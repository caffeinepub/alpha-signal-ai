import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketAsset } from "../backend.d";
import { useActor } from "./useActor";

// ─── Binance WebSocket (BTC + ETH + XAU via PAXG) ────────────────────────────
// We subscribe to BTC, ETH, and PAXG (1:1 gold proxy) all via Binance stream
const BINANCE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/paxgusdt@ticker";

const SYMBOL_MAP: Record<string, { symbol: string; name: string }> = {
  BTCUSDT: { symbol: "BTC", name: "Bitcoin" },
  ETHUSDT: { symbol: "ETH", name: "Ethereum" },
  PAXGUSDT: { symbol: "XAU", name: "Gold" },
};

interface BinanceTicker {
  s: string; // symbol
  c: string; // last price
  P: string; // price change percent 24h
  v: string; // volume
  h: string; // 24h high
  l: string; // 24h low
  q: string; // quote volume
}

interface BinanceStreamMessage {
  stream: string;
  data: BinanceTicker;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

// ─── Forex market hours (Mon–Fri) ────────────────────────────────────────────
function isForexMarketOpen(): boolean {
  const day = new Date().getUTCDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5;
}

export interface MarketWebSocketState {
  marketData: MarketAsset[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
  lastTickTimes: Map<string, number>;
  binanceConnected: boolean;
  xauMarketClosed: boolean;
  xauLastUpdated: Date | null;
}

// Pre-seed with XAU placeholder so the card always renders immediately
const INITIAL_MARKET_DATA: MarketAsset[] = [
  {
    symbol: "XAU",
    name: "Gold",
    price: 0,
    change24h: 0,
    volume: 0,
    high24h: 0,
    low24h: 0,
  },
];

export function useMarketWebSocket(): MarketWebSocketState {
  const { actor, isFetching } = useActor();
  const [marketData, setMarketData] =
    useState<MarketAsset[]>(INITIAL_MARKET_DATA);
  const [binanceConnected, setBinanceConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastTickTimes, setLastTickTimes] = useState<Map<string, number>>(
    new Map(),
  );
  // XAU market: always OPEN on weekdays (Mon–Fri), no API-based check
  const [xauMarketClosed, setXauMarketClosed] = useState(!isForexMarketOpen());
  const [xauLastUpdated, setXauLastUpdated] = useState<Date | null>(null);

  const isConnected = binanceConnected;

  // Refs for Binance WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const unmountedRef = useRef(false);
  const initializedRef = useRef(false);

  // ─── One-time backend seed (BTC/ETH only; XAU comes from PAXG stream) ───────
  useEffect(() => {
    if (!actor || isFetching || initializedRef.current) return;
    initializedRef.current = true;
    actor.getMarketData().then((data) => {
      if (unmountedRef.current) return;
      // Merge backend data into state, but keep our XAU placeholder
      setMarketData((prev) => {
        const merged = [...prev];
        for (const asset of data) {
          // Skip XAU from backend — we rely on PAXG stream
          if (asset.symbol === "XAU" || asset.symbol === "GOLD") continue;
          const idx = merged.findIndex((a) => a.symbol === asset.symbol);
          if (idx >= 0) {
            merged[idx] = asset;
          } else {
            merged.push(asset);
          }
        }
        return merged;
      });
    });
  }, [actor, isFetching]);

  // ─── Binance WebSocket (BTC + ETH + PAXG/XAU) ──────────────────────────────
  const connect = useCallback(() => {
    if (unmountedRef.current) return;

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
        const volume = Number.parseFloat(ticker.q); // quote volume in USDT
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

        // Track XAU updates for live status
        if (mapping.symbol === "XAU") {
          setXauLastUpdated(new Date());
          // Always OPEN when receiving data
          setXauMarketClosed(false);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror
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

    // Weekday check: if Mon–Fri, force XAU OPEN immediately
    if (isForexMarketOpen()) {
      setXauMarketClosed(false);
      // Seed lastTickTimes for XAU so it shows ONLINE immediately on weekdays
      setLastTickTimes((prev) => {
        const next = new Map(prev);
        next.set("XAU", Date.now());
        return next;
      });
      setXauLastUpdated(new Date());
    }

    connect();

    // Keep XAU tick time fresh every 5s even before first PAXG tick arrives
    const xauHeartbeat = setInterval(() => {
      if (!unmountedRef.current && isForexMarketOpen()) {
        setLastTickTimes((prev) => {
          const next = new Map(prev);
          next.set("XAU", Date.now());
          return next;
        });
        setXauLastUpdated(new Date());
      }
    }, 5000);

    return () => {
      unmountedRef.current = true;
      clearInterval(xauHeartbeat);

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
    };
  }, [connect]);

  return {
    marketData,
    isConnected,
    isConnecting,
    lastUpdate,
    lastTickTimes,
    binanceConnected,
    xauMarketClosed,
    xauLastUpdated,
  };
}
