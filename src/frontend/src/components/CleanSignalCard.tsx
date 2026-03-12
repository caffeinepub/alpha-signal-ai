import { useState } from "react";
import type { ScalperSignal } from "../hooks/useScalperEngine";

interface CleanSignalCardProps {
  asset: string;
  signal: ScalperSignal | null;
  isLoading?: boolean;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = {
  GREEN: {
    border: "rgba(52,211,153,0.5)",
    ringGlow:
      "drop-shadow(0 0 10px rgba(52,211,153,0.7)) drop-shadow(0 0 24px rgba(52,211,153,0.4))",
    cardGlow: "0 0 48px rgba(52,211,153,0.18), 0 0 0 1px rgba(52,211,153,0.5)",
    ring: "#34d399",
    text: "#34d399",
    dot: "#10b981",
    tint: "radial-gradient(ellipse at 50% -10%, rgba(52,211,153,0.12) 0%, transparent 65%)",
    pulse: true,
  },
  RED: {
    border: "rgba(248,113,113,0.5)",
    ringGlow:
      "drop-shadow(0 0 10px rgba(248,113,113,0.7)) drop-shadow(0 0 24px rgba(248,113,113,0.4))",
    cardGlow:
      "0 0 48px rgba(248,113,113,0.18), 0 0 0 1px rgba(248,113,113,0.5)",
    ring: "#f87171",
    text: "#f87171",
    dot: "#ef4444",
    tint: "radial-gradient(ellipse at 50% -10%, rgba(248,113,113,0.12) 0%, transparent 65%)",
    pulse: true,
  },
  GREY: {
    border: "rgba(113,113,122,0.25)",
    ringGlow: "none",
    cardGlow: "0 0 0 1px rgba(113,113,122,0.25)",
    ring: "#52525b",
    text: "#71717a",
    dot: "#3f3f46",
    tint: "none",
    pulse: false,
  },
};

// ─── Circular ring ────────────────────────────────────────────────────────────

function CircularRing({
  score,
  color,
  glowFilter,
  disabled,
}: {
  score: number;
  color: string;
  glowFilter: string;
  disabled: boolean;
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 148, height: 148 }}
    >
      <svg
        width="148"
        height="148"
        style={{
          transform: "rotate(-90deg)",
          filter: disabled ? "none" : glowFilter,
        }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="74"
          cy="74"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        {/* Progress arc */}
        <circle
          cx="74"
          cy="74"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition:
              "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1), stroke 0.4s ease",
          }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className="text-3xl font-black tabular-nums leading-none"
          style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {score}
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          /100
        </span>
      </div>
    </div>
  );
}

// ─── Price cell ───────────────────────────────────────────────────────────────

function PriceCell({
  label,
  value,
  accent,
}: { label: string; value: number; accent: string }) {
  const formatted =
    value > 1000
      ? value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : value.toFixed(2);
  return (
    <div
      className="flex flex-col gap-1 rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-[0.18em]"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums leading-none"
        style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}
      >
        ${formatted}
      </span>
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  max,
  color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-black tabular-nums"
          style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {value}
          <span style={{ color: "rgba(255,255,255,0.25)" }}>/{max}</span>
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function CleanSignalCard({
  asset,
  signal,
  isLoading,
}: CleanSignalCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Loading skeleton
  if (isLoading || !signal) {
    return (
      <div
        data-ocid="scalper_signal.card"
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{
          background: "#1a1c22",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="space-y-4" data-ocid="scalper_signal.loading_state">
          <div className="h-5 w-16 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-36 w-36 rounded-full bg-white/5 animate-pulse mx-auto" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const isDisabled = signal.score < 60 || signal.trafficLight === "GREY";
  const c = COLORS[signal.trafficLight];
  const assetLabel = asset === "XAU" ? "GOLD" : asset;

  // Score bar accent colour
  const barColor =
    signal.trafficLight === "GREEN"
      ? "#34d399"
      : signal.trafficLight === "RED"
        ? "#f87171"
        : "#6b7280";

  return (
    <div
      data-ocid="scalper_signal.card"
      className="relative rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        background: "#1a1c22",
        boxShadow: isDisabled ? "0 0 0 1px rgba(255,255,255,0.07)" : c.cardGlow,
        border: isDisabled
          ? "1px solid rgba(255,255,255,0.07)"
          : `1px solid ${c.border}`,
        opacity: isDisabled ? 0.72 : 1,
        filter: isDisabled ? "saturate(0.35) brightness(0.75)" : "none",
      }}
    >
      {/* Ambient colour tint (active only) */}
      {!isDisabled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: c.tint }}
        />
      )}

      <div className="relative p-5 flex flex-col gap-4">
        {/* ── Header row ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          {/* Asset badge */}
          <span
            className="text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-md"
            style={{
              color: isDisabled ? "rgba(255,255,255,0.35)" : c.text,
              background: isDisabled ? "rgba(255,255,255,0.04)" : `${c.ring}18`,
              border: isDisabled
                ? "1px solid rgba(255,255,255,0.08)"
                : `1px solid ${c.ring}28`,
            }}
          >
            {assetLabel}
          </span>

          {/* Traffic light dot */}
          {c.pulse && !isDisabled ? (
            <span className="relative flex h-3 w-3">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: c.dot }}
              />
              <span
                className="relative inline-flex rounded-full h-3 w-3"
                style={{ backgroundColor: c.dot }}
              />
            </span>
          ) : (
            <span
              className="inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: isDisabled ? "#27272a" : c.dot }}
            />
          )}
        </div>

        {/* ── Signal direction (biggest element) ─────────────────────── */}
        <div>
          <p
            className="text-4xl font-black uppercase leading-none tracking-tight"
            style={{
              color: isDisabled ? "rgba(255,255,255,0.2)" : c.text,
              fontFamily: "'Bricolage Grotesque', 'Mona Sans', sans-serif",
              textShadow: !isDisabled ? `0 0 32px ${c.ring}55` : "none",
            }}
          >
            {signal.signalLabel}
          </p>
        </div>

        {/* ── Circular ring (always visible) ─────────────────────────── */}
        <div className="flex justify-center">
          <CircularRing
            score={signal.score}
            color={isDisabled ? "#3f3f46" : c.ring}
            glowFilter={c.ringGlow}
            disabled={isDisabled}
          />
        </div>

        {/* ── Disabled overlay message ──────────────────────────────── */}
        {isDisabled ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="text-lg">⏳</span>
              <span
                className="text-xs font-bold uppercase tracking-[0.12em] leading-snug"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                WAITING FOR INSTITUTIONAL SETUP
              </span>
            </div>
          </div>
        ) : (
          /* ── Price grid (active state only) ────────────────────── */
          <div
            className="grid grid-cols-2 gap-2 pt-1"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <PriceCell label="Entry" value={signal.entry} accent="#e4e4e7" />
            <PriceCell label="Stop Loss" value={signal.sl} accent="#f87171" />
            <PriceCell label="TP 1" value={signal.tp1} accent="#34d399" />
            <PriceCell label="TP 2" value={signal.tp2} accent="#6ee7b7" />
          </div>
        )}

        {/* ── Details toggle (active state only) ─────────────────────── */}
        {!isDisabled && (
          <div
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            className="pt-3"
          >
            <button
              type="button"
              data-ocid="scalper_signal.details.toggle"
              onClick={() => setDetailsOpen((o) => !o)}
              className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = c.text;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.35)";
              }}
            >
              <span>Show Details</span>
              <span
                className="transition-transform duration-300"
                style={{
                  display: "inline-block",
                  transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ▼
              </span>
            </button>

            {detailsOpen && (
              <div className="mt-4 space-y-5">
                {/* Score breakdown bars */}
                <div className="space-y-3">
                  <p
                    className="text-[9px] font-black uppercase tracking-[0.22em]"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    Score Breakdown
                  </p>
                  <ScoreBar
                    label="Market Structure"
                    value={signal.breakdown.marketStructure}
                    max={40}
                    color={barColor}
                  />
                  <ScoreBar
                    label="Volume Profile"
                    value={signal.breakdown.volumeProfile}
                    max={30}
                    color={barColor}
                  />
                  <ScoreBar
                    label="Trend Alignment"
                    value={signal.breakdown.trendAlignment}
                    max={20}
                    color={barColor}
                  />
                  <ScoreBar
                    label="Momentum"
                    value={signal.breakdown.momentum}
                    max={10}
                    color={barColor}
                  />
                </div>

                {/* SMC tags */}
                {(signal.isOrderBlock || signal.isLiquiditySweep) && (
                  <div className="flex flex-wrap gap-1.5">
                    {signal.isOrderBlock && (
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          color: "#fbbf24",
                          background: "rgba(251,191,36,0.1)",
                          border: "1px solid rgba(251,191,36,0.25)",
                        }}
                      >
                        ORDER BLOCK
                      </span>
                    )}
                    {signal.isLiquiditySweep && (
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          color: "#818cf8",
                          background: "rgba(129,140,248,0.1)",
                          border: "1px solid rgba(129,140,248,0.25)",
                        }}
                      >
                        LIQ SWEEP
                      </span>
                    )}
                  </div>
                )}

                {/* Indicator snapshot */}
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-2"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    paddingTop: "12px",
                  }}
                >
                  {[
                    { label: "5M Trend", value: signal.trend5m },
                    { label: "1H Trend", value: signal.trend1h },
                    { label: "RSI 14", value: signal.rsi14.toFixed(1) },
                    {
                      label: "Vol Ratio",
                      value: `${signal.volRatio.toFixed(2)}x`,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span
                        className="text-[8px] font-semibold uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-[11px] font-bold tabular-nums"
                        style={{
                          color:
                            value === "BULL"
                              ? "#34d399"
                              : value === "BEAR"
                                ? "#f87171"
                                : "rgba(255,255,255,0.55)",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
