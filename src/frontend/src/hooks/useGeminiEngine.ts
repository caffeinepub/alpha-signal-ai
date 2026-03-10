import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeminiSignal =
  | "STRONG BUY"
  | "BUY"
  | "NEUTRAL"
  | "SELL"
  | "STRONG SELL";

export interface GeminiResult {
  analysisText: string;
  signal: GeminiSignal;
  geminiConfidence: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  nearHigh: boolean;
  nearLow: boolean;
  currentPrice: number;
  isThinking: boolean;
  lastUpdated: Date | null;
}

export interface GeminiEngineState {
  BTC: GeminiResult;
  XAU: GeminiResult;
  isLoading: boolean;
  error: string | null;
}

// ─── Math Utilities ───────────────────────────────────────────────────────────

function calcEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number {
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  if (trs.length < period)
    return trs.reduce((a, b) => a + b, 0) / (trs.length || 1);
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ─── Analysis Engine ──────────────────────────────────────────────────────────

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

function analyzeCandles(
  candles: Candle[],
): Omit<GeminiResult, "isThinking" | "lastUpdated"> {
  if (candles.length < 5) {
    return {
      analysisText: "Neutral — Gemini 3.0 awaiting confluence signal",
      signal: "NEUTRAL",
      geminiConfidence: 50,
      ema50: 0,
      ema200: 0,
      rsi14: 50,
      atr14: 0,
      nearHigh: false,
      nearLow: false,
      currentPrice: candles[candles.length - 1]?.close ?? 0,
    };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const currentPrice = closes[closes.length - 1];
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi14 = calcRSI(closes, 14);
  const atr14 = calcATR(highs, lows, closes, 14);

  // 24h high/low from last 24 candles (1h bars)
  const last24 = candles.slice(-24);
  const high24 = Math.max(...last24.map((c) => c.high));
  const low24 = Math.min(...last24.map((c) => c.low));
  const rangeThreshold = 0.005; // 0.5%
  const nearHigh = Math.abs(currentPrice - high24) / high24 <= rangeThreshold;
  const nearLow = Math.abs(currentPrice - low24) / low24 <= rangeThreshold;

  // Scoring system — count alignment
  let score = 0;
  let conditions = 0;

  // RSI condition
  conditions++;
  if (rsi14 < 30)
    score += 2; // oversold = bullish
  else if (rsi14 > 70)
    score -= 2; // overbought = bearish
  else if (rsi14 < 50) score += 0.5;
  else score -= 0.5;

  // EMA trend
  conditions++;
  if (currentPrice > ema50) score += 1;
  else score -= 1;

  conditions++;
  if (currentPrice > ema200) score += 1;
  else score -= 1;

  // SMC: liquidity sweep zones
  if (nearLow) {
    conditions++;
    if (rsi14 < 40)
      score += 2; // near low + oversold = strong buy signal
    else score += 0.5;
  }
  if (nearHigh) {
    conditions++;
    if (rsi14 > 60)
      score -= 2; // near high + overbought = strong sell signal
    else score -= 0.5;
  }

  // Normalise confidence 0-100
  const maxScore = conditions * 2;
  const normalised = (score + maxScore) / (2 * maxScore);
  const geminiConfidence = Math.round(
    Math.max(10, Math.min(95, normalised * 100)),
  );

  // Signal determination
  let signal: GeminiSignal;
  let analysisText: string;

  if (rsi14 < 30 && nearLow) {
    signal = "STRONG BUY";
    analysisText =
      "Strong Buy — Gemini 3.0 identifies oversold liquidity sweep";
  } else if (rsi14 > 70 && nearHigh) {
    signal = "STRONG SELL";
    analysisText =
      "Strong Sell — Gemini 3.0 detects overbought distribution zone";
  } else if (currentPrice > ema50 && currentPrice > ema200) {
    signal = "BUY";
    analysisText = "Buy — Gemini 3.0 confirms bullish trend continuation";
  } else if (currentPrice < ema50 && currentPrice < ema200) {
    signal = "SELL";
    analysisText = "Sell — Gemini 3.0 confirms bearish trend continuation";
  } else {
    signal = "NEUTRAL";
    analysisText = "Neutral — Gemini 3.0 awaiting confluence signal";
  }

  return {
    analysisText,
    signal,
    geminiConfidence,
    ema50,
    ema200,
    rsi14,
    atr14,
    nearHigh,
    nearLow,
    currentPrice,
  };
}

// ─── Default state ────────────────────────────────────────────────────────────

function defaultResult(): GeminiResult {
  return {
    analysisText: "Neutral — Gemini 3.0 awaiting confluence signal",
    signal: "NEUTRAL",
    geminiConfidence: 50,
    ema50: 0,
    ema200: 0,
    rsi14: 50,
    atr14: 0,
    nearHigh: false,
    nearLow: false,
    currentPrice: 0,
    isThinking: false,
    lastUpdated: null,
  };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchBinanceKlines(symbol: string): Promise<Candle[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`,
  );
  if (!res.ok) throw new Error(`Binance klines failed for ${symbol}`);
  const raw: [number, string, string, string, string, ...unknown[]][] =
    await res.json();
  return raw.map((k) => ({
    open: Number.parseFloat(k[1]),
    high: Number.parseFloat(k[2]),
    low: Number.parseFloat(k[3]),
    close: Number.parseFloat(k[4]),
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000;
const SIGNIFICANT_MOVE = 0.005; // 0.5%
const THINKING_MS = 2_000;

export function useGeminiEngine(): GeminiEngineState {
  const [state, setState] = useState<GeminiEngineState>({
    BTC: defaultResult(),
    XAU: defaultResult(),
    isLoading: true,
    error: null,
  });

  // Track previous prices to detect significant moves
  const prevPrices = useRef<{ BTC: number; XAU: number }>({ BTC: 0, XAU: 0 });
  const thinkingTimers = useRef<{
    BTC: ReturnType<typeof setTimeout> | null;
    XAU: ReturnType<typeof setTimeout> | null;
  }>({
    BTC: null,
    XAU: null,
  });

  const runAnalysis = useCallback(async () => {
    try {
      const [btcCandles, xauCandles] = await Promise.all([
        fetchBinanceKlines("BTCUSDT"),
        fetchBinanceKlines("PAXGUSDT"),
      ]);

      const btcAnalysis = analyzeCandles(btcCandles);
      const xauAnalysis = analyzeCandles(xauCandles);
      const now = new Date();

      setState((prev) => {
        const results: GeminiEngineState = {
          BTC: {
            ...btcAnalysis,
            isThinking: prev.BTC.isThinking,
            lastUpdated: now,
          },
          XAU: {
            ...xauAnalysis,
            isThinking: prev.XAU.isThinking,
            lastUpdated: now,
          },
          isLoading: false,
          error: null,
        };

        // Detect significant price moves and trigger thinking state
        for (const asset of ["BTC", "XAU"] as const) {
          const newPrice = results[asset].currentPrice;
          const prevPrice = prevPrices.current[asset];
          if (prevPrice > 0) {
            const move = Math.abs((newPrice - prevPrice) / prevPrice);
            if (move > SIGNIFICANT_MOVE) {
              results[asset].isThinking = true;
              if (thinkingTimers.current[asset]) {
                clearTimeout(thinkingTimers.current[asset]!);
              }
              thinkingTimers.current[asset] = setTimeout(() => {
                setState((s) => ({
                  ...s,
                  [asset]: { ...s[asset], isThinking: false },
                }));
              }, THINKING_MS);
            }
          }
          prevPrices.current[asset] = newPrice;
        }

        return results;
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Analysis failed",
      }));
    }
  }, []);

  useEffect(() => {
    runAnalysis();
    const interval = setInterval(runAnalysis, REFRESH_MS);
    return () => {
      clearInterval(interval);
      if (thinkingTimers.current.BTC) clearTimeout(thinkingTimers.current.BTC);
      if (thinkingTimers.current.XAU) clearTimeout(thinkingTimers.current.XAU);
    };
  }, [runAnalysis]);

  return state;
}
