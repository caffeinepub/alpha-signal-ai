import { useMemo } from "react";
import type { Candle } from "./useBinanceKlines";

// ─── SFI Follow Trend Level 1 — VERSION 100 ───────────────────────────────────
//
//  basis      = (ema_fast + ema_slow) / 2  (on close prices)
//  stdev      = StdDev(close, STD_LEN)      (direct, no smoothing)
//  UpperBand  = basis + (stdev * SENSITIVITY)
//  LowerBand  = basis - (stdev * SENSITIVITY)
//
//  TREND STATE MACHINE:
//    - BUY  triggers ONLY when candle CLOSES ABOVE UpperBand.
//    - SELL triggers ONLY when candle CLOSES BELOW LowerBand.
//    - State LOCKED — stays SELL on bounces. Only opposite band break flips.
//
//  FIXED SL:
//    - BTC:     SL = Entry ± 200 USD (200 Points)
//    - XAU/USD: SL = Entry ± 3 USD  (30 Pips @ $0.10/pip)
//    - EUR/USD: SL = Entry ± 0.0015 (15 pips @ 0.0001/pip)
//
//  EXIT RULE: Target = "Trend Flip" — trade stays active until signal flips.
//
//  STRICT LOCK: ONLY this logic sets the signal.
// ─────────────────────────────────────────────────────────────────────────────

const EMA_FAST = 10;
const EMA_SLOW = 20;
const STD_LEN = 10;
const SENSITIVITY = 2.0;

// firstValid = (EMA_SLOW - 1) + (STD_LEN - 1) = 28
const firstValid = EMA_SLOW - 1 + STD_LEN - 1;
const MIN_CANDLES = firstValid + 10;

// Fixed SL distances per asset
const FIXED_SL: Record<string, number> = {
  BTC: 200,
  "XAU/USD": 3,
  "EUR/USD": 0.0015,
};

export interface SFISignal {
  asset: string;
  timeframe: "3m" | "15m";
  signal: "BUY" | "SELL" | "WAIT";
  sfiColor: "GREEN" | "RED" | "NEUTRAL";
  isSideways: boolean;
  entry: number;
  stopLoss: number;
  slDistance: number;
  target: number;
  ema50: number;
  ema200: number;
  support: number;
  resistance: number;
  rsi: number;
  basis: number;
  upperBand: number;
  lowerBand: number;
  timestamp: number;
}

// ── EMA on arbitrary value array ──────────────────────────────────────────────

function emaFromValues(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const result: number[] = new Array(values.length).fill(Number.NaN);
  const k = 2 / (period + 1);
  const seedEnd = Math.min(period, values.length);
  let sum = 0;
  for (let i = 0; i < seedEnd; i++) sum += values[i];
  let ema = sum / seedEnd;
  result[seedEnd - 1] = ema;
  for (let i = seedEnd; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function calcEMA(candles: Candle[], period: number): number[] {
  return emaFromValues(
    candles.map((c) => c.close),
    period,
  );
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
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
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
  if (support >= resistance) {
    const last = slice[slice.length - 1];
    const mid = (last.high + last.low) / 2;
    support = mid * 0.995;
    resistance = mid * 1.005;
  }
  return { support, resistance };
}

// ── Core SFI signal generator — VERSION 100 ──────────────────────────────────

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
    slDistance: 0,
    target: 0,
    ema50: 0,
    ema200: 0,
    support: 0,
    resistance: 0,
    rsi: 50,
    basis: 0,
    upperBand: 0,
    lowerBand: 0,
    timestamp: Date.now(),
  };

  if (candles.length < MIN_CANDLES) return nullSignal;

  const closed = candles.filter((c) => c.isClosed);
  const wc = closed.length >= MIN_CANDLES ? closed : candles;
  if (wc.length < MIN_CANDLES) return nullSignal;

  // ── VERSION 100: basis = (ema_fast + ema_slow) / 2 on close prices ────────
  const closes = wc.map((c) => c.close);
  const ema10arr = emaFromValues(closes, EMA_FAST);
  const ema20arr = emaFromValues(closes, EMA_SLOW);
  const basisArr: number[] = ema10arr.map((v, i) => (v + ema20arr[i]) / 2);

  // Direct stdev — no EMA smoothing of vol (VERSION 100 change)
  const stdevArr: number[] = closes.map((_, i) => {
    if (i < STD_LEN - 1) return Number.NaN;
    const slice = closes.slice(i - STD_LEN + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / STD_LEN;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / STD_LEN;
    return Math.sqrt(variance);
  });

  const upperArr: number[] = basisArr.map((b, i) =>
    Number.isNaN(stdevArr[i]) ? Number.NaN : b + SENSITIVITY * stdevArr[i],
  );
  const lowerArr: number[] = basisArr.map((b, i) =>
    Number.isNaN(stdevArr[i]) ? Number.NaN : b - SENSITIVITY * stdevArr[i],
  );

  // ── State-Based Trend State Machine ──────────────────────────────────────
  type TState = "BULLISH" | "BEARISH" | "NEUTRAL";
  let trendState: TState = "NEUTRAL";
  let lastSignal: "BUY" | "SELL" | "WAIT" = "WAIT";
  let lockedEntry = 0;
  let lockedSL = 0;

  const fixedSlDist = FIXED_SL[asset] ?? 0;

  for (let i = firstValid; i < wc.length; i++) {
    const close = wc[i].close;
    const upper = upperArr[i];
    const lower = lowerArr[i];
    if (Number.isNaN(upper) || Number.isNaN(lower)) continue;

    if (trendState === "NEUTRAL") {
      if (close > upper) {
        trendState = "BULLISH";
        lastSignal = "BUY";
        lockedEntry = close;
        lockedSL = close - fixedSlDist;
      } else if (close < lower) {
        trendState = "BEARISH";
        lastSignal = "SELL";
        lockedEntry = close;
        lockedSL = close + fixedSlDist;
      }
    } else if (trendState === "BULLISH") {
      if (close < lower) {
        trendState = "BEARISH";
        lastSignal = "SELL";
        lockedEntry = close;
        lockedSL = close + fixedSlDist;
      }
    } else if (trendState === "BEARISH") {
      if (close > upper) {
        trendState = "BULLISH";
        lastSignal = "BUY";
        lockedEntry = close;
        lockedSL = close - fixedSlDist;
      }
    }
  }

  // ── Final values (last candle) ────────────────────────────────────────────
  const last = wc.length - 1;
  const basis = basisArr[last];
  const upper = upperArr[last];
  const lower = lowerArr[last];
  const currentClose = wc[last].close;

  if (Number.isNaN(upper) || Number.isNaN(lower) || upper === 0)
    return nullSignal;

  if (trendState === "NEUTRAL") return nullSignal;

  // ── Confirmation data (display only) ─────────────────────────────────────
  const ema50Arr = calcEMA(wc, 50);
  const ema200Arr = calcEMA(wc, 200);
  const ema50 = ema50Arr[last] ?? 0;
  const ema200 = ema200Arr[last] ?? 0;
  const rsi = calcRSI(wc);
  const { support, resistance } = calcSupportResistance(wc);

  const isSidewaysMarket =
    Math.abs(ema50 - ema200) / (ema200 || 1) < 0.003 && rsi > 44 && rsi < 56;

  console.log(
    `[SFI ${asset} ${timeframe}]`,
    `close=${currentClose.toFixed(4)}`,
    `upper=${upper.toFixed(4)} lower=${lower.toFixed(4)}`,
    `basis=${basis.toFixed(4)}`,
    `rsi=${rsi.toFixed(1)}`,
    `state=${trendState} => ${lastSignal}`,
    `lockedEntry=${lockedEntry.toFixed(4)} lockedSL=${lockedSL.toFixed(4)} fixedSlDist=${fixedSlDist}`,
  );

  return {
    asset,
    timeframe,
    signal: lastSignal,
    sfiColor:
      lastSignal === "BUY"
        ? "GREEN"
        : lastSignal === "SELL"
          ? "RED"
          : "NEUTRAL",
    isSideways: isSidewaysMarket,
    entry: lockedEntry,
    stopLoss: lockedSL,
    slDistance: fixedSlDist,
    target: 0,
    ema50,
    ema200,
    support,
    resistance,
    rsi,
    basis,
    upperBand: upper,
    lowerBand: lower,
    timestamp: Date.now(),
  };
}

// ── Confirmation accessor (DISPLAY ONLY) ──────────────────────────────────────

export interface SFIConfirmation {
  institutionalBias: "Bullish" | "Bearish" | "Neutral";
  emaTrend: "Uptrend" | "Downtrend" | "Sideways";
  liquidity: "Above support" | "Near support" | "Below support";
}

export function getConfirmationData(signal: SFISignal): SFIConfirmation {
  const emaTrend: SFIConfirmation["emaTrend"] =
    signal.ema50 > signal.ema200 * 1.001
      ? "Uptrend"
      : signal.ema50 < signal.ema200 * 0.999
        ? "Downtrend"
        : "Sideways";

  const institutionalBias: SFIConfirmation["institutionalBias"] =
    signal.rsi > 55 ? "Bullish" : signal.rsi < 45 ? "Bearish" : "Neutral";

  const distToSupport =
    signal.support > 0 ? (signal.entry - signal.support) / signal.entry : 0;
  const liquidity: SFIConfirmation["liquidity"] =
    distToSupport > 0.008
      ? "Above support"
      : distToSupport > 0
        ? "Near support"
        : "Below support";

  return { institutionalBias, emaTrend, liquidity };
}

// ── Main hook ──────────────────────────────────────────────────────────────────

export function useSFIEngine(
  candles3m_btc: Candle[],
  candles15m_btc: Candle[],
  candles3m_xau: Candle[],
  candles15m_xau: Candle[],
  candles3m_eurusd: Candle[],
  candles15m_eurusd: Candle[],
): { signals: SFISignal[]; lastUpdate: Date | null } {
  const signals = useMemo(
    () => [
      generateSignal(candles3m_btc, "BTC", "3m"),
      generateSignal(candles15m_btc, "BTC", "15m"),
      generateSignal(candles3m_xau, "XAU/USD", "3m"),
      generateSignal(candles15m_xau, "XAU/USD", "15m"),
      generateSignal(candles3m_eurusd, "EUR/USD", "3m"),
      generateSignal(candles15m_eurusd, "EUR/USD", "15m"),
    ],
    [
      candles3m_btc,
      candles15m_btc,
      candles3m_xau,
      candles15m_xau,
      candles3m_eurusd,
      candles15m_eurusd,
    ],
  );

  const lastUpdate = useMemo(() => {
    const ts = signals.find((s) => s.timestamp > 0)?.timestamp;
    return ts ? new Date(ts) : null;
  }, [signals]);

  return { signals, lastUpdate };
}
