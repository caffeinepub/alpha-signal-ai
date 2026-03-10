import { useEffect, useMemo, useRef, useState } from "react";
import { useMarketWebSocket } from "./useMarketWebSocket";

// ─────────────────────────────────────────────────────────────────────────────
// Session detection
// ─────────────────────────────────────────────────────────────────────────────

export type TradingSession = "ASIAN" | "LONDON" | "NEW_YORK" | "OFF_HOURS";

export interface SessionInfo {
  name: TradingSession;
  isActive: boolean;
  label: string;
}

export function getCurrentSession(): SessionInfo {
  const utcHour = new Date().getUTCHours();

  const isLondon = utcHour >= 7 && utcHour < 16;
  const isNewYork = utcHour >= 13 && utcHour < 22;
  const isAsian = utcHour >= 0 && utcHour < 8;

  // Session detection is informational only — signals run 24/7
  if (isLondon && isNewYork) {
    return {
      name: "NEW_YORK",
      isActive: true,
      label: "NY/London Overlap — High Volatility",
    };
  }
  if (isLondon) {
    return { name: "LONDON", isActive: true, label: "London Session — Active" };
  }
  if (isNewYork) {
    return {
      name: "NEW_YORK",
      isActive: true,
      label: "New York Session — Active",
    };
  }
  if (isAsian) {
    return {
      name: "ASIAN",
      isActive: true,
      label: "Asian Session — 24/7 Signals",
    };
  }
  return {
    name: "OFF_HOURS",
    isActive: true,
    label: "Global Session — 24/7 Signals",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GoldSignal {
  symbol: "XAU";
  name: string;
  price: number;
  direction: "STRONG BUY" | "STRONG SELL" | "WAIT";
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  smcTags: string[];
  lastUpdated: Date | null;
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdHistogram: number;
  atr: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  orderBlockLevel: number;
  orderBlockDirection: "bullish" | "bearish" | null;
  orderBlockNear: boolean;
  liquiditySweepDetected: boolean;
  liquiditySweepDirection: "bullish" | "bearish" | null;
  fakeBreakoutDetected: boolean;
  fakeBreakoutDirection: "bullish" | "bearish" | null;
  signalTime: Date | null;
  isLocked: boolean;
  // Gold-specific fields
  currentSession: TradingSession;
  sessionActive: boolean;
  sessionLabel: string;
  trend5mScore: number;
  momentum1mScore: number;
  confirmation3mScore: number;
  orderBlockScore: number;
  liqSweepScore: number;
  fakeBreakoutScore: number;
  volumeSpikeScore: number;
  totalScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Copied indicator helpers (from useSignalEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

function calcEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(prices.length);
  ema[0] = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACD(prices: number[]): {
  macdLine: number;
  signalLine: number;
  histogram: number;
} {
  if (prices.length < 26) return { macdLine: 0, signalLine: 0, histogram: 0 };
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdSeries = ema12.map((v, i) => v - ema26[i]);
  const signalSeries = calcEMA(macdSeries, 9);
  const last = prices.length - 1;
  return {
    macdLine: macdSeries[last],
    signalLine: signalSeries[last],
    histogram: macdSeries[last] - signalSeries[last],
  };
}

function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number {
  if (closes.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calcBollinger(
  prices: number[],
  period = 20,
  stdDevMult = 2,
): { upper: number; middle: number; lower: number } {
  const slice = prices.slice(-period);
  if (slice.length < period)
    return {
      upper: prices[prices.length - 1] * 1.02,
      middle: prices[prices.length - 1],
      lower: prices[prices.length - 1] * 0.98,
    };
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: mean + stdDevMult * sd,
    middle: mean,
    lower: mean - stdDevMult * sd,
  };
}

interface OHLCVSeries {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

function generateOHLCV(
  price: number,
  baseVolume: number,
  scale = 1.0,
  timeOffset = 0,
): OHLCVSeries {
  const N = 50;
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];

  const seed = price * 1000 + timeOffset;
  let prev = price * (1 - 0.05 * scale * Math.abs(Math.sin(seed)));

  for (let i = 0; i < N; i++) {
    const t = i / N;
    const noise1 = Math.sin(seed * 0.001 + i * 0.8) * 0.012 * scale;
    const noise2 = Math.cos(seed * 0.0007 + i * 1.3) * 0.007 * scale;
    const trend = Math.sin(seed * 0.0003 + i * 0.2) * 0.003 * (1 - t);

    const change = noise1 + noise2 + trend;
    const open = prev;
    const close = open * (1 + change);
    const bodySpread = Math.abs(close - open);
    const wick = bodySpread * (1 + Math.abs(Math.cos(seed + i * 2.1)) * 0.8);

    const high = Math.max(open, close) + wick * 0.5;
    const low = Math.min(open, close) - wick * 0.5;
    const vol =
      baseVolume * (0.6 + Math.abs(Math.sin(seed * 0.002 + i * 1.7)) * 1.4);

    opens.push(open);
    highs.push(high);
    lows.push(low);
    closes.push(close);
    volumes.push(vol);
    prev = close;
  }

  const drift = price / (closes[N - 1] || price);
  return {
    opens: opens.map((v) => v * drift),
    highs: highs.map((v) => v * drift),
    lows: lows.map((v) => v * drift),
    closes: closes.map((v) => v * drift),
    volumes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock
// ─────────────────────────────────────────────────────────────────────────────

interface LockEntry {
  direction: "STRONG BUY" | "STRONG SELL";
  entryPrice: number;
  signalTime: Date;
  lockedAt: number;
}

const LOCK_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAX_HISTORY = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Signal computation
// ─────────────────────────────────────────────────────────────────────────────

function computeGoldScores(price: number, priceHistory: number[]) {
  const baseVolume = 5000; // typical XAU base volume unit

  const series5m = generateOHLCV(price, baseVolume, 1.8, 0);
  const series3m = generateOHLCV(price, baseVolume, 1.0, 137);
  const series1m = generateOHLCV(price, baseVolume, 0.5, 271);

  // ── 5m Trend (EMA50/200) ─────────────────────────────────────────────────
  const closes5m = series5m.closes;
  const ema50Arr = calcEMA(closes5m, 50);
  const ema200Arr = calcEMA(closes5m, 200);
  const last5 = closes5m.length - 1;
  const ema50 = ema50Arr[last5];
  const ema200 = ema200Arr[last5];

  let trend5mScore = 0;
  if (ema50 > ema200) {
    const separation = (ema50 - ema200) / ema200;
    trend5mScore = Math.min(15, Math.round(separation * 3000));
    if (trend5mScore < 1) trend5mScore = 8;
  }

  // ── 3m Confirmation ────────────────────────────────────────────────────────
  let closes3m = series3m.closes;
  let rsi3m = 50;
  let confirmation3mScore = 0;
  let confirmation3mBullish = false;

  if (priceHistory.length >= 60) {
    const recentWindow = priceHistory.slice(-30);
    const priorWindow = priceHistory.slice(-60, -30);
    const higherHighs =
      priorWindow.length > 0 &&
      Math.max(...recentWindow) > Math.max(...priorWindow);
    const lowerLows =
      priorWindow.length > 0 &&
      Math.min(...recentWindow) < Math.min(...priorWindow);
    rsi3m = calcRSI(priceHistory);
    closes3m = priceHistory;

    if (higherHighs && rsi3m > 55) {
      confirmation3mScore = 15;
      confirmation3mBullish = true;
    } else if (lowerLows && rsi3m < 45) {
      confirmation3mScore = 0;
    } else {
      confirmation3mScore = 5;
    }
  } else {
    closes3m = series3m.closes;
    rsi3m = calcRSI(closes3m);
    const lastClose3m = closes3m[closes3m.length - 1];
    const opens3m = series3m.opens;
    const lastOpen3m = opens3m[opens3m.length - 1];
    const isBullishCandle = lastClose3m > lastOpen3m;
    const isBearishCandle = lastClose3m < lastOpen3m;

    if (isBullishCandle && rsi3m > 55) {
      confirmation3mScore = 15;
      confirmation3mBullish = true;
    } else if (isBearishCandle && rsi3m < 45) {
      confirmation3mScore = 0;
    } else {
      confirmation3mScore = 5;
    }
  }

  // ── 1m Momentum ────────────────────────────────────────────────────────────
  const closes1m = series1m.closes;
  const volumes1m = series1m.volumes;

  let ema9_1m: number;
  let ema20_1m: number;
  let priceRising = false;
  let usingLiveTicks = false;

  if (priceHistory.length >= 20) {
    usingLiveTicks = true;
    const ema9Arr = calcEMA(priceHistory, 9);
    const ema20Arr = calcEMA(priceHistory, 20);
    ema9_1m = ema9Arr[priceHistory.length - 1];
    ema20_1m = ema20Arr[priceHistory.length - 1];
    if (priceHistory.length >= 5) {
      const last = priceHistory.length - 1;
      priceRising = priceHistory[last] > priceHistory[last - 4];
    }
  } else {
    const ema9Arr1m = calcEMA(closes1m, 9);
    const ema20Arr1m = calcEMA(closes1m, 20);
    const last1 = closes1m.length - 1;
    ema9_1m = ema9Arr1m[last1];
    ema20_1m = ema20Arr1m[last1];
  }

  // Volume spike detection
  const last1Idx = volumes1m.length - 1;
  const recentVol = volumes1m[last1Idx];
  const avgVol =
    volumes1m.slice(-20).reduce((a, b) => a + b, 0) /
    Math.min(20, volumes1m.length);
  const hasVolumeSpike = recentVol > avgVol * 1.5;

  let momentum1mScore = 0;
  if (usingLiveTicks) {
    if (ema9_1m > ema20_1m && priceRising && hasVolumeSpike) {
      momentum1mScore = 15;
    } else if (ema9_1m < ema20_1m && !priceRising) {
      momentum1mScore = 0;
    } else if (ema9_1m > ema20_1m) {
      momentum1mScore = 8;
    } else {
      momentum1mScore = 5;
    }
  } else {
    if (ema9_1m > ema20_1m && hasVolumeSpike) momentum1mScore = 15;
    else if (ema9_1m > ema20_1m) momentum1mScore = 8;
    else if (ema9_1m < ema20_1m) momentum1mScore = 0;
    else momentum1mScore = 5;
  }

  // ── Volume Spike Score ─────────────────────────────────────────────────────
  let volumeSpikeScore = 0;
  if (hasVolumeSpike) volumeSpikeScore = 10;
  else if (avgVol > 0) {
    volumeSpikeScore = Math.round((recentVol / (avgVol * 1.5)) * 10);
  }

  // ── Order Block Detection (5m) ─────────────────────────────────────────────
  const { opens: opens5m, highs: highs5m, lows: lows5m } = series5m;
  const n5 = closes5m.length;

  let obLevel = 0;
  let obDirection: "bullish" | "bearish" | null = null;
  let obNear = false;
  let orderBlockScore = 0;

  const scanStart = Math.max(0, n5 - 11);
  let bestBullStr = 0;
  let bestBearStr = 0;
  let bullObLevel = 0;
  let bearObLevel = 0;

  for (let i = scanStart; i < n5 - 1; i++) {
    const isBearish = closes5m[i] < opens5m[i];
    const isBullish = closes5m[i] > opens5m[i];
    const nextClose = closes5m[i + 1];

    if (isBearish) {
      const impulse = (nextClose - closes5m[i]) / closes5m[i];
      if (impulse > 0.003) {
        const str = Math.min(100, impulse * 3000);
        if (str > bestBullStr) {
          bestBullStr = str;
          bullObLevel = (highs5m[i] + lows5m[i]) / 2;
        }
      }
    }
    if (isBullish) {
      const impulse = (closes5m[i] - nextClose) / closes5m[i];
      if (impulse > 0.003) {
        const str = Math.min(100, impulse * 3000);
        if (str > bestBearStr) {
          bestBearStr = str;
          bearObLevel = (highs5m[i] + lows5m[i]) / 2;
        }
      }
    }
  }

  if (bestBullStr > bestBearStr && bestBullStr > 10) {
    obLevel = bullObLevel;
    obDirection = "bullish";
  } else if (bestBearStr > 10) {
    obLevel = bearObLevel;
    obDirection = "bearish";
  }

  if (obLevel > 0 && obDirection !== null) {
    const proximity = Math.abs(price - obLevel) / price;
    obNear = proximity < 0.005;
    orderBlockScore = obNear ? 15 : 0;
  }

  // ── Liquidity Sweep Detection ──────────────────────────────────────────────
  let liquiditySweepDetected = false;
  let liquiditySweepDirection: "bullish" | "bearish" | null = null;
  let liqSweepScore = 0;

  if (n5 >= 10) {
    const prevLows5 = lows5m.slice(-10, -1);
    const prevHighs5 = highs5m.slice(-10, -1);
    const lastLow5 = lows5m[n5 - 1];
    const lastHigh5 = highs5m[n5 - 1];
    const lastClose5 = closes5m[n5 - 1];
    const minPrevLow5 = Math.min(...prevLows5);
    const maxPrevHigh5 = Math.max(...prevHighs5);

    if (lastLow5 < minPrevLow5 && lastClose5 > minPrevLow5) {
      liquiditySweepDetected = true;
      liquiditySweepDirection = "bullish";
      liqSweepScore = 15;
    } else if (lastHigh5 > maxPrevHigh5 && lastClose5 < maxPrevHigh5) {
      liquiditySweepDetected = true;
      liquiditySweepDirection = "bearish";
      liqSweepScore = 0;
    }
  }

  // ── Fake Breakout Detection ────────────────────────────────────────────────
  let fakeBreakoutDetected = false;
  let fakeBreakoutDirection: "bullish" | "bearish" | null = null;
  let fakeBreakoutScore = 0;

  if (n5 >= 12) {
    const recentCloses5 = closes5m.slice(-11, -1);
    const supportLevel = Math.min(...recentCloses5);
    const resistance = Math.max(...recentCloses5);
    const lastLow5 = lows5m[n5 - 1];
    const lastHigh5 = highs5m[n5 - 1];
    const lastClose5 = closes5m[n5 - 1];

    if (lastLow5 < supportLevel && lastClose5 > supportLevel) {
      fakeBreakoutDetected = true;
      fakeBreakoutDirection = "bullish";
      fakeBreakoutScore = 10;
    } else if (lastHigh5 > resistance && lastClose5 < resistance) {
      fakeBreakoutDetected = true;
      fakeBreakoutDirection = "bearish";
      fakeBreakoutScore = 0;
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalScore = Math.max(
    0,
    Math.min(
      100,
      trend5mScore +
        momentum1mScore +
        confirmation3mScore +
        orderBlockScore +
        liqSweepScore +
        fakeBreakoutScore +
        volumeSpikeScore,
    ),
  );

  // ── Display Indicators ─────────────────────────────────────────────────────
  const ema9FinalArr = calcEMA(closes5m, 9);
  const ema20FinalArr = calcEMA(closes5m, 20);
  const ema9 = ema9FinalArr[last5];
  const ema20 = ema20FinalArr[last5];
  const rsi = calcRSI(closes5m);
  const { histogram: macdHistogram } = calcMACD(closes5m);
  const atr = calcATR(highs5m, lows5m, closes5m);
  const {
    upper: bbUpper,
    middle: bbMiddle,
    lower: bbLower,
  } = calcBollinger(closes5m);

  // ── SMC Tags ──────────────────────────────────────────────────────────────
  const smcTags: string[] = [];
  if (obNear && obDirection !== null) smcTags.push("ORDER BLOCK");
  if (liquiditySweepDetected) smcTags.push("LIQ SWEEP");
  if (fakeBreakoutDetected) smcTags.push("FAKE BREAKOUT");
  if (ema50 > ema200 && ema9 > ema20) smcTags.push("BOS");
  if (confirmation3mBullish && trend5mScore > 8) smcTags.push("CHoCH");

  // ── Explanation ────────────────────────────────────────────────────────────
  const explanationParts: string[] = [];
  if (ema50 > ema200) {
    const sep = (((ema50 - ema200) / ema200) * 100).toFixed(2);
    explanationParts.push(
      `5m trend: EMA50 > EMA200 — ${sep}% separation (bullish)`,
    );
  } else {
    explanationParts.push("5m trend: EMA50 below EMA200 — bearish structure");
  }

  if (usingLiveTicks) {
    if (ema9_1m > ema20_1m && priceRising && hasVolumeSpike) {
      explanationParts.push(
        "1m: EMA9 > EMA20 with volume spike + price rising — strong XAU momentum",
      );
    } else if (ema9_1m < ema20_1m && !priceRising) {
      explanationParts.push(
        "1m: EMA9 below EMA20, price falling — bearish momentum",
      );
    }
  }

  if (obNear && obDirection === "bullish") {
    explanationParts.push(
      `Price near bullish order block at $${obLevel.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
  }

  if (liquiditySweepDetected && liquiditySweepDirection === "bullish") {
    explanationParts.push(
      "Bullish liquidity sweep: broke prior low then reversed — smart money XAU absorption",
    );
  }

  const explanation = `${explanationParts.slice(0, 4).join(". ")}.`;

  return {
    // Indicators
    ema9,
    ema20,
    ema50,
    ema200,
    rsi,
    macdHistogram,
    atr,
    bbUpper,
    bbMiddle,
    bbLower,
    rsi3m,
    // Scores
    trend5mScore,
    momentum1mScore,
    confirmation3mScore,
    orderBlockScore,
    liqSweepScore,
    fakeBreakoutScore,
    volumeSpikeScore,
    totalScore,
    // SMC
    obLevel,
    obDirection,
    obNear,
    liquiditySweepDetected,
    liquiditySweepDirection,
    fakeBreakoutDetected,
    fakeBreakoutDirection,
    smcTags,
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useGoldSignalEngine(): GoldSignal | null {
  const { marketData, lastUpdate } = useMarketWebSocket();

  const [, setTick] = useState(0);
  useEffect(() => {
    // Tick every 2s to refresh session info and lock countdown
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const lockRef = useRef<LockEntry | undefined>(undefined);
  const priceHistoryRef = useRef<number[]>([]);

  // Accumulate XAU price ticks
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastUpdate triggers tick
  useEffect(() => {
    const xau = marketData.find(
      (a) => a.symbol === "XAU" || a.symbol === "GOLD",
    );
    if (!xau) return;
    priceHistoryRef.current.push(xau.price);
    if (priceHistoryRef.current.length > MAX_HISTORY) {
      priceHistoryRef.current.shift();
    }
  }, [marketData, lastUpdate]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo<GoldSignal | null>(() => {
    const xau = marketData.find(
      (a) => a.symbol === "XAU" || a.symbol === "GOLD",
    );
    if (!xau || xau.price <= 0) return null;

    const session = getCurrentSession();
    const price = xau.price;

    // Active session — compute scores
    const scores = computeGoldScores(price, priceHistoryRef.current);
    const { totalScore, atr } = scores;

    // Determine raw direction
    let rawDirection: GoldSignal["direction"];
    if (totalScore > 75) rawDirection = "STRONG BUY";
    else if (totalScore < 25) rawDirection = "STRONG SELL";
    else rawDirection = "WAIT";

    // Apply lock logic
    const now = Date.now();
    let direction: GoldSignal["direction"];
    let entryPrice: number;
    let signalTime: Date | null;
    let isLocked: boolean;

    if (lockRef.current && now - lockRef.current.lockedAt < LOCK_DURATION_MS) {
      direction = lockRef.current.direction;
      entryPrice = lockRef.current.entryPrice;
      signalTime = lockRef.current.signalTime;
      isLocked = true;
    } else {
      direction = rawDirection;
      if (rawDirection !== "WAIT") {
        const newLock: LockEntry = {
          direction: rawDirection,
          entryPrice: price,
          signalTime: new Date(),
          lockedAt: now,
        };
        lockRef.current = newLock;
        entryPrice = price;
        signalTime = newLock.signalTime;
      } else {
        if (
          lockRef.current &&
          now - lockRef.current.lockedAt >= LOCK_DURATION_MS
        ) {
          lockRef.current = undefined;
        }
        entryPrice = price;
        signalTime = null;
      }
      isLocked = false;
    }

    // SL/TP
    let stopLoss: number;
    let tp1: number;
    let tp2: number;

    if (direction === "STRONG BUY") {
      stopLoss = entryPrice - atr * 1.5;
      tp1 = entryPrice + atr * 2;
      tp2 = entryPrice + atr * 3.5;
    } else if (direction === "STRONG SELL") {
      stopLoss = entryPrice + atr * 1.5;
      tp1 = entryPrice - atr * 2;
      tp2 = entryPrice - atr * 3.5;
    } else {
      stopLoss = entryPrice - atr * 1.5;
      tp1 = entryPrice + atr * 2;
      tp2 = entryPrice + atr * 3.5;
    }

    // Risk level
    const atrRatio = atr / price;
    let riskLevel: GoldSignal["riskLevel"];
    if (atrRatio > 0.03) riskLevel = "HIGH";
    else if (atrRatio > 0.015) riskLevel = "MEDIUM";
    else riskLevel = "LOW";

    return {
      symbol: "XAU",
      name: "Gold",
      price,
      direction,
      confidence: totalScore,
      entryPrice,
      stopLoss,
      tp1,
      tp2,
      riskLevel,
      explanation: scores.explanation,
      smcTags: scores.smcTags,
      lastUpdated: lastUpdate,
      ema9: scores.ema9,
      ema20: scores.ema20,
      ema50: scores.ema50,
      ema200: scores.ema200,
      rsi: scores.rsi,
      macdHistogram: scores.macdHistogram,
      atr: scores.atr,
      bbUpper: scores.bbUpper,
      bbLower: scores.bbLower,
      bbMiddle: scores.bbMiddle,
      orderBlockLevel: scores.obLevel,
      orderBlockDirection: scores.obDirection,
      orderBlockNear: scores.obNear,
      liquiditySweepDetected: scores.liquiditySweepDetected,
      liquiditySweepDirection: scores.liquiditySweepDirection,
      fakeBreakoutDetected: scores.fakeBreakoutDetected,
      fakeBreakoutDirection: scores.fakeBreakoutDirection,
      signalTime,
      isLocked,
      currentSession: session.name,
      sessionActive: true,
      sessionLabel: session.label,
      trend5mScore: scores.trend5mScore,
      momentum1mScore: scores.momentum1mScore,
      confirmation3mScore: scores.confirmation3mScore,
      orderBlockScore: scores.orderBlockScore,
      liqSweepScore: scores.liqSweepScore,
      fakeBreakoutScore: scores.fakeBreakoutScore,
      volumeSpikeScore: scores.volumeSpikeScore,
      totalScore,
    };
  }, [marketData, lastUpdate]);
}
