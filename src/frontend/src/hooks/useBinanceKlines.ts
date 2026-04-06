import { useCallback, useEffect, useRef, useState } from "react";

// ─── Binance Kline/Candlestick WebSocket ─────────────────────────────────────
// Subscribes to BTC, PAXG (gold proxy), and EURUSDT kline streams for 3m and 15m.
// Accumulates rolling candle buffers for the SFI signal engine.

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
  candles3m_btc: Candle[];
  candles15m_btc: Candle[];
  candles3m_xau: Candle[];
  candles15m_xau: Candle[];
  candles3m_eurusd: Candle[];
  candles15m_eurusd: Candle[];
  // Backward-compat aliases used by legacy hooks
  candles1m: Candle[];
  candles3m: Candle[];
  lastCandleClose1m: number;
  lastCandleClose3m: number;
  isConnected: boolean;
  lastTickTime: number;
}

const KLINE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@kline_3m/btcusdt@kline_15m/paxgusdt@kline_3m/paxgusdt@kline_15m/eurusdt@kline_3m/eurusdt@kline_15m";

const MAX_CANDLES = 200;
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

interface BinanceKlineData {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  x: boolean;
  i: string;
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
  const [candles3m_btc, setCandles3mBtc] = useState<Candle[]>([]);
  const [lastCandleClose3m, setLastCandleClose3m] = useState(0);
  const [candles15m_btc, setCandles15mBtc] = useState<Candle[]>([]);
  const [candles3m_xau, setCandles3mXau] = useState<Candle[]>([]);
  const [candles15m_xau, setCandles15mXau] = useState<Candle[]>([]);
  const [candles3m_eurusd, setCandles3mEurusd] = useState<Candle[]>([]);
  const [candles15m_eurusd, setCandles15mEurusd] = useState<Candle[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastTickTime, setLastTickTime] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const unmountedRef = useRef(false);

  // REST seed: fetch historical candles on mount so RSI/SFI works immediately
  const seedFromREST = useCallback(async () => {
    try {
      const pairs = [
        { symbol: "BTCUSDT", interval: "3m", set: setCandles3mBtc },
        { symbol: "BTCUSDT", interval: "15m", set: setCandles15mBtc },
        { symbol: "PAXGUSDT", interval: "3m", set: setCandles3mXau },
        { symbol: "PAXGUSDT", interval: "15m", set: setCandles15mXau },
        { symbol: "EURUSDT", interval: "3m", set: setCandles3mEurusd },
        { symbol: "EURUSDT", interval: "15m", set: setCandles15mEurusd },
      ];
      await Promise.all(
        pairs.map(async ({ symbol, interval, set }) => {
          const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`,
          );
          if (!res.ok) return;
          const rows: [
            number,
            string,
            string,
            string,
            string,
            string,
            ...unknown[],
          ][] = await res.json();
          const candles: Candle[] = rows.map((r) => ({
            time: r[0],
            open: Number.parseFloat(r[1]),
            high: Number.parseFloat(r[2]),
            low: Number.parseFloat(r[3]),
            close: Number.parseFloat(r[4]),
            volume: Number.parseFloat(r[5]),
            isClosed: true,
          }));
          set(candles);
        }),
      );
    } catch {}
  }, []);

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
        const symbol = msg.data.s.toUpperCase();
        const candle = parseCandle(k);

        setLastTickTime(Date.now());

        if (symbol === "BTCUSDT") {
          if (k.i === "3m") {
            setCandles3mBtc((prev) => upsertCandle(prev, candle));
            if (k.x) setLastCandleClose3m(Date.now());
          } else if (k.i === "15m") {
            setCandles15mBtc((prev) => upsertCandle(prev, candle));
          }
        } else if (symbol === "PAXGUSDT") {
          if (k.i === "3m") {
            setCandles3mXau((prev) => upsertCandle(prev, candle));
          } else if (k.i === "15m") {
            setCandles15mXau((prev) => upsertCandle(prev, candle));
          }
        } else if (symbol === "EURUSDT") {
          if (k.i === "3m") {
            setCandles3mEurusd((prev) => upsertCandle(prev, candle));
          } else if (k.i === "15m") {
            setCandles15mEurusd((prev) => upsertCandle(prev, candle));
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
    // Seed initial candle data from REST so RSI/SFI calculates immediately
    seedFromREST();
    // Also refresh every 15 seconds so prices stay live
    const refreshInterval = setInterval(() => {
      if (!unmountedRef.current) seedFromREST();
    }, 15000);

    return () => {
      unmountedRef.current = true;
      clearInterval(refreshInterval);
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
  }, [connect, seedFromREST]);

  return {
    candles3m_btc,
    candles15m_btc,
    candles3m_xau,
    candles15m_xau,
    candles3m_eurusd,
    candles15m_eurusd,
    // Backward-compat: alias BTC 3m as the legacy candles3m
    candles1m: candles3m_btc,
    candles3m: candles3m_btc,
    lastCandleClose1m: lastCandleClose3m,
    lastCandleClose3m,
    isConnected,
    lastTickTime,
  };
}
