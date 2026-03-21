import { useMemo } from "react";
import type { Candle } from "./useBinanceKlines";

// ─── SFI Signal Engine ────────────────────────────────────────────────────────
// Pure rule-based engine. No Gemini, no side effects.
// Signal stability: uses only closed candles (isClosed: true) where possible.

export interface SFISignal {
  asset: string;
  timeframe: "3m" | "15m";
  signal: "BUY" | "SELL" | "WAIT";
  sfiColor: "GREEN" | "RED" | "NEUTRAL";
  isSideways: boolean;
  entry: number;
  stopLoss: number;
  target: number;
  ema50: number;
  ema200: number;
  support: number;
  resistance: number;
  rsi: number;
  timestamp: number;
}

// ── Pure indicator functions ──────────────────────────────────────────────────

export function calcEMA(candles: Candle[], period: number): number[] {
  if (candles.length < period) return candles.map((c) => c.close);
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  result.push(...candles.slice(0, period - 1).map((c) => c.close));
  result.push(ema);
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function calcRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trs.push(
      Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      ),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

export function calcSFIColor(candles: Candle[]): "GREEN" | "RED" | "NEUTRAL" {
  if (candles.length < 10) return "NEUTRAL";
  const atr = calcATR(candles);
  if (atr === 0) return "NEUTRAL";
  const last8 = candles.slice(-8);
  let score = 0;
  for (const c of last8) {
    const dir = c.close > c.open ? 1 : c.close < c.open ? -1 : 0;
    const bodySize = Math.abs(c.close - c.open);
    score += dir * (bodySize / atr);
  }
  if (score > 0.5) return "GREEN";
  if (score < -0.5) return "RED";
  return "NEUTRAL";
}

export function calcSupportResistance(candles: Candle[]): {
  support: number;
  resistance: number;
} {
  if (candles.length < 10) {
    const last = candles[candles.length - 1];
    return { support: last?.low ?? 0, resistance: last?.high ?? 0 };
  }
  const slice = candles.slice(-50);
  const window = 5;
  let support = slice[0].low;
  let resistance = slice[0].high;

  for (let i = window; i < slice.length - window; i++) {
    const isSwingLow = slice
      .slice(i - window, i + window + 1)
      .every((c, j) => j === window || c.low >= slice[i].low);
    const isSwingHigh = slice
      .slice(i - window, i + window + 1)
      .every((c, j) => j === window || c.high <= slice[i].high);
    if (isSwingLow) support = Math.max(support, slice[i].low);
    if (isSwingHigh) resistance = Math.min(resistance, slice[i].high);
  }

  // Ensure support < resistance
  if (support >= resistance) {
    const last = slice[slice.length - 1];
    const mid = (last.high + last.low) / 2;
    support = mid * 0.995;
    resistance = mid * 1.005;
  }

  return { support, resistance };
}

export function isSidewaysMarket(
  candles: Candle[],
  ema50: number,
  ema200: number,
  rsi: number,
): boolean {
  if (candles.length < 10) return false;
  // 1. EMA distance < 0.3%
  const emaDist = Math.abs(ema50 - ema200) / (ema200 || 1);
  if (emaDist >= 0.003) return false;
  // 2. RSI between 44 and 56
  if (rsi < 44 || rsi > 56) return false;
  // 3. Average candle range < 0.5 * ATR
  const atr = calcATR(candles);
  const last10 = candles.slice(-10);
  const avgRange =
    last10.reduce((s, c) => s + (c.high - c.low), 0) / last10.length;
  if (avgRange >= 0.5 * atr) return false;
  return true;
}

function generateSignal(
  candles: Candle[],
  asset: string,
  timeframe: "3m" | "15m",
): SFISignal {
  const nullSignal: SFISignal = {
    asset,
    timeframe,
    signal: "WAIT",
    sfiColor: "NEUTRAL",
    isSideways: false,
    entry: 0,
    stopLoss: 0,
    target: 0,
    ema50: 0,
    ema200: 0,
    support: 0,
    resistance: 0,
    rsi: 50,
    timestamp: Date.now(),
  };

  if (candles.length < 20) return nullSignal;

  // Use closed candles for stability
  const closed = candles.filter((c) => c.isClosed);
  const workCandles = closed.length >= 20 ? closed : candles;

  const ema50Arr = calcEMA(workCandles, 50);
  const ema200Arr = calcEMA(workCandles, 200);
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const ema200 = ema200Arr[ema200Arr.length - 1];
  const rsi = calcRSI(workCandles);
  const atr = calcATR(workCandles);
  const { support, resistance } = calcSupportResistance(workCandles);
  const sfiColor = calcSFIColor(workCandles);
  const sideways = isSidewaysMarket(workCandles, ema50, ema200, rsi);
  const entry = workCandles[workCandles.length - 1].close;

  if (sideways) {
    return {
      ...nullSignal,
      signal: "WAIT",
      sfiColor: "NEUTRAL",
      isSideways: true,
      entry,
      ema50,
      ema200,
      support,
      resistance,
      rsi,
    };
  }

  if (sfiColor === "GREEN") {
    const sl = entry - atr;
    return {
      asset,
      timeframe,
      signal: "BUY",
      sfiColor: "GREEN",
      isSideways: false,
      entry,
      stopLoss: sl,
      target: entry + 3 * atr,
      ema50,
      ema200,
      support,
      resistance,
      rsi,
      timestamp: Date.now(),
    };
  }

  if (sfiColor === "RED") {
    const sl = entry + atr;
    return {
      asset,
      timeframe,
      signal: "SELL",
      sfiColor: "RED",
      isSideways: false,
      entry,
      stopLoss: sl,
      target: entry - 3 * atr,
      ema50,
      ema200,
      support,
      resistance,
      rsi,
      timestamp: Date.now(),
    };
  }

  return { ...nullSignal, entry, ema50, ema200, support, resistance, rsi };
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSFIEngine(
  candles3m_btc: Candle[],
  candles15m_btc: Candle[],
  candles3m_xau: Candle[],
  candles15m_xau: Candle[],
  candles3m_eurusd: Candle[],
  candles15m_eurusd: Candle[],
): { signals: SFISignal[]; lastUpdate: Date | null } {
  const signals = useMemo(() => {
    return [
      generateSignal(candles3m_btc, "BTC", "3m"),
      generateSignal(candles15m_btc, "BTC", "15m"),
      generateSignal(candles3m_xau, "XAU/USD", "3m"),
      generateSignal(candles15m_xau, "XAU/USD", "15m"),
      generateSignal(candles3m_eurusd, "EUR/USD", "3m"),
      generateSignal(candles15m_eurusd, "EUR/USD", "15m"),
    ];
  }, [
    candles3m_btc,
    candles15m_btc,
    candles3m_xau,
    candles15m_xau,
    candles3m_eurusd,
    candles15m_eurusd,
  ]);

  const lastUpdate = useMemo(() => {
    const ts = signals.find((s) => s.timestamp > 0)?.timestamp;
    return ts ? new Date(ts) : null;
  }, [signals]);

  return { signals, lastUpdate };
}
