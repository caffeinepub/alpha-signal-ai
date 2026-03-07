import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRecord } from "../backend.d";
import { usePerformanceStats, useTradeHistory } from "../hooks/useQueries";

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "neutral" | "blue";
  icon?: React.ElementType;
}) {
  const colorClass = {
    green: "text-bull",
    red: "text-bear",
    neutral: "text-hold",
    blue: "text-primary",
  }[color || "blue"];

  return (
    <div className="trading-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {Icon && <Icon className={`w-4 h-4 ${colorClass}`} />}
      </div>
      <div className={`text-xl font-bold font-mono ${colorClass}`}>{value}</div>
      {sub && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function WinRateDonut({ winRate }: { winRate: number }) {
  const data = [
    { name: "Wins", value: winRate },
    { name: "Losses", value: 100 - winRate },
  ];

  return (
    <div className="trading-card p-4 flex flex-col items-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 self-start">
        Win Rate
      </div>
      <div className="relative w-32 h-32">
        <PieChart width={128} height={128}>
          <Pie
            data={data}
            cx={64}
            cy={64}
            innerRadius={42}
            outerRadius={58}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill="oklch(0.65 0.20 145)" />
            <Cell fill="oklch(0.28 0.03 250)" />
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono text-bull">
            {winRate.toFixed(1)}%
          </span>
          <span className="text-[9px] text-muted-foreground">Win Rate</span>
        </div>
      </div>
    </div>
  );
}

function PnLChart({ trades }: { trades: TradeRecord[] }) {
  const chartData = useMemo(() => {
    let cumPnl = 0;
    return [...trades]
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
      .map((t, i) => {
        cumPnl += t.pnl;
        return {
          trade: i + 1,
          cumPnl,
          pnl: t.pnl,
          date: new Date(Number(t.timestamp) / 1_000_000).toLocaleDateString(
            "en-US",
            {
              month: "short",
              day: "numeric",
            },
          ),
        };
      });
  }, [trades]);

  const isPositive = chartData[chartData.length - 1]?.cumPnl >= 0;

  return (
    <div className="trading-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Cumulative P&L
        </span>
        {chartData.length > 0 && (
          <span
            className={`ml-auto text-sm font-mono font-bold ${isPositive ? "text-bull" : "text-bear"}`}
          >
            {isPositive ? "+" : ""}$
            {chartData[chartData.length - 1]?.cumPnl?.toFixed(2)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 50, bottom: 5 }}
        >
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={
                  isPositive ? "oklch(0.65 0.20 145)" : "oklch(0.60 0.22 25)"
                }
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor={
                  isPositive ? "oklch(0.65 0.20 145)" : "oklch(0.60 0.22 25)"
                }
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="oklch(0.28 0.03 250 / 0.3)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "oklch(0.55 0.02 250)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "oklch(0.55 0.02 250)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.16 0.025 250)",
              border: "1px solid oklch(0.28 0.03 250)",
              borderRadius: "6px",
              fontSize: "11px",
            }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "Cum. P&L"]}
            labelStyle={{ color: "oklch(0.92 0.01 250)" }}
          />
          <Area
            type="monotone"
            dataKey="cumPnl"
            stroke={isPositive ? "oklch(0.65 0.20 145)" : "oklch(0.60 0.22 25)"}
            strokeWidth={2}
            fill="url(#pnlGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TradeTable({ trades }: { trades: TradeRecord[] }) {
  const sorted = useMemo(
    () => [...trades].sort((a, b) => Number(b.timestamp) - Number(a.timestamp)),
    [trades],
  );

  return (
    <div className="trading-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Trade History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                #
              </th>
              <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                Symbol
              </th>
              <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                Dir
              </th>
              <th className="text-right p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                Entry
              </th>
              <th className="text-right p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                Exit
              </th>
              <th className="text-right p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                P&L $
              </th>
              <th className="text-right p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                P&L %
              </th>
              <th className="text-center p-3 text-muted-foreground font-semibold uppercase tracking-wider">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((trade, i) => {
              const isWin = trade.pnl >= 0;
              const ocidIndex = i + 1;
              return (
                <tr
                  key={Number(trade.id)}
                  data-ocid={`performance.trade.row.${ocidIndex}`}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="p-3 font-mono text-muted-foreground">
                    {Number(trade.id)}
                  </td>
                  <td className="p-3 font-mono font-bold text-foreground">
                    {trade.symbol}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                        trade.direction === "BUY" ? "signal-buy" : "signal-sell"
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-foreground">
                    $
                    {trade.entryPrice.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="p-3 text-right font-mono text-foreground">
                    $
                    {trade.exitPrice.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td
                    className={`p-3 text-right font-mono font-bold ${isWin ? "text-bull" : "text-bear"}`}
                  >
                    {isWin ? "+" : ""}
                    {trade.pnl.toFixed(2)}
                  </td>
                  <td
                    className={`p-3 text-right font-mono font-bold ${isWin ? "text-bull" : "text-bear"}`}
                  >
                    {isWin ? "+" : ""}
                    {trade.pnlPercent.toFixed(2)}%
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        trade.outcome === "WIN" || trade.outcome === "PROFIT"
                          ? "signal-buy"
                          : "signal-sell"
                      }`}
                    >
                      {trade.outcome}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Performance() {
  const { data: stats, isLoading: statsLoading } = usePerformanceStats();
  const { data: trades, isLoading: tradesLoading } = useTradeHistory();

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Trading Analytics
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Stats Row */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton loader
            <div key={i} className="trading-card p-4">
              <Skeleton className="h-16 bg-secondary" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {stats && <WinRateDonut winRate={stats.winRate} />}
          {stats && (
            <>
              <StatCard
                label="Total P&L"
                value={`${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`}
                color={stats.totalPnl >= 0 ? "green" : "red"}
                icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
              />
              <StatCard
                label="Total Trades"
                value={String(Number(stats.totalTrades))}
                sub="All time"
                color="blue"
                icon={Target}
              />
              <StatCard
                label="Avg Win"
                value={`+$${stats.avgWin.toFixed(2)}`}
                color="green"
                icon={TrendingUp}
              />
              <StatCard
                label="Avg Loss"
                value={`-$${Math.abs(stats.avgLoss).toFixed(2)}`}
                color="red"
                icon={TrendingDown}
              />
              <StatCard
                label="Best Trade"
                value={`+$${stats.bestTrade.toFixed(2)}`}
                color="green"
                icon={Trophy}
              />
            </>
          )}
        </div>
      )}

      {/* P&L Chart */}
      {tradesLoading ? (
        <div className="trading-card p-4">
          <Skeleton className="h-48 bg-secondary" />
        </div>
      ) : trades && trades.length > 0 ? (
        <PnLChart trades={trades} />
      ) : null}

      {/* Trade History Table */}
      {tradesLoading ? (
        <div className="trading-card p-4">
          <Skeleton className="h-64 bg-secondary" />
        </div>
      ) : trades && trades.length > 0 ? (
        <TradeTable trades={trades} />
      ) : (
        <div
          className="trading-card p-8 text-center"
          data-ocid="performance.trades.empty_state"
        >
          <p className="text-muted-foreground">No trade history available</p>
        </div>
      )}
    </div>
  );
}
