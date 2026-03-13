import { useEffect, useRef, useState } from "react";
import type { GeminiAnalysis } from "../backend";
import { useActor } from "./useActor";

// Curated financial headlines used as input for Gemini sentiment analysis
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

// Extended actor type to include methods defined in Candid but not in backendInterface
interface ActorWithSentiment {
  getSentimentFromNews(headlines: string[]): Promise<GeminiAnalysis>;
}

export function useGeminiSentiment() {
  const { actor, isFetching } = useActor();
  const [sentiment, setSentiment] = useState<GeminiAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const actorRef = useRef(actor);

  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);

  useEffect(() => {
    if (isFetching || !actor) return;

    const run = async () => {
      const currentActor =
        actorRef.current as unknown as ActorWithSentiment | null;
      if (!currentActor) return;
      setIsLoading(true);
      try {
        const result =
          await currentActor.getSentimentFromNews(SAMPLE_HEADLINES);
        setSentiment(result);
      } catch (e) {
        console.error("[GeminiSentiment] Failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    run();
    const interval = setInterval(run, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [actor, isFetching]);

  return { sentiment, isLoading, headlines: SAMPLE_HEADLINES };
}
