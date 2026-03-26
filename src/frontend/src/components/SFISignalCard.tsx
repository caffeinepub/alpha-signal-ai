import { motion } from "motion/react";
import { useGeminiConfirmation } from "../hooks/useGeminiConfirmation";
import type { SFISignal } from "../hooks/useSFIEngine";
import { getConfirmationData } from "../hooks/useSFIEngine";

interface SFISignalCardProps {
  asset: string;
  signal3m: SFISignal | undefined;
  signal15m: SFISignal | undefined;
  currentPrice: number;
}

function formatPrice(asset: string, value: number): string {
  if (value === 0) return "—";
  if (asset === "EUR/USD") return value.toFixed(4);
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
}: {
  color: "GREEN" | "RED" | "NEUTRAL";
  pulse: boolean;
}) {
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
  if (signal === "BUY")
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 tracking-widest">
        ▲ BUY 🟢
      </span>
    );
  if (signal === "SELL")
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-900/40 border border-red-500/40 text-red-300 tracking-widest">
        ▼ SELL 🔴
      </span>
    );
  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-900/30 border border-amber-500/30 text-amber-300 tracking-widest">
      ◆ WAIT ⚠️
    </span>
  );
}

// ── Gemini Institutional Bias Panel ──────────────────────────────────────────

function GeminiConfirmationPanel({ signal }: { signal: SFISignal }) {
  const { data, loading } = useGeminiConfirmation(signal);

  return (
    <div className="bg-black/40 rounded-lg px-2 py-2 space-y-1.5 border border-purple-500/10">
      <div className="flex items-center justify-between border-b border-white/5 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400">
          Gemini Institutional Bias
        </p>
        {loading ? (
          <span className="text-[8px] text-zinc-500 animate-pulse">
            Checking…
          </span>
        ) : (
          <span className="text-[8px] text-zinc-600">1.5 Pro</span>
        )}
      </div>

      {loading && !data && (
        <div className="flex items-center gap-1.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 animate-pulse" />
          <span className="text-[10px] text-zinc-500">Querying Gemini…</span>
        </div>
      )}

      {data && (
        <>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Inst. Bias</span>
            <span
              className={
                data.bias === "BULLISH"
                  ? "text-emerald-400 font-semibold"
                  : data.bias === "BEARISH"
                    ? "text-red-400 font-semibold"
                    : "text-amber-400 font-semibold"
              }
            >
              {data.bias}
            </span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Confidence</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={
                    data.bias === "BULLISH"
                      ? "h-full bg-emerald-400 rounded-full"
                      : data.bias === "BEARISH"
                        ? "h-full bg-red-400 rounded-full"
                        : "h-full bg-amber-400 rounded-full"
                  }
                  style={{ width: `${data.confidence}%` }}
                />
              </div>
              <span className="text-zinc-400 font-mono">
                {data.confidence}%
              </span>
            </div>
          </div>

          <div className="flex justify-between text-[10px] items-start gap-2">
            <span className="text-zinc-500 shrink-0">SFI Align</span>
            <span
              className={
                data.alignsWithSFI
                  ? "text-emerald-400 font-bold"
                  : "text-amber-400 font-bold"
              }
            >
              {data.alignsWithSFI ? "✓ Confirmed" : "⚠ Divergence"}
            </span>
          </div>

          <p className="text-[9px] text-zinc-500 leading-tight pt-0.5">
            {data.reasoning}
          </p>
        </>
      )}
    </div>
  );
}

// ── EMA + Liquidity confirmation (local, display only) ───────────────────────

function LocalConfirmationPanel({ signal }: { signal: SFISignal }) {
  const conf = getConfirmationData(signal);
  return (
    <div className="bg-black/30 rounded-lg px-2 py-2 space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 border-b border-white/5 pb-1">
        Confirmation Only
      </p>
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500">EMA Trend</span>
        <span
          className={
            conf.emaTrend === "Uptrend"
              ? "text-cyan-400"
              : conf.emaTrend === "Downtrend"
                ? "text-red-400"
                : "text-amber-400"
          }
        >
          {conf.emaTrend}
        </span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500">Liquidity</span>
        <span
          className={
            conf.liquidity === "Above support"
              ? "text-emerald-400"
              : conf.liquidity === "Below support"
                ? "text-red-400"
                : "text-amber-400"
          }
        >
          {conf.liquidity}
        </span>
      </div>
    </div>
  );
}

// ── Timeframe Panel ───────────────────────────────────────────────────────────

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
  const hasData = signal && signal.entry > 0;

  // Visual: box stays RED for SELL, GREEN for BUY — never resets to grey
  // unless signal is genuinely WAIT (NEUTRAL state, pre-bootstrap)
  const borderClass =
    sig === "BUY"
      ? "border-emerald-500/40 bg-emerald-900/15 shadow-[0_0_12px_rgba(52,211,153,0.08)]"
      : sig === "SELL"
        ? "border-red-500/40 bg-red-900/15 shadow-[0_0_12px_rgba(239,68,68,0.08)]"
        : "border-amber-500/20 bg-amber-900/5";

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 transition-colors duration-500 ${borderClass}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
          {label}
        </span>
        <SFIColorDot color={color} pulse={sig !== "WAIT"} />
      </div>

      {/* Loading state */}
      {!hasData ? (
        <div className="flex items-center gap-2 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-400/50 animate-pulse" />
          <span className="text-[11px] text-zinc-500 font-mono">
            Loading signals…
          </span>
        </div>
      ) : (
        <>
          {/* ── SIGNAL ── */}
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">
              Signal
            </p>
            <div className="flex items-center gap-2">
              <SignalBadge signal={sig} />
              {isSideways && sig !== "WAIT" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  Caution: Sideways
                </span>
              )}
            </div>
          </div>

          {/* ── LOCKED ENTRY / SL / TARGET ── */}
          <div className="space-y-0.5 text-[11px] font-mono">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">
              Locked Levels
            </p>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Entry</span>
              <span className="text-zinc-200">
                {formatPrice(asset, signal.entry)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">
                SL ({sig === "SELL" ? "Upper Band" : "Lower Band"})
              </span>
              <span className="text-red-400">
                {formatPrice(asset, signal.stopLoss)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Target (1:3 RR)</span>
              <span className="text-emerald-400">
                {formatPrice(asset, signal.target)}
              </span>
            </div>
          </div>

          {/* ── GEMINI INSTITUTIONAL BIAS (confirmation only) ── */}
          <GeminiConfirmationPanel signal={signal} />

          {/* ── LOCAL CONFIRMATION ── */}
          <LocalConfirmationPanel signal={signal} />
        </>
      )}
    </div>
  );
}

// ── Card Root ─────────────────────────────────────────────────────────────────

export function SFISignalCard({
  asset,
  signal3m,
  signal15m,
  currentPrice,
}: SFISignalCardProps) {
  const icon = ASSET_ICON[asset] ?? "◎";
  const label = ASSET_LABEL[asset] ?? asset;

  // Determine overall card accent based on dominant signal
  const dominant = signal3m?.signal ?? signal15m?.signal ?? "WAIT";
  const cardBorder =
    dominant === "BUY"
      ? "border-emerald-500/20"
      : dominant === "SELL"
        ? "border-red-500/20"
        : "border-zinc-700/40";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`trading-card p-4 flex flex-col gap-3 border ${cardBorder}`}
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

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-900/30 border border-cyan-500/20 text-cyan-400 uppercase tracking-wider">
          Risk:Reward 1:3
        </span>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
          🔒 SFI State-Lock
        </span>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-900/30 border border-purple-500/20 text-purple-400 uppercase tracking-wider">
          ✦ Gemini Confirmed
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
