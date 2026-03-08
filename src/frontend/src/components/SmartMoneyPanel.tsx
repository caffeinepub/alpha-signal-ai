import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import type { SmartMoneyState } from "../hooks/useSmartMoneyFlow";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatOI(btc: number): string {
  if (btc >= 1_000_000) return `${(btc / 1_000_000).toFixed(2)}M BTC`;
  if (btc >= 1_000) return `${(btc / 1_000).toFixed(1)}K BTC`;
  return `${btc.toFixed(2)} BTC`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function timeSince(date: Date | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  subLabel,
  children,
}: {
  label: string;
  subLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-secondary/50 rounded-lg border border-border/60 p-3 flex flex-col gap-1.5">
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </div>
        <div className="text-[9px] text-muted-foreground/60">{subLabel}</div>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  state: SmartMoneyState;
}

export function SmartMoneyPanel({ state }: Props) {
  const {
    openInterest,
    openInterestChange,
    fundingRate,
    whaleActivity,
    whaleBuyVolume,
    whaleSellVolume,
    isLoading,
    isWsConnected,
    lastUpdated,
  } = state;

  const totalWhaleVolume = whaleBuyVolume + whaleSellVolume;
  const buyPct =
    totalWhaleVolume > 0 ? (whaleBuyVolume / totalWhaleVolume) * 100 : 0;
  const sellPct =
    totalWhaleVolume > 0 ? (whaleSellVolume / totalWhaleVolume) * 100 : 0;

  const oiChangePositive = openInterestChange >= 0;

  const fundingLabel =
    fundingRate > 0.001
      ? "Longs Pay Shorts"
      : fundingRate < -0.001
        ? "Shorts Pay Longs"
        : "Neutral";

  const fundingColor =
    fundingRate > 0.001
      ? "text-bull"
      : fundingRate < -0.001
        ? "text-bear"
        : "text-hold";

  const whaleActivityColor =
    whaleActivity === "ACCUMULATION"
      ? "text-bull bg-bull/10 border-bull/30"
      : whaleActivity === "DISTRIBUTION"
        ? "text-bear bg-bear/10 border-bear/30"
        : "text-hold bg-hold/10 border-hold/30";

  const isHighFunding = Math.abs(fundingRate) > 0.05;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading && lastUpdated === null) {
    return (
      <div
        data-ocid="smart_money.panel"
        className="trading-card p-4 animate-pulse"
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5 text-primary/50" />
          <div className="h-3 w-48 bg-secondary rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["oi", "fr", "wa"] as const).map((id) => (
            <div
              key={id}
              className="bg-secondary/50 rounded-lg border border-border/60 p-3 space-y-2"
            >
              <div className="h-2 w-24 bg-secondary rounded" />
              <div className="h-6 w-32 bg-secondary rounded" />
              <div className="h-2 w-16 bg-secondary rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-ocid="smart_money.panel" className="trading-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">
            Smart Money Flow
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono">
            BINANCE FUTURES
          </span>
        </div>
        {/* WebSocket status */}
        <div className="flex items-center gap-1.5">
          {isWsConnected ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bull" />
              </span>
              <span className="text-[9px] font-bold font-mono text-bull tracking-widest">
                LIVE
              </span>
            </>
          ) : (
            <>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-hold" />
              <span className="text-[9px] font-bold font-mono text-hold tracking-widest">
                CONNECTING
              </span>
            </>
          )}
        </div>
      </div>

      {/* Three-column metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {/* ── Card 1: Open Interest ── */}
        <MetricCard label="Open Interest" subLabel="BTC Futures">
          <div className="text-lg font-mono font-bold text-foreground">
            {formatOI(openInterest)}
          </div>
          <div className="flex items-center gap-1">
            {oiChangePositive ? (
              <TrendingUp className="w-3 h-3 text-bull shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 text-bear shrink-0" />
            )}
            <span
              className={`text-xs font-mono font-bold ${
                oiChangePositive ? "text-bull" : "text-bear"
              }`}
            >
              {oiChangePositive ? "+" : ""}
              {openInterestChange.toFixed(3)}%
            </span>
            <span className="text-[9px] text-muted-foreground/60">change</span>
          </div>
        </MetricCard>

        {/* ── Card 2: Funding Rate ── */}
        <MetricCard label="Funding Rate" subLabel="8H Rate">
          <div
            className={`text-lg font-mono font-bold flex items-center gap-1.5 ${fundingColor}`}
          >
            {fundingRate >= 0 ? "+" : ""}
            {fundingRate.toFixed(4)}%
            {isHighFunding && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-hold/20 border border-hold/30 text-hold ml-1">
                HIGH
              </span>
            )}
          </div>
          <div className={`text-[10px] font-semibold ${fundingColor}`}>
            {fundingLabel}
          </div>
        </MetricCard>

        {/* ── Card 3: Whale Activity ── */}
        <MetricCard label="Whale Activity" subLabel=">$500K trades · 5min">
          <div
            className={`inline-flex px-2.5 py-1 rounded-md border text-[10px] font-bold font-mono tracking-wider w-fit ${whaleActivityColor}`}
          >
            {whaleActivity}
          </div>

          {totalWhaleVolume > 0 ? (
            <div className="space-y-1.5 mt-1">
              {/* Buy bar */}
              <div>
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span className="text-bull font-semibold">Buy</span>
                  <span className="font-mono text-bull">
                    {formatUsd(whaleBuyVolume)}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-bull rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${buyPct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
              {/* Sell bar */}
              <div>
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span className="text-bear font-semibold">Sell</span>
                  <span className="font-mono text-bear">
                    {formatUsd(whaleSellVolume)}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-bear rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${sellPct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              Monitoring...
            </div>
          )}
        </MetricCard>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <span className="text-[9px] text-muted-foreground">
          Updated {timeSince(lastUpdated)}
        </span>
        <div className="flex items-center gap-1">
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              isWsConnected ? "bg-bull" : "bg-muted-foreground"
            }`}
          />
          <span
            className={`text-[9px] font-mono ${
              isWsConnected ? "text-bull" : "text-muted-foreground"
            }`}
          >
            {isWsConnected ? "WebSocket LIVE" : "WebSocket OFFLINE"}
          </span>
        </div>
      </div>
    </div>
  );
}
