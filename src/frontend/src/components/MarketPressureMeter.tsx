import { BookOpen } from "lucide-react";
import { motion } from "motion/react";
import type { OrderBookState } from "../hooks/useOrderBook";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBtc(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K BTC`;
  return `${vol.toFixed(2)} BTC`;
}

function timeSince(date: Date | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  state: OrderBookState;
}

export function MarketPressureMeter({ state }: Props) {
  const {
    buyPressure,
    sellPressure,
    buyVolume,
    sellVolume,
    label,
    lastUpdated,
    isLoading,
  } = state;

  const labelColor =
    label === "BULLISH PRESSURE"
      ? "signal-buy"
      : label === "BEARISH PRESSURE"
        ? "signal-sell"
        : "signal-hold";

  const labelBg =
    label === "BULLISH PRESSURE"
      ? "bg-bull/10 border-bull/30 text-bull"
      : label === "BEARISH PRESSURE"
        ? "bg-bear/10 border-bear/30 text-bear"
        : "bg-hold/10 border-hold/30 text-hold";

  // Show skeleton if still loading and no data yet
  if (isLoading && lastUpdated === null) {
    return (
      <div
        data-ocid="order_book.panel"
        className="trading-card p-4 animate-pulse"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-3.5 h-3.5 text-primary/50" />
          <div className="h-3 w-40 bg-secondary rounded" />
        </div>
        <div className="h-4 w-full bg-secondary rounded mb-3" />
        <div className="h-6 w-24 bg-secondary rounded mb-2" />
        <div className="h-2 w-32 bg-secondary rounded" />
      </div>
    );
  }

  return (
    <div data-ocid="order_book.panel" className="trading-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">
            BTC Order Book Pressure
          </span>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border font-mono ${labelColor}`}
        >
          {label}
        </span>
      </div>

      {/* Split pressure bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-bull font-semibold">Buy Pressure</span>
          <span className="text-bear font-semibold">Sell Pressure</span>
        </div>

        {/* Split bar */}
        <div className="relative h-5 bg-secondary rounded-full overflow-hidden flex">
          {/* Buy side (left, green) */}
          <motion.div
            className="h-full bg-bull rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${buyPressure}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          {/* Sell side (right, red) — fills the rest */}
          <motion.div
            className="h-full bg-bear rounded-r-full flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
          {/* Percentage labels overlay */}
          <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
            <span className="text-[10px] font-mono font-bold text-white/90">
              {buyPressure.toFixed(1)}%
            </span>
            <span className="text-[10px] font-mono font-bold text-white/90">
              {sellPressure.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Volume breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-bull/10 border border-bull/20 rounded-md p-2">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
            Bid Volume (Buy)
          </div>
          <div className="text-xs font-mono font-bold text-bull">
            {formatBtc(buyVolume)}
          </div>
        </div>
        <div className="bg-bear/10 border border-bear/20 rounded-md p-2">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
            Ask Volume (Sell)
          </div>
          <div className="text-xs font-mono font-bold text-bear">
            {formatBtc(sellVolume)}
          </div>
        </div>
      </div>

      {/* Market bias badge */}
      <div
        className={`w-full text-center py-1.5 rounded-md border text-xs font-bold font-mono ${labelBg}`}
      >
        {label}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
        <span className="text-[9px] text-muted-foreground">
          Top 100 orders · Binance
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">
          Updated {timeSince(lastUpdated)}
        </span>
      </div>
    </div>
  );
}
