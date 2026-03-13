import { useCallback, useEffect, useRef, useState } from "react";
import { useActor } from "./useActor";
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
  if (s === "STRONG BUY") return "STRONG BUY";
  if (s === "STRONG SELL") return "STRONG SELL";
  if (s === "BUY") return "BUY";
  if (s === "SELL") return "SELL";
  return "NEUTRAL";
}

// ─── Default state ────────────────────────────────────────────────────────────

function defaultResult(): GeminiResult {
  return {
    analysisText: "Awaiting Gemini 2.0 Flash analysis...",
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
  const { actor, isFetching } = useActor();
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

  // Stable refs — never cause re-renders or effect re-runs
  const runningRef = useRef(false);
  const initDoneRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  // Keep latest values accessible inside stable callbacks without adding to deps
  const actorRef = useRef(actor);
  const isFetchingRef = useRef(isFetching);
  const marketDataRef = useRef(marketData);
  const candles1mRef = useRef(candles1m);

  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);
  useEffect(() => {
    isFetchingRef.current = isFetching;
  }, [isFetching]);
  useEffect(() => {
    marketDataRef.current = marketData;
  }, [marketData]);
  useEffect(() => {
    candles1mRef.current = candles1m;
  }, [candles1m]);

  // ─── Core analysis function (stable — reads everything through refs) ───────
  const runAnalysis = useCallback(async (isRetry = false) => {
    const currentActor = actorRef.current;
    const currentIsFetching = isFetchingRef.current;
    const currentMarketData = marketDataRef.current;
    const currentCandles = candles1mRef.current;

    if (!currentActor || currentIsFetching) return;
    if (runningRef.current && !isRetry) return;

    const btcAsset = currentMarketData.find((d) => d.symbol === "BTC");
    const xauAsset = currentMarketData.find(
      (d) => d.symbol === "XAU" || d.symbol === "PAXG",
    );

    const btcPrice = btcAsset?.price ?? 0;
    const xauPrice = xauAsset?.price ?? 0;

    // Need at least one price — do not block if only one is zero
    if (btcPrice === 0 && xauPrice === 0) return;

    runningRef.current = true;

    // Compute RSI before try block so it's accessible in catch for local fallback
    const btcCloses = currentCandles.map((c) => c.close);
    const btcRsi = btcCloses.length > 15 ? calcRSI(btcCloses) : 50;
    const xauRsi = 50;

    // ── Immediately show "Gemini is Thinking..." ───────────────────────────
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
      // Build plain-text market data strings for each asset
      const btcSmc =
        btcAsset && btcPrice > (btcAsset.high24h ?? 0) * 0.998
          ? "near 24h high liquidity sweep"
          : btcAsset && btcPrice < (btcAsset.low24h ?? 0) * 1.002
            ? "near 24h low liquidity sweep"
            : "mid range";
      const xauSmc =
        xauAsset && xauPrice > (xauAsset.high24h ?? 0) * 0.998
          ? "near 24h high liquidity sweep"
          : xauAsset && xauPrice < (xauAsset.low24h ?? 0) * 1.002
            ? "near 24h low liquidity sweep"
            : "mid range";

      const btcData = `Asset: BTC, Price: ${btcPrice.toFixed(2)}, RSI: ${btcRsi.toFixed(1)}, SMC: ${btcSmc}, 24h High: ${(btcAsset?.high24h ?? 0).toFixed(2)}, 24h Low: ${(btcAsset?.low24h ?? 0).toFixed(2)}, Volume: ${(btcAsset?.volume ?? 0).toFixed(0)}`;
      const xauData = `Asset: XAU/USD (Gold), Price: ${xauPrice.toFixed(2)}, RSI: ${xauRsi.toFixed(1)}, SMC: ${xauSmc}, 24h High: ${(xauAsset?.high24h ?? 0).toFixed(2)}, 24h Low: ${(xauAsset?.low24h ?? 0).toFixed(2)}, Volume: ${(xauAsset?.volume ?? 0).toFixed(0)}`;

      const [btcText, xauText] = await Promise.all([
        currentActor.analyzeWithGemini(btcData),
        currentActor.analyzeWithGemini(xauData),
      ]);

      // ── Null-response guard: auto-retry up to MAX_RETRIES ─────────────────
      const btcEmpty = !btcText || btcText.trim() === "";
      const xauEmpty = !xauText || xauText.trim() === "";

      if ((btcEmpty || xauEmpty) && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        runningRef.current = false;
        setTimeout(() => runAnalysis(true), 2000);
        return;
      }

      // ── Parse plain text response: BIAS/CONFIDENCE/SIGNAL/INSIGHT ─────────
      const parsePlainText = (text: string) => {
        const extract = (key: string) => {
          const m = text.match(new RegExp(`${key}:\s*(.+)`, "i"));
          return m ? m[1].trim() : "";
        };
        const biasRaw = extract("BIAS");
        const confRaw = extract("CONFIDENCE");
        const signalRaw = extract("SIGNAL");
        const insight =
          extract("INSIGHT") ||
          text
            .split("\n")
            .filter((l) => l.trim() && !l.includes(":"))
            .join(" ")
            .slice(0, 200) ||
          "Analysis complete.";
        const bias = biasRaw || "Neutral";
        const conf = Number.parseInt(confRaw) || 65;
        const signal = (
          signalRaw.toUpperCase().includes("STRONG BUY")
            ? "STRONG BUY"
            : signalRaw.toUpperCase().includes("STRONG SELL")
              ? "STRONG SELL"
              : signalRaw.toUpperCase().includes("BUY")
                ? "BUY"
                : signalRaw.toUpperCase().includes("SELL")
                  ? "SELL"
                  : "NEUTRAL"
        ) as string;
        return { bias, conf, signal, insight };
      };

      const btcParsed = parsePlainText(btcText || "");
      const xauParsed = parsePlainText(xauText || "");

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
          signal: mapSignal(btcParsed.signal),
          geminiConfidence: btcParsed.conf,
          marketBias: btcParsed.bias,
          strategicInsight: btcParsed.insight,
          rawText: btcText || "",
          analysisText: btcEmpty
            ? "Analysis unavailable — retrying..."
            : `${btcParsed.bias} — ${btcParsed.insight}`,
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
          signal: mapSignal(xauParsed.signal),
          geminiConfidence: xauParsed.conf,
          marketBias: xauParsed.bias,
          strategicInsight: xauParsed.insight,
          rawText: xauText || "",
          analysisText: xauEmpty
            ? "Analysis unavailable — retrying..."
            : `${xauParsed.bias} — ${xauParsed.insight}`,
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
      console.error("[Gemini Analysis] Full error object:", err);

      // ── Local AI Analysis fallback based on Institutional Score ───────────
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── initAnalysis: fire once actor is ready + at least one price is live ──
  useEffect(() => {
    if (initDoneRef.current) return;
    if (!actor || isFetching) return;

    const btcPrice = marketData.find((d) => d.symbol === "BTC")?.price ?? 0;
    const xauPrice =
      marketData.find((d) => d.symbol === "XAU" || d.symbol === "PAXG")
        ?.price ?? 0;

    // Fire immediately if prices are ready; otherwise wait 2s for WS to deliver
    initDoneRef.current = true;
    const delay = btcPrice > 0 || xauPrice > 0 ? 0 : 2000;
    setTimeout(() => runAnalysis(), delay);

    // Stable 60s interval — set once and never reset
    intervalRef.current = setInterval(() => runAnalysis(), REFRESH_MS);
  }, [actor, isFetching, marketData, runAnalysis]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // ─── Manual refresh ───────────────────────────────────────────────────────
  const triggerAnalysis = useCallback(() => {
    runningRef.current = false;
    retryCountRef.current = 0;
    runAnalysis();
  }, [runAnalysis]);

  return { ...state, triggerAnalysis };
}
