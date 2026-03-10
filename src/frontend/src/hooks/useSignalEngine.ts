import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketAsset } from "../backend.d";
import { useBinanceKlines } from "./useBinanceKlines";
import { useLiquidationData } from "./useLiquidationData";
import { useMarketWebSocket } from "./useMarketWebSocket";
import type { TimeframeMatrix } from "./useMultiTimeframe";
import { useMultiTimeframe } from "./useMultiTimeframe";
import { useOrderBook } from "./useOrderBook";
import { useSmartMoneyFlow } from "./useSmartMoneyFlow";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  trendScore: number; // 0-15 (mapped from trend5m)
  momentumScore: number; // 0-30 (momentum1m + confirmation3m)
  volumeScore: number; // 0-10 (volumeSpike)
  structureScore: number; // 0-25 (orderBlock + fakeBreakout)
  liquidityScore: number; // 0-20 (liqSweep + liqHeatmap)
  total: number; // 0-100
}

export interface TimeframeScores {
  trend5m: number; // 0-15
  momentum1m: number; // 0-15
  confirmation3m: number; // 0-15
  orderBlock: number; // 0-15
  liqSweep: number; // 0-15
  fakeBreakout: number; // 0-10
  volumeSpike: number; // 0-10
  liqHeatmap: number; // 0-5
  total: number; // 0-100
}

export interface EngineSignal {
  symbol: string;
  name: string;
  price: number;
  direction: "STRONG BUY" | "STRONG SELL" | "WAIT";
  confidence: number;
  scoreBreakdown: ScoreBreakdown;
  timeframeScores: TimeframeScores;
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
  // New fields
  orderBlockLevel: number;
  orderBlockDirection: "bullish" | "bearish" | null;
  orderBlockNear: boolean;
  liquiditySweepDetected: boolean;
  liquiditySweepDirection: "bullish" | "bearish" | null;
  fakeBreakoutDetected: boolean;
  fakeBreakoutDirection: "bullish" | "bearish" | null;
  signalTime: Date | null;
  isLocked: boolean;
  // Order book confirmation (BTC only)
  orderBookConfirmed: boolean;
  liquidationConfirmed: boolean;
  orderBookBuyPressure: number;
  orderBookSellPressure: number;
  liquidationBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  // Smart money confirmation
  smartMoneyConfirmed: boolean;
  whaleActivity: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  openInterestChange: number;
  fundingRate: number;
  // Multi-timeframe alignment
  timeframeMatrix: TimeframeMatrix | null;
  alignmentAllowed: boolean;
  alignmentScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assets — only BTC and XAU
// ─────────────────────────────────────────────────────────────────────────────

const SIGNAL_ASSETS = new Set(["BTC", "XAU", "GOLD"]);

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic OHLCV generator — seeded deterministically from current price
// ─────────────────────────────────────────────────────────────────────────────

interface OHLCVSeries {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

/**
 * @param price  - current live price (anchor)
 * @param baseVolume - per-candle base volume
 * @param scale  - noise amplitude multiplier (1m = 0.5, 3m = 1.0, 5m = 1.8)
 * @param timeOffset - phase offset to differentiate timeframes
 */
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

  // Anchor last close to current live price
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
// Indicator calculations
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
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
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
  const macdLine = macdSeries[last];
  const signalLine = signalSeries[last];
  return { macdLine, signalLine, histogram: macdLine - signalLine };
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

// ─────────────────────────────────────────────────────────────────────────────
// Multi-timeframe signal scoring
// ─────────────────────────────────────────────────────────────────────────────

interface RawSignalScores {
  // Indicators (for display)
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
  // Timeframe scores
  timeframeScores: TimeframeScores;
  // SMC detection details
  orderBlockLevel: number;
  orderBlockDirection: "bullish" | "bearish" | null;
  orderBlockNear: boolean;
  liquiditySweepDetected: boolean;
  liquiditySweepDirection: "bullish" | "bearish" | null;
  fakeBreakoutDetected: boolean;
  fakeBreakoutDirection: "bullish" | "bearish" | null;
  smcTags: string[];
  explanation: string;
}

function computeRawScores(
  asset: MarketAsset,
  priceHistory: number[],
  realCloses1m?: number[],
  realCloses3m?: number[],
  realVolumes1m?: number[],
): RawSignalScores {
  const price = asset.price;
  const baseVolume = asset.volume / 50;

  // Three timeframe series (synthetic — anchored to live price)
  // Real kline data overrides synthetic for 1m and 3m when available
  const series5m = generateOHLCV(price, baseVolume, 1.8, 0);
  const series3m = generateOHLCV(price, baseVolume, 1.0, 137);
  const series1m = generateOHLCV(price, baseVolume, 0.5, 271);

  // ── 5m indicators (trend) ─────────────────────────────────────────────────
  const closes5m = series5m.closes;
  const ema50Arr = calcEMA(closes5m, 50);
  const ema200Arr = calcEMA(closes5m, 200);
  const last5 = closes5m.length - 1;
  const ema50 = ema50Arr[last5];
  const ema200 = ema200Arr[last5];

  // 5m Trend Detection: EMA50 vs EMA200
  let trend5m = 0;
  if (ema50 > ema200) {
    // Bullish trend — score based on separation
    const separation = (ema50 - ema200) / ema200;
    trend5m = Math.min(15, Math.round(separation * 3000));
    if (trend5m < 1 && ema50 > ema200) trend5m = 8; // minimum if bullish
  }
  // Bearish trend → 0 points (pure absence of bull trend)

  // ── 3m confirmation using real kline closes (or live tick history fallback) ─
  // Prefer real 3m kline closes when available (real candle close triggered)
  const closes3m =
    realCloses3m && realCloses3m.length >= 10 ? realCloses3m : series3m.closes;
  const opens3m = series3m.opens;

  let confirmation3m = 0;
  let confirmation3mBullish = false;
  let higherHighs = false;
  let lowerLows = false;
  let rsi3m: number;

  // If we have real 3m kline closes — use them for structure detection
  if (closes3m.length >= 30) {
    const recentWindow = closes3m.slice(-15);
    const priorWindow = closes3m.slice(-30, -15);
    higherHighs =
      priorWindow.length > 0 &&
      Math.max(...recentWindow) > Math.max(...priorWindow);
    lowerLows =
      priorWindow.length > 0 &&
      Math.min(...recentWindow) < Math.min(...priorWindow);
    rsi3m = calcRSI(closes3m);

    if (higherHighs && rsi3m > 55) {
      confirmation3m = 15;
      confirmation3mBullish = true;
    } else if (lowerLows && rsi3m < 45) {
      confirmation3m = 0;
    } else {
      confirmation3m = 5;
    }
  } else if (priceHistory.length >= 60) {
    // Fall back to live tick history
    const recentWindow = priceHistory.slice(-30);
    const priorWindow = priceHistory.slice(-60, -30);
    higherHighs =
      priorWindow.length > 0 &&
      Math.max(...recentWindow) > Math.max(...priorWindow);
    lowerLows =
      priorWindow.length > 0 &&
      Math.min(...recentWindow) < Math.min(...priorWindow);
    rsi3m =
      priceHistory.length >= 15 ? calcRSI(priceHistory) : calcRSI(closes3m);

    if (higherHighs && rsi3m > 55) {
      confirmation3m = 15;
      confirmation3mBullish = true;
    } else if (lowerLows && rsi3m < 45) {
      confirmation3m = 0;
    } else {
      confirmation3m = 5;
    }
  } else {
    // Fall back to synthetic 3m series candle direction
    rsi3m = calcRSI(closes3m);
    const lastClose3m = closes3m[closes3m.length - 1];
    const lastOpen3m = opens3m[opens3m.length - 1];
    const isBullishCandle3m = lastClose3m > lastOpen3m;
    const isBearishCandle3m = lastClose3m < lastOpen3m;

    if (isBullishCandle3m && rsi3m > 55) {
      confirmation3m = 15;
      confirmation3mBullish = true;
    } else if (isBearishCandle3m && rsi3m < 45) {
      confirmation3m = 0;
    } else {
      confirmation3m = 5;
    }
  }

  // ── 1m indicators (momentum) — use real kline closes when available ─────────
  // Prefer real 1m kline closes for EMA9/20 calculation
  const closes1m =
    realCloses1m && realCloses1m.length >= 20 ? realCloses1m : series1m.closes;
  const volumes1m =
    realVolumes1m && realVolumes1m.length >= 5
      ? realVolumes1m
      : series1m.volumes;

  let ema9_1m: number;
  let ema20_1m: number;
  let priceRising = false;
  let usingLiveTicks = false;

  // Priority: real kline closes > live tick history > synthetic
  if (closes1m !== series1m.closes && closes1m.length >= 20) {
    // Using real 1m kline closes
    usingLiveTicks = true;
    const ema9Arr = calcEMA(closes1m, 9);
    const ema20Arr = calcEMA(closes1m, 20);
    ema9_1m = ema9Arr[closes1m.length - 1];
    ema20_1m = ema20Arr[closes1m.length - 1];
    if (closes1m.length >= 5) {
      const last = closes1m.length - 1;
      priceRising = closes1m[last] > closes1m[last - 4];
    }
  } else if (priceHistory.length >= 20) {
    usingLiveTicks = true;
    const liveEma9Arr = calcEMA(priceHistory, 9);
    const liveEma20Arr = calcEMA(priceHistory, 20);
    ema9_1m = liveEma9Arr[priceHistory.length - 1];
    ema20_1m = liveEma20Arr[priceHistory.length - 1];

    if (priceHistory.length >= 5) {
      const last = priceHistory.length - 1;
      priceRising = priceHistory[last] > priceHistory[last - 4];
    }
  } else {
    // Fall back to synthetic 1m series
    const ema9Arr1m = calcEMA(series1m.closes, 9);
    const ema20Arr1m = calcEMA(series1m.closes, 20);
    const last1 = series1m.closes.length - 1;
    ema9_1m = ema9Arr1m[last1];
    ema20_1m = ema20Arr1m[last1];
  }

  // Volume spike detection
  const last1Idx = volumes1m.length - 1;
  const recentVol1m = volumes1m[last1Idx];
  const avgVol1m =
    volumes1m.slice(-20).reduce((a, b) => a + b, 0) /
    Math.min(20, volumes1m.length);

  // For BTC we have real volume from Binance; use a relative spike heuristic
  // (asset.volume is 24h USD volume — elevated values indicate current spike activity)
  let hasVolumeSpike1m: boolean;
  if (asset.symbol === "BTC" && asset.volume > 0) {
    // Compare synthetic spike flag with volume magnitude threshold
    hasVolumeSpike1m = recentVol1m > avgVol1m * 1.5;
  } else {
    // XAU and others: synthetic only
    hasVolumeSpike1m = recentVol1m > avgVol1m * 1.5;
  }

  let momentum1m = 0;
  if (usingLiveTicks) {
    // Tick-driven momentum rules
    if (ema9_1m > ema20_1m && priceRising && hasVolumeSpike1m) {
      momentum1m = 15; // Bullish momentum + direction + volume spike
    } else if (ema9_1m < ema20_1m && !priceRising) {
      momentum1m = 0; // Bearish
    } else if (ema9_1m > ema20_1m) {
      momentum1m = 8; // Partial bullish (no spike or direction confirmation)
    } else {
      momentum1m = 5; // Neutral
    }
  } else {
    // Synthetic fallback
    if (ema9_1m > ema20_1m && hasVolumeSpike1m) {
      momentum1m = 15;
    } else if (ema9_1m > ema20_1m) {
      momentum1m = 8;
    } else if (ema9_1m < ema20_1m) {
      momentum1m = 0;
    } else {
      momentum1m = 5;
    }
  }

  // ── Order Block Detection from 5m ─────────────────────────────────────────
  const { opens: opens5m, highs: highs5m, lows: lows5m } = series5m;
  const n5 = closes5m.length;

  let obLevel = 0;
  let obDirection: "bullish" | "bearish" | null = null;
  let obNear = false;
  let orderBlockScore = 0;

  // Scan last 10 candles of 5m series
  const scanStart = Math.max(0, n5 - 11);
  let bestBullStr = 0;
  let bestBearStr = 0;
  let bullObLevel = 0;
  let bearObLevel = 0;

  for (let i = scanStart; i < n5 - 1; i++) {
    const isBearish = closes5m[i] < opens5m[i];
    const isBullish = closes5m[i] > opens5m[i];
    const nextClose = closes5m[i + 1];

    // Bullish OB: last bearish candle before strong upward move (>0.3%)
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

    // Bearish OB: last bullish candle before strong downward move (>0.3%)
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

  // Price proximity check: within 0.5% of OB level
  if (obLevel > 0 && obDirection !== null) {
    const proximity = Math.abs(price - obLevel) / price;
    obNear = proximity < 0.005;
    orderBlockScore = obNear ? 15 : 0;
  }

  // ── Liquidity Sweep Detection (5m series) ─────────────────────────────────
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

    // Bullish sweep: price breaks previous low and reverses upward
    if (lastLow5 < minPrevLow5 && lastClose5 > minPrevLow5) {
      liquiditySweepDetected = true;
      liquiditySweepDirection = "bullish";
      liqSweepScore = 15;
    }
    // Bearish sweep: price breaks previous high and reverses downward
    else if (lastHigh5 > maxPrevHigh5 && lastClose5 < maxPrevHigh5) {
      liquiditySweepDetected = true;
      liquiditySweepDirection = "bearish";
      liqSweepScore = 0; // bearish sweep = 0 for bull score
    }
  }

  // ── Fake Breakout Detection (5m series) ───────────────────────────────────
  let fakeBreakoutDetected = false;
  let fakeBreakoutDirection: "bullish" | "bearish" | null = null;
  let fakeBreakoutScore = 0;

  if (n5 >= 12) {
    const recentCloses5 = closes5m.slice(-11, -1);
    const support = Math.min(...recentCloses5);
    const resistance = Math.max(...recentCloses5);
    const lastLow5 = lows5m[n5 - 1];
    const lastHigh5 = highs5m[n5 - 1];
    const lastClose5 = closes5m[n5 - 1];

    // Bullish fake breakout: price breaks below support but closes back above
    if (lastLow5 < support && lastClose5 > support) {
      fakeBreakoutDetected = true;
      fakeBreakoutDirection = "bullish";
      fakeBreakoutScore = 10;
    }
    // Bearish fake breakout: price breaks above resistance but closes back below
    else if (lastHigh5 > resistance && lastClose5 < resistance) {
      fakeBreakoutDetected = true;
      fakeBreakoutDirection = "bearish";
      fakeBreakoutScore = 0; // bearish fake breakout = 0 for bull score
    }
  }

  // ── Volume Spike Score (1m) ────────────────────────────────────────────────
  let volumeSpikeScore = 0;
  if (recentVol1m > avgVol1m * 1.5) {
    volumeSpikeScore = 10;
  } else if (avgVol1m > 0) {
    volumeSpikeScore = Math.round((recentVol1m / (avgVol1m * 1.5)) * 10);
  }

  // ── Liquidation Heatmap Pressure (synthetic) ──────────────────────────────
  // Estimate based on price position relative to recent range
  const allCloses = closes5m;
  const rangeHigh = Math.max(...allCloses.slice(-20));
  const rangeLow = Math.min(...allCloses.slice(-20));
  const rangeSize = rangeHigh - rangeLow || 1;
  const pricePosition = (price - rangeLow) / rangeSize; // 0 = at low, 1 = at high

  // Near lower range → more short liquidation pressure (bullish)
  // Near upper range → more long liquidation pressure (bearish)
  const liqHeatmapScore = Math.round((1 - pricePosition) * 5);

  // ── Totals ────────────────────────────────────────────────────────────────
  const total = Math.max(
    0,
    Math.min(
      100,
      trend5m +
        momentum1m +
        confirmation3m +
        orderBlockScore +
        liqSweepScore +
        fakeBreakoutScore +
        volumeSpikeScore +
        liqHeatmapScore,
    ),
  );

  const timeframeScores: TimeframeScores = {
    trend5m,
    momentum1m,
    confirmation3m,
    orderBlock: orderBlockScore,
    liqSweep: liqSweepScore,
    fakeBreakout: fakeBreakoutScore,
    volumeSpike: volumeSpikeScore,
    liqHeatmap: liqHeatmapScore,
    total,
  };

  // ── Indicators for display (from 5m + live ticks) ─────────────────────────
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
  // Keep legacy tags
  if (ema50 > ema200 && ema9 > ema20) smcTags.push("BOS");
  if (confirmation3mBullish && trend5m > 8) smcTags.push("CHoCH");

  // ── Explanation ──────────────────────────────────────────────────────────
  const explanationParts: string[] = [];

  // Live tick analysis header
  if (usingLiveTicks) {
    const momentum = priceRising ? "RISING" : "FALLING";
    explanationParts.push(
      `Live tick analysis: ${priceHistory.length} price ticks monitored — Price momentum: ${momentum}`,
    );
  }

  if (ema50 > ema200) {
    const sep = (((ema50 - ema200) / ema200) * 100).toFixed(2);
    explanationParts.push(
      `5m trend: EMA50 (${ema50.toFixed(0)}) > EMA200 (${ema200.toFixed(0)}) — ${sep}% separation`,
    );
  } else {
    explanationParts.push(
      "5m trend: EMA50 below EMA200 — bearish trend structure",
    );
  }

  if (priceHistory.length >= 60) {
    if (confirmation3m >= 15) {
      explanationParts.push(
        `3m tick structure: higher highs forming, RSI ${rsi3m.toFixed(1)} > 55 — confirmed upward momentum`,
      );
    } else if (confirmation3m === 0) {
      explanationParts.push(
        `3m tick structure: lower lows forming, RSI ${rsi3m.toFixed(1)} < 45 — bearish confirmation`,
      );
    }
  } else {
    if (confirmation3m >= 15) {
      explanationParts.push(
        `3m candle bullish close, RSI ${rsi3m.toFixed(1)} > 55 — confirmed momentum`,
      );
    } else if (confirmation3m === 0) {
      explanationParts.push(
        `3m candle bearish close, RSI ${rsi3m.toFixed(1)} < 45 — bearish confirmation`,
      );
    }
  }

  if (usingLiveTicks) {
    if (ema9_1m > ema20_1m && priceRising && hasVolumeSpike1m) {
      explanationParts.push(
        "1m tick: EMA9 > EMA20, price rising with volume spike — strong bullish momentum",
      );
    } else if (ema9_1m < ema20_1m && !priceRising) {
      explanationParts.push(
        "1m tick: EMA9 below EMA20, price falling — bearish momentum confirmed",
      );
    } else if (ema9_1m > ema20_1m) {
      explanationParts.push(
        "1m tick: EMA9 > EMA20 — partial bullish momentum (awaiting volume confirmation)",
      );
    }
  } else if (ema9_1m > ema20_1m && hasVolumeSpike1m) {
    explanationParts.push(
      "1m: EMA9 crossed above EMA20 with volume spike — strong bullish momentum",
    );
  } else if (ema9_1m < ema20_1m) {
    explanationParts.push("1m: EMA9 below EMA20 — no bullish 1m momentum");
  }

  if (obNear && obDirection === "bullish") {
    explanationParts.push(
      `Price within 0.5% of bullish order block at $${obLevel.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
  }

  if (liquiditySweepDetected && liquiditySweepDirection === "bullish") {
    explanationParts.push(
      "Bullish liquidity sweep: price broke below prior low then reversed — smart money absorption",
    );
  }

  if (fakeBreakoutDetected && fakeBreakoutDirection === "bullish") {
    explanationParts.push(
      "Bullish fake breakout: price pierced support but closed above — bear trap confirmed",
    );
  }

  const explanation = `${explanationParts.slice(0, 4).join(". ")}.`;

  return {
    ema9,
    ema20,
    ema50,
    ema200,
    rsi,
    macdHistogram,
    atr,
    bbUpper,
    bbLower,
    bbMiddle,
    timeframeScores,
    orderBlockLevel: obLevel,
    orderBlockDirection: obDirection,
    orderBlockNear: obNear,
    liquiditySweepDetected,
    liquiditySweepDirection,
    fakeBreakoutDetected,
    fakeBreakoutDirection,
    smcTags,
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock entry type
// ─────────────────────────────────────────────────────────────────────────────

interface LockEntry {
  direction: "STRONG BUY" | "STRONG SELL";
  entryPrice: number;
  signalTime: Date;
  lockedAt: number; // Date.now()
}

const LOCK_DURATION_MS = 3 * 60 * 1000; // 3 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Full signal build from asset + raw scores
// ─────────────────────────────────────────────────────────────────────────────

interface OrderBookConfirmation {
  buyPressure: number;
  sellPressure: number;
  isLoading: boolean;
}

interface LiquidationConfirmation {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
}

interface SmartMoneyConfirmation {
  whaleActivity: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  openInterestChange: number;
  fundingRate: number;
  isLoading: boolean;
}

function buildSignal(
  asset: MarketAsset,
  scores: RawSignalScores,
  lockEntry: LockEntry | undefined,
  lastUpdate: Date | null,
  orderBook?: OrderBookConfirmation,
  liquidation?: LiquidationConfirmation,
  smartMoney?: SmartMoneyConfirmation,
  tfMatrix?: TimeframeMatrix,
): EngineSignal {
  const { timeframeScores } = scores;
  const price = asset.price;

  // Determine direction with lock logic
  let direction: EngineSignal["direction"];
  let entryPrice: number;
  let signalTime: Date | null;
  let isLocked: boolean;

  const now = Date.now();
  if (lockEntry && now - lockEntry.lockedAt < LOCK_DURATION_MS) {
    // Within lock window — use locked direction and entry
    direction = lockEntry.direction;
    entryPrice = lockEntry.entryPrice;
    signalTime = lockEntry.signalTime;
    isLocked = true;
  } else {
    // No lock or lock expired
    const total = timeframeScores.total;
    let rawDir: EngineSignal["direction"];
    if (total > 75) rawDir = "STRONG BUY";
    else if (total < 25) rawDir = "STRONG SELL";
    else rawDir = "WAIT";

    // For BTC: apply order book confirmation gating
    if (asset.symbol === "BTC" && orderBook && !orderBook.isLoading) {
      if (rawDir === "STRONG BUY" && orderBook.buyPressure < 60) {
        rawDir = "WAIT";
      } else if (rawDir === "STRONG SELL" && orderBook.sellPressure < 60) {
        rawDir = "WAIT";
      }
    }

    // For BTC: apply smart money gating (after order book gating)
    if (asset.symbol === "BTC" && smartMoney && !smartMoney.isLoading) {
      if (
        rawDir === "STRONG BUY" &&
        smartMoney.whaleActivity === "DISTRIBUTION"
      ) {
        rawDir = "WAIT";
      } else if (
        rawDir === "STRONG SELL" &&
        smartMoney.whaleActivity === "ACCUMULATION"
      ) {
        rawDir = "WAIT";
      }
    }

    direction = rawDir;
    entryPrice = price;
    signalTime =
      direction !== "WAIT" ? (lockEntry?.signalTime ?? new Date()) : null;
    isLocked = false;
  }

  // ATR-based SL/TP
  const atr = scores.atr;
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
  let riskLevel: EngineSignal["riskLevel"];
  if (atrRatio > 0.03) riskLevel = "HIGH";
  else if (atrRatio > 0.015) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  // Backward-compat scoreBreakdown
  const scoreBreakdown: ScoreBreakdown = {
    trendScore: timeframeScores.trend5m,
    momentumScore: timeframeScores.momentum1m + timeframeScores.confirmation3m,
    volumeScore: timeframeScores.volumeSpike,
    structureScore: timeframeScores.orderBlock + timeframeScores.fakeBreakout,
    liquidityScore: timeframeScores.liqSweep + timeframeScores.liqHeatmap,
    total: timeframeScores.total,
  };

  // Order book & liquidation confirmation fields
  const obBuyPressure = orderBook?.buyPressure ?? 50;
  const obSellPressure = orderBook?.sellPressure ?? 50;
  const liqBias = liquidation?.bias ?? "NEUTRAL";

  let orderBookConfirmed: boolean;
  let liquidationConfirmed: boolean;

  if (asset.symbol === "BTC") {
    if (direction === "STRONG BUY") {
      orderBookConfirmed = obBuyPressure > 60;
      liquidationConfirmed = liqBias === "BULLISH";
    } else if (direction === "STRONG SELL") {
      orderBookConfirmed = obSellPressure > 60;
      liquidationConfirmed = liqBias === "BEARISH";
    } else {
      orderBookConfirmed = false;
      liquidationConfirmed = false;
    }
  } else {
    // XAU — not applicable, always true
    orderBookConfirmed = true;
    liquidationConfirmed = true;
  }

  // Smart money confirmation fields
  const smWhaleActivity = smartMoney?.whaleActivity ?? "NEUTRAL";
  const smOIChange = smartMoney?.openInterestChange ?? 0;
  const smFundingRate = smartMoney?.fundingRate ?? 0;

  let smartMoneyConfirmed: boolean;
  if (direction === "STRONG BUY") {
    smartMoneyConfirmed = smWhaleActivity !== "DISTRIBUTION";
  } else if (direction === "STRONG SELL") {
    smartMoneyConfirmed = smWhaleActivity !== "ACCUMULATION";
  } else {
    smartMoneyConfirmed = false;
  }

  // Apply OI + funding rate bonus/penalty to displayed confidence
  let adjustedConfidence = timeframeScores.total;
  if (smartMoney && !smartMoney.isLoading) {
    if (smOIChange > 0 && smFundingRate > 0) {
      adjustedConfidence = Math.min(100, adjustedConfidence + 3);
    } else if (smOIChange < 0 && smFundingRate < 0) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 3);
    }
  }

  // Blend multi-timeframe alignment score into confidence
  // alignmentScore 0–4: each point above 2 adds +2, below 2 subtracts -2
  if (tfMatrix) {
    const alignBonus = (tfMatrix.alignmentScore - 2) * 2;
    adjustedConfidence = Math.max(
      0,
      Math.min(100, adjustedConfidence + alignBonus),
    );
  }

  return {
    symbol: asset.symbol,
    name: asset.name,
    price,
    direction,
    confidence: adjustedConfidence,
    scoreBreakdown,
    timeframeScores,
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
    atr,
    bbUpper: scores.bbUpper,
    bbLower: scores.bbLower,
    bbMiddle: scores.bbMiddle,
    orderBlockLevel: scores.orderBlockLevel,
    orderBlockDirection: scores.orderBlockDirection,
    orderBlockNear: scores.orderBlockNear,
    liquiditySweepDetected: scores.liquiditySweepDetected,
    liquiditySweepDirection: scores.liquiditySweepDirection,
    fakeBreakoutDetected: scores.fakeBreakoutDetected,
    fakeBreakoutDirection: scores.fakeBreakoutDirection,
    signalTime,
    isLocked,
    orderBookConfirmed,
    liquidationConfirmed,
    orderBookBuyPressure: obBuyPressure,
    orderBookSellPressure: obSellPressure,
    liquidationBias: liqBias,
    smartMoneyConfirmed,
    whaleActivity: smWhaleActivity,
    openInterestChange: smOIChange,
    fundingRate: smFundingRate,
    timeframeMatrix: tfMatrix ?? null,
    alignmentAllowed: tfMatrix?.alignmentAllowed ?? false,
    alignmentScore: tfMatrix?.alignmentScore ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

// Per-symbol rolling price history (last 300 ticks)
const MAX_HISTORY = 300;

export function useSignalEngine(): {
  signals: EngineSignal[];
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: Date | null;
} {
  const { marketData, isConnected, isConnecting, lastUpdate } =
    useMarketWebSocket();

  // Real Binance kline streams for BTC
  const { candles1m, candles3m, lastCandleClose1m, lastCandleClose3m } =
    useBinanceKlines();

  // Order book and liquidation confirmation
  const orderBookState = useOrderBook();
  const liquidationState = useLiquidationData();

  // Smart money flow confirmation
  const smartMoneyState = useSmartMoneyFlow();

  // Multi-timeframe alignment matrices
  const tfMatrices = useMultiTimeframe();

  // Tick counter to drive re-renders during lock windows (every 2 seconds)
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // Lock map: symbol → lock entry
  const lockMapRef = useRef<Map<string, LockEntry>>(new Map());

  // Live price history buffer — persists across renders
  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());

  // Filter to BTC and XAU only
  const filteredAssets = useMemo(
    () => marketData.filter((a) => SIGNAL_ASSETS.has(a.symbol)),
    [marketData],
  );

  // Push each incoming live price tick into the history buffer
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastUpdate intentionally triggers re-push on each new price tick
  useEffect(() => {
    for (const asset of filteredAssets) {
      if (!SIGNAL_ASSETS.has(asset.symbol)) continue;
      const hist = priceHistoryRef.current.get(asset.symbol) ?? [];
      hist.push(asset.price);
      if (hist.length > MAX_HISTORY) hist.shift();
      priceHistoryRef.current.set(asset.symbol, hist);
    }
  }, [filteredAssets, lastUpdate]);

  // Extract real kline closes and volumes for BTC
  const btcCloses1m = useMemo(() => candles1m.map((c) => c.close), [candles1m]);
  const btcCloses3m = useMemo(() => candles3m.map((c) => c.close), [candles3m]);
  const btcVolumes1m = useMemo(
    () => candles1m.map((c) => c.volume),
    [candles1m],
  );

  // Compute raw scores:
  // - For BTC: recalculate on candle close (1m or 3m) OR on tick (for live entry price)
  // - For XAU: recalculate on every price tick (synthetic candles)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional multi-dep recompute
  const rawScores = useMemo(
    () =>
      filteredAssets.map((asset) => {
        if (asset.symbol === "BTC") {
          // Use real kline data for BTC — pass actual candle closes
          return computeRawScores(
            asset,
            priceHistoryRef.current.get("BTC") ?? [],
            btcCloses1m.length >= 20 ? btcCloses1m : undefined,
            btcCloses3m.length >= 10 ? btcCloses3m : undefined,
            btcVolumes1m.length >= 5 ? btcVolumes1m : undefined,
          );
        }
        // XAU: synthetic candles anchored to live price
        return computeRawScores(
          asset,
          priceHistoryRef.current.get(asset.symbol) ?? [],
        );
      }),
    // Recalculate when: candle closes for BTC, OR price ticks for XAU
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filteredAssets,
      lastUpdate,
      lastCandleClose1m,
      lastCandleClose3m,
      btcCloses1m,
      btcCloses3m,
      btcVolumes1m,
    ],
  );

  // Stable primitive refs for OB/liquidation to avoid creating new objects on every render
  const obBuyPressureRef = useRef(orderBookState.buyPressure);
  const obSellPressureRef = useRef(orderBookState.sellPressure);
  const obIsLoadingRef = useRef(orderBookState.isLoading);
  const liqBiasRef = useRef(liquidationState.liquidationBias);

  obBuyPressureRef.current = orderBookState.buyPressure;
  obSellPressureRef.current = orderBookState.sellPressure;
  obIsLoadingRef.current = orderBookState.isLoading;
  liqBiasRef.current = liquidationState.liquidationBias;

  // Stable refs for smart money state
  const smWhaleActivityRef = useRef(smartMoneyState.whaleActivity);
  const smOIChangeRef = useRef(smartMoneyState.openInterestChange);
  const smFundingRateRef = useRef(smartMoneyState.fundingRate);
  const smIsLoadingRef = useRef(smartMoneyState.isLoading);

  smWhaleActivityRef.current = smartMoneyState.whaleActivity;
  smOIChangeRef.current = smartMoneyState.openInterestChange;
  smFundingRateRef.current = smartMoneyState.fundingRate;
  smIsLoadingRef.current = smartMoneyState.isLoading;

  // Apply lock logic and build final signals
  // Entry price always uses current live market price
  const signals = useMemo<EngineSignal[]>(() => {
    const now = Date.now();
    const result: EngineSignal[] = [];

    const obConf: OrderBookConfirmation = {
      buyPressure: obBuyPressureRef.current,
      sellPressure: obSellPressureRef.current,
      isLoading: obIsLoadingRef.current,
    };
    const liqConf: LiquidationConfirmation = {
      bias: liqBiasRef.current,
    };
    const smConf: SmartMoneyConfirmation = {
      whaleActivity: smWhaleActivityRef.current,
      openInterestChange: smOIChangeRef.current,
      fundingRate: smFundingRateRef.current,
      isLoading: smIsLoadingRef.current,
    };

    filteredAssets.forEach((asset, idx) => {
      const scores = rawScores[idx];
      if (!scores) return;

      const sym = asset.symbol;
      const lockMap = lockMapRef.current;
      const existingLock = lockMap.get(sym);
      const total = scores.timeframeScores.total;

      // Resolve multi-timeframe matrix for this asset
      const tfMatrix = tfMatrices.find((m) => m.symbol === sym) ?? null;

      // Determine raw direction (before any gating)
      let rawDirection: "STRONG BUY" | "STRONG SELL" | "WAIT";
      if (total > 75) rawDirection = "STRONG BUY";
      else if (total < 25) rawDirection = "STRONG SELL";
      else rawDirection = "WAIT";

      // ── GATE 1: Multi-timeframe alignment (applied FIRST) ────────────────
      // If 15m + 5m + 3m are not aligned, block signal generation
      let gatedDirection = rawDirection;
      if (tfMatrix && !tfMatrix.alignmentAllowed && gatedDirection !== "WAIT") {
        gatedDirection = "WAIT";
      }

      // Also: if aligned direction contradicts raw direction, block it
      if (tfMatrix?.alignmentAllowed && gatedDirection !== "WAIT") {
        const dominant = tfMatrix.dominantDirection;
        if (dominant === "BULLISH" && gatedDirection === "STRONG SELL") {
          gatedDirection = "WAIT";
        } else if (dominant === "BEARISH" && gatedDirection === "STRONG BUY") {
          gatedDirection = "WAIT";
        }
      }

      // ── GATE 2: Order book confirmation (BTC only) ───────────────────────
      if (asset.symbol === "BTC" && !obConf.isLoading) {
        if (gatedDirection === "STRONG BUY" && obConf.buyPressure < 60) {
          gatedDirection = "WAIT";
        } else if (
          gatedDirection === "STRONG SELL" &&
          obConf.sellPressure < 60
        ) {
          gatedDirection = "WAIT";
        }
      }

      // ── GATE 3: Smart money confirmation (BTC only) ──────────────────────
      if (asset.symbol === "BTC" && !smConf.isLoading) {
        if (
          gatedDirection === "STRONG BUY" &&
          smConf.whaleActivity === "DISTRIBUTION"
        ) {
          gatedDirection = "WAIT";
        } else if (
          gatedDirection === "STRONG SELL" &&
          smConf.whaleActivity === "ACCUMULATION"
        ) {
          gatedDirection = "WAIT";
        }
      }

      // ── Blend alignment score into confidence ────────────────────────────
      // This is for display purposes only; raw scoring unchanged
      // Applied inside buildSignal when returning the signal object

      // Check if existing lock is still valid
      if (existingLock && now - existingLock.lockedAt < LOCK_DURATION_MS) {
        // Lock still active — use it
        result.push(
          buildSignal(
            asset,
            scores,
            existingLock,
            lastUpdate,
            obConf,
            liqConf,
            smConf,
            tfMatrix ?? undefined,
          ),
        );
      } else {
        // Lock expired or none — check if we should set a new lock
        if (gatedDirection !== "WAIT") {
          const newLock: LockEntry = {
            direction: gatedDirection,
            entryPrice: asset.price, // live market price at signal time
            signalTime: new Date(),
            lockedAt: now,
          };
          lockMap.set(sym, newLock);
          result.push(
            buildSignal(
              asset,
              scores,
              newLock,
              lastUpdate,
              obConf,
              liqConf,
              smConf,
              tfMatrix ?? undefined,
            ),
          );
        } else {
          // WAIT — clear any expired lock
          if (existingLock && now - existingLock.lockedAt >= LOCK_DURATION_MS) {
            lockMap.delete(sym);
          }
          result.push(
            buildSignal(
              asset,
              scores,
              undefined,
              lastUpdate,
              obConf,
              liqConf,
              smConf,
              tfMatrix ?? undefined,
            ),
          );
        }
      }
    });

    return result;
  }, [filteredAssets, rawScores, lastUpdate, tfMatrices]);

  return { signals, isConnected, isConnecting, lastUpdate };
}
