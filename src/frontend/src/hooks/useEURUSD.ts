import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle } from "./useBinanceKlines";

// ─── EUR/USD Hook ─────────────────────────────────────────────────────────────
// Uses Binance EURUSDT klines REST API for proper OHLC data.
// Fetches 200-candle history on mount and refreshes every 15 seconds.

export interface EURUSDState {
  price: number;
  candles3m: Candle[];
  candles15m: Candle[];
  isConnected: boolean;
}

const MAX_CANDLES = 200;
const POLL_INTERVAL = 15_000;

type KlineRow = [number, string, string, string, string, string, ...unknown[]];

function parseKlines(rows: KlineRow[]): Candle[] {
  return rows.map((r) => ({
    time: r[0],
    open: Number.parseFloat(r[1]),
    high: Number.parseFloat(r[2]),
    low: Number.parseFloat(r[3]),
    close: Number.parseFloat(r[4]),
    volume: Number.parseFloat(r[5]),
    isClosed: true,
  }));
}

export function useEURUSD(): EURUSDState {
  const [price, setPrice] = useState(0);
  const [candles3m, setCandles3m] = useState<Candle[]>([]);
  const [candles15m, setCandles15m] = useState<Candle[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const unmountedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (unmountedRef.current) return;
    try {
      const [res3m, res15m] = await Promise.all([
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=EURUSDT&interval=3m&limit=${MAX_CANDLES}`,
        ),
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=EURUSDT&interval=15m&limit=${MAX_CANDLES}`,
        ),
      ]);

      if (!res3m.ok || !res15m.ok)
        throw new Error("Binance EURUSDT fetch error");

      const [rows3m, rows15m] = (await Promise.all([
        res3m.json(),
        res15m.json(),
      ])) as [KlineRow[], KlineRow[]];

      if (unmountedRef.current) return;

      const c3m = parseKlines(rows3m);
      const c15m = parseKlines(rows15m);

      setCandles3m(c3m);
      setCandles15m(c15m);

      const lastClose = c3m[c3m.length - 1]?.close ?? 0;
      if (lastClose > 0) {
        setPrice(lastClose);
        setIsConnected(true);
      }
    } catch (err) {
      console.warn("[EUR/USD] Binance EURUSDT fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    fetchData();
    const id = setInterval(() => {
      if (!unmountedRef.current) fetchData();
    }, POLL_INTERVAL);

    return () => {
      unmountedRef.current = true;
      clearInterval(id);
    };
  }, [fetchData]);

  return { price, candles3m, candles15m, isConnected };
}
