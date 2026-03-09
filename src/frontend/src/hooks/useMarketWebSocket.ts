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

// ─── Gold Market Hours ────────────────────────────────────────────────────────
// XAUUSD / Forex market is open Monday 00:00 UTC through Friday 22:00 UTC
// Closed: Friday 22:00 UTC → Sunday 23:00 UTC (approx)
function isGoldMarketOpen(): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcTimeMinutes = utcHour * 60 + utcMinute;

  // Saturday: always closed
  if (utcDay === 6) return false;
  // Sunday: closed until ~22:00 UTC (NY open on Sunday evening US time)
  if (utcDay === 0 && utcTimeMinutes < 22 * 60) return false;
  // Friday: closes at 22:00 UTC
  if (utcDay === 5 && utcTimeMinutes >= 22 * 60) return false;

  return true;
}

// ─── TwelveData REST (XAU/USD) ────────────────────────────────────────────────
// Uses the free-tier REST endpoint — no API key needed for basic quote.
// We poll every 2 seconds when the market is open.
const TWELVE_DATA_REST_URL =
  "https://api.twelvedata.com/price?symbol=XAU/USD&apikey=demo";

// Valid gold price range (USD per troy ounce)
const XAU_MIN_PRICE = 1000;
const XAU_MAX_PRICE = 10000;

// How often to poll TwelveData (ms)
const XAU_POLL_INTERVAL_MS = 2000;

export interface MarketWebSocketState {
  marketData: MarketAsset[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
  /** Timestamp (Date.now()) of last received price tick per symbol */
  lastTickTimes: Map<string, number>;
  /** True when the gold forex market is closed (weekend / after hours) */
  xauMarketClosed: boolean;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

export function useMarketWebSocket(): MarketWebSocketState {
  const { actor, isFetching } = useActor();
  const [marketData, setMarketData] = useState<MarketAsset[]>([]);
  const [binanceConnected, setBinanceConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastTickTimes, setLastTickTimes] = useState<Map<string, number>>(
    new Map(),
  );
  const [xauMarketClosed, setXauMarketClosed] = useState(!isGoldMarketOpen());

  // Connection is considered active once Binance is streaming.
  const isConnected = binanceConnected;

  // Refs for Binance WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Refs for XAU polling
  const xauPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xauFetchingRef = useRef(false);

  const unmountedRef = useRef(false);
  const initializedRef = useRef(false);

  // XAU running high/low refs
  const xauPriceRef = useRef<number>(0);
  const xauHigh24hRef = useRef<number>(0);
  const xauLow24hRef = useRef<number>(0);

  // ─── One-time backend seed ──────────────────────────────────────────────────
  useEffect(() => {
    if (!actor || isFetching || initializedRef.current) return;
    initializedRef.current = true;
    actor.getMarketData().then((data) => {
      if (unmountedRef.current) return;
      setMarketData(data);
      // Seed XAU refs from backend data as fallback initial state
      const xau = data.find((a) => a.symbol === "XAU" || a.symbol === "GOLD");
      if (xau) {
        xauPriceRef.current = xau.price;
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
        change24h: 0,
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

  // ─── TwelveData REST polling (XAU/USD) ─────────────────────────────────────
  const fetchXauPrice = useCallback(async () => {
    if (unmountedRef.current || xauFetchingRef.current) return;
    xauFetchingRef.current = true;

    try {
      const response = await fetch(TWELVE_DATA_REST_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        price?: string;
        status?: string;
        message?: string;
      };

      // Handle API errors (e.g. rate limit, market closed)
      if (data.status === "error") {
        // Market may be closed or API quota hit — don't update price
        return;
      }

      if (data.price != null) {
        const price = Number.parseFloat(data.price);
        if (
          Number.isFinite(price) &&
          price >= XAU_MIN_PRICE &&
          price <= XAU_MAX_PRICE
        ) {
          pushXauTick(price);
        }
      }
    } catch {
      // Network error or CORS — silently ignore, will retry next cycle
    } finally {
      xauFetchingRef.current = false;
    }
  }, [pushXauTick]);

  // ─── XAU polling scheduler ──────────────────────────────────────────────────
  const scheduleXauPoll = useCallback(() => {
    if (unmountedRef.current) return;

    const marketOpen = isGoldMarketOpen();
    setXauMarketClosed(!marketOpen);

    if (marketOpen) {
      // Fire immediately, then schedule next poll
      fetchXauPrice().then(() => {
        if (!unmountedRef.current) {
          xauPollTimerRef.current = setTimeout(
            scheduleXauPoll,
            XAU_POLL_INTERVAL_MS,
          );
        }
      });
    } else {
      // Market closed: check again every 60 seconds to detect market open
      xauPollTimerRef.current = setTimeout(scheduleXauPoll, 60_000);
    }
  }, [fetchXauPrice]);

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

    // Start Binance stream (BTC + ETH) — unchanged
    connect();

    // Start XAU polling (TwelveData REST)
    scheduleXauPoll();

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

      // Clean up XAU polling
      if (xauPollTimerRef.current) {
        clearTimeout(xauPollTimerRef.current);
        xauPollTimerRef.current = null;
      }
    };
  }, [connect, scheduleXauPoll]);

  return {
    marketData,
    isConnected,
    isConnecting,
    lastUpdate,
    lastTickTimes,
    xauMarketClosed,
  };
}
