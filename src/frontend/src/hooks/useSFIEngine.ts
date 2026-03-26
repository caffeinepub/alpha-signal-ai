import { useMemo } from "react";
import type { Candle } from "./useBinanceKlines";

// ─── SFI Follow Trend Level 1 — Exact Pine Script Logic ──────────────────────
//
//  hlc3       = (high + low + close) / 3
//  Basis      = (EMA(hlc3, 10) + EMA(hlc3, 20)) / 2
//  vol        = StdDev(hlc3, 10)          ← population std-dev
//  smoothVol  = EMA(vol, 14)
//  UpperBand  = Basis + (smoothVol × 2.0)
//  LowerBand  = Basis − (smoothVol × 2.0)
//
//  TREND STATE MACHINE (no simple crossings):
//    - Start NEUTRAL.  First break initialises state.
//    - If BULLISH  and close < LowerBand  → switch BEARISH  → signal = SELL
//    - If BEARISH  and close > UpperBand  → switch BULLISH  → signal = BUY
//    - Otherwise  hold state  (no flip)
//
//  STRICT LOCK: ONLY this logic sets the signal.
//  EMA 50/200, RSI, Volume, Order-flow = confirmation display only.
// ─────────────────────────────────────────────────────────────────────────────

const EMA_FAST = 10; // EMA applied to hlc3
const EMA_SLOW = 20; // EMA applied to hlc3
const STD_LEN = 10; // StdDev window for hlc3
const SMOOTH_LEN = 14; // EMA of vol (smoothVol)
const SENSITIVITY = 2.0; // band multiplier

// Minimum candles needed before the engine produces anything meaningful
const MIN_CANDLES = Math.max(EMA_SLOW, STD_LEN) + SMOOTH_LEN + 10;

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

  // Seed from the first `period` values
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

// ── EMA on candle closes (legacy helper) ─────────────────────────────────────

export function calcEMA(candles: Candle[], period: number): number[] {
  return emaFromValues(
    candles.map((c) => c.close),
    period,
  );
}

// ── RSI (close-based) ────────────────────────────────────────────────────────

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

// ── ATR ───────────────────────────────────────────────────────────────────────

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

// ── Support / Resistance ──────────────────────────────────────────────────────

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

// ── Core SFI signal generator (exact Pine Script logic) ───────────────────────

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
    basis: 0,
    upperBand: 0,
    lowerBand: 0,
    timestamp: Date.now(),
  };

  if (candles.length < MIN_CANDLES) return nullSignal;

  // Prefer closed candles for no-repaint stability; fall back to all if too few
  const closed = candles.filter((c) => c.isClosed);
  const wc = closed.length >= MIN_CANDLES ? closed : candles;
  if (wc.length < MIN_CANDLES) return nullSignal;

  // ── Step 1: Compute hlc3 series ──────────────────────────────────────────
  const hlc3: number[] = wc.map((c) => (c.high + c.low + c.close) / 3);

  // ── Step 2: EMA(hlc3, 10) and EMA(hlc3, 20) ─────────────────────────────
  const ema10arr = emaFromValues(hlc3, EMA_FAST); // length = wc.length
  const ema20arr = emaFromValues(hlc3, EMA_SLOW);

  // ── Step 3: Basis series ─────────────────────────────────────────────────
  const basisArr: number[] = ema10arr.map((v, i) => (v + ema20arr[i]) / 2);

  // ── Step 4: vol = StdDev(hlc3, STD_LEN) — population std-dev ────────────
  const volArr: number[] = hlc3.map((_, i) => {
    if (i < STD_LEN - 1) return Number.NaN;
    const slice = hlc3.slice(i - STD_LEN + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / STD_LEN;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / STD_LEN;
    return Math.sqrt(variance);
  });

  // ── Step 5: smoothVol = EMA(vol, SMOOTH_LEN) — NaN-safe ──────────────────
  const validVolStart = STD_LEN - 1; // first non-NaN index in volArr
  const volValid = volArr.slice(validVolStart); // only real values
  const smoothVolValid = emaFromValues(volValid, SMOOTH_LEN);
  // Re-map back to full-length array (NaN for early indices)
  const smoothVolArr: number[] = new Array(wc.length).fill(Number.NaN);
  for (let i = 0; i < smoothVolValid.length; i++) {
    smoothVolArr[validVolStart + i] = smoothVolValid[i];
  }

  // ── Step 6: Band arrays ───────────────────────────────────────────────────
  const upperArr: number[] = basisArr.map((b, i) =>
    Number.isNaN(smoothVolArr[i])
      ? Number.NaN
      : b + SENSITIVITY * smoothVolArr[i],
  );
  const lowerArr: number[] = basisArr.map((b, i) =>
    Number.isNaN(smoothVolArr[i])
      ? Number.NaN
      : b - SENSITIVITY * smoothVolArr[i],
  );

  // ── Step 7: Trend State Machine ───────────────────────────────────────────
  // Walk through ALL candles to reproduce exact Pine Script state history.
  // "No simple crossings" — state only switches on close vs band boundary.
  type TState = "BULLISH" | "BEARISH" | "NEUTRAL";
  let trendState: TState = "NEUTRAL";
  let lastSignal: "BUY" | "SELL" | "WAIT" = "WAIT";

  // First valid index (all arrays have real values)
  const firstValid = validVolStart + SMOOTH_LEN - 1; // ~ STD_LEN + SMOOTH_LEN - 2

  for (let i = firstValid; i < wc.length; i++) {
    const close = wc[i].close;
    const upper = upperArr[i];
    const lower = lowerArr[i];
    if (Number.isNaN(upper) || Number.isNaN(lower)) continue;

    if (trendState === "NEUTRAL") {
      // Bootstrap state from first break
      if (close > upper) {
        trendState = "BULLISH";
        lastSignal = "BUY";
      } else if (close < lower) {
        trendState = "BEARISH";
        lastSignal = "SELL";
      }
    } else if (trendState === "BULLISH") {
      if (close < lower) {
        trendState = "BEARISH";
        lastSignal = "SELL";
      }
      // else hold BULLISH / BUY
    } else if (trendState === "BEARISH") {
      if (close > upper) {
        trendState = "BULLISH";
        lastSignal = "BUY";
      }
      // else hold BEARISH / SELL
    }
  }

  // ── Final values (last candle) ────────────────────────────────────────────
  const last = wc.length - 1;
  const entry = wc[last].close;
  const basis = basisArr[last];
  const upper = upperArr[last];
  const lower = lowerArr[last];

  if (Number.isNaN(upper) || Number.isNaN(lower) || upper === 0)
    return nullSignal;

  // ── Confirmation data (display only) ─────────────────────────────────────
  const ema50Arr = calcEMA(wc, 50);
  const ema200Arr = calcEMA(wc, 200);
  const ema50 = ema50Arr[last] ?? 0;
  const ema200 = ema200Arr[last] ?? 0;
  const rsi = calcRSI(wc);
  const atr = calcATR(wc);
  const { support, resistance } = calcSupportResistance(wc);

  // Sideways check (confirmation only, does NOT override signal)
  const isSidewaysMarket =
    Math.abs(ema50 - ema200) / (ema200 || 1) < 0.003 && rsi > 44 && rsi < 56;

  // ── Debug console ────────────────────────────────────────────────────────
  console.log(
    `[SFI ${asset} ${timeframe}]`,
    `close=${entry.toFixed(4)}`,
    `upper=${upper.toFixed(4)} lower=${lower.toFixed(4)}`,
    `basis=${basis.toFixed(4)}`,
    `rsi=${rsi.toFixed(1)}`,
    `state=${trendState} => ${lastSignal}`,
  );

  // ── Build result ──────────────────────────────────────────────────────────
  const baseResult: SFISignal = {
    asset,
    timeframe,
    signal: lastSignal,
    sfiColor:
      lastSignal === "BUY"
        ? "GREEN"
        : lastSignal === "SELL"
          ? "RED"
          : "NEUTRAL",
    isSideways: lastSignal === "WAIT" ? isSidewaysMarket : false,
    entry,
    stopLoss:
      lastSignal === "BUY"
        ? entry - atr
        : lastSignal === "SELL"
          ? entry + atr
          : entry,
    target:
      lastSignal === "BUY"
        ? entry + 3 * atr
        : lastSignal === "SELL"
          ? entry - 3 * atr
          : entry,
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

  return baseResult;
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
