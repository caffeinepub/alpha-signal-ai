import {
  AlertTriangle,
  BookOpen,
  Brain,
  FlaskConical,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { callGeminiResearch } from "../utils/geminiClient";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface ResearchReport {
  ticker: string;
  assetType: string;
  executiveSummary: string;
  fundamentalHealth: string;
  technicalOutlook: string;
  priceTargets: string;
  riskAssessment: string;
  keyCatalysts: string;
  overallRating: string;
  rawText: string;
  generatedAt: Date;
}

type AssetType = "Stock" | "Crypto" | "Forex";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const QUICK_PICKS: { label: string; type: AssetType }[] = [
  { label: "NVDA", type: "Stock" },
  { label: "AAPL", type: "Stock" },
  { label: "MSFT", type: "Stock" },
  { label: "TSLA", type: "Stock" },
  { label: "BTC", type: "Crypto" },
  { label: "ETH", type: "Crypto" },
  { label: "SOL", type: "Crypto" },
  { label: "XAU/USD", type: "Forex" },
  { label: "EUR/USD", type: "Forex" },
];

const LOADING_STEPS = [
  "Connecting to Gemini 2.0 Flash...",
  "Fetching market context...",
  "Analyzing fundamentals...",
  "Evaluating technical structure...",
  "Computing price targets...",
  "Assessing risk profile...",
  "Building institutional report...",
];

const RATING_CONFIG: Record<
  string,
  { color: string; glow: string; bg: string; border: string }
> = {
  "STRONG BUY": {
    color: "text-emerald-400",
    glow: "shadow-[0_0_30px_rgba(52,211,153,0.35)]",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
  },
  BUY: {
    color: "text-green-400",
    glow: "shadow-[0_0_20px_rgba(74,222,128,0.25)]",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  HOLD: {
    color: "text-yellow-400",
    glow: "",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  },
  SELL: {
    color: "text-orange-400",
    glow: "shadow-[0_0_20px_rgba(251,146,60,0.25)]",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  "STRONG SELL": {
    color: "text-red-400",
    glow: "shadow-[0_0_30px_rgba(248,113,113,0.35)]",
    bg: "bg-red-500/10",
    border: "border-red-500/40",
  },
};

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function LoadingProgress({ step }: { step: number }) {
  const pct = Math.min(((step + 1) / LOADING_STEPS.length) * 100, 95);
  return (
    <div
      data-ocid="research.generate.loading_state"
      className="flex flex-col items-center gap-6 py-16"
    >
      <div className="relative w-20 h-20">
        <svg
          className="w-20 h-20 -rotate-90"
          viewBox="0 0 80 80"
          aria-label="Loading progress"
          role="img"
        >
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border"
          />
          <motion.circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-primary"
            strokeDasharray={`${2 * Math.PI * 34}`}
            animate={{
              strokeDashoffset: [
                2 * Math.PI * 34,
                2 * Math.PI * 34 * (1 - pct / 100),
              ],
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <FlaskConical className="w-7 h-7 text-primary animate-pulse" />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="text-sm font-mono text-primary tracking-wide"
        >
          {LOADING_STEPS[step] ?? LOADING_STEPS[LOADING_STEPS.length - 1]}
        </motion.p>
      </AnimatePresence>
      <div className="w-64 h-1 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        GEMINI-2.0-FLASH · DEEP ANALYSIS IN PROGRESS
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// Structured section parser
// ────────────────────────────────────────────────────────────

interface ResearchSections {
  executiveSummary: string;
  marketContext: string;
  technicalAnalysis: string;
  tradeBias: string;
  confidence: number;
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
}

function parseResearchSections(rawText: string): ResearchSections {
  const sections: ResearchSections = {
    executiveSummary: "",
    marketContext: "",
    technicalAnalysis: "",
    tradeBias: "NEUTRAL",
    confidence: 50,
    entry: "",
    sl: "",
    tp1: "",
    tp2: "",
  };

  // Extract trade bias
  if (/STRONG BUY/i.test(rawText)) sections.tradeBias = "STRONG BUY";
  else if (/STRONG SELL/i.test(rawText)) sections.tradeBias = "STRONG SELL";
  else if (/\bBUY\b/i.test(rawText)) sections.tradeBias = "BUY";
  else if (/\bSELL\b/i.test(rawText)) sections.tradeBias = "SELL";
  else if (/BULLISH/i.test(rawText)) sections.tradeBias = "BUY";
  else if (/BEARISH/i.test(rawText)) sections.tradeBias = "SELL";

  // Extract confidence
  const confMatch = rawText.match(/confidence[:\s]+(\d+)/i);
  if (confMatch)
    sections.confidence = Math.min(100, Number.parseInt(confMatch[1]));

  // Extract price levels
  const entryMatch = rawText.match(/entry[:\s]+\$?([\d,]+\.?\d*)/i);
  if (entryMatch) sections.entry = entryMatch[1];
  const slMatch = rawText.match(/(?:stop.?loss|sl)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (slMatch) sections.sl = slMatch[1];
  const tp1Match = rawText.match(/(?:tp1|target.?1)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (tp1Match) sections.tp1 = tp1Match[1];
  const tp2Match = rawText.match(/(?:tp2|target.?2)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (tp2Match) sections.tp2 = tp2Match[1];

  // Split into sections by headers
  const lines = rawText.split("\n");
  let currentSection = "executiveSummary";
  const sectionBuffer: string[] = [];

  for (const line of lines) {
    if (/executive.?summary|overview|summary/i.test(line) && line.length < 60) {
      currentSection = "executiveSummary";
      continue;
    }
    if (/market.?context|sentiment|macro/i.test(line) && line.length < 60) {
      if (currentSection === "executiveSummary")
        sections.executiveSummary = sectionBuffer.splice(0).join("\n").trim();
      currentSection = "marketContext";
      continue;
    }
    if (
      /technical.?analysis|structure|technical/i.test(line) &&
      line.length < 60
    ) {
      if (currentSection === "marketContext")
        sections.marketContext = sectionBuffer.splice(0).join("\n").trim();
      else if (currentSection === "executiveSummary")
        sections.executiveSummary = sectionBuffer.splice(0).join("\n").trim();
      currentSection = "technicalAnalysis";
      continue;
    }
    sectionBuffer.push(line);
  }

  // Fill last active section
  const remaining = sectionBuffer.join("\n").trim();
  if (currentSection === "technicalAnalysis")
    sections.technicalAnalysis = remaining;
  else if (currentSection === "marketContext")
    sections.marketContext = remaining;
  else sections.executiveSummary = remaining;

  // Fallback: if sections empty, split into thirds
  if (
    !sections.executiveSummary &&
    !sections.marketContext &&
    !sections.technicalAnalysis
  ) {
    const third = Math.floor(rawText.length / 3);
    sections.executiveSummary = rawText.substring(0, third).trim();
    sections.marketContext = rawText.substring(third, third * 2).trim();
    sections.technicalAnalysis = rawText.substring(third * 2).trim();
  } else if (
    !sections.marketContext &&
    !sections.technicalAnalysis &&
    sections.executiveSummary
  ) {
    const half = Math.floor(sections.executiveSummary.length / 2);
    sections.technicalAnalysis = sections.executiveSummary
      .substring(half)
      .trim();
    sections.executiveSummary = sections.executiveSummary
      .substring(0, half)
      .trim();
  }

  return sections;
}

export default function Research() {
  const [ticker, setTicker] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("Stock");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef = useRef(ticker);
  const assetTypeRef = useRef(assetType);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);
  useEffect(() => {
    assetTypeRef.current = assetType;
  }, [assetType]);

  // Loading step animation
  useEffect(() => {
    if (isLoading) {
      setLoadingStep(0);
      stepIntervalRef.current = setInterval(() => {
        setLoadingStep((prev) =>
          prev < LOADING_STEPS.length - 2 ? prev + 1 : prev,
        );
      }, 1800);
    } else {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
    }
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, [isLoading]);

  const clearAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setNextRefreshIn(null);
  }, []);

  const startAutoRefresh = useCallback(
    (generateFn: () => Promise<void>) => {
      clearAutoRefresh();
      let remaining = 60;
      setNextRefreshIn(remaining);
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setNextRefreshIn(remaining);
        if (remaining <= 0) remaining = 60;
      }, 1000);
      autoRefreshRef.current = setInterval(() => {
        remaining = 60;
        setNextRefreshIn(remaining);
        generateFn();
      }, 60_000);
    },
    [clearAutoRefresh],
  );

  useEffect(() => () => clearAutoRefresh(), [clearAutoRefresh]);

  const generateReport = useCallback(async (sym?: string, type?: string) => {
    const currentTicker = sym ?? tickerRef.current;
    const currentType = type ?? assetTypeRef.current;
    if (!currentTicker.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await callGeminiResearch(
        currentTicker.trim().toUpperCase(),
        currentType || "CRYPTO",
      );

      const built: ResearchReport = {
        ticker: currentTicker.trim().toUpperCase(),
        assetType: currentType,
        executiveSummary: result.executiveSummary,
        fundamentalHealth: result.marketContext,
        technicalOutlook: result.technicalAnalysis,
        priceTargets: result.tradeSetup,
        riskAssessment: "",
        keyCatalysts: "",
        overallRating: result.overallRating,
        rawText: result.rawText,
        generatedAt: new Date(),
      };
      setReport(built);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate report";
      setError(msg);
      console.error("[Research] callGeminiResearch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!ticker.trim()) return;
    clearAutoRefresh();
    setReport(null);
    await generateReport(ticker, assetType);
    startAutoRefresh(() =>
      generateReport(tickerRef.current, assetTypeRef.current),
    );
  }, [ticker, assetType, generateReport, clearAutoRefresh, startAutoRefresh]);

  const handleQuickPick = (label: string, type: AssetType) => {
    setTicker(label);
    setAssetType(type);
    setReport(null);
    setError(null);
    clearAutoRefresh();
  };

  const normalizedRating = report?.overallRating?.toUpperCase().trim() ?? "";
  const ratingCfg = RATING_CONFIG[normalizedRating] ?? RATING_CONFIG.HOLD;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              AI Research Terminal
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Institutional-grade deep analysis powered by Gemini 2.0 Flash
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextRefreshIn !== null && (
            <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
              Auto-refresh in {nextRefreshIn}s
            </span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 glow-cyan flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold font-mono text-primary tracking-widest">
              GEMINI-2.0-FLASH
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Search & Controls ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="trading-card p-5 space-y-4"
      >
        {/* Asset type tabs */}
        <div className="flex items-center gap-1">
          {(["Stock", "Crypto", "Forex"] as AssetType[]).map((type) => (
            <button
              key={type}
              type="button"
              data-ocid={`research.${type.toLowerCase()}.tab`}
              onClick={() => setAssetType(type)}
              className={`px-4 py-1.5 rounded text-xs font-bold font-mono tracking-wide transition-all duration-150 ${
                assetType === type
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40"
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Input + Generate */}
        <div className="flex gap-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading) handleGenerate();
            }}
            placeholder={`Enter ticker (e.g. ${
              assetType === "Stock"
                ? "NVDA"
                : assetType === "Crypto"
                  ? "BTC"
                  : "XAU/USD"
            })`}
            data-ocid="research.ticker.input"
            className="flex-1 bg-input border border-border rounded-md px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
          />
          <button
            type="button"
            data-ocid="research.generate.button"
            onClick={handleGenerate}
            disabled={!ticker.trim() || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 glow-cyan"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FlaskConical className="w-4 h-4" />
                <span>Generate Report</span>
              </>
            )}
          </button>
        </div>

        {/* Quick-pick chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest self-center mr-1">
            Quick:
          </span>
          {QUICK_PICKS.map((pick, idx) => (
            <button
              key={pick.label}
              type="button"
              data-ocid={`research.quickpick.button.${idx + 1}`}
              onClick={() => handleQuickPick(pick.label, pick.type)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border transition-all duration-150 ${
                ticker === pick.label && assetType === pick.type
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-secondary/50 text-muted-foreground border-border/40 hover:text-foreground hover:border-primary/30"
              }`}
            >
              {pick.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Loading ── */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="trading-card"
          >
            <LoadingProgress step={loadingStep} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && !isLoading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            data-ocid="research.error_state"
            className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/25 bg-amber-500/6 text-amber-400/80"
          >
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-0.5">
                Analysis Unavailable
              </p>
              <p className="text-xs opacity-80">{error}</p>
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-2 flex items-center gap-1.5 text-xs font-mono font-semibold hover:opacity-80 transition-opacity"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty State ── */}
      <AnimatePresence>
        {!isLoading && !report && !error && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-ocid="research.empty_state"
            className="trading-card p-16 flex flex-col items-center gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-primary/60" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground mb-1">
                No Report Generated
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Enter a ticker symbol above and click{" "}
                <strong className="text-primary">Generate Report</strong> to get
                institutional-grade AI analysis powered by Gemini 2.0 Flash.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {["NVDA", "BTC", "XAU/USD"].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  data-ocid={`research.quickpick.button.${i + 1}`}
                  onClick={() =>
                    handleQuickPick(
                      t,
                      i === 0 ? "Stock" : i === 1 ? "Crypto" : "Forex",
                    )
                  }
                  className="px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-secondary border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                >
                  Try {t}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Report ── */}
      <AnimatePresence>
        {report &&
          !isLoading &&
          (() => {
            const sections = parseResearchSections(
              report.rawText || report.executiveSummary || "",
            );
            const biasColors: Record<
              string,
              { bg: string; border: string; text: string }
            > = {
              "STRONG BUY": {
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/40",
                text: "text-emerald-400",
              },
              BUY: {
                bg: "bg-green-500/10",
                border: "border-green-500/30",
                text: "text-green-400",
              },
              SELL: {
                bg: "bg-orange-500/10",
                border: "border-orange-500/30",
                text: "text-orange-400",
              },
              "STRONG SELL": {
                bg: "bg-red-500/10",
                border: "border-red-500/40",
                text: "text-red-400",
              },
              NEUTRAL: {
                bg: "bg-yellow-500/10",
                border: "border-yellow-500/30",
                text: "text-yellow-400",
              },
            };
            const bias = sections.tradeBias;
            const biasCfg = biasColors[bias] ?? biasColors.NEUTRAL;

            return (
              <motion.div
                key="report"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Disclaimer */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-ocid="research.disclaimer.panel"
                  className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/8"
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-yellow-400 font-mono tracking-wide mb-0.5">
                      AI-ESTIMATED DATA — NOT FINANCIAL ADVICE
                    </p>
                    <p className="text-xs text-yellow-300/70 leading-relaxed">
                      Analysis generated by Gemini 2.0 Flash from training
                      knowledge. Always verify with official sources.
                    </p>
                  </div>
                </motion.div>

                {/* Header row: Rating + meta */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 }}
                  data-ocid="research.rating.card"
                  className={`backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4 ${ratingCfg.glow}`}
                >
                  <div className="flex flex-col items-center gap-1 sm:border-r sm:border-border/40 sm:pr-6">
                    <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase">
                      Overall Rating
                    </span>
                    <span
                      className={`text-3xl font-black tracking-tight ${ratingCfg.color}`}
                    >
                      {normalizedRating || report.overallRating}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-wrap items-center gap-3">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${ratingCfg.bg} border ${ratingCfg.border}`}
                    >
                      <span
                        className={`text-[10px] font-mono font-bold tracking-widest ${ratingCfg.color}`}
                      >
                        {report.ticker} · {report.assetType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-mono font-bold text-primary tracking-widest">
                        GEMINI-2.0-FLASH
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">
                      {report.generatedAt.toLocaleTimeString("en-US", {
                        hour12: false,
                      })}
                      {nextRefreshIn !== null && (
                        <span className="ml-2 text-primary/60">
                          · refresh in {nextRefreshIn}s
                        </span>
                      )}
                    </span>
                  </div>
                </motion.div>

                {/* 4-card grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Executive Summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    data-ocid="research.report.panel"
                    className="md:col-span-2 backdrop-blur-md bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-blue-400" />
                      <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-blue-400">
                        Executive Summary
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {sections.executiveSummary ||
                        report.executiveSummary ||
                        "System Re-aligning... please wait."}
                    </p>
                  </motion.div>

                  {/* Market Context */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-5 relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-muted-foreground">
                        Market Context
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {sections.marketContext ||
                        report.fundamentalHealth ||
                        "See executive summary for market context."}
                    </p>
                  </motion.div>

                  {/* Technical Analysis */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-5 relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-chart-5" />
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-chart-5" />
                      <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-muted-foreground">
                        Technical Analysis
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {sections.technicalAnalysis ||
                        report.technicalOutlook ||
                        "See executive summary for technical analysis."}
                    </p>
                  </motion.div>

                  {/* Trade Bias */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="md:col-span-2 backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-muted-foreground">
                        Trade Bias & Setup
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Bias badge */}
                      <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${biasCfg.bg} ${biasCfg.border}`}
                      >
                        <span
                          className={`text-lg font-black tracking-tight ${biasCfg.text}`}
                        >
                          {bias}
                        </span>
                      </div>
                      {/* Confidence bar */}
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Confidence
                          </span>
                          <span className="text-[10px] font-mono font-bold text-foreground">
                            {sections.confidence}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${bias.includes("BUY") ? "bg-bull" : bias.includes("SELL") ? "bg-bear" : "bg-hold"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${sections.confidence}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                      {/* Price levels grid */}
                      {(sections.entry ||
                        sections.sl ||
                        sections.tp1 ||
                        sections.tp2) && (
                        <div className="flex gap-2 flex-wrap ml-auto">
                          {sections.entry && (
                            <div className="bg-secondary/50 rounded-md px-3 py-2 text-center min-w-[70px]">
                              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                Entry
                              </div>
                              <div className="text-xs font-mono font-bold text-foreground">
                                ${sections.entry}
                              </div>
                            </div>
                          )}
                          {sections.sl && (
                            <div className="bg-bear/10 border border-bear/20 rounded-md px-3 py-2 text-center min-w-[70px]">
                              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                SL
                              </div>
                              <div className="text-xs font-mono font-bold text-bear">
                                ${sections.sl}
                              </div>
                            </div>
                          )}
                          {sections.tp1 && (
                            <div className="bg-bull/8 border border-bull/15 rounded-md px-3 py-2 text-center min-w-[70px]">
                              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                TP1
                              </div>
                              <div className="text-xs font-mono font-bold text-bull">
                                ${sections.tp1}
                              </div>
                            </div>
                          )}
                          {sections.tp2 && (
                            <div className="bg-bull/12 border border-bull/25 rounded-md px-3 py-2 text-center min-w-[70px]">
                              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                TP2
                              </div>
                              <div className="text-xs font-mono font-bold text-bull">
                                ${sections.tp2}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Report metadata / refresh */}
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/30 bg-card/40">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                      {report.ticker}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">
                      ·
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">
                      {report.assetType}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">
                      ·
                    </span>
                    <span className="text-[10px] font-mono text-primary/60">
                      GEMINI-2.0-FLASH
                    </span>
                  </div>
                  <button
                    type="button"
                    data-ocid="research.refresh.button"
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>
    </div>
  );
}
