import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle } from "./useBinanceKlines";

export type SignalType = "BUY" | "SELL" | "WAIT";

export interface SignalResult {
  type: SignalType;
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  lockedAt: number;
  lockedUntil: number;
  ema10: number;
  ema20: number;
  ema50: number;
  ema200: number;
  supertrendBullish: boolean;
  atr: number;
}

const LOCK_DURATION = 3 * 60 * 1000; // 3 minutes

function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcATR(candles: Candle[], period: number): number[] {
  if (candles.length < 2) return [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return [];
  const result: number[] = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

function calcSupertrend(
  candles: Candle[],
  period = 10,
  multiplier = 3.0,
): { direction: number; upperBand: number; lowerBand: number }[] {
  const atrs = calcATR(candles, period);
  if (atrs.length === 0) return [];

  const offset = candles.length - atrs.length;
  const results: { direction: number; upperBand: number; lowerBand: number }[] =
    [];

  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let direction = 1;

  for (let i = 0; i < atrs.length; i++) {
    const ci = i + offset;
    const hl2 = (candles[ci].high + candles[ci].low) / 2;
    const atr = atrs[i];

    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    const upperBand =
      i === 0
        ? basicUpper
        : basicUpper < prevUpperBand || candles[ci - 1].close > prevUpperBand
          ? basicUpper
          : prevUpperBand;

    const lowerBand =
      i === 0
        ? basicLower
        : basicLower > prevLowerBand || candles[ci - 1].close < prevLowerBand
          ? basicLower
          : prevLowerBand;

    if (i > 0) {
      if (direction === -1 && candles[ci].close > upperBand) {
        direction = 1;
      } else if (direction === 1 && candles[ci].close < lowerBand) {
        direction = -1;
      }
    }

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    results.push({ direction, upperBand, lowerBand });
  }

  return results;
}

export function computeSignal(
  candles: Candle[],
  currentPrice: number,
  symbol: string,
): Omit<SignalResult, "lockedAt" | "lockedUntil"> | null {
  if (candles.length < 210) return null;

  const closes = candles.map((c) => c.close);

  const ema10Arr = calcEMA(closes, 10);
  const ema20Arr = calcEMA(closes, 20);
  const ema50Arr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);

  if (
    ema10Arr.length < 2 ||
    ema20Arr.length < 2 ||
    ema50Arr.length < 1 ||
    ema200Arr.length < 1
  )
    return null;

  const ema10 = ema10Arr[ema10Arr.length - 1];
  const ema10Prev = ema10Arr[ema10Arr.length - 2];
  const ema20 = ema20Arr[ema20Arr.length - 1];
  const ema20Prev = ema20Arr[ema20Arr.length - 2];
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const ema200 = ema200Arr[ema200Arr.length - 1];

  const stResults = calcSupertrend(candles, 10, 3.0);
  const st = stResults[stResults.length - 1];
  if (!st) return null;

  const atrs = calcATR(candles, 10);
  const atr = atrs[atrs.length - 1] || 1;

  const bullCross = ema10 > ema20 && ema10Prev <= ema20Prev;
  const bearCross = ema10 < ema20 && ema10Prev >= ema20Prev;
  const priceAboveEma50 = currentPrice > ema50;
  const priceBelowEma50 = currentPrice < ema50;
  const ema50AboveEma200 = ema50 > ema200;
  const ema50BelowEma200 = ema50 < ema200;
  const stBullish = st.direction === 1;
  const stBearish = st.direction === -1;

  const buyConditions = [
    bullCross,
    priceAboveEma50,
    ema50AboveEma200,
    stBullish,
  ];
  const sellConditions = [
    bearCross,
    priceBelowEma50,
    ema50BelowEma200,
    stBearish,
  ];
  const buyCount = buyConditions.filter(Boolean).length;
  const sellCount = sellConditions.filter(Boolean).length;

  let type: SignalType = "WAIT";
  let confidence = 0;

  if (buyConditions.every(Boolean)) {
    type = "BUY";
    confidence = 70 + buyCount * 7.5;
  } else if (sellConditions.every(Boolean)) {
    type = "SELL";
    confidence = 70 + sellCount * 7.5;
  } else {
    // Partial confidence
    confidence = Math.max(buyCount, sellCount) * 20;
  }

  const entry = currentPrice;
  const sl = type === "BUY" ? entry - 1.5 * atr : entry + 1.5 * atr;
  const tp1 = type === "BUY" ? entry + 2 * atr : entry - 2 * atr;
  const tp2 = type === "BUY" ? entry + 3.5 * atr : entry - 3.5 * atr;

  return {
    type,
    symbol,
    entryPrice: entry,
    stopLoss: sl,
    takeProfit1: tp1,
    takeProfit2: tp2,
    confidence: Math.min(100, confidence),
    ema10,
    ema20,
    ema50,
    ema200,
    supertrendBullish: stBullish,
    atr,
  };
}

export function useSignalEngine(
  candles: Candle[],
  currentPrice: number,
  symbol: string,
) {
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const lockedSignalRef = useRef<SignalResult | null>(null);
  const lastCandleTimeRef = useRef<number>(0);

  const recalculate = useCallback(() => {
    if (candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    if (lastCandle.time === lastCandleTimeRef.current) return;
    lastCandleTimeRef.current = lastCandle.time;

    const now = Date.now();

    // Check if locked signal is still active
    if (lockedSignalRef.current && now < lockedSignalRef.current.lockedUntil) {
      setSignal(lockedSignalRef.current);
      return;
    }

    const result = computeSignal(candles, currentPrice, symbol);
    if (!result) return;

    if (result.type !== "WAIT") {
      const newSignal: SignalResult = {
        ...result,
        lockedAt: now,
        lockedUntil: now + LOCK_DURATION,
      };
      lockedSignalRef.current = newSignal;
      setSignal(newSignal);
    } else {
      lockedSignalRef.current = null;
      setSignal({
        ...result,
        lockedAt: now,
        lockedUntil: now,
      });
    }
  }, [candles, currentPrice, symbol]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  return signal;
}
