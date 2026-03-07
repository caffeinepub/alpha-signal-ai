import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  Brain,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  MinusCircle,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { type EngineSignal, useSignalEngine } from "../hooks/useSignalEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(p: number): string {
  if (p > 1000)
    return `$${p.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  if (p > 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

function timeSince(date: Date | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function formatSignalTime(date: Date | null): string {
  if (!date) return "--";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const LOCK_DURATION_SECS = 180; // 3 minutes

const DIRECTION_CONFIG = {
  "STRONG BUY": {
    icon: ArrowUpCircle,
    label: "STRONG BUY",
    badgeCls: "signal-buy",
    barCls: "bg-bull",
    glowCls: "glow-green",
    borderCls: "border-bull/30",
    textCls: "text-bull",
  },
  "STRONG SELL": {
    icon: ArrowDownCircle,
    label: "STRONG SELL",
    badgeCls: "signal-sell",
    barCls: "bg-bear",
    glowCls: "glow-red",
    borderCls: "border-bear/30",
    textCls: "text-bear",
  },
  WAIT: {
    icon: MinusCircle,
    label: "WAIT",
    badgeCls: "signal-hold",
    barCls: "bg-hold",
    glowCls: "",
    borderCls: "border-hold/30",
    textCls: "text-hold",
  },
} as const;

const RISK_CONFIG = {
  LOW: { cls: "signal-buy", label: "LOW RISK", icon: Shield },
  MEDIUM: { cls: "signal-hold", label: "MED RISK", icon: AlertTriangle },
  HIGH: { cls: "signal-sell", label: "HIGH RISK", icon: AlertTriangle },
} as const;

const SMC_TAG_CONFIG: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  BOS: { bg: "bg-bull/15", text: "text-bull", border: "border-bull/30" },
  CHoCH: { bg: "bg-bear/15", text: "text-bear", border: "border-bear/30" },
  "LIQ SWEEP": {
    bg: "bg-chart-5/15",
    text: "text-chart-5",
    border: "border-chart-5/30",
  },
  "ORDER BLOCK": {
    bg: "bg-primary/15",
    text: "text-primary",
    border: "border-primary/30",
  },
  "FAKE BREAKOUT": {
    bg: "bg-hold/15",
    text: "text-hold",
    border: "border-hold/30",
  },
  FVG: { bg: "bg-hold/15", text: "text-hold", border: "border-hold/30" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Score Breakdown Row
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRow({
  label,
  score,
  max,
  delay,
}: {
  label: string;
  score: number;
  max: number;
  delay: number;
}) {
  const pct = (score / max) * 100;
  const barColor =
    pct >= 75
      ? "bg-bull"
      : pct >= 50
        ? "bg-primary"
        : pct >= 25
          ? "bg-hold"
          : "bg-bear";

  return (
    <motion.div
      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1, ease: "easeOut" }}
        />
      </div>
      <div className="text-[11px] font-mono font-bold text-foreground w-10 text-right">
        {score}/{max}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock countdown pill
// ─────────────────────────────────────────────────────────────────────────────

function LockCountdown({ signalTime }: { signalTime: Date | null }) {
  const [secsLeft, setSecsLeft] = useState(() => {
    if (!signalTime) return 0;
    const elapsed = Math.floor((Date.now() - signalTime.getTime()) / 1000);
    return Math.max(0, LOCK_DURATION_SECS - elapsed);
  });

  useEffect(() => {
    if (!signalTime) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - signalTime.getTime()) / 1000);
      setSecsLeft(Math.max(0, LOCK_DURATION_SECS - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, [signalTime]);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;

  return (
    <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-hold/20 border border-hold/40 text-hold font-bold font-mono">
      <Lock className="w-2.5 h-2.5" />
      LOCKED {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Card
// ─────────────────────────────────────────────────────────────────────────────

const CARD_OCIDS: Record<string, string> = {
  BTC: "signals.btc.card",
  XAU: "signals.xau.card",
  GOLD: "signals.xau.card",
};

const PANEL_OCIDS: Record<string, string> = {
  BTC: "signals.btc.panel",
  XAU: "signals.xau.panel",
  GOLD: "signals.xau.panel",
};

function SignalCard({
  signal,
  index,
}: {
  signal: EngineSignal;
  index: number;
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const dir = DIRECTION_CONFIG[signal.direction];
  const DirIcon = dir.icon;
  const risk = RISK_CONFIG[signal.riskLevel];
  const RiskIcon = risk.icon;

  const rr1 = Math.abs(
    (signal.tp1 - signal.entryPrice) /
      (Math.abs(signal.entryPrice - signal.stopLoss) || 1),
  );
  const potentialGain = Math.abs(
    ((signal.tp2 - signal.entryPrice) / signal.entryPrice) * 100,
  );
  const maxLoss = Math.abs(
    ((signal.entryPrice - signal.stopLoss) / signal.entryPrice) * 100,
  );

  const rsiColor =
    signal.rsi > 55
      ? "text-bull"
      : signal.rsi < 45
        ? "text-bear"
        : "text-muted-foreground";

  const ts = signal.timeframeScores;

  return (
    <motion.div
      data-ocid={CARD_OCIDS[signal.symbol] ?? "signals.card"}
      className={`trading-card flex flex-col gap-0 overflow-hidden hover:${dir.borderCls} transition-all duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      {/* Top accent bar — direction-colored */}
      <div className={`h-0.5 w-full ${dir.barCls}`} style={{ opacity: 0.6 }} />

      <div className="p-5 flex flex-col gap-4">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl font-bold font-mono text-foreground tracking-tight">
                {signal.symbol}
              </span>
              <span className="text-xs text-muted-foreground">
                {signal.name}
              </span>
              {signal.isLocked && signal.signalTime && (
                <LockCountdown signalTime={signal.signalTime} />
              )}
            </div>
            <div className={`text-2xl font-bold font-mono ${dir.textCls}`}>
              {formatPrice(signal.price)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${dir.badgeCls}`}
            >
              <DirIcon className="w-3.5 h-3.5" />
              {dir.label}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {timeSince(signal.lastUpdated)}
            </div>
          </div>
        </div>

        {/* ── Confidence bar ──────────────────────────────────────────────── */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Brain className="w-3 h-3" />
              Institutional Probability
            </span>
            <span className={`text-sm font-mono font-bold ${dir.textCls}`}>
              {signal.confidence}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${dir.barCls}`}
              initial={{ width: 0 }}
              animate={{ width: `${signal.confidence}%` }}
              transition={{
                duration: 0.8,
                delay: 0.2 + index * 0.1,
                ease: "easeOut",
              }}
            />
          </div>
        </div>

        {/* ── Multi-Timeframe Score Breakdown ─────────────────────────────── */}
        <div className="border border-border/60 rounded-md overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 bg-secondary/40 hover:bg-secondary/70 transition-colors"
            onClick={() => setBreakdownOpen((v) => !v)}
            data-ocid={PANEL_OCIDS[signal.symbol] ?? "signals.panel"}
          >
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Institutional Probability Score
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-foreground">
                {signal.confidence}/100
              </span>
              {breakdownOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {breakdownOpen && (
              <motion.div
                key="breakdown"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-2 divide-y divide-border/40">
                  <ScoreRow
                    label="5m Trend (EMA50/200)"
                    score={ts.trend5m}
                    max={15}
                    delay={0.04}
                  />
                  <ScoreRow
                    label="1m Momentum (EMA9/20 + Vol)"
                    score={ts.momentum1m}
                    max={15}
                    delay={0.08}
                  />
                  <ScoreRow
                    label="3m Candle Confirmation"
                    score={ts.confirmation3m}
                    max={15}
                    delay={0.12}
                  />
                  <ScoreRow
                    label="Order Block Proximity"
                    score={ts.orderBlock}
                    max={15}
                    delay={0.16}
                  />
                  <ScoreRow
                    label="Liquidity Sweep"
                    score={ts.liqSweep}
                    max={15}
                    delay={0.2}
                  />
                  <ScoreRow
                    label="Fake Breakout"
                    score={ts.fakeBreakout}
                    max={10}
                    delay={0.24}
                  />
                  <ScoreRow
                    label="Volume Spike"
                    score={ts.volumeSpike}
                    max={10}
                    delay={0.28}
                  />
                  <ScoreRow
                    label="Liq Heatmap Pressure"
                    score={ts.liqHeatmap}
                    max={5}
                    delay={0.32}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Indicator Snapshot ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 border-t border-border/40">
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">RSI</span>
            <span className={`font-mono font-bold ${rsiColor}`}>
              {signal.rsi.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">EMA9/20</span>
            <span
              className={`font-mono font-bold ${signal.ema9 > signal.ema20 ? "text-bull" : "text-bear"}`}
            >
              {signal.ema9 > signal.ema20 ? "▲" : "▼"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">EMA50/200</span>
            <span
              className={`font-mono font-bold ${signal.ema50 > signal.ema200 ? "text-bull" : "text-bear"}`}
            >
              {signal.ema50 > signal.ema200 ? "▲" : "▼"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">MACD</span>
            <span
              className={`font-mono font-bold ${signal.macdHistogram > 0 ? "text-bull" : "text-bear"}`}
            >
              {signal.macdHistogram > 0 ? "+" : ""}
              {signal.macdHistogram.toFixed(signal.price > 1000 ? 0 : 4)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">ATR</span>
            <span className="font-mono font-bold text-foreground">
              {formatPrice(signal.atr)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">BB</span>
            <span className="font-mono font-bold text-foreground">
              {signal.price >= signal.bbUpper
                ? "⬆ OB"
                : signal.price <= signal.bbLower
                  ? "⬇ OS"
                  : "MID"}
            </span>
          </div>
        </div>

        {/* ── Price Levels Grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-secondary/50 rounded-md p-2.5 text-center">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Entry
            </div>
            <div className="text-xs font-mono font-bold text-foreground">
              {formatPrice(signal.entryPrice)}
            </div>
          </div>
          <div className="bg-bear/10 rounded-md p-2.5 text-center border border-bear/20">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Stop Loss
            </div>
            <div className="text-xs font-mono font-bold text-bear">
              {formatPrice(signal.stopLoss)}
            </div>
          </div>
          <div className="bg-bull/8 rounded-md p-2.5 text-center border border-bull/15">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              TP 1
            </div>
            <div className="text-xs font-mono font-bold text-bull">
              {formatPrice(signal.tp1)}
            </div>
          </div>
          <div className="bg-bull/12 rounded-md p-2.5 text-center border border-bull/25">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              TP 2
            </div>
            <div className="text-xs font-mono font-bold text-bull">
              {formatPrice(signal.tp2)}
            </div>
          </div>
        </div>

        {/* ── SMC & Signal Info Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 py-2 border-t border-border/40">
          {/* Order Block Zone */}
          <div className="bg-secondary/30 rounded-md p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Order Block Zone
            </div>
            <div className="text-[10px] font-mono font-bold">
              {signal.orderBlockNear && signal.orderBlockLevel > 0 ? (
                <span className="text-primary">
                  {formatPrice(signal.orderBlockLevel)}
                  <span className="text-[8px] ml-1 text-primary/70">
                    (
                    {signal.orderBlockDirection === "bullish" ? "BULL" : "BEAR"}
                    )
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/60">Not near OB</span>
              )}
            </div>
          </div>

          {/* Liquidity Sweep */}
          <div className="bg-secondary/30 rounded-md p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Liq Sweep
            </div>
            <div className="text-[10px] font-mono font-bold">
              {signal.liquiditySweepDetected ? (
                <span
                  className={
                    signal.liquiditySweepDirection === "bullish"
                      ? "text-bull"
                      : "text-bear"
                  }
                >
                  {signal.liquiditySweepDirection === "bullish"
                    ? "Bullish Sweep ▲"
                    : "Bearish Sweep ▼"}
                </span>
              ) : (
                <span className="text-muted-foreground/60">None</span>
              )}
            </div>
          </div>

          {/* Fake Breakout */}
          <div className="bg-secondary/30 rounded-md p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Fake Breakout
            </div>
            <div className="text-[10px] font-mono font-bold">
              {signal.fakeBreakoutDetected ? (
                <span
                  className={
                    signal.fakeBreakoutDirection === "bullish"
                      ? "text-bull"
                      : "text-bear"
                  }
                >
                  {signal.fakeBreakoutDirection === "bullish"
                    ? "Bullish FB ▲"
                    : "Bearish FB ▼"}
                </span>
              ) : (
                <span className="text-muted-foreground/60">None</span>
              )}
            </div>
          </div>

          {/* Signal Time */}
          <div className="bg-secondary/30 rounded-md p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Signal Time
            </div>
            <div className="text-[10px] font-mono font-bold text-foreground">
              {formatSignalTime(signal.signalTime)}
            </div>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 py-2 border-t border-border/40">
          <div className="text-center">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
              R:R (TP1)
            </div>
            <div className="text-xs font-mono font-bold text-primary">
              1:{rr1.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
              Gain (TP2)
            </div>
            <div className="text-xs font-mono font-bold text-bull">
              +{potentialGain.toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
              Max Loss
            </div>
            <div className="text-xs font-mono font-bold text-bear">
              -{maxLoss.toFixed(2)}%
            </div>
          </div>
          <div className="flex items-center justify-center">
            <span
              className={`text-[9px] px-2 py-1 rounded-full border font-bold flex items-center gap-0.5 ${risk.cls}`}
            >
              <RiskIcon className="w-2.5 h-2.5" />
              {risk.label}
            </span>
          </div>
        </div>

        {/* ── SMC Tags ───────────────────────────────────────────────────── */}
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            Active SMC Patterns
          </div>
          {signal.smcTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {signal.smcTags.map((tag) => {
                const cfg = SMC_TAG_CONFIG[tag] ?? {
                  bg: "bg-secondary",
                  text: "text-foreground",
                  border: "border-border",
                };
                return (
                  <span
                    key={tag}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/60 italic">
              No active SMC patterns
            </span>
          )}
        </div>

        {/* ── Explanation ────────────────────────────────────────────────── */}
        <div
          className={`border-l-2 ${dir.textCls.replace("text-", "border-")} pl-3`}
        >
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {signal.explanation}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Bar
// ─────────────────────────────────────────────────────────────────────────────

function SummaryBar({
  signals,
  isConnected,
  isConnecting,
}: {
  signals: EngineSignal[];
  isConnected: boolean;
  isConnecting: boolean;
}) {
  const buyCount = signals.filter((s) => s.direction === "STRONG BUY").length;
  const sellCount = signals.filter((s) => s.direction === "STRONG SELL").length;
  const waitCount = signals.filter((s) => s.direction === "WAIT").length;

  let bias = "NEUTRAL";
  let biasClass = "text-hold";
  if (buyCount > sellCount) {
    bias = "BULLISH BIAS";
    biasClass = "text-bull";
  } else if (sellCount > buyCount) {
    bias = "BEARISH BIAS";
    biasClass = "text-bear";
  }

  return (
    <div
      data-ocid="signals.summary_bar.panel"
      className="trading-card p-3 flex flex-wrap items-center gap-4"
    >
      {/* Market Bias */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
          Overall Bias
        </span>
        <span className={`text-sm font-bold font-mono ${biasClass}`}>
          {bias}
        </span>
      </div>

      {/* Signal counts */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-bull" />
          <span className="text-xs font-mono font-bold text-bull">
            {buyCount} BUY
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-bear" />
          <span className="text-xs font-mono font-bold text-bear">
            {sellCount} SELL
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MinusCircle className="w-3.5 h-3.5 text-hold" />
          <span className="text-xs font-mono font-bold text-hold">
            {waitCount} WAIT
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 h-px bg-border hidden sm:block" />

      {/* WS status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isConnected ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-bull" />
            </span>
            <span className="text-[10px] font-bold font-mono text-bull tracking-widest">
              LIVE
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              · Binance Stream
            </span>
          </>
        ) : isConnecting ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hold opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-hold" />
            </span>
            <span className="text-[10px] font-bold font-mono text-hold tracking-widest">
              CONNECTING...
            </span>
          </>
        ) : (
          <>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-bear" />
            <span className="text-[10px] font-bold font-mono text-bear tracking-widest">
              OFFLINE
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications Banner
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsBanner({
  onEnable,
}: {
  onEnable: () => void;
}) {
  return (
    <motion.div
      data-ocid="signals.notifications_banner.panel"
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-hold/40 bg-hold/10"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2.5">
        <Bell className="w-4 h-4 text-hold shrink-0" />
        <p className="text-xs text-muted-foreground">
          Get instant alerts for{" "}
          <span className="text-foreground font-semibold">STRONG BUY/SELL</span>{" "}
          signals
        </p>
      </div>
      <button
        type="button"
        data-ocid="signals.enable_notifications.button"
        onClick={onEnable}
        className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold bg-hold/20 hover:bg-hold/30 border border-hold/40 text-hold transition-colors"
      >
        Enable Notifications
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div
      data-ocid="signals.loading_state"
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {[1, 2].map((i) => (
        <div key={i} className="trading-card p-5 space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-24 bg-secondary" />
            <Skeleton className="h-8 w-28 bg-secondary rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-full bg-secondary rounded-full" />
          <Skeleton className="h-36 w-full bg-secondary rounded-md" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-12 bg-secondary rounded-md" />
            ))}
          </div>
          <Skeleton className="h-10 w-full bg-secondary rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type AssetFilter = "ALL" | "BTC" | "XAU";

export default function Signals() {
  const { signals, isConnected, isConnecting } = useSignalEngine();
  const { permission, isSupported, requestPermission, sendSignalNotification } =
    useNotifications();

  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");

  // Wire up notifications — fire for each STRONG BUY/SELL signal
  const prevSignalsRef = useRef<EngineSignal[]>([]);
  useEffect(() => {
    for (const signal of signals) {
      if (signal.direction !== "WAIT") {
        sendSignalNotification(signal);
      }
    }
    prevSignalsRef.current = signals;
  }, [signals, sendSignalNotification]);

  const isLoading = signals.length === 0;

  const filteredSignals =
    assetFilter === "ALL"
      ? signals
      : signals.filter(
          (s) =>
            s.symbol === assetFilter ||
            (assetFilter === "XAU" && s.symbol === "GOLD"),
        );

  const showNotificationsBanner = isSupported && permission === "default";

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          AI Signal Engine
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
          <Zap className="w-2.5 h-2.5" />
          INSTITUTIONAL
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Notifications banner */}
      <AnimatePresence>
        {showNotificationsBanner && (
          <NotificationsBanner onEnable={requestPermission} />
        )}
      </AnimatePresence>

      {/* Asset filter tabs */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 w-fit border border-border/40">
        {(["ALL", "BTC", "XAU"] as AssetFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            data-ocid={`signals.${filter.toLowerCase()}.tab`}
            onClick={() => setAssetFilter(filter)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold font-mono transition-all duration-200 ${
              assetFilter === filter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {!isLoading && (
        <SummaryBar
          signals={signals}
          isConnected={isConnected}
          isConnecting={isConnecting}
        />
      )}

      {/* Signal cards */}
      {isLoading ? (
        <SkeletonCards />
      ) : filteredSignals.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {filteredSignals.map((signal, i) => (
            <SignalCard key={signal.symbol} signal={signal} index={i} />
          ))}
        </motion.div>
      ) : (
        <div
          data-ocid="signals.empty_state"
          className="trading-card p-12 text-center"
        >
          <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {signals.length === 0
              ? "Waiting for market data…"
              : `No ${assetFilter} signals available`}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {signals.length === 0
              ? "Connect to stream live signals"
              : "Try switching to ALL to see all signals"}
          </p>
        </div>
      )}

      {/* Notification status indicator */}
      {isSupported && permission === "granted" && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Bell className="w-3 h-3 text-bull" />
          <span>
            Push notifications{" "}
            <span className="text-bull font-semibold">enabled</span> — you'll
            receive instant alerts for STRONG BUY/SELL signals
          </span>
        </div>
      )}

      {/* Engine description */}
      <div className="trading-card p-4">
        <div className="flex items-start gap-3">
          <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-foreground mb-1">
              Institutional Signal Engine — Multi-Timeframe Analysis
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Signals are generated for{" "}
              <span className="text-foreground font-semibold">BTC and XAU</span>{" "}
              only, using three synthetic OHLCV series (1m / 3m / 5m
              timeframes). The{" "}
              <span className="text-foreground font-semibold">5m series</span>{" "}
              detects trend direction via EMA50 vs EMA200. The{" "}
              <span className="text-foreground font-semibold">3m series</span>{" "}
              confirms candle close direction and RSI. The{" "}
              <span className="text-foreground font-semibold">1m series</span>{" "}
              detects momentum via EMA9/20 crossover + volume spike. Order
              blocks, liquidity sweeps, and fake breakouts are detected from the
              5m structure. A{" "}
              <span className="text-bull font-semibold">STRONG BUY</span>{" "}
              requires score &gt;75 and a{" "}
              <span className="text-bear font-semibold">STRONG SELL</span>{" "}
              requires &lt;25. Signals lock for{" "}
              <span className="text-hold font-semibold">3 minutes</span> with a
              fixed entry price to prevent rapid flipping. Push notifications
              fire immediately on new actionable signals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
