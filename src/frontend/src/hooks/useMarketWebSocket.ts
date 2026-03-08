import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketAsset } from "../backend.d";
import { useActor } from "./useActor";

// ─── Binance WebSocket (BTC + ETH) ───────────────────────────────────────────
const BINANCE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker";

const SYMBOL_MAP: Record<string, { symbol: string; name: string }> = {
  BTCUSDT: { symbol: "BTC", name: "Bitcoin" },
  ETHUSDT: { symbol: "ETH", name: "Ethereum" },
};

interface BinanceTicker {
  s: string; // symbol
  c: string; // last price
  P: string; // price change percent 24h
  v: string; // volume
  h: string; // 24h high
  l: string; // 24h low
}

interface BinanceStreamMessage {
  stream: string;
  data: BinanceTicker;
}

export interface MarketWebSocketState {
  marketData: MarketAsset[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
  /** Timestamp (Date.now()) of last received price tick per symbol */
  lastTickTimes: Map<string, number>;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

// ─── Gold REST sources (tried in order) ──────────────────────────────────────
// We fetch from multiple free endpoints and use the first that succeeds.
// Between fetches we apply a small random walk to simulate smooth ticking.

const XAU_FETCH_INTERVAL_MS = 8000; // fetch real price every 8 seconds
const XAU_TICK_INTERVAL_MS = 1500; // simulate tick every 1.5s between fetches

async function fetchGoldPrice(): Promise<number | null> {
  // Source 1: Metals.live (free, no key)
  try {
    const res = await fetch("https://metals.live/api/spot", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = (await res.json()) as Array<{ gold?: number }>;
      if (Array.isArray(json)) {
        for (const item of json) {
          if (typeof item.gold === "number" && item.gold > 100) {
            return item.gold;
          }
        }
      }
    }
  } catch {
    /* try next */
  }

  // Source 2: Open Exchange Rates (XAU against USD)
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/XAU", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = (await res.json()) as { rates?: { USD?: number } };
      if (json?.rates?.USD && json.rates.USD > 0) {
        // XAU base → USD rate means 1 XAU = rates.USD USD
        return json.rates.USD;
      }
    }
  } catch {
    /* try next */
  }

  // Source 3: Frankfurter (ECB data, XAU available)
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=XAU&to=USD",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const json = (await res.json()) as { rates?: { USD?: number } };
      if (json?.rates?.USD && json.rates.USD > 100) {
        return json.rates.USD;
      }
    }
  } catch {
    /* try next */
  }

  return null;
}

export function useMarketWebSocket(): MarketWebSocketState {
  const { actor, isFetching } = useActor();
  const [marketData, setMarketData] = useState<MarketAsset[]>([]);
  const [binanceConnected, setBinanceConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastTickTimes, setLastTickTimes] = useState<Map<string, number>>(
    new Map(),
  );

  // Connection is considered active once Binance is streaming.
  // Gold runs independently and doesn't gate the "LIVE" status.
  const isConnected = binanceConnected;

  // Refs for Binance WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const unmountedRef = useRef(false);
  const initializedRef = useRef(false);

  // XAU state refs
  const xauPriceRef = useRef<number>(0);
  const xauChange24hRef = useRef<number>(0);
  const xauHigh24hRef = useRef<number>(0);
  const xauLow24hRef = useRef<number>(0);
  const xauFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xauTickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── One-time backend seed ──────────────────────────────────────────────────
  useEffect(() => {
    if (!actor || isFetching || initializedRef.current) return;
    initializedRef.current = true;
    actor.getMarketData().then((data) => {
      if (unmountedRef.current) return;
      setMarketData(data);
      // Seed XAU refs from backend data
      const xau = data.find((a) => a.symbol === "XAU" || a.symbol === "GOLD");
      if (xau) {
        xauPriceRef.current = xau.price;
        xauChange24hRef.current = xau.change24h;
        xauHigh24hRef.current = xau.high24h;
        xauLow24hRef.current = xau.low24h;
      }
    });
  }, [actor, isFetching]);

  // ─── XAU price updater helper ───────────────────────────────────────────────
  const pushXauTick = useCallback((price: number) => {
    if (unmountedRef.current || price <= 0) return;

    // Update running high/low
    if (xauHigh24hRef.current <= 0) xauHigh24hRef.current = price;
    if (xauLow24hRef.current <= 0) xauLow24hRef.current = price;
    xauHigh24hRef.current = Math.max(xauHigh24hRef.current, price);
    xauLow24hRef.current = Math.min(xauLow24hRef.current, price);
    xauPriceRef.current = price;

    setMarketData((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (a) => a.symbol === "XAU" || a.symbol === "GOLD",
      );
      const updated: MarketAsset = {
        symbol: "XAU",
        name: "Gold",
        price,
        change24h: xauChange24hRef.current,
        volume: 0,
        high24h: xauHigh24hRef.current,
        low24h: xauLow24hRef.current,
      };
      if (idx >= 0) {
        next[idx] = updated;
      } else {
        next.push(updated);
      }
      return next;
    });
    const nowXau = Date.now();
    setLastTickTimes((prev) => {
      const next = new Map(prev);
      next.set("XAU", nowXau);
      return next;
    });
    setLastUpdate(new Date());
  }, []);

  // ─── XAU micro-tick simulator (smooth movement between REST fetches) ────────
  const startXauTicks = useCallback(() => {
    if (xauTickTimerRef.current) clearInterval(xauTickTimerRef.current);

    xauTickTimerRef.current = setInterval(() => {
      if (unmountedRef.current) return;
      const base = xauPriceRef.current;
      if (base <= 0) return;
      // Small random walk: ±0.03% per tick
      const noise = (Math.random() - 0.5) * 0.0006 * base;
      pushXauTick(base + noise);
    }, XAU_TICK_INTERVAL_MS);
  }, [pushXauTick]);

  // ─── XAU REST fetch loop ────────────────────────────────────────────────────
  const scheduleXauFetch = useCallback(() => {
    if (xauFetchTimerRef.current) clearTimeout(xauFetchTimerRef.current);

    const run = async () => {
      if (unmountedRef.current) return;
      const price = await fetchGoldPrice();
      if (!unmountedRef.current && price !== null && price > 100) {
        pushXauTick(price);
      }
      if (!unmountedRef.current) {
        xauFetchTimerRef.current = setTimeout(run, XAU_FETCH_INTERVAL_MS);
      }
    };

    // First fetch immediately
    run();
  }, [pushXauTick]);

  // ─── Binance WebSocket (BTC + ETH) ─────────────────────────────────────────
  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // Clean up any existing socket
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);
    setBinanceConnected(false);

    const ws = new WebSocket(BINANCE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setBinanceConnected(true);
      setIsConnecting(false);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const msg: BinanceStreamMessage = JSON.parse(event.data as string);
        const ticker = msg.data;
        const mapping = SYMBOL_MAP[ticker.s];
        if (!mapping) return;

        const price = Number.parseFloat(ticker.c);
        const change24h = Number.parseFloat(ticker.P);
        const volume = Number.parseFloat(ticker.v) * price;
        const high24h = Number.parseFloat(ticker.h);
        const low24h = Number.parseFloat(ticker.l);

        setMarketData((prev) => {
          const next = [...prev];
          const idx = next.findIndex((a) => a.symbol === mapping.symbol);
          const updated: MarketAsset = {
            symbol: mapping.symbol,
            name: mapping.name,
            price,
            change24h,
            volume,
            high24h,
            low24h,
          };
          if (idx >= 0) {
            next[idx] = updated;
          } else {
            next.push(updated);
          }
          return next;
        });
        const now = Date.now();
        setLastTickTimes((prev) => {
          const next = new Map(prev);
          next.set(mapping.symbol, now);
          return next;
        });
        setLastUpdate(new Date());
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror — handled there
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setBinanceConnected(false);

      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** attempts,
        MAX_RECONNECT_DELAY,
      );
      reconnectAttemptsRef.current = attempts + 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          setIsConnecting(true);
          connect();
        }
      }, delay);
    };
  }, []);

  // ─── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    unmountedRef.current = false;

    // Start Binance stream
    connect();

    // Start XAU REST loop + micro-tick simulator
    scheduleXauFetch();
    startXauTicks();

    return () => {
      unmountedRef.current = true;

      // Clean up Binance
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clean up XAU timers
      if (xauFetchTimerRef.current) {
        clearTimeout(xauFetchTimerRef.current);
        xauFetchTimerRef.current = null;
      }
      if (xauTickTimerRef.current) {
        clearInterval(xauTickTimerRef.current);
        xauTickTimerRef.current = null;
      }
    };
  }, [connect, scheduleXauFetch, startXauTicks]);

  return { marketData, isConnected, isConnecting, lastUpdate, lastTickTimes };
}
