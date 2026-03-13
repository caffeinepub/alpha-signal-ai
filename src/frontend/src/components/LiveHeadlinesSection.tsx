import { Skeleton } from "@/components/ui/skeleton";
import { Minus, Newspaper, TrendingDown, TrendingUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { GeminiAnalysis } from "../backend";

type CategoryTag = "MACRO" | "CRYPTO" | "EQUITY" | "COMMODITIES" | "FOREX";
type SentimentTag = "BULLISH" | "BEARISH" | "NEUTRAL";

const CATEGORY_COLORS: Record<CategoryTag, string> = {
  MACRO: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  CRYPTO: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  EQUITY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  COMMODITIES: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  FOREX: "bg-blue-500/15 text-blue-400 border-blue-500/25",
};

function getCategory(index: number): CategoryTag {
  if (index < 2) return "MACRO";
  if (index < 4) return "CRYPTO";
  if (index < 6) return "EQUITY";
  if (index < 8) return "COMMODITIES";
  return "FOREX";
}

function getHeadlineSentiment(headline: string): SentimentTag {
  const lower = headline.toLowerCase();
  const bullishWords = [
    "surge",
    "surges",
    "gains",
    "record",
    "rallies",
    "climbs",
    "beats",
    "strong",
    "leads",
    "rises",
  ];
  const bearishWords = [
    "falls",
    "slips",
    "contracts",
    "pressure",
    "concern",
    "decline",
    "drop",
    "weak",
    "deficit",
    "worry",
  ];
  const bullishCount = bullishWords.filter((w) => lower.includes(w)).length;
  const bearishCount = bearishWords.filter((w) => lower.includes(w)).length;
  if (bullishCount > bearishCount) return "BULLISH";
  if (bearishCount > bullishCount) return "BEARISH";
  return "NEUTRAL";
}

interface Props {
  sentiment: GeminiAnalysis | null;
  isLoading: boolean;
  headlines: string[];
}

function SentimentMeter({ sentiment }: { sentiment: GeminiAnalysis | null }) {
  const bias = sentiment?.marketBias ?? "Neutral";
  const confidence = sentiment?.confidence ?? 50;
  const signal = sentiment?.signal ?? "NEUTRAL";
  const insight =
    sentiment?.strategicInsight ?? "Awaiting Gemini sentiment analysis...";

  const isUp = bias.toLowerCase().includes("bull");
  const isDown = bias.toLowerCase().includes("bear");

  const barColor = isUp ? "bg-bull" : isDown ? "bg-bear" : "bg-hold";
  const pct = isUp || isDown ? confidence : 50;

  const signalColor = signal.includes("BUY")
    ? "bg-bull/15 text-bull border-bull/25"
    : signal.includes("SELL")
      ? "bg-bear/15 text-bear border-bear/25"
      : "bg-hold/15 text-hold border-hold/25";

  return (
    <div
      className="px-4 py-3 border-b border-border/30 bg-white/[0.012]"
      data-ocid="headlines.sentiment_meter"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest">
          Market Sentiment
        </span>
        <span
          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${signalColor}`}
        >
          {signal}
        </span>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-bull inline-block" />
            <span className="text-[9px] font-mono text-bull">Bullish</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-hold inline-block" />
            <span className="text-[9px] font-mono text-hold">Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-bear inline-block" />
            <span className="text-[9px] font-mono text-bear">Bearish</span>
          </div>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">
          {confidence}% conf.
        </span>
      </div>

      {/* Insight */}
      {insight && (
        <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
          {insight}
        </p>
      )}
    </div>
  );
}

function SentimentIcon({ tag }: { tag: SentimentTag }) {
  if (tag === "BULLISH") return <TrendingUp className="w-3 h-3 text-bull" />;
  if (tag === "BEARISH") return <TrendingDown className="w-3 h-3 text-bear" />;
  return <Minus className="w-3 h-3 text-hold" />;
}

export function LiveHeadlinesSection({
  sentiment,
  isLoading,
  headlines,
}: Props) {
  return (
    <motion.div
      className="trading-card overflow-hidden"
      data-ocid="headlines.panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground tracking-wide">
            Live Headlines
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            via Gemini 2.0 Flash
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="text-[9px] font-bold font-mono text-primary tracking-widest">
            LIVE
          </span>
        </div>
      </div>

      {/* Sentiment Meter */}
      {isLoading && !sentiment ? (
        <div className="px-4 py-3 border-b border-border/30">
          <Skeleton className="h-4 w-32 mb-2 bg-secondary" />
          <Skeleton className="h-1.5 w-full rounded-full bg-secondary" />
          <Skeleton className="h-3 w-full mt-2 bg-secondary" />
        </div>
      ) : (
        <SentimentMeter sentiment={sentiment} />
      )}

      {/* Headlines */}
      <div className="overflow-y-auto max-h-[360px]">
        <AnimatePresence>
          {headlines.map((headline, idx) => {
            const category = getCategory(idx);
            const headlineSentiment = getHeadlineSentiment(headline);
            const sentimentColor =
              headlineSentiment === "BULLISH"
                ? "text-bull/80"
                : headlineSentiment === "BEARISH"
                  ? "text-bear/80"
                  : "text-hold/80";

            return (
              <motion.div
                key={headline}
                data-ocid={`headlines.item.${idx + 1}`}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.22 }}
                className="px-4 py-3 border-b border-border/10 hover:bg-white/[0.02] transition-colors duration-100 group"
              >
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border tracking-wider ${CATEGORY_COLORS[category]}`}
                  >
                    {category}
                  </span>
                  <span
                    className={`ml-auto flex items-center gap-1 text-[9px] font-mono ${sentimentColor}`}
                  >
                    <SentimentIcon tag={headlineSentiment} />
                    {headlineSentiment}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-foreground leading-relaxed group-hover:text-primary transition-colors duration-150">
                  {headline}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/20 bg-white/[0.01]">
        <span className="text-[9px] text-muted-foreground/50 font-mono">
          Sentiment powered by Gemini 2.0 Flash · Refreshes every 5 min
        </span>
      </div>
    </motion.div>
  );
}
