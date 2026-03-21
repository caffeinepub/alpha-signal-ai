import { motion } from "motion/react";
import type { SFISignal } from "../hooks/useSFIEngine";

interface SFISignalCardProps {
  asset: string;
  signal3m: SFISignal | undefined;
  signal15m: SFISignal | undefined;
  currentPrice: number;
}

function formatPrice(asset: string, value: number): string {
  if (value === 0) return "—";
  if (asset === "EUR/USD") return value.toFixed(4);
  if (asset === "XAU/USD") {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ASSET_ICON: Record<string, string> = {
  BTC: "₿",
  "XAU/USD": "🥇",
  "EUR/USD": "€",
};

const ASSET_LABEL: Record<string, string> = {
  BTC: "Bitcoin",
  "XAU/USD": "Gold",
  "EUR/USD": "Euro / Dollar",
};

function SFIColorDot({
  color,
  pulse,
}: { color: "GREEN" | "RED" | "NEUTRAL"; pulse: boolean }) {
  const cls =
    color === "GREEN"
      ? "bg-emerald-400"
      : color === "RED"
        ? "bg-red-400"
        : "bg-zinc-500";
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      {pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cls}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${cls}`} />
    </span>
  );
}

function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "WAIT" }) {
  if (signal === "BUY") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 tracking-widest">
        ▲ BUY
      </span>
    );
  }
  if (signal === "SELL") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-900/40 border border-red-500/40 text-red-300 tracking-widest">
        ▼ SELL
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-900/30 border border-amber-500/30 text-amber-300 tracking-widest">
      ◆ WAIT
    </span>
  );
}

function TimeframePanel({
  label,
  signal,
  asset,
}: {
  label: string;
  signal: SFISignal | undefined;
  asset: string;
}) {
  const sig = signal?.signal ?? "WAIT";
  const color = signal?.sfiColor ?? "NEUTRAL";
  const isSideways = signal?.isSideways ?? false;

  const borderClass =
    sig === "BUY"
      ? "border-emerald-500/30 bg-emerald-900/10"
      : sig === "SELL"
        ? "border-red-500/30 bg-red-900/10"
        : "border-amber-500/20 bg-amber-900/5";

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${borderClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
          {label}
        </span>
        <SFIColorDot color={color} pulse={sig !== "WAIT"} />
      </div>

      {/* Signal badge */}
      <div className="flex items-center gap-2">
        <SignalBadge signal={sig} />
        {isSideways && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 uppercase tracking-wider">
            Sideways Market
          </span>
        )}
      </div>

      {/* Price levels */}
      {signal && signal.entry > 0 ? (
        <div className="space-y-0.5 text-[11px] font-mono">
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">Entry</span>
            <span className="text-zinc-200">
              {formatPrice(asset, signal.entry)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">SL</span>
            <span className="text-red-400">
              {formatPrice(asset, signal.stopLoss)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">Target</span>
            <span className="text-emerald-400">
              {formatPrice(asset, signal.target)}
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-white/5">
            <div className="flex justify-between gap-2">
              <span className="text-zinc-600">EMA 50</span>
              <span className="text-cyan-500/70 text-[10px]">
                {formatPrice(asset, signal.ema50)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-600">EMA 200</span>
              <span className="text-violet-500/70 text-[10px]">
                {formatPrice(asset, signal.ema200)}
              </span>
            </div>
            <div className="flex justify-between gap-2 mt-0.5">
              <span className="text-zinc-600">Support</span>
              <span className="text-emerald-600/70 text-[10px]">
                {formatPrice(asset, signal.support)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-600">Resistance</span>
              <span className="text-red-600/70 text-[10px]">
                {formatPrice(asset, signal.resistance)}
              </span>
            </div>
          </div>
          <div className="text-[9px] text-zinc-600 mt-0.5">
            EMA — Confirmation Only
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-zinc-600 font-mono py-1">
          Awaiting candle data…
        </div>
      )}
    </div>
  );
}

export function SFISignalCard({
  asset,
  signal3m,
  signal15m,
  currentPrice,
}: SFISignalCardProps) {
  const icon = ASSET_ICON[asset] ?? "◎";
  const label = ASSET_LABEL[asset] ?? asset;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="trading-card p-4 flex flex-col gap-3"
      data-ocid="sfi.card"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{icon}</span>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">
              {asset}
            </div>
            <div className="text-[10px] text-zinc-500">{label}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-400">LIVE</span>
          {currentPrice > 0 && (
            <span className="ml-2 text-[11px] font-mono text-zinc-300">
              {formatPrice(asset, currentPrice)}
            </span>
          )}
        </div>
      </div>

      {/* RR Badge */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-900/30 border border-cyan-500/20 text-cyan-400 uppercase tracking-wider">
          Risk:Reward 1:3
        </span>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 uppercase tracking-wider">
          SFI Engine
        </span>
      </div>

      {/* Two timeframe panels */}
      <div className="grid grid-cols-2 gap-2">
        <TimeframePanel label="3 Minute" signal={signal3m} asset={asset} />
        <TimeframePanel label="15 Minute" signal={signal15m} asset={asset} />
      </div>
    </motion.div>
  );
}
