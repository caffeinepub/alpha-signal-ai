import { Flame } from "lucide-react";
import { motion } from "motion/react";
import type { LiquidationState } from "../hooks/useLiquidationData";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  state: LiquidationState;
}

export function LiquidationCascadePanel({ state }: Props) {
  const { longLiquidations, shortLiquidations, liquidationBias, isConnected } =
    state;

  const total = longLiquidations + shortLiquidations;
  const isZero = total === 0;

  const longPct = total > 0 ? (longLiquidations / total) * 100 : 50;
  const shortPct = total > 0 ? (shortLiquidations / total) * 100 : 50;

  const biasColor =
    liquidationBias === "BULLISH"
      ? "signal-buy"
      : liquidationBias === "BEARISH"
        ? "signal-sell"
        : "signal-hold";

  const biasBg =
    liquidationBias === "BULLISH"
      ? "bg-bull/10 border-bull/30 text-bull"
      : liquidationBias === "BEARISH"
        ? "bg-bear/10 border-bear/30 text-bear"
        : "bg-hold/10 border-hold/30 text-hold";

  const biasLabel =
    liquidationBias === "BULLISH"
      ? "BULLISH — Shorts Being Wiped"
      : liquidationBias === "BEARISH"
        ? "BEARISH — Longs Being Wiped"
        : "NEUTRAL";

  return (
    <div data-ocid="liquidation.panel" className="trading-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-bear" />
          <span className="text-xs font-semibold text-muted-foreground">
            BTC Liquidation Cascade
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border font-mono ${biasColor}`}
          >
            {liquidationBias}
          </span>
          {/* Connection dot */}
          <span className="relative flex h-1.5 w-1.5">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bull" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-muted-foreground" />
            )}
          </span>
        </div>
      </div>

      {/* Zero state */}
      {isZero ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Flame className="w-6 h-6 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">
            Monitoring liquidations...
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {isConnected
              ? "Connected — waiting for events"
              : "Connecting to Binance futures stream"}
          </p>
        </div>
      ) : (
        <>
          {/* Liquidation values */}
          <div className="space-y-2 mb-3">
            {/* Long liquidations */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Long Liqs{" "}
                  <span className="text-bear/70">(Bearish Pressure)</span>
                </div>
                <div className="text-lg font-mono font-bold text-bear">
                  {formatUsd(longLiquidations)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-muted-foreground">Share</div>
                <div className="text-xs font-mono font-bold text-bear">
                  {longPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Short liquidations */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Short Liqs{" "}
                  <span className="text-bull/70">(Bullish Pressure)</span>
                </div>
                <div className="text-lg font-mono font-bold text-bull">
                  {formatUsd(shortLiquidations)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-muted-foreground">Share</div>
                <div className="text-xs font-mono font-bold text-bull">
                  {shortPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Visual comparison bar */}
          <div className="mb-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
              {/* Longs (red) */}
              <motion.div
                className="h-full bg-bear"
                initial={{ width: 0 }}
                animate={{ width: `${longPct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
              {/* Shorts (green) fills the rest */}
              <div className="h-full bg-bull flex-1" />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5 text-muted-foreground font-mono">
              <span>Longs</span>
              <span>Shorts</span>
            </div>
          </div>

          {/* Market bias badge */}
          <div
            className={`w-full text-center py-1.5 rounded-md border text-xs font-bold font-mono ${biasBg}`}
          >
            {biasLabel}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
        <span className="text-[9px] text-muted-foreground">
          1-hour rolling window
        </span>
        <span
          className={`text-[9px] font-mono ${isConnected ? "text-bull" : "text-muted-foreground"}`}
        >
          {isConnected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
    </div>
  );
}
