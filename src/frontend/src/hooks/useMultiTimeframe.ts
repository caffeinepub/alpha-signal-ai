import { useEffect, useMemo, useRef } from "react";
import { useBinanceKlines } from "./useBinanceKlines";
import { useMarketWebSocket } from "./useMarketWebSocket";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TFDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface TimeframeData {
  label: string; // "15M", "5M", "3M", "1M"
  direction: TFDirection;
  strength: number; // 0–100 how strong the signal is
  detail: string; // short detail text e.g. "EMA50 > EMA200"
}

export interface TimeframeMatrix {
  symbol: string;
  tf15m: TimeframeData;
  tf5m: TimeframeData;
  tf3m: TimeframeData;
  tf1m: TimeframeData;
  alignmentScore: number; // 0–4 (one point per aligned TF)
  alignmentAllowed: boolean; // true if 15m + 5m + 3m all agree (score >= 3)
  dominantDirection: TFDirection; // direction when aligned, else NEUTRAL
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic OHLCV generator (copied inline — no circular import from useSignalEngine)
// ─────────────────────────────────────────────────────────────────────────────

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
// Indicator calculations (copied inline)
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

// ─────────────────────────────────────────────────────────────────────────────
// Per-timeframe computation
// ─────────────────────────────────────────────────────────────────────────────

function compute15m(price: number, baseVolume: number): TimeframeData {
  // Synthetic 15m series: scale=2.5, timeOffset=500
  const series = generateOHLCV(price, baseVolume, 2.5, 500);
  const closes = series.closes;
  const last = closes.length - 1;

  const ema50Arr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);
  const ema50 = ema50Arr[last];
  const ema200 = ema200Arr[last];

  if (ema50 > ema200) {
    const sep = (ema50 - ema200) / ema200;
    const strength = Math.min(100, sep * 5000);
    return {
      label: "15M",
      direction: "BULLISH",
      strength,
      detail: `EMA50>${ema50.toFixed(0)} EMA200${ema200.toFixed(0)}`,
    };
  }
  const sep = (ema200 - ema50) / ema200;
  const strength = Math.min(100, sep * 5000);
  return {
    label: "15M",
    direction: "BEARISH",
    strength,
    detail: `EMA50<${ema50.toFixed(0)} EMA200${ema200.toFixed(0)}`,
  };
}

function compute5m(
  price: number,
  baseVolume: number,
  priceHistory: number[],
): TimeframeData {
  let closes: number[];
  let usingLive = false;

  if (priceHistory.length >= 40) {
    closes = priceHistory;
    usingLive = true;
  } else {
    closes = generateOHLCV(price, baseVolume, 1.8, 0).closes;
  }

  const last = closes.length - 1;
  const ema9Arr = calcEMA(closes, 9);
  const ema20Arr = calcEMA(closes, 20);
  const ema9 = ema9Arr[last];
  const ema20 = ema20Arr[last];

  // Market structure: higher highs / lower lows
  let higherHighs = false;
  let lowerLows = false;

  if (usingLive && closes.length >= 20) {
    const recentWindow = closes.slice(-10);
    const priorWindow = closes.slice(-20, -10);
    if (priorWindow.length > 0) {
      higherHighs = Math.max(...recentWindow) > Math.max(...priorWindow);
      lowerLows = Math.min(...recentWindow) < Math.min(...priorWindow);
    }
  }

  const emaBullish = ema9 > ema20;
  const emaBearish = ema9 < ema20;

  if (higherHighs && emaBullish) {
    const sep = (ema9 - ema20) / ema20;
    return {
      label: "5M",
      direction: "BULLISH",
      strength: Math.min(100, sep * 3000 + 30),
      detail: "HH + EMA9>EMA20",
    };
  }
  if (lowerLows && emaBearish) {
    const sep = (ema20 - ema9) / ema20;
    return {
      label: "5M",
      direction: "BEARISH",
      strength: Math.min(100, sep * 3000 + 30),
      detail: "LL + EMA9<EMA20",
    };
  }

  // Partial signal — just EMA
  if (emaBullish) {
    return {
      label: "5M",
      direction: "NEUTRAL",
      strength: 30,
      detail: "EMA9>EMA20 (weak)",
    };
  }
  if (emaBearish) {
    return {
      label: "5M",
      direction: "NEUTRAL",
      strength: 30,
      detail: "EMA9<EMA20 (weak)",
    };
  }

  return {
    label: "5M",
    direction: "NEUTRAL",
    strength: 0,
    detail: "No clear structure",
  };
}

function compute3m(
  price: number,
  baseVolume: number,
  priceHistory: number[],
  realCloses3m?: number[],
): TimeframeData {
  let closes: number[];

  if (realCloses3m && realCloses3m.length >= 30) {
    closes = realCloses3m;
  } else if (priceHistory.length >= 30) {
    closes = priceHistory;
  } else {
    closes = generateOHLCV(price, baseVolume, 1.0, 137).closes;
  }

  const rsi = calcRSI(closes);

  // Higher highs / lower lows
  let higherHighs = false;
  let lowerLows = false;

  if (closes.length >= 30) {
    const recentWindow = closes.slice(-15);
    const priorWindow = closes.slice(-30, -15);
    if (priorWindow.length > 0) {
      higherHighs = Math.max(...recentWindow) > Math.max(...priorWindow);
      lowerLows = Math.min(...recentWindow) < Math.min(...priorWindow);
    }
  }

  if (rsi > 55 && higherHighs) {
    return {
      label: "3M",
      direction: "BULLISH",
      strength: Math.min(100, (rsi - 50) * 3),
      detail: `RSI ${rsi.toFixed(1)} + HH`,
    };
  }
  if (rsi < 45 && lowerLows) {
    return {
      label: "3M",
      direction: "BEARISH",
      strength: Math.min(100, (50 - rsi) * 3),
      detail: `RSI ${rsi.toFixed(1)} + LL`,
    };
  }

  // Partial
  if (rsi > 55) {
    return {
      label: "3M",
      direction: "NEUTRAL",
      strength: 20,
      detail: `RSI ${rsi.toFixed(1)} (no HH)`,
    };
  }
  if (rsi < 45) {
    return {
      label: "3M",
      direction: "NEUTRAL",
      strength: 20,
      detail: `RSI ${rsi.toFixed(1)} (no LL)`,
    };
  }

  return {
    label: "3M",
    direction: "NEUTRAL",
    strength: 0,
    detail: `RSI ${rsi.toFixed(1)} neutral`,
  };
}

function compute1m(
  price: number,
  baseVolume: number,
  priceHistory: number[],
  realCloses1m?: number[],
): TimeframeData {
  let closes: number[];

  if (realCloses1m && realCloses1m.length >= 20) {
    closes = realCloses1m;
  } else if (priceHistory.length >= 20) {
    closes = priceHistory.slice(-50);
  } else {
    closes = generateOHLCV(price, baseVolume, 0.5, 271).closes;
  }

  const last = closes.length - 1;
  const ema9Arr = calcEMA(closes, 9);
  const ema20Arr = calcEMA(closes, 20);
  const ema9 = ema9Arr[last];
  const ema20 = ema20Arr[last];

  // Price direction from last 5 ticks
  let priceRising = false;
  let priceFalling = false;
  if (closes.length >= 5) {
    const recentSlice = closes.slice(-5);
    const firstPrice = recentSlice[0];
    const lastPrice = recentSlice[recentSlice.length - 1];
    priceRising = lastPrice > firstPrice * 1.0001; // small threshold to filter noise
    priceFalling = lastPrice < firstPrice * 0.9999;
  }

  if (ema9 > ema20 && priceRising) {
    const sep = (ema9 - ema20) / ema20;
    return {
      label: "1M",
      direction: "BULLISH",
      strength: Math.min(100, sep * 4000 + 40),
      detail: "EMA9>EMA20 ↑",
    };
  }
  if (ema9 < ema20 && priceFalling) {
    const sep = (ema20 - ema9) / ema20;
    return {
      label: "1M",
      direction: "BEARISH",
      strength: Math.min(100, sep * 4000 + 40),
      detail: "EMA9<EMA20 ↓",
    };
  }

  // Partial
  if (ema9 > ema20) {
    return {
      label: "1M",
      direction: "NEUTRAL",
      strength: 25,
      detail: "EMA9>EMA20 (flat)",
    };
  }
  if (ema9 < ema20) {
    return {
      label: "1M",
      direction: "NEUTRAL",
      strength: 25,
      detail: "EMA9<EMA20 (flat)",
    };
  }

  return { label: "1M", direction: "NEUTRAL", strength: 0, detail: "Flat" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Alignment computation
// ─────────────────────────────────────────────────────────────────────────────

function computeMatrix(
  symbol: string,
  price: number,
  baseVolume: number,
  priceHistory: number[],
  realCloses1m?: number[],
  realCloses3m?: number[],
): TimeframeMatrix {
  const tf15m = compute15m(price, baseVolume);
  const tf5m = compute5m(price, baseVolume, priceHistory);
  const tf3m = compute3m(price, baseVolume, priceHistory, realCloses3m);
  const tf1m = compute1m(price, baseVolume, priceHistory, realCloses1m);

  // Dominant direction: majority of 15m + 5m + 3m
  // All three must agree for alignment
  const alignmentAllowed =
    tf15m.direction !== "NEUTRAL" &&
    tf15m.direction === tf5m.direction &&
    tf5m.direction === tf3m.direction;

  const dominantDirection: TFDirection = alignmentAllowed
    ? tf15m.direction
    : "NEUTRAL";

  // Alignment score: count how many of all 4 TFs match dominantDirection
  let alignmentScore = 0;
  if (dominantDirection !== "NEUTRAL") {
    if (tf15m.direction === dominantDirection) alignmentScore++;
    if (tf5m.direction === dominantDirection) alignmentScore++;
    if (tf3m.direction === dominantDirection) alignmentScore++;
    if (tf1m.direction === dominantDirection) alignmentScore++;
  }

  return {
    symbol,
    tf15m,
    tf5m,
    tf3m,
    tf1m,
    alignmentScore,
    alignmentAllowed,
    dominantDirection,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const ASSETS = ["BTC", "XAU"] as const;
const MAX_HISTORY = 300;

export function useMultiTimeframe(): TimeframeMatrix[] {
  const { marketData, lastUpdate } = useMarketWebSocket();
  const { candles1m, candles3m, lastCandleClose1m, lastCandleClose3m } =
    useBinanceKlines();

  // Per-symbol price history — same approach as useSignalEngine
  const priceHistoryRef = useRef<Map<string, number[]>>(new Map());

  // Push incoming ticks into the history buffer
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastUpdate intentionally triggers re-push
  useEffect(() => {
    for (const asset of marketData) {
      if (!ASSETS.includes(asset.symbol as (typeof ASSETS)[number])) continue;
      const hist = priceHistoryRef.current.get(asset.symbol) ?? [];
      hist.push(asset.price);
      if (hist.length > MAX_HISTORY) hist.shift();
      priceHistoryRef.current.set(asset.symbol, hist);
    }
  }, [marketData, lastUpdate]);

  // Real kline closes for BTC
  const btcCloses1m = useMemo(
    () => (candles1m.length >= 20 ? candles1m.map((c) => c.close) : undefined),
    [candles1m],
  );
  const btcCloses3m = useMemo(
    () => (candles3m.length >= 10 ? candles3m.map((c) => c.close) : undefined),
    [candles3m],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional multi-dep recompute
  const matrices = useMemo<TimeframeMatrix[]>(() => {
    return ASSETS.map((sym) => {
      const asset = marketData.find((a) => a.symbol === sym);
      if (!asset) {
        // Return a neutral placeholder when asset not yet loaded
        const neutralTF = (label: string): TimeframeData => ({
          label,
          direction: "NEUTRAL",
          strength: 0,
          detail: "Loading…",
        });
        return {
          symbol: sym,
          tf15m: neutralTF("15M"),
          tf5m: neutralTF("5M"),
          tf3m: neutralTF("3M"),
          tf1m: neutralTF("1M"),
          alignmentScore: 0,
          alignmentAllowed: false,
          dominantDirection: "NEUTRAL",
        };
      }

      const priceHistory = priceHistoryRef.current.get(sym) ?? [];
      const baseVolume = (asset.volume || 1000) / 50;

      if (sym === "BTC") {
        return computeMatrix(
          sym,
          asset.price,
          baseVolume,
          priceHistory,
          btcCloses1m,
          btcCloses3m,
        );
      }

      // XAU: no real klines
      return computeMatrix(sym, asset.price, baseVolume, priceHistory);
    });
  }, [
    marketData,
    lastUpdate,
    lastCandleClose1m,
    lastCandleClose3m,
    btcCloses1m,
    btcCloses3m,
  ]);

  return matrices;
}
