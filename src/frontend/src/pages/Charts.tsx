import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle } from "../backend.d";
import { useCandlestickData } from "../hooks/useQueries";

const ASSETS = ["BTC", "ETH", "GOLD"];
const TIMEFRAMES = ["1D", "1W", "1M"];

function calcEMA(data: number[], period: number): (number | null)[] {
  if (data.length < period) return data.map(() => null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = Array(period - 1).fill(null);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function detectSupportResistance(candles: Candle[]): number[] {
  if (candles.length < 5) return [];
  const levels: number[] = [];
  const prices = [...candles.map((c) => c.high), ...candles.map((c) => c.low)];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const bucketSize = range / 20;

  const buckets: Record<number, number> = {};
  for (const p of prices) {
    const bucket = Math.floor((p - min) / bucketSize);
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }

  const sortedBuckets = Object.entries(buckets)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3);

  for (const [bucket] of sortedBuckets) {
    const level = min + (Number(bucket) + 0.5) * bucketSize;
    if (!levels.some((l) => Math.abs(l - level) < range * 0.05)) {
      levels.push(level);
    }
  }

  const closes = candles.map((c) => c.close);
  const mid = (Math.min(...closes) + Math.max(...closes)) / 2;
  if (!levels.some((l) => Math.abs(l - mid) < range * 0.05)) {
    levels.push(mid);
  }

  return levels.slice(0, 3).sort((a, b) => a - b);
}

interface CandlestickChartProps {
  candles: Candle[];
  width: number;
  height: number;
}

function CandlestickChart({ candles, width, height }: CandlestickChartProps) {
  if (!candles.length) return null;

  const closes = candles.map((c) => c.close);
  const ema10 = calcEMA(closes, 10);
  const ema20 = calcEMA(closes, 20);
  const srLevels = detectSupportResistance(candles);

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.05;
  const chartMin = minPrice - padding;
  const chartMax = maxPrice + padding;
  const totalRange = chartMax - chartMin;

  const PADDING_LEFT = 60;
  const PADDING_RIGHT = 10;
  const PADDING_TOP = 10;
  const PADDING_BOTTOM = 25;
  const chartWidth = width - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM;

  const n = candles.length;
  const candleWidth = Math.max(2, (chartWidth / n) * 0.6);
  const gap = chartWidth / n;

  const toX = (i: number) => PADDING_LEFT + i * gap + gap / 2;
  const toY = (price: number) =>
    PADDING_TOP + ((chartMax - price) / totalRange) * chartHeight;

  // Y-axis ticks using price as stable key
  const yTicks = Array.from({ length: 6 }, (_, i) => {
    const price = chartMin + (i / 5) * totalRange;
    return { price, y: toY(price) };
  }).reverse();

  // X-axis ticks
  const xTickEvery = Math.max(1, Math.floor(n / 6));
  const xTicks = candles
    .filter((_, i) => i % xTickEvery === 0)
    .map((c, i) => ({
      x: toX(i * xTickEvery),
      label: new Date(Number(c.timestamp) / 1_000_000).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        },
      ),
      ts: Number(c.timestamp),
    }));

  const formatPrice = (p: number) => {
    if (p >= 1000) return `${(p / 1000).toFixed(1)}K`;
    return p.toFixed(1);
  };

  // Build EMA points strings
  const ema10Points = ema10
    .map((v, i) => (v !== null ? `${toX(i)},${toY(v)}` : null))
    .filter((v): v is string => v !== null)
    .join(" ");

  const ema20Points = ema20
    .map((v, i) => (v !== null ? `${toX(i)},${toY(v)}` : null))
    .filter((v): v is string => v !== null)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      style={{ fontFamily: "JetBrains Mono, monospace" }}
    >
      <title>Candlestick price chart</title>
      {/* Background grid lines - use price as key */}
      {yTicks.map((tick) => (
        <line
          key={`grid-${tick.price.toFixed(4)}`}
          x1={PADDING_LEFT}
          x2={width - PADDING_RIGHT}
          y1={tick.y}
          y2={tick.y}
          stroke="oklch(0.28 0.03 250 / 0.4)"
          strokeWidth={0.5}
        />
      ))}

      {/* S/R Levels */}
      {srLevels.map((level, i) => (
        <g key={`sr-${level.toFixed(2)}`}>
          <line
            x1={PADDING_LEFT}
            x2={width - PADDING_RIGHT}
            y1={toY(level)}
            y2={toY(level)}
            stroke={
              i % 2 === 0
                ? "oklch(0.60 0.22 25 / 0.6)"
                : "oklch(0.65 0.20 145 / 0.6)"
            }
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={PADDING_LEFT + 2}
            y={toY(level) - 3}
            fill={
              i % 2 === 0
                ? "oklch(0.60 0.22 25 / 0.8)"
                : "oklch(0.65 0.20 145 / 0.8)"
            }
            fontSize={8}
          >
            {i % 2 === 0 ? "R" : "S"} {formatPrice(level)}
          </text>
        </g>
      ))}

      {/* Candlesticks - use timestamp as stable key */}
      {candles.map((c, i) => {
        const x = toX(i);
        const isBull = c.close >= c.open;
        const color = isBull ? "oklch(0.65 0.20 145)" : "oklch(0.60 0.22 25)";
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBottom = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBottom - bodyTop);

        return (
          <g key={`candle-${Number(c.timestamp)}`}>
            <line
              x1={x}
              x2={x}
              y1={toY(c.high)}
              y2={toY(c.low)}
              stroke={color}
              strokeWidth={1}
            />
            <rect
              x={x - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyH}
              fill={color}
              opacity={isBull ? 1 : 0.85}
              rx={0.5}
            />
          </g>
        );
      })}

      {/* EMA 10 line */}
      {ema10Points && (
        <polyline
          points={ema10Points}
          fill="none"
          stroke="oklch(0.70 0.18 220)"
          strokeWidth={1.5}
          opacity={0.9}
        />
      )}

      {/* EMA 20 line */}
      {ema20Points && (
        <polyline
          points={ema20Points}
          fill="none"
          stroke="oklch(0.75 0.18 80)"
          strokeWidth={1.5}
          opacity={0.9}
        />
      )}

      {/* Y Axis Labels - use price as key */}
      {yTicks.map((tick) => (
        <text
          key={`ylabel-${tick.price.toFixed(4)}`}
          x={PADDING_LEFT - 5}
          y={tick.y + 4}
          textAnchor="end"
          fill="oklch(0.55 0.02 250)"
          fontSize={9}
        >
          {formatPrice(tick.price)}
        </text>
      ))}

      {/* X Axis Labels - use timestamp as key */}
      {xTicks.map((tick) => (
        <text
          key={`xlabel-${tick.ts}`}
          x={tick.x}
          y={height - 6}
          textAnchor="middle"
          fill="oklch(0.55 0.02 250)"
          fontSize={9}
        >
          {tick.label}
        </text>
      ))}
    </svg>
  );
}

function VolumeChart({ candles }: { candles: Candle[] }) {
  const data = candles.map((c) => ({
    volume: c.volume,
    isBull: c.close >= c.open,
    ts: Number(c.timestamp),
    time: new Date(Number(c.timestamp) / 1_000_000).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      },
    ),
  }));

  const formatVol = (v: number) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  };

  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
        <CartesianGrid
          stroke="oklch(0.28 0.03 250 / 0.3)"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tick={{ fill: "oklch(0.55 0.02 250)", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "oklch(0.55 0.02 250)", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatVol}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.16 0.025 250)",
            border: "1px solid oklch(0.28 0.03 250)",
            borderRadius: "6px",
            fontSize: "11px",
          }}
          formatter={(v: number) => [formatVol(v), "Volume"]}
          labelStyle={{ color: "oklch(0.92 0.01 250)" }}
        />
        <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={`vol-${entry.ts}`}
              fill={
                entry.isBull
                  ? "oklch(0.65 0.20 145 / 0.7)"
                  : "oklch(0.60 0.22 25 / 0.7)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Charts() {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");

  const { data: candles, isLoading } = useCandlestickData(
    selectedAsset,
    selectedTimeframe,
  );

  const chartDimensions = { width: 800, height: 320 };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Asset + Timeframe Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Asset Tabs */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {ASSETS.map((asset) => (
            <button
              key={asset}
              type="button"
              data-ocid={`charts.${asset.toLowerCase()}.tab`}
              onClick={() => setSelectedAsset(asset)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all duration-200 ${
                selectedAsset === asset
                  ? "bg-primary text-primary-foreground glow-cyan"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {asset}
            </button>
          ))}
        </div>

        {/* Timeframe Tabs */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              data-ocid={`charts.${tf.toLowerCase()}.tab`}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all duration-200 ${
                selectedTimeframe === tf
                  ? "bg-primary text-primary-foreground glow-cyan"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-bull rounded" />
          <span className="text-muted-foreground">Bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-bear rounded" />
          <span className="text-muted-foreground">Bearish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-primary rounded" />
          <span className="text-muted-foreground">EMA 10</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-hold rounded" />
          <span className="text-muted-foreground">EMA 20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t border-dashed border-bear/60" />
          <span className="text-muted-foreground">Resistance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t border-dashed border-bull/60" />
          <span className="text-muted-foreground">Support</span>
        </div>
      </div>

      {/* Main Candlestick Chart */}
      <div className="trading-card p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2 font-mono">
          {selectedAsset}/USD · {selectedTimeframe}
        </div>
        {isLoading ? (
          <Skeleton className="w-full h-80 bg-secondary" />
        ) : candles && candles.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="relative w-full" style={{ paddingBottom: "40%" }}>
                <div className="absolute inset-0">
                  <svg
                    viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="none"
                  >
                    <title>{selectedAsset} price chart</title>
                    <CandlestickChart
                      candles={candles}
                      width={chartDimensions.width}
                      height={chartDimensions.height}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="h-80 flex items-center justify-center text-muted-foreground text-sm"
            data-ocid="charts.empty_state"
          >
            No chart data available
          </div>
        )}
      </div>

      {/* Volume Chart */}
      <div className="trading-card p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2 font-mono">
          Volume
        </div>
        {isLoading ? (
          <Skeleton className="w-full h-20 bg-secondary" />
        ) : candles && candles.length > 0 ? (
          <VolumeChart candles={candles} />
        ) : null}
      </div>
    </div>
  );
}
