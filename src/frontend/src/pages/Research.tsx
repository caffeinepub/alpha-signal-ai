import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchReport } from "../backend";
import { useActor } from "../hooks/useActor";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface ResearchReportWithMeta extends ResearchReport {
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
// Helpers
// ────────────────────────────────────────────────────────────

function extractSection(
  text: string,
  header: string,
  nextHeaders: string[],
): string {
  const upper = text.toUpperCase();
  const start = upper.indexOf(header.toUpperCase());
  if (start === -1) return "";
  let end = text.length;
  for (const next of nextHeaders) {
    const pos = upper.indexOf(next.toUpperCase(), start + header.length);
    if (pos !== -1 && pos < end) end = pos;
  }
  return text
    .slice(start + header.length, end)
    .replace(/^[:\s]+/, "")
    .trim();
}

const SECTION_HEADERS = [
  "EXECUTIVE SUMMARY",
  "FUNDAMENTAL HEALTH",
  "TECHNICAL OUTLOOK",
  "PRICE TARGETS",
  "RISK ASSESSMENT",
  "KEY CATALYSTS",
  "OVERALL RATING",
];

function isNeutralOrEmpty(text: string | undefined): boolean {
  if (!text || text.trim().length === 0 || text === "—") return true;
  const t = text.trim().toUpperCase();
  return (
    t === "NEUTRAL" ||
    t === "N/A" ||
    t.startsWith("REPORT GENERATION FAILED") ||
    t.startsWith("ANALYSIS IN PROGRESS") ||
    t.startsWith("GEMINI")
  );
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────
function SectionCard({
  icon: Icon,
  title,
  accentClass,
  borderClass,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accentClass: string;
  borderClass: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-lg border ${borderClass} bg-card/60 backdrop-blur-sm p-5`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentClass}`} />
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className={`w-4 h-4 ${accentClass.replace("bg-", "text-")}`} />
        <span className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </motion.div>
  );
}

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
export default function Research() {
  const { actor } = useActor();

  const [ticker, setTicker] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("Stock");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [report, setReport] = useState<ResearchReportWithMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef = useRef(ticker);
  const assetTypeRef = useRef(assetType);
  const actorRef = useRef(actor);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);
  useEffect(() => {
    assetTypeRef.current = assetType;
  }, [assetType]);
  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);

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

  // Cleanup on unmount
  useEffect(() => () => clearAutoRefresh(), [clearAutoRefresh]);

  const generateReport = useCallback(async (sym?: string, type?: string) => {
    const currentActor = actorRef.current;
    const currentTicker = sym ?? tickerRef.current;
    const currentType = type ?? assetTypeRef.current;
    if (!currentTicker.trim() || !currentActor) return;

    setIsLoading(true);
    setError(null);

    try {
      const plainText = await currentActor.researchWithGemini(
        currentTicker.trim().toUpperCase(),
      );
      // Build ResearchReport from plain text using section extraction
      const fullText = plainText || "";
      const getSection = (header: string) => {
        const idx = SECTION_HEADERS.indexOf(header);
        const remaining = SECTION_HEADERS.slice(idx + 1);
        return extractSection(fullText, header, remaining);
      };
      const overallRatingRaw = getSection("OVERALL RATING");
      let overallRating = "HOLD";
      for (const r of ["STRONG BUY", "STRONG SELL", "BUY", "SELL", "HOLD"]) {
        if (overallRatingRaw.toUpperCase().includes(r)) {
          overallRating = r;
          break;
        }
      }
      const built: ResearchReportWithMeta = {
        ticker: currentTicker.trim().toUpperCase(),
        assetType: currentType,
        executiveSummary:
          getSection("EXECUTIVE SUMMARY") ||
          (fullText.length > 0
            ? fullText.slice(0, 400)
            : "Analysis in progress."),
        fundamentalHealth:
          getSection("FUNDAMENTAL HEALTH") ||
          "Fundamental data being compiled.",
        technicalOutlook:
          getSection("TECHNICAL OUTLOOK") || "Technical analysis in progress.",
        priceTargets:
          getSection("PRICE TARGETS") || "Price targets being calculated.",
        riskAssessment:
          getSection("RISK ASSESSMENT") || "Risk assessment in progress.",
        keyCatalysts:
          getSection("KEY CATALYSTS") || "Catalysts being identified.",
        overallRating,
        rawText: fullText,
        generatedAt: new Date(),
      };
      setReport(built);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate report",
      );
      console.error("[Research] researchWithGemini failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!ticker.trim() || !actor) return;
    clearAutoRefresh();
    setReport(null);
    await generateReport(ticker, assetType);
    // Start 60s auto-refresh for the current ticker
    startAutoRefresh(() =>
      generateReport(tickerRef.current, assetTypeRef.current),
    );
  }, [
    ticker,
    assetType,
    actor,
    generateReport,
    clearAutoRefresh,
    startAutoRefresh,
  ]);

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
            placeholder={`Enter ticker (e.g. ${assetType === "Stock" ? "NVDA" : assetType === "Crypto" ? "BTC" : "XAU/USD"})`}
            data-ocid="research.ticker.input"
            className="flex-1 bg-input border border-border rounded-md px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
          />
          <button
            type="button"
            data-ocid="research.generate.button"
            onClick={handleGenerate}
            disabled={!ticker.trim() || isLoading || !actor}
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
        {report && !isLoading && (
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
                  Fundamental metrics are generated by Gemini 2.0 Flash based on
                  training knowledge. This is not financial advice. Always
                  verify with official sources before making investment
                  decisions.
                </p>
              </div>
            </motion.div>

            {/* Overall Rating */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              data-ocid="research.rating.card"
              className={`trading-card p-6 flex flex-col items-center gap-2 ${ratingCfg.glow}`}
            >
              <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                Overall Rating
              </span>
              <span
                className={`text-3xl font-black tracking-tight ${ratingCfg.color}`}
              >
                {normalizedRating || report.overallRating}
              </span>
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-md ${ratingCfg.bg} border ${ratingCfg.border}`}
              >
                <span
                  className={`text-[10px] font-mono font-bold tracking-widest ${ratingCfg.color}`}
                >
                  {report.ticker} · {report.assetType.toUpperCase()} ·
                  GEMINI-2.0-FLASH
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/50 mt-1">
                Generated at{" "}
                {report.generatedAt.toLocaleTimeString("en-US", {
                  hour12: false,
                })}
                {nextRefreshIn !== null && (
                  <span className="ml-2 text-primary/60">
                    {" "}
                    · Auto-refresh in {nextRefreshIn}s
                  </span>
                )}
              </span>
            </motion.div>

            {/* Section cards */}
            <div className="grid grid-cols-1 gap-4">
              <SectionCard
                icon={BookOpen}
                title="Executive Summary"
                accentClass="bg-blue-500"
                borderClass="border-blue-500/20"
              >
                {isNeutralOrEmpty(report.executiveSummary)
                  ? "System Re-aligning... please wait."
                  : report.executiveSummary ||
                    "System Re-aligning... please wait."}
              </SectionCard>
              <SectionCard
                icon={BarChart2}
                title="Fundamental Health"
                accentClass="bg-emerald-500"
                borderClass="border-emerald-500/20"
              >
                {isNeutralOrEmpty(report.fundamentalHealth)
                  ? "System Re-aligning... please wait."
                  : report.fundamentalHealth ||
                    "System Re-aligning... please wait."}
                <p className="mt-3 text-[10px] font-mono text-yellow-400/70 italic">
                  ⚠ AI-estimated. Verify with official filings.
                </p>
              </SectionCard>
              <SectionCard
                icon={TrendingUp}
                title="Technical Outlook"
                accentClass="bg-cyan-500"
                borderClass="border-cyan-500/20"
              >
                {isNeutralOrEmpty(report.technicalOutlook)
                  ? "System Re-aligning... please wait."
                  : report.technicalOutlook ||
                    "System Re-aligning... please wait."}
              </SectionCard>
              <SectionCard
                icon={Target}
                title="Price Targets"
                accentClass="bg-violet-500"
                borderClass="border-violet-500/20"
              >
                {isNeutralOrEmpty(report.priceTargets)
                  ? "System Re-aligning... please wait."
                  : report.priceTargets || "System Re-aligning... please wait."}
              </SectionCard>
              <SectionCard
                icon={ShieldAlert}
                title="Risk Assessment"
                accentClass="bg-red-500"
                borderClass="border-red-500/20"
              >
                {isNeutralOrEmpty(report.riskAssessment)
                  ? "System Re-aligning... please wait."
                  : report.riskAssessment ||
                    "System Re-aligning... please wait."}
              </SectionCard>
              <SectionCard
                icon={Zap}
                title="Key Catalysts"
                accentClass="bg-amber-500"
                borderClass="border-amber-500/20"
              >
                {isNeutralOrEmpty(report.keyCatalysts)
                  ? "System Re-aligning... please wait."
                  : report.keyCatalysts || "System Re-aligning... please wait."}
              </SectionCard>
            </div>

            {/* Report metadata */}
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
        )}
      </AnimatePresence>
    </div>
  );
}
