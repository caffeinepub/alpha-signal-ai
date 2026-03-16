import { useEffect, useRef, useState } from "react";
import { callGeminiRaw } from "../utils/geminiClient";

const SAMPLE_HEADLINES = [
  "Federal Reserve signals potential rate pause as inflation data cools",
  "Bitcoin surges past $85,000 on institutional ETF inflows",
  "Gold hits record high amid global uncertainty and dollar weakness",
  "NVIDIA reports record datacenter revenue, AI chip demand remains strong",
  "S&P 500 futures climb as CPI beats expectations",
  "Euro slips ahead of ECB policy decision",
  "Oil rallies on OPEC+ production cut extension",
  "Treasury yields rise, pressure on growth stocks",
  "China manufacturing PMI contracts for third straight month",
  "Tech sector leads market gains on strong earnings season",
];

export interface SentimentResult {
  bias: string;
  confidence: number;
  signal: string;
  insight: string;
}

export function useGeminiSentiment() {
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const run = async () => {
      setIsLoading(true);
      try {
        const prompt = `Analyze these market headlines and return a JSON sentiment analysis:
Headlines: ${SAMPLE_HEADLINES.join("; ")}
Return ONLY a JSON object: {"bias": "BULLISH/BEARISH/NEUTRAL", "confidence": 0-100, "signal": "BUY/SELL/HOLD", "insight": "one sentence"}`;
        const text = await callGeminiRaw(prompt);
        if (text) {
          try {
            const clean = text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            const parsed = JSON.parse(clean);
            setSentiment(parsed);
          } catch {
            setSentiment({
              bias: "NEUTRAL",
              confidence: 50,
              signal: "HOLD",
              insight: text.slice(0, 200),
            });
          }
        }
      } catch (e) {
        console.error("[GeminiSentiment] Failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    run();
    const interval = setInterval(run, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { sentiment, isLoading, headlines: SAMPLE_HEADLINES };
}
