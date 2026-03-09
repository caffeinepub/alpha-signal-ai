import { useEffect, useRef } from "react";
import {
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BacktestTrade } from "../hooks/useBacktestTracker";
import { useBacktestTracker } from "../hooks/useBacktestTracker";
import { useMarketWebSocket } from "../hooks/useMarketWebSocket";
import { useSignalEngine } from "../hooks/useSignalEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PriceTick {
  index: number;
  price: number;
}

interface SignalMarker {
  tickIndex: number;
  type: "BUY" | "SELL";
  trade: BacktestTrade;
}

interface ChartPoint {
  index: number;
  price: number;
  buyMarker?: number; // price value at this index if BUY marker
  sellMarker?: number; // price value at this index if SELL marker
  markerTrade?: BacktestTrade; // associated trade for tooltip
}

const TICK_BUFFER_SIZE = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Price formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(p: number): string {
  if (p >= 1000)
    return `$${p.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  if (p > 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom BUY triangle shape (green ▲ below candle)
// ─────────────────────────────────────────────────────────────────────────────

interface TriangleShapeProps {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}

function BuyTriangle({ cx = 0, cy = 0 }: TriangleShapeProps) {
  const size = 7;
  const tipY = cy + 14;
  const baseY = tipY + size * 1.5;
  const halfBase = size;
  return (
    <polygon
      points={`${cx},${tipY} ${cx - halfBase},${baseY} ${cx + halfBase},${baseY}`}
      fill="oklch(0.65 0.20 145)"
      stroke="oklch(0.65 0.20 145 / 0.3)"
      strokeWidth={1}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom SELL triangle shape (red ▼ above candle)
// ─────────────────────────────────────────────────────────────────────────────

function SellTriangle({ cx = 0, cy = 0 }: TriangleShapeProps) {
  const size = 7;
  const tipY = cy - 14;
  const baseY = tipY - size * 1.5;
  const halfBase = size;
  return (
    <polygon
      points={`${cx},${tipY} ${cx - halfBase},${baseY} ${cx + halfBase},${baseY}`}
      fill="oklch(0.60 0.22 25)"
      stroke="oklch(0.60 0.22 25 / 0.3)"
      strokeWidth={1}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: ChartPoint;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const trade = point.markerTrade;

  // If there's a trade marker on this point, show full signal info
  if (trade) {
    const isBuy = trade.direction === "STRONG BUY";
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs font-mono max-w-[180px]">
        <div className={`font-bold mb-1 ${isBuy ? "text-bull" : "text-bear"}`}>
          {trade.symbol} {isBuy ? "▲ BUY" : "▼ SELL"}
        </div>
        <div className="text-muted-foreground space-y-0.5">
          <div>
            Entry:{" "}
            <span className="text-foreground">
              {formatPrice(trade.entryPrice)}
            </span>
          </div>
          <div>
            SL: <span className="text-bear">{formatPrice(trade.stopLoss)}</span>
          </div>
          <div>
            TP:{" "}
            <span className="text-bull">{formatPrice(trade.takeProfit)}</span>
          </div>
          <div>
            Confidence:{" "}
            <span className="text-primary">{trade.confidence}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Default: show current price
  return (
    <div className="bg-card border border-border rounded-md px-2 py-1 shadow-lg text-xs font-mono">
      <span className="text-muted-foreground">Price: </span>
      <span className="text-foreground font-bold">
        {formatPrice(point.price)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SignalChartOverlayProps {
  asset: "BTC" | "XAU";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SignalChartOverlay({ asset }: SignalChartOverlayProps) {
  const { marketData, lastUpdate } = useMarketWebSocket();
  const { signals } = useSignalEngine();
  const { trades } = useBacktestTracker();

  // Rolling price buffer — max TICK_BUFFER_SIZE entries
  const priceBufferRef = useRef<PriceTick[]>([]);
  const tickIndexRef = useRef(0);

  // Signal markers pinned to tick indices
  const signalMarkersRef = useRef<SignalMarker[]>([]);

  // Track which trade IDs have been marked to avoid duplicate markers
  const markedTradeIdsRef = useRef<Set<string>>(new Set());

  // ── Push new price tick into buffer ──────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastUpdate is the tick trigger
  useEffect(() => {
    const assetSymbol = asset === "XAU" ? ["XAU", "GOLD"] : [asset];
    const assetData = marketData.find((a) => assetSymbol.includes(a.symbol));
    if (!assetData || assetData.price <= 0) return;

    const idx = tickIndexRef.current++;
    priceBufferRef.current.push({ index: idx, price: assetData.price });

    // Trim buffer and shift marker indices when over limit
    if (priceBufferRef.current.length > TICK_BUFFER_SIZE) {
      const dropped = priceBufferRef.current.splice(
        0,
        priceBufferRef.current.length - TICK_BUFFER_SIZE,
      );
      const shiftBy = dropped.length;
      signalMarkersRef.current = signalMarkersRef.current
        .map((m) => ({ ...m, tickIndex: m.tickIndex - shiftBy }))
        .filter((m) => m.tickIndex >= 0);
    }
  }, [asset, marketData, lastUpdate]);

  // ── Record new signal markers from trades ─────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: trades is the dep
  useEffect(() => {
    const assetSymbol = asset === "XAU" ? ["XAU", "GOLD"] : [asset];

    for (const trade of trades) {
      if (!assetSymbol.includes(trade.symbol)) continue;
      if (markedTradeIdsRef.current.has(trade.id)) continue;

      // Pin to the most recent tick index
      const lastTick =
        priceBufferRef.current[priceBufferRef.current.length - 1];
      if (!lastTick) continue;

      signalMarkersRef.current.push({
        tickIndex: lastTick.index,
        type: trade.direction === "STRONG BUY" ? "BUY" : "SELL",
        trade,
      });
      markedTradeIdsRef.current.add(trade.id);
    }
  }, [asset, trades]);

  // ── Build chart dataset ───────────────────────────────────────────────────
  const buffer = priceBufferRef.current;

  // Find active signal for this asset
  const assetSymbols = asset === "XAU" ? ["XAU", "GOLD"] : [asset];
  const activeSignal = signals.find((s) => assetSymbols.includes(s.symbol));

  // Build chart data: map tick indices to 0..N positions for display
  const chartData: ChartPoint[] = buffer.map((tick, displayIdx) => {
    const relativeIdx = tick.index;

    // Check if any signal marker is at this tick index
    const marker = signalMarkersRef.current.find(
      (m) => m.tickIndex === relativeIdx,
    );

    const point: ChartPoint = {
      index: displayIdx,
      price: tick.price,
    };

    if (marker) {
      if (marker.type === "BUY") {
        point.buyMarker = tick.price;
        point.markerTrade = marker.trade;
      } else {
        point.sellMarker = tick.price;
        point.markerTrade = marker.trade;
      }
    }

    return point;
  });

  // Separate BUY and SELL scatter datasets
  const buyPoints = chartData.filter((p) => p.buyMarker !== undefined);
  const sellPoints = chartData.filter((p) => p.sellMarker !== undefined);

  // Y-axis domain with 0.3% padding
  const prices = buffer.map((t) => t.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;
  const paddingFactor = 0.003;
  const domainMin = minPrice * (1 - paddingFactor);
  const domainMax = maxPrice * (1 + paddingFactor);

  const hasData = buffer.length > 0;
  const currentPrice = buffer[buffer.length - 1]?.price ?? 0;

  // Color tokens
  const primaryStroke = "oklch(0.72 0.18 220)"; // cyan
  const gridStroke = "oklch(0.28 0.03 250 / 0.3)";
  const entryColor = "oklch(0.85 0.02 250)"; // near-white
  const slColor = "oklch(0.60 0.22 25)"; // red
  const tpColor = "oklch(0.65 0.20 145)"; // green

  return (
    <div
      data-ocid="charts.signal_overlay.panel"
      className="trading-card p-0 overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            AI Signal Overlay
          </span>
          <span className="text-xs font-mono font-bold text-primary">
            {asset}
          </span>
          {/* Pulsing LIVE dot */}
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-bull/10 border border-bull/30 text-bull font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
            LIVE
          </span>
        </div>
        {currentPrice > 0 && (
          <span className="text-sm font-bold font-mono text-foreground">
            {formatPrice(currentPrice)}
          </span>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border/20 flex-wrap">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span
            style={{ color: "oklch(0.65 0.20 145)" }}
            className="font-bold text-xs"
          >
            ▲
          </span>
          BUY signal
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span
            style={{ color: "oklch(0.60 0.22 25)" }}
            className="font-bold text-xs"
          >
            ▼
          </span>
          SELL signal
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block w-5 border-t border-dashed border-white/60" />
          Entry
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block w-5 border-t border-dashed border-red-400/70" />
          SL
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block w-5 border-t border-dashed border-green-400/70" />
          TP
        </div>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      {!hasData ? (
        <div
          className="flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: 180 }}
        >
          Waiting for live data…
        </div>
      ) : (
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
            >
              {/* Grid */}
              <defs>
                <pattern
                  id="grid-pattern"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke={gridStroke}
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>

              {/* Axes */}
              <XAxis
                dataKey="index"
                hide
                type="number"
                domain={[0, TICK_BUFFER_SIZE - 1]}
              />
              <YAxis
                dataKey="price"
                domain={[domainMin, domainMax]}
                hide={false}
                width={65}
                tickFormatter={(v: number) => formatPrice(v)}
                tick={{
                  fontSize: 9,
                  fill: "oklch(0.60 0.04 250)",
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickLine={false}
                axisLine={false}
                tickCount={4}
              />

              {/* Tooltip */}
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: gridStroke, strokeDasharray: "3 3" }}
              />

              {/* Reference lines for active signal */}
              {activeSignal && activeSignal.direction !== "WAIT" && (
                <>
                  <ReferenceLine
                    y={activeSignal.entryPrice}
                    stroke={entryColor}
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{
                      value: "ENTRY",
                      position: "insideTopRight",
                      fontSize: 8,
                      fill: entryColor,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  />
                  <ReferenceLine
                    y={activeSignal.stopLoss}
                    stroke={slColor}
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{
                      value: "SL",
                      position: "insideTopRight",
                      fontSize: 8,
                      fill: slColor,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  />
                  <ReferenceLine
                    y={activeSignal.tp1}
                    stroke={tpColor}
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{
                      value: "TP",
                      position: "insideTopRight",
                      fontSize: 8,
                      fill: tpColor,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  />
                </>
              )}

              {/* Main price line */}
              <Line
                type="monotone"
                dataKey="price"
                stroke={primaryStroke}
                strokeWidth={1.5}
                dot={false}
                animationDuration={0}
                isAnimationActive={false}
              />

              {/* BUY signal markers */}
              <Scatter
                data={buyPoints}
                dataKey="buyMarker"
                fill="oklch(0.65 0.20 145)"
                shape={(props: TriangleShapeProps) => (
                  <BuyTriangle
                    cx={props.cx}
                    cy={props.cy}
                    payload={props.payload}
                  />
                )}
                isAnimationActive={false}
              />

              {/* SELL signal markers */}
              <Scatter
                data={sellPoints}
                dataKey="sellMarker"
                fill="oklch(0.60 0.22 25)"
                shape={(props: TriangleShapeProps) => (
                  <SellTriangle
                    cx={props.cx}
                    cy={props.cy}
                    payload={props.payload}
                  />
                )}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
