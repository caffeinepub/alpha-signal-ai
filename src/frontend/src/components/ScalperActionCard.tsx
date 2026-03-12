import { motion } from "motion/react";
import type { ScalperSignal } from "../hooks/useScalperEngine";

// ─── Price formatter ──────────────────────────────────────────────────────────

function fmt(p: number, decimals = 2): string {
  if (p <= 0) return "—";
  if (p > 1000) {
    return `$${p.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `$${p.toFixed(decimals)}`;
}

// ─── Traffic Light Dot ────────────────────────────────────────────────────────

function TrafficLightDot({ light }: { light: "GREEN" | "RED" | "GREY" }) {
  if (light === "GREEN") {
    return (
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
      </span>
    );
  }
  if (light === "RED") {
    return (
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
      </span>
    );
  }
  return (
    <span className="relative inline-flex rounded-full h-5 w-5 bg-zinc-500/60 border border-zinc-500/40" />
  );
}

// ─── Score Bar ───────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  earned,
  max,
  color,
}: {
  label: string;
  earned: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (earned / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-zinc-400 w-24 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[9px] font-mono text-zinc-300 w-10 text-right shrink-0">
        {earned}/{max}
      </span>
    </div>
  );
}

// ─── Mini Price Cell ─────────────────────────────────────────────────────────

function PriceCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-mono">
        {label}
      </span>
      <span
        className={`text-sm font-mono font-bold ${valueClass ?? "text-zinc-100"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ScalperActionCardProps {
  asset: string;
  signal: ScalperSignal | null;
  isLoading?: boolean;
}

export function ScalperActionCard({
  asset,
  signal,
  isLoading,
}: ScalperActionCardProps) {
  const cardId = asset === "BTC" ? "scalper.btc_card" : "scalper.xau_card";

  // Card border glow style based on signal
  let cardClass =
    "relative rounded-2xl p-5 flex flex-col gap-4 bg-white/5 backdrop-blur-xl border transition-all duration-500 ";

  let signalTextClass = "text-zinc-400";
  let scoreBarColor = "bg-zinc-500";

  if (signal?.signalLabel === "STRONG BUY") {
    cardClass += "border-emerald-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]";
    signalTextClass = "text-emerald-400";
    scoreBarColor = "bg-emerald-400";
  } else if (signal?.signalLabel === "STRONG SELL") {
    cardClass += "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]";
    signalTextClass = "text-red-400";
    scoreBarColor = "bg-red-400";
  } else if (signal?.signalLabel === "CAUTION: SETUP FORMING") {
    cardClass += "border-amber-500/40";
    signalTextClass = "text-amber-400";
    scoreBarColor = "bg-amber-400";
  } else {
    cardClass += "border-white/10";
  }

  if (isLoading || !signal) {
    return (
      <div data-ocid={cardId} className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-300 font-mono">
            {asset}
          </span>
          <span className="h-5 w-5 rounded-full bg-zinc-700 animate-pulse" />
        </div>
        <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-2 bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 bg-white/5 rounded-full animate-pulse" />
        </div>
        <div className="text-[10px] text-zinc-600 font-mono text-center animate-pulse">
          Awaiting market data...
        </div>
      </div>
    );
  }

  const {
    currentPrice,
    entry,
    sl,
    tp1,
    tp2,
    score,
    breakdown,
    trafficLight,
    signalLabel,
    isOrderBlock,
    isLiquiditySweep,
    volRatio,
    trend5m,
    trend1h,
    rsi14,
  } = signal;

  const priceDecimals = asset === "BTC" ? 2 : 2;

  return (
    <motion.div
      data-ocid={cardId}
      className={cardClass}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Top: Asset name + Traffic Light + Signal Label ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-[10px] font-bold font-mono text-zinc-200">
                {asset === "XAU" ? "AU" : asset.slice(0, 2)}
              </span>
            </div>
            <span className="text-base font-bold font-mono text-zinc-100">
              {asset}
            </span>
          </div>
          <div
            data-ocid="scalper.signal_label"
            className={`text-xl font-black tracking-tight leading-none ${signalTextClass}`}
          >
            {signalLabel}
          </div>
        </div>

        <div
          data-ocid="scalper.traffic_light"
          className="flex flex-col items-center gap-1 pt-1"
        >
          <TrafficLightDot light={trafficLight} />
          <span
            className={`text-[8px] font-mono font-bold tracking-widest ${signalTextClass}`}
          >
            {trafficLight === "GREEN"
              ? "GO"
              : trafficLight === "RED"
                ? "STOP"
                : "WAIT"}
          </span>
        </div>
      </div>

      {/* ── Current Price ── */}
      <div className="text-3xl font-black font-mono text-zinc-50 tabular-nums tracking-tight">
        {fmt(currentPrice, priceDecimals)}
      </div>

      {/* ── Price Grid: Entry / SL / TP1 / TP2 ── */}
      <div className="grid grid-cols-2 gap-2">
        <PriceCell
          label="Entry"
          value={fmt(entry, priceDecimals)}
          valueClass="text-zinc-100"
        />
        <PriceCell
          label="Stop Loss"
          value={fmt(sl, priceDecimals)}
          valueClass="text-red-400"
        />
        <PriceCell
          label="TP1"
          value={fmt(tp1, priceDecimals)}
          valueClass="text-emerald-400"
        />
        <PriceCell
          label="TP2"
          value={fmt(tp2, priceDecimals)}
          valueClass="text-emerald-300"
        />
      </div>

      {/* ── Confidence Score ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
            Confidence Score
          </span>
          <span className={`text-lg font-black font-mono ${signalTextClass}`}>
            {score}%
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
          <motion.div
            className={`h-full rounded-full ${
              score >= 80
                ? "bg-emerald-400"
                : score >= 60
                  ? "bg-amber-400"
                  : "bg-zinc-500"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* Factor breakdown bars */}
        <ScoreBar
          label="MKT STRUCTURE"
          earned={breakdown.marketStructure}
          max={40}
          color={scoreBarColor}
        />
        <ScoreBar
          label="VOLUME"
          earned={breakdown.volumeProfile}
          max={30}
          color={scoreBarColor}
        />
        <ScoreBar
          label="TREND ALIGN"
          earned={breakdown.trendAlignment}
          max={20}
          color={scoreBarColor}
        />
        <ScoreBar
          label="MOMENTUM"
          earned={breakdown.momentum}
          max={10}
          color={scoreBarColor}
        />
      </div>

      {/* ── SMC Tags + Indicators ── */}
      <div className="flex flex-wrap gap-1.5">
        {isOrderBlock && (
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300">
            ORDER BLOCK
          </span>
        )}
        {isLiquiditySweep && (
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
            LIQ SWEEP
          </span>
        )}
        {volRatio >= 1.2 && (
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
            {volRatio.toFixed(1)}x VOL
          </span>
        )}
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
          5M: {trend5m}
        </span>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
          1H: {trend1h}
        </span>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
          RSI {rsi14.toFixed(0)}
        </span>
      </div>
    </motion.div>
  );
}
