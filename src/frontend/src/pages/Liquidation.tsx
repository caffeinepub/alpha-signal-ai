import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Flame, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLiquidationData } from "../hooks/useLiquidationData";

const ASSETS = ["BTC"];
const FALLBACK_BTC_PRICE = 95000;
const NUM_BUCKETS = 10;
const PRICE_RANGE_PCT = 0.05; // ±5%

// ── BTC price helper ──────────────────────────────────────────────────────────────────────

function useBtcPrice() {
  const [price, setPrice] = useState(FALLBACK_BTC_PRICE);
  useEffect(() => {
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
      .then((r) => r.json())
      .then((d) => {
        const p = Number.parseFloat(d.price);
        if (Number.isFinite(p) && p > 0) setPrice(p);
      })
      .catch(() => {
        // keep fallback
      });
  }, []);
  return price;
}

// ── Bell-curve distribution helper ──────────────────────────────────────────────────────────

function bellWeight(idx: number, total: number): number {
  const center = (total - 1) / 2;
  const sigma = total / 4;
  const x = idx - center;
  return Math.exp(-(x * x) / (2 * sigma * sigma));
}

// ── Sub-components ──────────────────────────────────────────────────────────────────────

function MarketPressureIndicator({
  totalLongs,
  totalShorts,
}: {
  totalLongs: number;
  totalShorts: number;
}) {
  const total = totalLongs + totalShorts || 1;
  const longPct = (totalLongs / total) * 100;
  const shortPct = (totalShorts / total) * 100;
  const isLongDominant = totalLongs > totalShorts;

  return (
    <div className="trading-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-hold" />
        <span className="text-sm font-semibold text-foreground">
          Market Pressure Indicator
        </span>
      </div>

      <div className="space-y-3">
        {/* Labels */}
        <div className="flex justify-between text-xs font-mono font-bold">
          <span className="text-bear">LONG LIQUIDATIONS</span>
          <span className="text-bull">SHORT LIQUIDATIONS</span>
        </div>

        {/* Gauge bar */}
        <div className="relative h-6 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-bear/80 rounded-l-full transition-all duration-700 absolute left-0"
            style={{ width: `${longPct}%` }}
          />
          <div
            className="h-full bg-bull/80 rounded-r-full transition-all duration-700 absolute right-0"
            style={{ width: `${shortPct}%` }}
          />
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border z-10" />
          {/* Current indicator */}
          <div
            className="absolute top-1 bottom-1 w-1 rounded-full bg-white/90 shadow-lg transition-all duration-700 z-20"
            style={{ left: `calc(${longPct}% - 2px)` }}
          />
        </div>

        {/* Percentages */}
        <div className="flex justify-between text-xs font-mono">
          <div className="text-bear font-bold">
            {longPct.toFixed(1)}% Longs at Risk
          </div>
          <div className="text-bull font-bold">
            {shortPct.toFixed(1)}% Shorts at Risk
          </div>
        </div>

        {/* Dominant pressure */}
        <div
          className={`text-center py-2 rounded-md text-xs font-bold ${
            isLongDominant
              ? "bg-bear/10 text-bear border border-bear/20"
              : "bg-bull/10 text-bull border border-bull/20"
          }`}
        >
          {isLongDominant
            ? "⚠ HIGH LONG PRESSURE — Bearish Risk"
            : "⚠ HIGH SHORT PRESSURE — Bullish Risk"}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="bg-bear/10 rounded-md p-3 border border-bear/20">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
              Long Liquidations
            </div>
            <div className="text-sm font-mono font-bold text-bear mt-1">
              ${(totalLongs / 1e6).toFixed(2)}M
            </div>
          </div>
          <div className="bg-bull/10 rounded-md p-3 border border-bull/20">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
              Short Liquidations
            </div>
            <div className="text-sm font-mono font-bold text-bull mt-1">
              ${(totalShorts / 1e6).toFixed(2)}M
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 text-xs shadow-xl">
        <div className="font-mono font-bold text-foreground mb-2">
          $
          {Number(label).toLocaleString("en-US", {
            minimumFractionDigits: 0,
          })}
        </div>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-mono font-bold" style={{ color: p.color }}>
              ${(p.value / 1e6).toFixed(2)}M
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ── Main Page ────────────────────────────────────────────────────────────────────────────

export default function Liquidation() {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const liqState = useLiquidationData();
  const currentPrice = useBtcPrice();

  const {
    longLiquidations,
    shortLiquidations,
    isConnected,
    statusMessage,
    isSimulated,
  } = liqState;

  // Build synthetic heatmap chart from long/short totals distributed across price buckets
  const chartData = useMemo(() => {
    const priceMin = currentPrice * (1 - PRICE_RANGE_PCT);
    const priceMax = currentPrice * (1 + PRICE_RANGE_PCT);
    const step = (priceMax - priceMin) / (NUM_BUCKETS - 1);

    // Bell-curve weights (more liquidations concentrated near current price)
    const weights = Array.from({ length: NUM_BUCKETS }, (_, i) =>
      bellWeight(i, NUM_BUCKETS),
    );
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    return weights.map((w, i) => {
      const priceLevel = priceMin + i * step;
      const share = w / totalWeight;
      return {
        priceLevel: Math.round(priceLevel),
        longLiquidations: longLiquidations * share,
        shortLiquidations: shortLiquidations * share,
        label:
          priceLevel >= 1000
            ? `$${(priceLevel / 1000).toFixed(1)}K`
            : `$${priceLevel.toFixed(0)}`,
      };
    });
  }, [longLiquidations, shortLiquidations, currentPrice]);

  const totalLongs = longLiquidations;
  const totalShorts = shortLiquidations;
  const hasData = longLiquidations + shortLiquidations > 0;

  const formatLiq = (v: number) => {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  const formatPrice = (v: number | string) => {
    const n = Number(v);
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header + Asset Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-bear" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Liquidation Heatmap
          </span>
          {isSimulated && (
            <span className="text-[9px] font-mono text-muted-foreground/50 bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
              [SIMULATED DATA]
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bull" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground" />
              )}
            </span>
            <span
              className={`text-[10px] font-mono ${
                isConnected ? "text-bull" : "text-muted-foreground"
              }`}
            >
              {isConnected ? "Connected" : "Syncing..."}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {ASSETS.map((asset) => (
              <button
                key={asset}
                type="button"
                data-ocid={`liquidation.${asset.toLowerCase()}.tab`}
                onClick={() => setSelectedAsset(asset)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold font-mono transition-all duration-200 ${
                  selectedAsset === asset
                    ? "bg-primary text-primary-foreground glow-cyan"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status message */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground/70">
          {statusMessage}
        </span>
        {currentPrice > 0 && (
          <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
            BTC: $
            {currentPrice.toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        )}
      </div>

      {/* Main Chart */}
      <div className="trading-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-bear/70" />
              <span className="text-muted-foreground">Long Liquidations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-bull/70" />
              <span className="text-muted-foreground">Short Liquidations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-px border-t-2 border-dashed border-primary" />
              <span className="text-muted-foreground">Current Price</span>
            </div>
          </div>
        </div>

        {!hasData ? (
          <div
            className="h-80 flex flex-col items-center justify-center text-muted-foreground gap-3"
            data-ocid="liquidation.loading_state"
          >
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-semibold">Syncing...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {statusMessage}
              </p>
              {isSimulated && (
                <p className="text-[10px] text-muted-foreground/40 mt-1 font-mono">
                  (simulated data loading)
                </p>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 50, bottom: 30 }}
              barCategoryGap="10%"
            >
              <CartesianGrid
                stroke="oklch(0.28 0.03 250 / 0.3)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="priceLevel"
                tickFormatter={formatPrice}
                tick={{ fill: "oklch(0.55 0.02 250)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                tickFormatter={formatLiq}
                tick={{ fill: "oklch(0.55 0.02 250)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={Math.round(currentPrice)}
                stroke="oklch(0.70 0.18 220)"
                strokeWidth={2}
                strokeDasharray="5 3"
                label={{
                  value: "Current",
                  fill: "oklch(0.70 0.18 220)",
                  fontSize: 9,
                  position: "top",
                }}
              />
              <Bar
                dataKey="longLiquidations"
                name="Long Liquidations"
                fill="oklch(0.60 0.22 25 / 0.75)"
                radius={[2, 2, 0, 0]}
                maxBarSize={20}
              />
              <Bar
                dataKey="shortLiquidations"
                name="Short Liquidations"
                fill="oklch(0.65 0.20 145 / 0.75)"
                radius={[2, 2, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Market Pressure */}
      <MarketPressureIndicator
        totalLongs={totalLongs}
        totalShorts={totalShorts}
      />
    </div>
  );
}
