import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import type { BacktestTrade } from "../hooks/useBacktestTracker";
import { useBacktestTracker } from "../hooks/useBacktestTracker";

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

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueClass,
  subContent,
}: {
  label: string;
  value: string;
  valueClass?: string;
  subContent?: React.ReactNode;
}) {
  return (
    <div className="bg-secondary/40 rounded-lg p-3 flex flex-col gap-1">
      <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
        {label}
      </div>
      <div
        className={`text-lg font-bold font-mono ${valueClass ?? "text-foreground"}`}
      >
        {value}
      </div>
      {subContent && <div className="mt-0.5">{subContent}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Row
// ─────────────────────────────────────────────────────────────────────────────

function TradeRow({
  trade,
  index,
}: {
  trade: BacktestTrade;
  index: number;
}) {
  const isWin = trade.status === "WIN";
  const isOpen = trade.status === "OPEN";
  const isBuy = trade.direction === "STRONG BUY";
  const closedTime = trade.closedTime ?? trade.signalTime;

  const statusBadge = isOpen ? (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border bg-hold/10 text-hold border-hold/30 font-mono">
      <span className="w-1.5 h-1.5 rounded-full bg-hold animate-pulse" />
      OPEN
    </span>
  ) : isWin ? (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-bull/10 text-bull border-bull/30 font-mono">
      WIN
    </span>
  ) : (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-bear/10 text-bear border-bear/30 font-mono">
      LOSS
    </span>
  );

  const dirBadge = isBuy ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-bull/10 text-bull border border-bull/20 font-mono">
      BUY
    </span>
  ) : (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-bear/10 text-bear border border-bear/20 font-mono">
      SELL
    </span>
  );

  const ocidSuffix = index + 1;

  return (
    <div
      data-ocid={`backtest.trade.row.${ocidSuffix}`}
      className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        {statusBadge}
        <span className="text-xs font-bold font-mono text-foreground">
          {trade.symbol}
        </span>
        {dirBadge}
      </div>
      <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono">
        <span className="text-muted-foreground">
          {formatPrice(trade.entryPrice)}
        </span>
        <span className="text-muted-foreground">→</span>
        <span
          className={isOpen ? "text-hold" : isWin ? "text-bull" : "text-bear"}
        >
          {isOpen
            ? formatPrice(trade.takeProfit)
            : isWin
              ? formatPrice(trade.takeProfit)
              : formatPrice(trade.stopLoss)}
        </span>
        <span className="text-muted-foreground/60 hidden sm:inline">
          {timeAgo(closedTime)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Open Trade Row
// ─────────────────────────────────────────────────────────────────────────────

function OpenTradeRow({
  trade,
  index,
}: { trade: BacktestTrade; index: number }) {
  const isBuy = trade.direction === "STRONG BUY";
  const ocidSuffix = index + 1;

  return (
    <div
      data-ocid={`backtest.trade.row.${ocidSuffix}`}
      className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0"
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border bg-hold/10 text-hold border-hold/30 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-hold animate-pulse" />
          OPEN
        </span>
        <span className="text-xs font-bold font-mono text-foreground">
          {trade.symbol}
        </span>
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono ${
            isBuy
              ? "bg-bull/10 text-bull border-bull/20"
              : "bg-bear/10 text-bear border-bear/20"
          }`}
        >
          {isBuy ? "BUY" : "SELL"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <div className="text-right">
          <div className="text-muted-foreground/70">
            Entry: {formatPrice(trade.entryPrice)}
          </div>
          <div className="text-bull">TP: {formatPrice(trade.takeProfit)}</div>
        </div>
        <div className="text-bear text-right">
          SL: {formatPrice(trade.stopLoss)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

export function BacktestPerformancePanel() {
  const { trades, stats } = useBacktestTracker();

  const { totalTrades, wins, losses, openTrades, winRate, avgRR } = stats;

  const winRateColor =
    winRate > 50
      ? "text-bull"
      : winRate < 50 && totalTrades > 0
        ? "text-bear"
        : "text-muted-foreground";

  // Last 5 closed trades, most recent first
  const closedTrades = trades
    .filter((t) => t.status !== "OPEN")
    .slice()
    .reverse()
    .slice(0, 5);

  const openTradeList = trades.filter((t) => t.status === "OPEN");

  return (
    <div
      data-ocid="backtest.panel"
      className="trading-card p-4 flex flex-col gap-4"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Strategy Backtesting
          </span>
          {/* LIVE badge */}
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-bull/10 border border-bull/30 text-bull font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
            LIVE
          </span>
        </div>
        {/* Open trades pill */}
        {openTrades > 0 && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-hold/10 border border-hold/30 text-hold font-mono">
            TRACKING {openTrades} OPEN
          </span>
        )}
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Win Rate */}
        <div
          data-ocid="backtest.winrate.card"
          className="col-span-2 sm:col-span-1 bg-secondary/40 rounded-lg p-3 flex flex-col gap-1"
        >
          <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
            Win Rate
          </div>
          <div className={`text-2xl font-bold font-mono ${winRateColor}`}>
            {totalTrades === 0 ? "—" : `${winRate.toFixed(1)}%`}
          </div>
          {/* Animated progress bar */}
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
            <motion.div
              className={`h-full rounded-full ${winRate > 50 ? "bg-bull" : winRate > 0 ? "bg-bear" : "bg-muted"}`}
              initial={{ width: 0 }}
              animate={{ width: `${winRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        <StatCard
          label="Total Trades"
          value={totalTrades > 0 ? String(totalTrades) : "—"}
        />
        <StatCard
          label="Wins"
          value={wins > 0 ? String(wins) : "—"}
          valueClass="text-bull"
        />
        <StatCard
          label="Losses"
          value={losses > 0 ? String(losses) : "—"}
          valueClass="text-bear"
        />
        <StatCard
          label="Avg R:R"
          value={avgRR > 0 ? `1:${avgRR.toFixed(2)}` : "—"}
          valueClass="text-primary"
        />
      </div>

      {/* ── Recent Closed Trades ──────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
          Recent Signals
        </div>
        <div data-ocid="backtest.trades.list">
          {closedTrades.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-muted-foreground/60 italic">
              Monitoring signals… Results will appear as trades close.
            </div>
          ) : (
            closedTrades.map((trade, i) => (
              <TradeRow key={trade.id} trade={trade} index={i} />
            ))
          )}
        </div>
      </div>

      {/* ── Open Trades ───────────────────────────────────────────────────── */}
      {openTradeList.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hold animate-pulse" />
            Monitoring
          </div>
          {openTradeList.map((trade, i) => (
            <OpenTradeRow key={trade.id} trade={trade} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
