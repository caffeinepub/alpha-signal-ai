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
//  ON-TICK MODE (livePrices):
//    - A synthetic open candle is appended using the live price as close.
//    - The state machine runs over the extended array to give lower-latency signal display.
//    - lockedEntry / lockedSL are NEVER updated on synthetic candles.
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

export type LivePrices = {
  BTCUSDT?: number;
  PAXGUSDT?: number;
  EURUSDT?: number;
};

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
// When tickCandle is provided, it is appended as a synthetic open candle.
// lockedEntry/lockedSL are only set from CLOSED candle flips.

function generateSignal(
  candles: Candle[],
  asset: string,
  timeframe: "3m" | "15m",
  tickCandle?: Candle,
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

  // ── Trend state machine on CLOSED candles only ────────────────────────────
  type TrendState = "BULLISH" | "BEARISH" | "NEUTRAL";
  let trendState: TrendState = "NEUTRAL";
  let lockedEntry = 0;
  let lockedSL = 0;

  for (let i = firstValid; i < wc.length; i++) {
    const upper = upperArr[i];
    const lower = lowerArr[i];
    const close = wc[i].close;
    if (Number.isNaN(upper) || Number.isNaN(lower)) continue;

    if (trendState !== "BULLISH" && close > upper) {
      trendState = "BULLISH";
      lockedEntry = close;
      lockedSL =
        close - (FIXED_SL[asset] ?? calcATR([...wc.slice(0, i + 1)], 14));
    } else if (trendState !== "BEARISH" && close < lower) {
      trendState = "BEARISH";
      lockedEntry = close;
      lockedSL =
        close + (FIXED_SL[asset] ?? calcATR([...wc.slice(0, i + 1)], 14));
    }
  }

  // ── On-tick: extend with synthetic candle to reduce lag ──────────────────
  // Signal direction may update on tick, but lockedEntry/lockedSL stay locked.
  let tickTrendState: TrendState = trendState;
  if (tickCandle) {
    const lastIdx = wc.length - 1;
    const upper = upperArr[lastIdx];
    const lower = lowerArr[lastIdx];
    if (!Number.isNaN(upper) && !Number.isNaN(lower)) {
      const liveClose = tickCandle.close;
      if (tickTrendState !== "BULLISH" && liveClose > upper) {
        tickTrendState = "BULLISH";
      } else if (tickTrendState !== "BEARISH" && liveClose < lower) {
        tickTrendState = "BEARISH";
      }
    }
  }

  const lastIdx = wc.length - 1;
  const lastClose = wc[lastIdx].close;
  const basis = basisArr[lastIdx];
  const upperBand = upperArr[lastIdx];
  const lowerBand = lowerArr[lastIdx];

  // ── EMA 50 / 200 (confirmation only) ─────────────────────────────────────
  const ema50arr = emaFromValues(closes, 50);
  const ema200arr = emaFromValues(closes, 200);
  const ema50 = ema50arr[lastIdx] ?? 0;
  const ema200 = ema200arr[lastIdx] ?? 0;

  // ── Sideways filter ───────────────────────────────────────────────────────
  const rsi = calcRSI(wc);
  const emaDist = ema200 > 0 ? Math.abs(ema50 - ema200) / ema200 : 1;
  const candleRange =
    wc.slice(-5).reduce((s, c) => s + (c.high - c.low), 0) / 5;
  const avgClose = closes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const relRange = avgClose > 0 ? candleRange / avgClose : 1;
  const isSideways =
    emaDist < 0.003 && rsi >= 44 && rsi <= 56 && relRange < 0.002;

  const { support, resistance } = calcSupportResistance(wc);

  // ── Map trendState to signal ───────────────────────────────────────────────
  let signal: "BUY" | "SELL" | "WAIT";
  let sfiColor: "GREEN" | "RED" | "NEUTRAL";

  if (isSideways) {
    signal = "WAIT";
    sfiColor = "NEUTRAL";
  } else if (tickTrendState === "BULLISH") {
    signal = "BUY";
    sfiColor = "GREEN";
  } else if (tickTrendState === "BEARISH") {
    signal = "SELL";
    sfiColor = "RED";
  } else {
    signal = "WAIT";
    sfiColor = "NEUTRAL";
  }

  // ── Entry / SL / Target ───────────────────────────────────────────────────
  const slDistance = FIXED_SL[asset] ?? 0;
  let entry = lockedEntry > 0 ? lockedEntry : lastClose;
  let stopLoss = lockedSL;
  if (stopLoss === 0 && signal !== "WAIT") {
    stopLoss = signal === "BUY" ? entry - slDistance : entry + slDistance;
  }

  // Debug log
  console.log(
    `[SFI ${asset} ${timeframe}] close=${lastClose.toFixed(4)} upper=${(upperBand ?? 0).toFixed(4)} lower=${(lowerBand ?? 0).toFixed(4)} basis=${(basis ?? 0).toFixed(4)} state=${trendState}${tickCandle ? ` tickState=${tickTrendState}` : ""} => ${signal}`,
  );

  return {
    asset,
    timeframe,
    signal,
    sfiColor,
    isSideways,
    entry,
    stopLoss,
    slDistance,
    target: 0, // "Trend Flip" exit
    ema50,
    ema200,
    support,
    resistance,
    rsi,
    basis: basis ?? 0,
    upperBand: upperBand ?? 0,
    lowerBand: lowerBand ?? 0,
    timestamp: Date.now(),
  };
}

// ── Public hook ───────────────────────────────────────────────────────────────

export interface SFIEngineInputs {
  candles3m_btc: Candle[];
  candles15m_btc: Candle[];
  candles3m_xau: Candle[];
  candles15m_xau: Candle[];
  candles3m_eurusd: Candle[];
  candles15m_eurusd: Candle[];
  livePrices?: LivePrices;
}

export function useSFIEngine(inputs: SFIEngineInputs) {
  const {
    candles3m_btc,
    candles15m_btc,
    candles3m_xau,
    candles15m_xau,
    candles3m_eurusd,
    candles15m_eurusd,
    livePrices,
  } = inputs;

  return useMemo(() => {
    // Build synthetic tick candles when live prices are available
    const makeTickCandle = (
      candles: Candle[],
      livePrice: number | undefined,
    ): Candle | undefined => {
      if (!livePrice || candles.length === 0) return undefined;
      const last = candles[candles.length - 1];
      return {
        time: Date.now(),
        open: last.close,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
        volume: 0,
        isClosed: false,
      };
    };

    const btcTick = makeTickCandle(candles3m_btc, livePrices?.BTCUSDT);
    const btc15mTick = makeTickCandle(candles15m_btc, livePrices?.BTCUSDT);
    const xauTick = makeTickCandle(candles3m_xau, livePrices?.PAXGUSDT);
    const xau15mTick = makeTickCandle(candles15m_xau, livePrices?.PAXGUSDT);
    const eurTick = makeTickCandle(candles3m_eurusd, livePrices?.EURUSDT);
    const eur15mTick = makeTickCandle(candles15m_eurusd, livePrices?.EURUSDT);

    return {
      btc3m: generateSignal(candles3m_btc, "BTC", "3m", btcTick),
      btc15m: generateSignal(candles15m_btc, "BTC", "15m", btc15mTick),
      xau3m: generateSignal(candles3m_xau, "XAU/USD", "3m", xauTick),
      xau15m: generateSignal(candles15m_xau, "XAU/USD", "15m", xau15mTick),
      eur3m: generateSignal(candles3m_eurusd, "EUR/USD", "3m", eurTick),
      eur15m: generateSignal(candles15m_eurusd, "EUR/USD", "15m", eur15mTick),
    };
  }, [
    candles3m_btc,
    candles15m_btc,
    candles3m_xau,
    candles15m_xau,
    candles3m_eurusd,
    candles15m_eurusd,
    livePrices,
  ]);
}

// ── Legacy backward-compatible API ────────────────────────────────────────────
// The old hook accepted 6 positional candle arrays and returned { signals: SFISignal[] }.
// Consumers (CompactSFIWidget, Signals, Charts, Dashboard) still use this API.
// This re-export bridges the gap without touching those files.

export function getConfirmationData(signal: SFISignal): {
  institutionalBias: string;
  emaTrend: string;
  liquidity: string;
} {
  const trend =
    signal.ema50 > signal.ema200
      ? "Bullish"
      : signal.ema50 < signal.ema200
        ? "Bearish"
        : "Neutral";
  const liquidity =
    signal.signal === "BUY"
      ? "Above support"
      : signal.signal === "SELL"
        ? "Below support"
        : "Near support";
  return {
    institutionalBias: trend,
    emaTrend: signal.ema50 > signal.ema200 ? "Uptrend" : "Downtrend",
    liquidity,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: legacy overload for positional callers
export function useSFIEngineLegacy(
  candles3m_btc: Candle[],
  candles15m_btc: Candle[],
  candles3m_xau: Candle[],
  candles15m_xau: Candle[],
  candles3m_eurusd: Candle[],
  candles15m_eurusd: Candle[],
): { signals: SFISignal[] } {
  const result = useSFIEngine({
    candles3m_btc,
    candles15m_btc,
    candles3m_xau,
    candles15m_xau,
    candles3m_eurusd,
    candles15m_eurusd,
  });

  return useMemo(
    () => ({
      signals: [
        result.btc3m,
        result.btc15m,
        result.xau3m,
        result.xau15m,
        result.eur3m,
        result.eur15m,
      ],
    }),
    [result],
  );
}
