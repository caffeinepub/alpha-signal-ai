import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketAsset } from "../backend.d";
import { useActor } from "./useActor";

const BINANCE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker";

const TWELVE_DATA_WS_URL =
  "wss://ws.twelvedata.com/v1/quotes/price?apikey=demo";

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

interface TwelveDataMessage {
  event: string;
  symbol?: string;
  price?: number;
  status?: string;
}

export interface MarketWebSocketState {
  marketData: MarketAsset[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

export function useMarketWebSocket(): MarketWebSocketState {
  const { actor, isFetching } = useActor();
  const [marketData, setMarketData] = useState<MarketAsset[]>([]);
  const [binanceConnected, setBinanceConnected] = useState(false);
  const [xauConnected, setXauConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Derived combined connection state
  const isConnected = binanceConnected && xauConnected;

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

  const unmountedRef = useRef(false);
  const initializedRef = useRef(false);

  // One-time backend fetch to seed all three assets (BTC, ETH, Gold)
  useEffect(() => {
    if (!actor || isFetching || initializedRef.current) return;
    initializedRef.current = true;
    actor.getMarketData().then((data) => {
      if (!unmountedRef.current) {
        setMarketData(data);
      }
    });
  }, [actor, isFetching]);

  // ─── Binance WebSocket (BTC + ETH) ───────────────────────────────────────
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
        const volume = Number.parseFloat(ticker.v) * price; // convert to USD volume
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
        setLastUpdate(new Date());
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnect
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setBinanceConnected(false);

      // Exponential backoff reconnect
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

  // ─── Twelve Data WebSocket (XAU/USD) ─────────────────────────────────────
  const connectXauWs = useCallback(() => {
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

    setXauConnected(false);

    const ws = new WebSocket(TWELVE_DATA_WS_URL);
    xauWsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      xauReconnectAttemptsRef.current = 0;

      // Subscribe to XAU/USD
      ws.send(
        JSON.stringify({
          action: "subscribe",
          params: { symbols: "XAU/USD" },
        }),
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const msg: TwelveDataMessage = JSON.parse(event.data as string);

        if (msg.event === "subscribe-status" && msg.status === "ok") {
          setXauConnected(true);
          return;
        }

        if (msg.event === "heartbeat") {
          // Keep connection alive — no action needed
          return;
        }

        if (
          msg.event === "price" &&
          msg.symbol === "XAU/USD" &&
          msg.price != null
        ) {
          const price = Number(msg.price);
          if (!Number.isFinite(price) || price <= 0) return;

          setMarketData((prev) => {
            const next = [...prev];
            const xauIdx = next.findIndex(
              (a) => a.symbol === "XAU" || a.symbol === "GOLD",
            );
            if (xauIdx < 0) {
              // No XAU entry yet — add one
              next.push({
                symbol: "XAU",
                name: "Gold",
                price,
                change24h: 0,
                volume: 0,
                high24h: price,
                low24h: price,
              });
            } else {
              const existing = next[xauIdx];
              if (!existing) return prev;
              next[xauIdx] = {
                ...existing,
                price,
                high24h:
                  existing.high24h > 0
                    ? Math.max(existing.high24h, price)
                    : price,
                low24h:
                  existing.low24h > 0
                    ? Math.min(existing.low24h, price)
                    : price,
              };
            }
            return next;
          });
          setLastUpdate(new Date());
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnect
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setXauConnected(false);

      // Exponential backoff reconnect
      const attempts = xauReconnectAttemptsRef.current;
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** attempts,
        MAX_RECONNECT_DELAY,
      );
      xauReconnectAttemptsRef.current = attempts + 1;

      xauReconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          connectXauWs();
        }
      }, delay);
    };
  }, []);

  // Connect both WebSockets on mount
  useEffect(() => {
    unmountedRef.current = false;
    connect();
    connectXauWs();

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

      // Clean up Twelve Data (XAU)
      if (xauReconnectTimerRef.current) {
        clearTimeout(xauReconnectTimerRef.current);
        xauReconnectTimerRef.current = null;
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
  }, [connect, connectXauWs]);

  return { marketData, isConnected, isConnecting, lastUpdate };
}
