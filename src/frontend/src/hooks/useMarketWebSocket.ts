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

// ─── Twelve Data WebSocket (XAU/USD) ─────────────────────────────────────────
const TWELVE_DATA_WS_URL =
  "wss://ws.twelvedata.com/v1/quotes/price?apikey=demo";
const XAU_SYMBOL = "XAU/USD";
// If no price tick arrives within 60s of subscribing, treat as market closed
const XAU_MARKET_CLOSED_TIMEOUT_MS = 60_000;
// Valid gold price range (USD per troy ounce)
const XAU_MIN_PRICE = 1000;
const XAU_MAX_PRICE = 10000;

interface TwelveDataPriceMessage {
  event: string;
  symbol?: string;
  price?: string;
  timestamp?: number;
  currency_base?: string;
  currency_quote?: string;
  exchange?: string;
  type?: string;
  day_volume?: number | null;
  status?: string;
}

export interface MarketWebSocketState {
  marketData: MarketAsset[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
  /** Timestamp (Date.now()) of last received price tick per symbol */
  lastTickTimes: Map<string, number>;
  /** True when XAU WebSocket is connected but no tick received within 60s — market closed */
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
  const [xauMarketClosed, setXauMarketClosed] = useState(false);

  // Connection is considered active once Binance is streaming.
  const isConnected = binanceConnected;

  // Refs for Binance WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Refs for Twelve Data WebSocket (XAU)
  const xauWsRef = useRef<WebSocket | null>(null);
  const xauReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const xauReconnectAttemptsRef = useRef(0);
  const xauClosedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xauSubscribedRef = useRef(false);

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

    setXauMarketClosed(false);

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

  // ─── Twelve Data WebSocket (XAU/USD) ───────────────────────────────────────
  const connectXau = useCallback(() => {
    if (unmountedRef.current) return;

    // Clean up any existing XAU socket
    if (xauWsRef.current) {
      xauWsRef.current.onopen = null;
      xauWsRef.current.onmessage = null;
      xauWsRef.current.onclose = null;
      xauWsRef.current.onerror = null;
      xauWsRef.current.close();
      xauWsRef.current = null;
    }
    xauSubscribedRef.current = false;

    const ws = new WebSocket(TWELVE_DATA_WS_URL);
    xauWsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      xauReconnectAttemptsRef.current = 0;
      xauSubscribedRef.current = true;

      // Subscribe to XAU/USD
      ws.send(
        JSON.stringify({
          action: "subscribe",
          params: { symbols: XAU_SYMBOL },
        }),
      );

      // Start market-closed detection timer: if no tick in 60s after subscribing
      if (xauClosedTimerRef.current) {
        clearTimeout(xauClosedTimerRef.current);
      }
      xauClosedTimerRef.current = setTimeout(() => {
        if (unmountedRef.current) return;
        // No tick arrived — market is closed
        setXauMarketClosed(true);
      }, XAU_MARKET_CLOSED_TIMEOUT_MS);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const msg: TwelveDataPriceMessage = JSON.parse(event.data as string);

        // Ignore heartbeats
        if (msg.event === "heartbeat") return;

        // Handle error/closed status
        if (
          msg.event === "subscribe-status" &&
          msg.status &&
          msg.status !== "ok"
        ) {
          setXauMarketClosed(true);
          return;
        }

        // Handle price updates
        if (
          msg.event === "price" &&
          msg.symbol === XAU_SYMBOL &&
          msg.price != null
        ) {
          const price = Number.parseFloat(msg.price);

          // Validate price is in sane range
          if (
            !Number.isFinite(price) ||
            price < XAU_MIN_PRICE ||
            price > XAU_MAX_PRICE
          ) {
            return;
          }

          // Clear the market-closed timeout since we got a tick
          if (xauClosedTimerRef.current) {
            clearTimeout(xauClosedTimerRef.current);
            xauClosedTimerRef.current = null;
          }

          pushXauTick(price);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror — handled there
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;

      const attempts = xauReconnectAttemptsRef.current;
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** attempts,
        MAX_RECONNECT_DELAY,
      );
      xauReconnectAttemptsRef.current = attempts + 1;

      xauReconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          connectXau();
        }
      }, delay);
    };
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

    // Start Binance stream (BTC + ETH)
    connect();

    // Start Twelve Data stream (XAU/USD)
    connectXau();

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

      // Clean up XAU (Twelve Data)
      if (xauReconnectTimerRef.current) {
        clearTimeout(xauReconnectTimerRef.current);
        xauReconnectTimerRef.current = null;
      }
      if (xauClosedTimerRef.current) {
        clearTimeout(xauClosedTimerRef.current);
        xauClosedTimerRef.current = null;
      }
      if (xauWsRef.current) {
        xauWsRef.current.onopen = null;
        xauWsRef.current.onmessage = null;
        xauWsRef.current.onclose = null;
        xauWsRef.current.onerror = null;
        xauWsRef.current.close();
        xauWsRef.current = null;
      }
    };
  }, [connect, connectXau]);

  return {
    marketData,
    isConnected,
    isConnecting,
    lastUpdate,
    lastTickTimes,
    xauMarketClosed,
  };
}
