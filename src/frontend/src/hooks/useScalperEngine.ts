import { useEffect, useRef, useState } from "react";
import type { Candle } from "./useBinanceKlines";
import { useBinanceKlines } from "./useBinanceKlines";
import { useMarketWebSocket } from "./useMarketWebSocket";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScalperInputData {
  isInOrderBlock: boolean;
  isLiquiditySweep: boolean;
  currentVolume: number;
  avgVolume20: number;
  trend5m: "BULL" | "BEAR" | "NEUTRAL";
  trend1h: "BULL" | "BEAR" | "NEUTRAL";
  rsi14: number;
  macdHistogram: number;
  direction: "BUY" | "SELL";
}

export interface ScoreResult {
  total: number;
  marketStructure: number;
  volumeProfile: number;
  trendAlignment: number;
  momentum: number;
}

export interface ScalperSignal {
  score: number;
  signalLabel:
    | "STRONG BUY"
    | "STRONG SELL"
    | "CAUTION: SETUP FORMING"
    | "NO TRADE ZONE";
  direction: "BUY" | "SELL" | "WAIT";
  trafficLight: "GREEN" | "RED" | "GREY";
  currentPrice: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  breakdown: {
    marketStructure: number;
    volumeProfile: number;
    trendAlignment: number;
    momentum: number;
  };
  lockedUntil: number;
  isOrderBlock: boolean;
  isLiquiditySweep: boolean;
  volRatio: number;
  trend5m: string;
  trend1h: string;
  rsi14: number;
}

// ─── Pure scoring function (exported for testing) ────────────────────────────

export function calculateConfidenceScore(data: ScalperInputData): ScoreResult {
  // Market Structure (40 pts max)
  let marketStructure = 0;
  if (data.isInOrderBlock) marketStructure += 25;
  if (data.isLiquiditySweep) marketStructure += 15;
  marketStructure = Math.min(40, marketStructure);

  // Volume Profile (30 pts max)
  const volRatio =
    data.avgVolume20 > 0 ? data.currentVolume / data.avgVolume20 : 0;
  let volumeProfile = 5;
  if (volRatio >= 2.0) volumeProfile = 30;
  else if (volRatio >= 1.5) volumeProfile = 22;
  else if (volRatio >= 1.2) volumeProfile = 12;

  // Trend Alignment (20 pts max)
  let trendAlignment = 0;
  if (
    data.trend5m !== "NEUTRAL" &&
    data.trend1h !== "NEUTRAL" &&
    data.trend5m === data.trend1h
  ) {
    // Both point the same direction AND that direction matches what we're scoring
    const trendDir = data.trend5m === "BULL" ? "BUY" : "SELL";
    if (trendDir === data.direction) {
      trendAlignment = 20;
    } else {
      // Trend exists but opposes signal direction
      trendAlignment = 0;
    }
  } else if (data.trend5m === "NEUTRAL" || data.trend1h === "NEUTRAL") {
    trendAlignment = 8;
  } else {
    // Conflict: 5m and 1h disagree
    trendAlignment = 0;
  }

  // Momentum (10 pts max)
  let momentum = 0;
  if (data.direction === "BUY") {
    if (data.rsi14 >= 55 && data.rsi14 <= 75) momentum = 10;
    else if (data.rsi14 >= 50 && data.rsi14 < 55) momentum = 5;
  } else {
    if (data.rsi14 >= 25 && data.rsi14 <= 45) momentum = 10;
    else if (data.rsi14 > 45 && data.rsi14 <= 50) momentum = 5;
  }
  // MACD histogram bonus
  const macdConfirms =
    (data.direction === "BUY" && data.macdHistogram > 0) ||
    (data.direction === "SELL" && data.macdHistogram < 0);
  if (macdConfirms) momentum = Math.min(10, momentum + 2);

  const total = marketStructure + volumeProfile + trendAlignment + momentum;

  return { total, marketStructure, volumeProfile, trendAlignment, momentum };
}

// ─── EMA helpers ─────────────────────────────────────────────────────────────

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

function lastEMA(closes: number[], period: number): number {
  const ema = calcEMA(closes, period);
  return ema.length > 0 ? ema[ema.length - 1] : 0;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── MACD histogram ──────────────────────────────────────────────────────────

function calcMACDHistogram(closes: number[]): number {
  if (closes.length < 26) return 0;
  const ema12 = lastEMA(closes, 12);
  const ema26 = lastEMA(closes, 26);
  const macdLine = ema12 - ema26;
  // Signal = 9-period EMA of macdLine — simplified: just use macdLine sign
  return macdLine;
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i].close;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev),
      Math.abs(c.low - prev),
    );
  });
  const recent = trs.slice(-period);
  return recent.length > 0
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : 0;
}

// ─── Order Block detection ───────────────────────────────────────────────────
// Detect if current price is within the last bearish-before-bullish (for BUY)
// or bullish-before-bearish (for SELL) candle range.

function detectOrderBlock(
  candles: Candle[],
  currentPrice: number,
  direction: "BUY" | "SELL",
): boolean {
  if (candles.length < 5) return false;
  const closed = candles.filter((c) => c.isClosed);
  if (closed.length < 5) return false;

  // Look at last 20 closed candles for an order block
  const window = closed.slice(-20);
  for (let i = 0; i < window.length - 2; i++) {
    const c = window[i];
    const next = window[i + 1];
    const isBearish = c.close < c.open;
    const isBullish = c.close > c.open;
    const nextIsStrong =
      Math.abs(next.close - next.open) > Math.abs(c.close - c.open) * 1.5;

    if (
      direction === "BUY" &&
      isBearish &&
      next.close > c.high &&
      nextIsStrong
    ) {
      // Bearish OB before a strong bullish move — price re-entering OB?
      if (currentPrice >= c.low && currentPrice <= c.high) return true;
    }
    if (
      direction === "SELL" &&
      isBullish &&
      next.close < c.low &&
      nextIsStrong
    ) {
      if (currentPrice >= c.low && currentPrice <= c.high) return true;
    }
  }
  return false;
}

// ─── Liquidity Sweep detection ───────────────────────────────────────────────
// Price crossed prev 24h high/low but reversed within 3 candles

function detectLiquiditySweep(
  candles: Candle[],
  high24h: number,
  low24h: number,
): boolean {
  if (candles.length < 5) return false;
  const recent = candles.slice(-5);
  const brokeHigh = recent.some((c) => c.high > high24h);
  const brokeLow = recent.some((c) => c.low < low24h);
  if (!brokeHigh && !brokeLow) return false;

  const lastClose = recent[recent.length - 1].close;
  // Reversal: if it broke high but closed back below, or broke low but closed above
  if (brokeHigh && lastClose < high24h) return true;
  if (brokeLow && lastClose > low24h) return true;
  return false;
}

// ─── Trend detection from candles ────────────────────────────────────────────

function getTrend(
  candles: Candle[],
  fast: number,
  slow: number,
): "BULL" | "BEAR" | "NEUTRAL" {
  const closes = candles.filter((c) => c.isClosed).map((c) => c.close);
  if (closes.length < slow) return "NEUTRAL";
  const fastEMA = lastEMA(closes, fast);
  const slowEMA = lastEMA(closes, slow);
  if (fastEMA === 0 || slowEMA === 0) return "NEUTRAL";
  const diff = Math.abs(fastEMA - slowEMA) / slowEMA;
  if (diff < 0.0001) return "NEUTRAL";
  return fastEMA > slowEMA ? "BULL" : "BEAR";
}

// ─── Synthesize synthetic candles from tick history ───────────────────────────

function buildSyntheticCandles(ticks: number[], windowSize = 10): Candle[] {
  if (ticks.length < windowSize) return [];
  const candles: Candle[] = [];
  for (
    let i = 0;
    i + windowSize <= ticks.length;
    i += Math.floor(windowSize / 2)
  ) {
    const slice = ticks.slice(i, i + windowSize);
    const open = slice[0];
    const close = slice[slice.length - 1];
    const high = Math.max(...slice);
    const low = Math.min(...slice);
    candles.push({
      time: i,
      open,
      high,
      low,
      close,
      volume: 1,
      isClosed: true,
    });
  }
  return candles;
}

// ─── Lock signal for 180 seconds ─────────────────────────────────────────────

const LOCK_DURATION = 180_000; // 3 minutes

interface LockedSignal {
  signal: ScalperSignal;
  lockedUntil: number;
}

function shouldReplaceSignal(
  current: ScalperSignal | null,
  newScore: number,
  newDirection: "BUY" | "SELL" | "WAIT",
): boolean {
  if (!current) return true;
  if (Date.now() > current.lockedUntil) return true;
  // Allow override if direction flips and new score is much higher
  if (current.direction !== newDirection && newScore > current.score + 15)
    return true;
  return false;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UseScalperEngineResult {
  btc: ScalperSignal | null;
  xau: ScalperSignal | null;
}

export function useScalperEngine(): UseScalperEngineResult {
  const { marketData } = useMarketWebSocket();
  const { candles1m, candles3m } = useBinanceKlines();

  // XAU tick history for synthetic candles
  const xauTicksRef = useRef<number[]>([]);
  const btcLockedRef = useRef<LockedSignal | null>(null);
  const xauLockedRef = useRef<LockedSignal | null>(null);

  const [result, setResult] = useState<UseScalperEngineResult>({
    btc: null,
    xau: null,
  });

  // Track XAU ticks
  const xauAsset = marketData.find((a) => a.symbol === "XAU");
  const xauPrice = xauAsset?.price ?? 0;

  const prevXauPriceRef = useRef(0);
  useEffect(() => {
    if (xauPrice > 0 && xauPrice !== prevXauPriceRef.current) {
      prevXauPriceRef.current = xauPrice;
      xauTicksRef.current = [...xauTicksRef.current.slice(-299), xauPrice];
    }
  }, [xauPrice]);

  // ─── Compute BTC signal ────────────────────────────────────────────────────
  useEffect(() => {
    const btcAsset = marketData.find((a) => a.symbol === "BTC");
    if (!btcAsset || btcAsset.price === 0) return;
    if (candles1m.length < 10) return;

    const currentPrice = btcAsset.price;
    const candles5m = candles3m; // use 3m as proxy for 5m structure
    const closes1m = candles1m.filter((c) => c.isClosed).map((c) => c.close);
    const _closes5m = candles5m.filter((c) => c.isClosed).map((c) => c.close);

    // ATR from 1m
    const atr = calcATR(candles1m);

    // Trend
    const trend5m = getTrend(candles5m, 9, 20); // EMA9 vs EMA20 on 5m proxy
    // 1h trend: use long-range 1m closes as proxy
    const trend1h = getTrend(candles1m, 50, 200); // EMA50 vs EMA200

    // Volume: use last candle volume vs avg 20
    const vol = [...candles1m].filter((c) => c.isClosed);
    const currentVol = vol.length > 0 ? vol[vol.length - 1].volume : 1;
    const avg20Vol =
      vol.length >= 20
        ? vol.slice(-20).reduce((s, c) => s + c.volume, 0) / 20
        : currentVol;

    // RSI & MACD
    const rsi14 = calcRSI(closes1m);
    const macdHistogram = calcMACDHistogram(closes1m);

    // Direction based on trend bias
    const direction: "BUY" | "SELL" =
      trend5m === "BEAR" || (trend5m === "NEUTRAL" && trend1h === "BEAR")
        ? "SELL"
        : "BUY";

    // Order block & liquidity sweep
    const isInOrderBlock = detectOrderBlock(candles5m, currentPrice, direction);
    const isLiquiditySweep = detectLiquiditySweep(
      candles1m,
      btcAsset.high24h,
      btcAsset.low24h,
    );

    // Score
    const inputData: ScalperInputData = {
      isInOrderBlock,
      isLiquiditySweep,
      currentVolume: currentVol,
      avgVolume20: avg20Vol,
      trend5m,
      trend1h,
      rsi14,
      macdHistogram,
      direction,
    };
    const score = calculateConfidenceScore(inputData);

    // Signal classification
    let signalLabel: ScalperSignal["signalLabel"];
    let trafficLight: ScalperSignal["trafficLight"];
    let signalDirection: ScalperSignal["direction"];

    if (score.total >= 80) {
      signalLabel = direction === "BUY" ? "STRONG BUY" : "STRONG SELL";
      trafficLight = direction === "BUY" ? "GREEN" : "RED";
      signalDirection = direction;
    } else if (score.total >= 60) {
      signalLabel = "CAUTION: SETUP FORMING";
      trafficLight = "GREY";
      signalDirection = "WAIT";
    } else {
      signalLabel = "NO TRADE ZONE";
      trafficLight = "GREY";
      signalDirection = "WAIT";
    }

    const atrSafe = atr > 0 ? atr : currentPrice * 0.002;
    const newSignal: ScalperSignal = {
      score: score.total,
      signalLabel,
      direction: signalDirection,
      trafficLight,
      currentPrice,
      entry: currentPrice,
      sl:
        direction === "BUY"
          ? currentPrice - atrSafe * 1.5
          : currentPrice + atrSafe * 1.5,
      tp1:
        direction === "BUY"
          ? currentPrice + atrSafe * 2.0
          : currentPrice - atrSafe * 2.0,
      tp2:
        direction === "BUY"
          ? currentPrice + atrSafe * 3.5
          : currentPrice - atrSafe * 3.5,
      breakdown: {
        marketStructure: score.marketStructure,
        volumeProfile: score.volumeProfile,
        trendAlignment: score.trendAlignment,
        momentum: score.momentum,
      },
      lockedUntil: Date.now() + LOCK_DURATION,
      isOrderBlock: isInOrderBlock,
      isLiquiditySweep,
      volRatio: avg20Vol > 0 ? currentVol / avg20Vol : 0,
      trend5m,
      trend1h,
      rsi14,
    };

    if (
      shouldReplaceSignal(
        btcLockedRef.current?.signal ?? null,
        score.total,
        signalDirection,
      )
    ) {
      btcLockedRef.current = {
        signal: newSignal,
        lockedUntil: newSignal.lockedUntil,
      };
      setResult((prev) => ({ ...prev, btc: newSignal }));
    } else if (btcLockedRef.current) {
      // Update price only, keep signal locked
      const updated: ScalperSignal = {
        ...btcLockedRef.current.signal,
        currentPrice,
      };
      setResult((prev) => ({ ...prev, btc: updated }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles1m, candles3m, marketData]);

  // ─── Compute XAU signal ────────────────────────────────────────────────────
  useEffect(() => {
    if (xauPrice === 0) return;
    const ticks = xauTicksRef.current;
    if (ticks.length < 30) return;

    const candles = buildSyntheticCandles(ticks, 10);
    if (candles.length < 10) return;

    const closes = candles.map((c) => c.close);
    const atr = calcATR(candles);

    const trend5m = getTrend(candles, 9, 20);
    const trend1h = getTrend(candles, 20, 50);

    // Volume approximation: use price volatility as proxy
    const recentVols = closes
      .slice(-20)
      .map((c, i, arr) => (i === 0 ? 0 : Math.abs(c - arr[i - 1])));
    const currentVol = recentVols[recentVols.length - 1] || 0;
    const avg20Vol = recentVols.reduce((a, b) => a + b, 0) / 20 || 0.01;

    const rsi14 = calcRSI(closes);
    const macdHistogram = calcMACDHistogram(closes);

    const direction: "BUY" | "SELL" =
      trend5m === "BEAR" || (trend5m === "NEUTRAL" && trend1h === "BEAR")
        ? "SELL"
        : "BUY";

    const xauAssetData = marketData.find((a) => a.symbol === "XAU");
    const high24h = xauAssetData?.high24h ?? xauPrice * 1.005;
    const low24h = xauAssetData?.low24h ?? xauPrice * 0.995;

    const isInOrderBlock = detectOrderBlock(candles, xauPrice, direction);
    const isLiquiditySweep = detectLiquiditySweep(candles, high24h, low24h);

    const inputData: ScalperInputData = {
      isInOrderBlock,
      isLiquiditySweep,
      currentVolume: currentVol,
      avgVolume20: avg20Vol,
      trend5m,
      trend1h,
      rsi14,
      macdHistogram,
      direction,
    };
    const score = calculateConfidenceScore(inputData);

    let signalLabel: ScalperSignal["signalLabel"];
    let trafficLight: ScalperSignal["trafficLight"];
    let signalDirection: ScalperSignal["direction"];

    if (score.total >= 80) {
      signalLabel = direction === "BUY" ? "STRONG BUY" : "STRONG SELL";
      trafficLight = direction === "BUY" ? "GREEN" : "RED";
      signalDirection = direction;
    } else if (score.total >= 60) {
      signalLabel = "CAUTION: SETUP FORMING";
      trafficLight = "GREY";
      signalDirection = "WAIT";
    } else {
      signalLabel = "NO TRADE ZONE";
      trafficLight = "GREY";
      signalDirection = "WAIT";
    }

    const atrSafe = atr > 0 ? atr : xauPrice * 0.002;
    const newSignal: ScalperSignal = {
      score: score.total,
      signalLabel,
      direction: signalDirection,
      trafficLight,
      currentPrice: xauPrice,
      entry: xauPrice,
      sl:
        direction === "BUY"
          ? xauPrice - atrSafe * 1.5
          : xauPrice + atrSafe * 1.5,
      tp1:
        direction === "BUY"
          ? xauPrice + atrSafe * 2.0
          : xauPrice - atrSafe * 2.0,
      tp2:
        direction === "BUY"
          ? xauPrice + atrSafe * 3.5
          : xauPrice - atrSafe * 3.5,
      breakdown: {
        marketStructure: score.marketStructure,
        volumeProfile: score.volumeProfile,
        trendAlignment: score.trendAlignment,
        momentum: score.momentum,
      },
      lockedUntil: Date.now() + LOCK_DURATION,
      isOrderBlock: isInOrderBlock,
      isLiquiditySweep,
      volRatio: avg20Vol > 0 ? currentVol / avg20Vol : 0,
      trend5m,
      trend1h,
      rsi14,
    };

    if (
      shouldReplaceSignal(
        xauLockedRef.current?.signal ?? null,
        score.total,
        signalDirection,
      )
    ) {
      xauLockedRef.current = {
        signal: newSignal,
        lockedUntil: newSignal.lockedUntil,
      };
      setResult((prev) => ({ ...prev, xau: newSignal }));
    } else if (xauLockedRef.current) {
      const updated: ScalperSignal = {
        ...xauLockedRef.current.signal,
        currentPrice: xauPrice,
      };
      setResult((prev) => ({ ...prev, xau: updated }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xauPrice, marketData]);

  return result;
}
