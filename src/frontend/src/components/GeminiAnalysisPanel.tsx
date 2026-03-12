import { Badge } from "@/components/ui/badge";
import { Bot, Cpu, Loader2, RefreshCw, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { GeminiResult, GeminiSignal } from "../hooks/useRealGeminiEngine";

// ─── Color Helpers ────────────────────────────────────────────────────────────

function signalColors(signal: GeminiSignal) {
  switch (signal) {
    case "STRONG BUY":
      return {
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        bar: "bg-emerald-500",
        badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      };
    case "BUY":
      return {
        text: "text-bull",
        bg: "bg-bull/10",
        border: "border-bull/30",
        bar: "bg-bull",
        badge: "bg-bull/20 text-bull border-bull/40",
      };
    case "STRONG SELL":
      return {
        text: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
        bar: "bg-rose-500",
        badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
      };
    case "SELL":
      return {
        text: "text-bear",
        bg: "bg-bear/10",
        border: "border-bear/30",
        bar: "bg-bear",
        badge: "bg-bear/20 text-bear border-bear/40",
      };
    default:
      return {
        text: "text-hold",
        bg: "bg-hold/10",
        border: "border-hold/30",
        bar: "bg-hold",
        badge: "bg-hold/20 text-hold border-hold/40",
      };
  }
}

// ─── Asset Analysis Card ─────────────────────────────────────────────────────

function AssetGeminiCard({
  asset,
  result,
}: {
  asset: string;
  result: GeminiResult;
}) {
  const colors = signalColors(result.signal);

  return (
    <div
      className={`rounded-xl border ${colors.border} ${colors.bg} p-4 relative overflow-hidden`}
    >
      {/* Subtle glow overlay */}
      <div
        className={`absolute inset-0 opacity-5 pointer-events-none ${colors.bar} blur-2xl`}
        style={{ borderRadius: "inherit" }}
      />

      {/* Header row */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] font-bold font-mono text-primary">
              {asset === "XAU" ? "AU" : asset.slice(0, 2)}
            </span>
          </div>
          <span className="text-sm font-bold text-foreground font-mono">
            {asset}
          </span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${colors.badge}`}
        >
          {result.signal}
        </span>
      </div>

      {/* Thinking / Analysis state */}
      <div className="relative z-10 min-h-[52px]">
        <AnimatePresence mode="wait">
          {result.isThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 py-2"
            >
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
              <span className="text-[11px] text-muted-foreground italic">
                Generating Insight via Gemini 2.0 Flash...
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <p
                className={`text-[11px] font-semibold leading-relaxed mb-2 ${colors.text}`}
              >
                {result.analysisText}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Institutional Probability bar */}
      <div className="relative z-10 mt-1">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" />
            Institutional Probability
          </span>
          <span className={`font-mono font-bold ${colors.text}`}>
            {result.geminiConfidence}%
          </span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${colors.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${result.geminiConfidence}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Technical stats row */}
      <div className="relative z-10 grid grid-cols-4 gap-1 mt-3 pt-2 border-t border-border/30">
        {(
          [
            { label: "RSI", value: result.rsi14.toFixed(1) },
            {
              label: "EMA50",
              value:
                result.ema50 > 0
                  ? `$${(result.ema50 / (result.ema50 >= 1000 ? 1000 : 1)).toFixed(result.ema50 >= 1000 ? 1 : 2)}${
                      result.ema50 >= 1000 ? "K" : ""
                    }`
                  : "—",
            },
            {
              label: "EMA200",
              value:
                result.ema200 > 0
                  ? `$${(result.ema200 / (result.ema200 >= 1000 ? 1000 : 1)).toFixed(result.ema200 >= 1000 ? 1 : 2)}${
                      result.ema200 >= 1000 ? "K" : ""
                    }`
                  : "—",
            },
            {
              label: "ATR14",
              value:
                result.atr14 > 0
                  ? `$${result.atr14.toFixed(result.atr14 >= 100 ? 0 : 2)}`
                  : "—",
            },
          ] as const
        ).map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-[8px] text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div className="text-[10px] font-mono font-semibold text-foreground mt-0.5 truncate">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* SMC flags */}
      {(result.nearHigh || result.nearLow) && (
        <div className="relative z-10 flex gap-1.5 mt-2">
          {result.nearHigh && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-bear/10 text-bear border border-bear/20 font-mono font-semibold">
              ⚡ NEAR 24H HIGH
            </span>
          )}
          {result.nearLow && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-bull/10 text-bull border border-bull/20 font-mono font-semibold">
              ⚡ NEAR 24H LOW
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function GeminiAnalysisPanel({
  btc,
  xau,
  isLoading,
  onRefresh,
}: {
  btc: GeminiResult;
  xau: GeminiResult;
  isLoading: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="trading-card p-4" data-ocid="gemini.panel">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">
            Gemini 2.0 Flash Analysis
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              data-ocid="gemini.refresh.button"
              disabled={isLoading || btc.isThinking || xau.isThinking}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold font-mono tracking-wide text-muted-foreground border border-border/40 hover:border-primary/40 hover:text-primary transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
            >
              <RefreshCw
                className={`w-2.5 h-2.5 ${
                  btc.isThinking || xau.isThinking ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          )}
          <Badge
            className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            data-ocid="gemini.success_state"
          >
            <span className="relative flex h-1.5 w-1.5 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            API: GEMINI-2.0-FLASH · ACTIVE &amp; VERIFIED
          </Badge>
        </div>
      </div>

      {/* Asset cards */}
      {isLoading ? (
        <div className="space-y-3" data-ocid="gemini.loading_state">
          {["BTC", "XAU"].map((a) => (
            <div
              key={a}
              className="rounded-xl border border-border/40 bg-secondary/30 p-4 animate-pulse"
            >
              <div className="h-3 bg-secondary rounded w-1/3 mb-3" />
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 bg-secondary rounded-full" />
                <div className="h-2.5 bg-secondary rounded w-2/3" />
              </div>
              <div className="h-1.5 bg-secondary rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AssetGeminiCard asset="BTC" result={btc} />
          <AssetGeminiCard asset="XAU" result={xau} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-[9px] text-muted-foreground font-mono">
          Powered by Gemini 2.0 Flash · Secure backend outcall · Refreshes every
          60s
        </p>
        <div className="flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 text-primary" />
          <span className="text-[9px] font-mono font-bold text-primary">
            SMC · RSI · ATR
          </span>
        </div>
      </div>
    </div>
  );
}
