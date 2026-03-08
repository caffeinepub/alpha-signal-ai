import { useCallback, useEffect, useRef, useState } from "react";

// ─── Binance Kline/Candlestick WebSocket ─────────────────────────────────────
// Subscribes to btcusdt@kline_1m and btcusdt@kline_3m streams.
// Accumulates rolling candle buffers and fires onCandleClose callbacks.

export interface Candle {
  time: number; // open time (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface BinanceKlinesState {
  candles1m: Candle[];
  candles3m: Candle[];
  lastCandleClose1m: number; // timestamp of last closed 1m candle
  lastCandleClose3m: number; // timestamp of last closed 3m candle
  isConnected: boolean;
  lastTickTime: number; // last received message timestamp
}

const KLINE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@kline_3m";

const MAX_CANDLES = 200;
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

interface BinanceKlineData {
  t: number; // kline start time
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
  x: boolean; // is this kline closed?
  i: string; // interval
}

interface BinanceKlineMsg {
  stream: string;
  data: {
    e: string;
    E: number;
    s: string;
    k: BinanceKlineData;
  };
}

function parseCandle(k: BinanceKlineData): Candle {
  return {
    time: k.t,
    open: Number.parseFloat(k.o),
    high: Number.parseFloat(k.h),
    low: Number.parseFloat(k.l),
    close: Number.parseFloat(k.c),
    volume: Number.parseFloat(k.v),
    isClosed: k.x,
  };
}

function upsertCandle(candles: Candle[], candle: Candle): Candle[] {
  const next = [...candles];
  const idx = next.findIndex((c) => c.time === candle.time);
  if (idx >= 0) {
    next[idx] = candle;
  } else {
    next.push(candle);
    if (next.length > MAX_CANDLES) next.shift();
  }
  return next;
}

export function useBinanceKlines(): BinanceKlinesState {
  const [candles1m, setCandles1m] = useState<Candle[]>([]);
  const [candles3m, setCandles3m] = useState<Candle[]>([]);
  const [lastCandleClose1m, setLastCandleClose1m] = useState(0);
  const [lastCandleClose3m, setLastCandleClose3m] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastTickTime, setLastTickTime] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const unmountedRef = useRef(false);

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

    const ws = new WebSocket(KLINE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const msg: BinanceKlineMsg = JSON.parse(event.data as string);
        const k = msg.data.k;
        const candle = parseCandle(k);

        setLastTickTime(Date.now());

        if (k.i === "1m") {
          setCandles1m((prev) => upsertCandle(prev, candle));
          if (k.x) {
            setLastCandleClose1m(Date.now());
          }
        } else if (k.i === "3m") {
          setCandles3m((prev) => upsertCandle(prev, candle));
          if (k.x) {
            setLastCandleClose3m(Date.now());
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      /* onclose handles reconnect */
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setIsConnected(false);

      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** attempts,
        MAX_RECONNECT_DELAY,
      );
      reconnectAttemptsRef.current = attempts + 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) connect();
      }, delay);
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
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
    candles1m,
    candles3m,
    lastCandleClose1m,
    lastCandleClose3m,
    isConnected,
    lastTickTime,
  };
}
