import { useMemo, useRef } from "react";
import type { Candle } from "./useBinanceKlines";
import { useBinanceKlines } from "./useBinanceKlines";
import { useMarketWebSocket } from "./useMarketWebSocket";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PredictionDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface AssetPrediction {
  symbol: string;
  bullishProb: number; // 0-100
  bearishProb: number; // 0-100
  confidence: number; // 0-100 (how certain the model is)
  prediction: PredictionDirection;
  label: string; // human-readable
  signalStrength: "STRONG BUY" | "STRONG SELL" | "WAIT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator helpers
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

function lastOf(arr: number[]): number {
  return arr.length > 0 ? arr[arr.length - 1] : 0;
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

function calcMACD(prices: number[]): number {
  if (prices.length < 26) return 0;
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = lastOf(ema12) - lastOf(ema26);
  const macdSeries = ema12.map((v, i) => v - ema26[i]);
  const signalLine = lastOf(calcEMA(macdSeries, 9));
  return macdLine - signalLine; // histogram
}

// Generate synthetic OHLCV for assets without live kline data (XAU)
function syntheticCloses(
  price: number,
  n = 200,
  scale = 1.0,
  offset = 0,
): number[] {
  const seed = price * 1000 + offset;
  let prev = price * (1 - 0.05 * scale * Math.abs(Math.sin(seed)));
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    const noise1 = Math.sin(seed * 0.001 + i * 0.8) * 0.012 * scale;
    const noise2 = Math.cos(seed * 0.0007 + i * 1.3) * 0.007 * scale;
    const trend = Math.sin(seed * 0.0003 + i * 0.2) * 0.003;
    const close = prev * (1 + noise1 + noise2 + trend);
    result.push(close);
    prev = close;
  }
  const drift = price / (result[n - 1] || price);
  return result.map((v) => v * drift);
}

function syntheticVolumes(n = 200, base = 1000): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(base * (0.6 + Math.abs(Math.sin(i * 1.7)) * 1.4));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core probability calculation
// ─────────────────────────────────────────────────────────────────────────────

function calculateProbability(
  price: number,
  closes5m: number[],
  closes3m: number[],
  closes1m: number[],
  volumes1m: number[],
  priceHistory: number[],
): { bullishProb: number; bearishProb: number; confidence: number } {
  const n5 = closes5m.length;
  const n3 = closes3m.length;

  // ── 5m Trend (EMA50/200) ──────────────────────────────────────────────────
  const ema50 = lastOf(calcEMA(closes5m, Math.min(50, n5)));
  const ema200 = lastOf(calcEMA(closes5m, Math.min(200, n5)));
  const trendScore = ema50 > ema200 ? 10 : -10;

  // ── 1m Momentum (EMA9/20 + volume) ────────────────────────────────────────
  const livePrices = priceHistory.length >= 20 ? priceHistory : closes1m;
  const ema9 = lastOf(calcEMA(livePrices, 9));
  const ema20 = lastOf(calcEMA(livePrices, 20));
  const priceRising =
    livePrices.length >= 5
      ? livePrices[livePrices.length - 1] > livePrices[livePrices.length - 5]
      : false;

  let momentumScore: number;
  if (ema9 > ema20 && priceRising) momentumScore = 15;
  else if (ema9 > ema20) momentumScore = 7;
  else if (ema9 < ema20 && !priceRising) momentumScore = -15;
  else if (ema9 < ema20) momentumScore = -7;
  else momentumScore = 0;

  // ── 3m Candle Confirmation ─────────────────────────────────────────────────
  const rsi3m = calcRSI(closes3m.length >= 15 ? closes3m : closes5m);
  let conf3m: number;
  if (n3 >= 60) {
    const recentMax = Math.max(...closes3m.slice(-30));
    const priorMax = Math.max(...closes3m.slice(-60, -30));
    const recentMin = Math.min(...closes3m.slice(-30));
    const priorMin = Math.min(...closes3m.slice(-60, -30));
    if (recentMax > priorMax && rsi3m > 55) conf3m = 15;
    else if (recentMin < priorMin && rsi3m < 45) conf3m = -15;
    else conf3m = 0;
  } else {
    if (rsi3m > 60) conf3m = 10;
    else if (rsi3m < 40) conf3m = -10;
    else conf3m = 0;
  }

  // ── RSI Momentum ──────────────────────────────────────────────────────────
  const rsi = calcRSI(closes5m);
  let rsiScore: number;
  if (rsi > 70)
    rsiScore = -8; // overbought
  else if (rsi > 60) rsiScore = 6;
  else if (rsi > 55) rsiScore = 3;
  else if (rsi < 30)
    rsiScore = 8; // oversold
  else if (rsi < 40) rsiScore = -6;
  else if (rsi < 45) rsiScore = -3;
  else rsiScore = 0;

  // ── MACD ──────────────────────────────────────────────────────────────────
  const macdHist = calcMACD(closes5m);
  const macdScore = macdHist > 0 ? 8 : macdHist < 0 ? -8 : 0;

  // ── Volume Spike ──────────────────────────────────────────────────────────
  const avgVol =
    volumes1m.length > 0
      ? volumes1m.slice(-20).reduce((a, b) => a + b, 0) /
        Math.min(20, volumes1m.length)
      : 0;
  const lastVol = volumes1m.length > 0 ? volumes1m[volumes1m.length - 1] : 0;
  const hasSpike = avgVol > 0 && lastVol > avgVol * 1.5;
  // amplify the dominant trend direction
  const volumeScore = hasSpike ? (trendScore > 0 ? 8 : -8) : 0;

  // ── Order Block ───────────────────────────────────────────────────────────
  let obScore = 0;
  if (n5 >= 10) {
    for (let i = Math.max(0, n5 - 10); i < n5 - 1; i++) {
      const impulse = closes5m[i + 1] / closes5m[i] - 1;
      if (Math.abs(impulse) > 0.003) {
        const obLevel = (closes5m[i] + closes5m[i + 1]) / 2;
        const proximity = Math.abs(price - obLevel) / price;
        if (proximity < 0.005) {
          obScore = impulse > 0 ? 12 : -12;
          break;
        }
      }
    }
  }

  // ── Liquidity Sweep ───────────────────────────────────────────────────────
  let liqSweepScore = 0;
  if (n5 >= 10) {
    const prevLows = closes5m.slice(-10, -1).map((c) => c * 0.999);
    const prevHighs = closes5m.slice(-10, -1).map((c) => c * 1.001);
    const lastClose = closes5m[n5 - 1];
    const minLow = Math.min(...prevLows);
    const maxHigh = Math.max(...prevHighs);
    if (lastClose < minLow * 0.999 && price > minLow) liqSweepScore = 10;
    else if (lastClose > maxHigh * 1.001 && price < maxHigh)
      liqSweepScore = -10;
  }

  // ── Fake Breakout ─────────────────────────────────────────────────────────
  let fbScore = 0;
  if (n5 >= 12) {
    const support = Math.min(...closes5m.slice(-11, -1));
    const resistance = Math.max(...closes5m.slice(-11, -1));
    const lastClose5 = closes5m[n5 - 1];
    if (lastClose5 < support * 0.998 && price > support) fbScore = 8;
    else if (lastClose5 > resistance * 1.002 && price < resistance)
      fbScore = -8;
  }

  // ── Liquidation Heatmap (price position in range) ─────────────────────────
  const rangeHigh = Math.max(...closes5m.slice(-20));
  const rangeLow = Math.min(...closes5m.slice(-20));
  const rangeSize = rangeHigh - rangeLow || 1;
  const pricePos = (price - rangeLow) / rangeSize; // 0 = at low, 1 = at high
  const liqHeatmapScore = Math.round((0.5 - pricePos) * 10); // +5 near low, -5 near high

  // ── Combine scores ────────────────────────────────────────────────────────
  const rawScore =
    trendScore +
    momentumScore +
    conf3m +
    rsiScore +
    macdScore +
    volumeScore +
    obScore +
    liqSweepScore +
    fbScore +
    liqHeatmapScore;

  // Max possible absolute score (sum of max absolute values per factor)
  const maxScore = 10 + 15 + 15 + 8 + 8 + 8 + 12 + 10 + 8 + 5; // = 99

  // Normalise to 0-100 probability
  const normalised = ((rawScore + maxScore) / (2 * maxScore)) * 100;
  const bullishProb = Math.min(100, Math.max(0, Math.round(normalised)));
  const bearishProb = 100 - bullishProb;

  // Confidence: distance from 50 (more decisive = higher confidence)
  const confidence = Math.round(Math.abs(bullishProb - 50) * 2);

  return { bullishProb, bearishProb, confidence };
}

function buildPrediction(
  symbol: string,
  price: number,
  closes5m: number[],
  closes3m: number[],
  closes1m: number[],
  volumes1m: number[],
  priceHistory: number[],
): AssetPrediction {
  const { bullishProb, bearishProb, confidence } = calculateProbability(
    price,
    closes5m,
    closes3m,
    closes1m,
    volumes1m,
    priceHistory,
  );

  let prediction: PredictionDirection;
  let label: string;
  if (bullishProb > 70) {
    prediction = "BULLISH";
    label = "Market likely to move UP";
  } else if (bearishProb > 70) {
    prediction = "BEARISH";
    label = "Market likely to move DOWN";
  } else {
    prediction = "NEUTRAL";
    label = "Neutral — no clear direction";
  }

  let signalStrength: AssetPrediction["signalStrength"];
  if (bullishProb > 75 && confidence > 70) signalStrength = "STRONG BUY";
  else if (bearishProb > 75 && confidence > 70) signalStrength = "STRONG SELL";
  else signalStrength = "WAIT";

  return {
    symbol,
    bullishProb,
    bearishProb,
    confidence,
    prediction,
    label,
    signalStrength,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PRICE_HISTORY = 300;

export function usePredictionEngine(): AssetPrediction[] {
  const { marketData, lastUpdate } = useMarketWebSocket();
  const { candles1m, candles3m } = useBinanceKlines();

  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());

  // Accumulate price history
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastUpdate triggers tick
  useMemo(() => {
    for (const asset of marketData) {
      if (
        asset.symbol !== "BTC" &&
        asset.symbol !== "XAU" &&
        asset.symbol !== "GOLD"
      )
        continue;
      const hist = priceHistoryRef.current.get(asset.symbol) ?? [];
      hist.push(asset.price);
      if (hist.length > MAX_PRICE_HISTORY) hist.shift();
      priceHistoryRef.current.set(asset.symbol, hist);
    }
  }, [marketData, lastUpdate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional lastUpdate dep
  return useMemo(() => {
    const predictions: AssetPrediction[] = [];

    // BTC prediction using real klines
    const btc = marketData.find((a) => a.symbol === "BTC");
    if (btc) {
      const btcHistory = priceHistoryRef.current.get("BTC") ?? [];
      const closes5m =
        candles3m.length >= 3
          ? candles3m.map((c) => c.close) // use 3m as proxy for 5m trend when 5m not available
          : syntheticCloses(btc.price, 200, 1.8, 0);
      const closes3m = candles3m.map((c) => c.close);
      const closes1m = candles1m.map((c) => c.close);
      const volumes1m = candles1m.map((c) => c.volume);

      // Prefer longer 5m synthetic series for EMA200 calculation when real klines are short
      const closes5mFull =
        closes5m.length >= 50
          ? closes5m
          : [
              ...syntheticCloses(btc.price, 200 - closes5m.length, 1.8, 0),
              ...closes5m,
            ];

      predictions.push(
        buildPrediction(
          "BTC",
          btc.price,
          closes5mFull,
          closes3m.length >= 10
            ? closes3m
            : syntheticCloses(btc.price, 100, 1.0, 137),
          closes1m.length >= 10
            ? closes1m
            : btcHistory.length >= 10
              ? btcHistory
              : syntheticCloses(btc.price, 100, 0.5, 271),
          volumes1m.length >= 5
            ? volumes1m
            : syntheticVolumes(100, btc.volume / 50),
          btcHistory,
        ),
      );
    }

    // XAU prediction using synthetic candles (no kline stream)
    const xau = marketData.find(
      (a) => a.symbol === "XAU" || a.symbol === "GOLD",
    );
    if (xau) {
      const xauHistory = priceHistoryRef.current.get(xau.symbol) ?? [];
      predictions.push(
        buildPrediction(
          "XAU",
          xau.price,
          syntheticCloses(xau.price, 200, 1.8, 0),
          syntheticCloses(xau.price, 100, 1.0, 137),
          xauHistory.length >= 10
            ? xauHistory
            : syntheticCloses(xau.price, 100, 0.5, 271),
          syntheticVolumes(100, 5000),
          xauHistory,
        ),
      );
    }

    return predictions;
  }, [marketData, lastUpdate, candles1m, candles3m]);
}
