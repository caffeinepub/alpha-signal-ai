import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle } from "./useBinanceKlines";

// ─── EUR/USD Hook ─────────────────────────────────────────────────────────────
// Polls the Frankfurter API every 30 seconds and builds synthetic candles
// for 3m and 15m timeframes. Each poll tick = one synthetic candle.

export interface EURUSDState {
  price: number;
  candles3m: Candle[];
  candles15m: Candle[];
  isConnected: boolean;
}

const API_URL = "https://api.frankfurter.app/latest?from=EUR&to=USD";
const POLL_INTERVAL = 30_000;
const MAX_CANDLES = 200;
const NOISE = 0.0002;

function makeSyntheticCandle(price: number, time: number): Candle {
  const half = NOISE;
  return {
    time,
    open: price - half * (Math.random() - 0.5),
    high: price + half * Math.random(),
    low: price - half * Math.random(),
    close: price,
    volume: 1,
    isClosed: true,
  };
}

export function useEURUSD(): EURUSDState {
  const [price, setPrice] = useState(0);
  const [candles3m, setCandles3m] = useState<Candle[]>([]);
  const [candles15m, setCandles15m] = useState<Candle[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const priceRef = useRef(0);
  const tickCountRef = useRef(0);
  const unmountedRef = useRef(false);

  const addCandle = useCallback((p: number) => {
    const now = Date.now();
    const candle = makeSyntheticCandle(p, now);
    tickCountRef.current += 1;

    setCandles3m((prev) => {
      const next = [...prev, candle];
      if (next.length > MAX_CANDLES) next.shift();
      return next;
    });

    if (tickCountRef.current % 5 === 0) {
      setCandles15m((prev) => {
        const next = [...prev, candle];
        if (next.length > MAX_CANDLES) next.shift();
        return next;
      });
    }
  }, []);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const p = data?.rates?.USD as number;
      if (p && p > 0) {
        priceRef.current = p;
        setPrice(p);
        setIsConnected(true);
        addCandle(p);
      }
    } catch {
      if (priceRef.current > 0) {
        addCandle(priceRef.current);
      }
    }
  }, [addCandle]);

  useEffect(() => {
    unmountedRef.current = false;
    fetchPrice();
    const id = setInterval(() => {
      if (!unmountedRef.current) fetchPrice();
    }, POLL_INTERVAL);

    return () => {
      unmountedRef.current = true;
      clearInterval(id);
    };
  }, [fetchPrice]);

  return { price, candles3m, candles15m, isConnected };
}
