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

// ─── Yahoo Finance REST (XAU/USD) ─────────────────────────────────────────────
// Uses the public Yahoo Finance chart endpoint — no API key required.
const YAHOO_XAU_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX?interval=1m&range=1d";

// Valid gold price range (USD per troy ounce)
const XAU_MIN_PRICE = 1000;
const XAU_MAX_PRICE = 10000;

// How often to poll Yahoo Finance (ms)
const XAU_POLL_INTERVAL_MS = 3000;

export interface MarketWebSocketState {
  marketData: MarketAsset[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
  /** Timestamp (Date.now()) of last received price tick per symbol */
  lastTickTimes: Map<string, number>;
  /** True when the gold price could not be fetched */
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
  // xauMarketClosed = true when Yahoo Finance returns no valid price
  const [xauMarketClosed, setXauMarketClosed] = useState(false);

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

  // ─── Yahoo Finance REST polling (XAUUSD=X) ──────────────────────────────────
  const fetchXauPrice = useCallback(async () => {
    if (unmountedRef.current || xauFetchingRef.current) return;
    xauFetchingRef.current = true;

    try {
      const response = await fetch(YAHOO_XAU_URL, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = (await response.json()) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; previousClose?: number };
          }>;
          error?: { code?: string; description?: string } | null;
        };
      };

      const result = json?.chart?.result?.[0];
      const price = result?.meta?.regularMarketPrice;

      if (
        price != null &&
        Number.isFinite(price) &&
        price >= XAU_MIN_PRICE &&
        price <= XAU_MAX_PRICE
      ) {
        // Valid price received → market is LIVE
        setXauMarketClosed(false);
        pushXauTick(price);
      } else {
        // No valid price in response → OFFLINE
        setXauMarketClosed(true);
      }
    } catch {
      // Network error — show OFFLINE
      setXauMarketClosed(true);
    } finally {
      xauFetchingRef.current = false;
    }
  }, [pushXauTick]);

  // ─── XAU polling scheduler ──────────────────────────────────────────────────
  const scheduleXauPoll = useCallback(() => {
    if (unmountedRef.current) return;

    fetchXauPrice().then(() => {
      if (!unmountedRef.current) {
        xauPollTimerRef.current = setTimeout(
          scheduleXauPoll,
          XAU_POLL_INTERVAL_MS,
        );
      }
    });
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

    // Start XAU polling (Yahoo Finance REST)
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
