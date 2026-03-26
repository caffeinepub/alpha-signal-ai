import { useCallback, useEffect, useRef, useState } from "react";
import { callGeminiAnalysis } from "../utils/geminiClient";
import { useBinanceKlines } from "./useBinanceKlines";
import { useMarketWebSocket } from "./useMarketWebSocket";

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  marketBias: string;
  strategicInsight: string;
  rawText: string;
}

export interface GeminiEngineState {
  BTC: GeminiResult;
  XAU: GeminiResult;
  isLoading: boolean;
  error: string | null;
  triggerAnalysis: () => void;
}

// ─── RSI helper ───────────────────────────────────────────────────────────────

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

// ─── Signal mapper ────────────────────────────────────────────────────────────

function mapSignal(raw: string): GeminiSignal {
  const s = (raw ?? "").toUpperCase().trim();
  if (s.includes("STRONG BUY")) return "STRONG BUY";
  if (s.includes("STRONG SELL")) return "STRONG SELL";
  if (s.includes("BUY")) return "BUY";
  if (s.includes("SELL")) return "SELL";
  return "NEUTRAL";
}

// ─── Default state ────────────────────────────────────────────────────────────

function defaultResult(): GeminiResult {
  return {
    analysisText: "Awaiting Gemini 1.5 Pro analysis...",
    signal: "NEUTRAL",
    geminiConfidence: 0,
    ema50: 0,
    ema200: 0,
    rsi14: 50,
    atr14: 0,
    nearHigh: false,
    nearLow: false,
    currentPrice: 0,
    isThinking: false,
    lastUpdated: null,
    marketBias: "Neutral",
    strategicInsight: "",
    rawText: "",
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000;
const MAX_RETRIES = 3;

export function useGeminiEngine(): GeminiEngineState {
  const { marketData } = useMarketWebSocket();
  const { candles1m } = useBinanceKlines();

  const [state, setState] = useState<
    Omit<GeminiEngineState, "triggerAnalysis">
  >({
    BTC: defaultResult(),
    XAU: defaultResult(),
    isLoading: true,
    error: null,
  });

  const runningRef = useRef(false);
  const initDoneRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  const marketDataRef = useRef(marketData);
  const candles1mRef = useRef(candles1m);

  useEffect(() => {
    marketDataRef.current = marketData;
  }, [marketData]);
  useEffect(() => {
    candles1mRef.current = candles1m;
  }, [candles1m]);

  const runAnalysis = useCallback(async (isRetry = false) => {
    const currentMarketData = marketDataRef.current;
    const currentCandles = candles1mRef.current;

    if (runningRef.current && !isRetry) return;

    const btcAsset = currentMarketData.find((d) => d.symbol === "BTC");
    const xauAsset = currentMarketData.find(
      (d) => d.symbol === "XAU" || d.symbol === "PAXG",
    );

    const btcPrice = btcAsset?.price ?? 0;
    const xauPrice = xauAsset?.price ?? 0;

    if (btcPrice === 0 && xauPrice === 0) return;

    runningRef.current = true;

    const btcCloses = currentCandles.map((c) => c.close);
    const btcRsi = btcCloses.length > 15 ? calcRSI(btcCloses) : 50;
    const xauRsi = 50;

    setState((prev) => ({
      ...prev,
      BTC: {
        ...prev.BTC,
        isThinking: true,
        analysisText: "Gemini is Thinking...",
      },
      XAU: {
        ...prev.XAU,
        isThinking: true,
        analysisText: "Gemini is Thinking...",
      },
    }));

    try {
      const [btcResult, xauResult] = await Promise.all([
        callGeminiAnalysis("BTC/USD", "CRYPTO"),
        callGeminiAnalysis("XAU/USD (Gold)", "COMMODITIES"),
      ]);

      const btcEmpty =
        !btcResult.insight || btcResult.insight.includes("unavailable");
      const xauEmpty =
        !xauResult.insight || xauResult.insight.includes("unavailable");

      if ((btcEmpty || xauEmpty) && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        runningRef.current = false;
        setTimeout(() => runAnalysis(true), 2000);
        return;
      }

      retryCountRef.current = 0;
      const now = new Date();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
        BTC: {
          ...prev.BTC,
          isThinking: false,
          lastUpdated: now,
          currentPrice: btcPrice,
          rsi14: btcRsi,
          signal: mapSignal(btcResult.signal),
          geminiConfidence: btcResult.confidence,
          marketBias: btcResult.bias,
          strategicInsight: btcResult.insight,
          rawText: `${btcResult.insight}\n${btcResult.summary}`,
          analysisText: `${btcResult.bias} — ${btcResult.insight}`,
          nearHigh:
            btcAsset && btcAsset.high24h > 0
              ? Math.abs(btcPrice - btcAsset.high24h) / btcAsset.high24h <=
                0.005
              : false,
          nearLow:
            btcAsset && btcAsset.low24h > 0
              ? Math.abs(btcPrice - btcAsset.low24h) / btcAsset.low24h <= 0.005
              : false,
        },
        XAU: {
          ...prev.XAU,
          isThinking: false,
          lastUpdated: now,
          currentPrice: xauPrice,
          rsi14: xauRsi,
          signal: mapSignal(xauResult.signal),
          geminiConfidence: xauResult.confidence,
          marketBias: xauResult.bias,
          strategicInsight: xauResult.insight,
          rawText: `${xauResult.insight}\n${xauResult.summary}`,
          analysisText: `${xauResult.bias} — ${xauResult.insight}`,
          nearHigh:
            xauAsset && xauAsset.high24h > 0
              ? Math.abs(xauPrice - xauAsset.high24h) / xauAsset.high24h <=
                0.005
              : false,
          nearLow:
            xauAsset && xauAsset.low24h > 0
              ? Math.abs(xauPrice - xauAsset.low24h) / xauAsset.low24h <= 0.005
              : false,
        },
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[Gemini Analysis] FAILED:", errorMsg);

      const btcLocalSignal =
        btcRsi > 60 ? "BUY" : btcRsi < 40 ? "SELL" : "NEUTRAL";
      const btcLocalConf = Math.round(Math.abs(btcRsi - 50) * 2);
      const xauLocalSignal =
        xauRsi > 60 ? "BUY" : xauRsi < 40 ? "SELL" : "NEUTRAL";
      const xauLocalConf = Math.round(Math.abs(xauRsi - 50) * 2);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        BTC: {
          ...prev.BTC,
          isThinking: false,
          signal: mapSignal(btcLocalSignal),
          geminiConfidence: btcLocalConf,
          marketBias:
            btcLocalSignal === "BUY"
              ? "Bullish"
              : btcLocalSignal === "SELL"
                ? "Bearish"
                : "Neutral",
          analysisText: `Local AI Analysis: RSI ${btcRsi.toFixed(1)} — ${btcLocalSignal}. Gemini temporarily unavailable.`,
          strategicInsight: `RSI-based signal: ${btcLocalSignal}`,
        },
        XAU: {
          ...prev.XAU,
          isThinking: false,
          signal: mapSignal(xauLocalSignal),
          geminiConfidence: xauLocalConf,
          marketBias:
            xauLocalSignal === "BUY"
              ? "Bullish"
              : xauLocalSignal === "SELL"
                ? "Bearish"
                : "Neutral",
          analysisText: `Local AI Analysis: RSI ${xauRsi.toFixed(1)} — ${xauLocalSignal}. Gemini temporarily unavailable.`,
          strategicInsight: `RSI-based signal: ${xauLocalSignal}`,
        },
        error: errorMsg,
      }));
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (initDoneRef.current) return;

    const btcPrice = marketData.find((d) => d.symbol === "BTC")?.price ?? 0;
    const xauPrice =
      marketData.find((d) => d.symbol === "XAU" || d.symbol === "PAXG")
        ?.price ?? 0;

    initDoneRef.current = true;
    const delay = btcPrice > 0 || xauPrice > 0 ? 0 : 2000;
    setTimeout(() => runAnalysis(), delay);

    intervalRef.current = setInterval(() => runAnalysis(), REFRESH_MS);
  }, [marketData, runAnalysis]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const triggerAnalysis = useCallback(() => {
    runningRef.current = false;
    retryCountRef.current = 0;
    runAnalysis();
  }, [runAnalysis]);

  return { ...state, triggerAnalysis };
}
