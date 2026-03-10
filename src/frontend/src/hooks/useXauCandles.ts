import { useEffect, useRef, useState } from "react";
import type { Candle } from "./useBinanceKlines";

const MAX_TICKS = 300;
const CANDLE_INTERVAL = 60 * 1000; // 1 minute synthetic candles

export function useXauCandles(currentPrice: number) {
  const ticksRef = useRef<{ time: number; price: number }[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const lastCandleTimeRef = useRef<number>(0);
  const prevLengthRef = useRef<number>(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional price-only dep
  useEffect(() => {
    if (currentPrice === 0) return;

    const now = Date.now();
    ticksRef.current = [
      ...ticksRef.current.slice(-MAX_TICKS + 1),
      { time: now, price: currentPrice },
    ];

    const ticks = ticksRef.current;
    if (ticks.length < 2) return;

    const candleMap = new Map<number, Candle>();

    for (const tick of ticks) {
      const candleStart =
        Math.floor(tick.time / CANDLE_INTERVAL) * CANDLE_INTERVAL;
      const existing = candleMap.get(candleStart);
      if (!existing) {
        candleMap.set(candleStart, {
          time: candleStart,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: 1,
        });
      } else {
        candleMap.set(candleStart, {
          ...existing,
          high: Math.max(existing.high, tick.price),
          low: Math.min(existing.low, tick.price),
          close: tick.price,
          volume: existing.volume + 1,
        });
      }
    }

    const sorted = Array.from(candleMap.values()).sort(
      (a, b) => a.time - b.time,
    );
    const lastCandleTime =
      sorted.length > 0 ? sorted[sorted.length - 1].time : 0;
    if (
      lastCandleTime > lastCandleTimeRef.current ||
      sorted.length !== prevLengthRef.current
    ) {
      lastCandleTimeRef.current = lastCandleTime;
      prevLengthRef.current = sorted.length;
      setCandles(sorted);
    }
  }, [currentPrice]);

  return candles;
}
