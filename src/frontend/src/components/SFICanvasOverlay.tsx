import { useEffect, useRef } from "react";
import type { Candle } from "../hooks/useBinanceKlines";
import type { SFISignal } from "../hooks/useSFIEngine";

interface SFICanvasOverlayProps {
  candles: Candle[];
  signals: SFISignal[];
  asset: string;
  timeframe: "3m" | "15m";
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = data[0];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      out.push(Number.NaN);
      prev = data[i];
    } else if (i === period - 1) {
      const slice = data.slice(0, period);
      prev = slice.reduce((s, v) => s + v, 0) / period;
      out.push(prev);
    } else {
      prev = data[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

// ── VERSION 102: Darker cloud, thicker borders for instant SFI state ID ────
function computeSFIBands(candles: Candle[]): {
  upper: number[];
  lower: number[];
  basis: number[];
  ema200: number[];
} {
  const closes = candles.map((c) => c.close);
  const ema10 = calcEMA(closes, 10);
  const ema20 = calcEMA(closes, 20);
  const basis = ema10.map((v, i) => (v + ema20[i]) / 2);

  const stdev: number[] = closes.map((_, i) => {
    if (i < 9) return Number.NaN;
    const slice = closes.slice(i - 9, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / 10;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / 10;
    return Math.sqrt(variance);
  });

  const upper = basis.map((b, i) =>
    Number.isNaN(stdev[i]) ? Number.NaN : b + 2.0 * stdev[i],
  );
  const lower = basis.map((b, i) =>
    Number.isNaN(stdev[i]) ? Number.NaN : b - 2.0 * stdev[i],
  );
  const ema200 = calcEMA(closes, 200);

  return { upper, lower, basis, ema200 };
}

export function SFICanvasOverlay({
  candles,
  signals,
  asset,
  timeframe,
}: SFICanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const _signal = signals.find(
    (s) => s.asset === asset && s.timeframe === timeframe,
  );
  const hasData = candles.length > 5;

  // biome-ignore lint/correctness/useExhaustiveDependencies: canvas redraw depends on all props
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const W = wrapper.clientWidth;
    const H = 300;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // ── Layout constants ────────────────────────────────────────────────────
    const PAD_LEFT = 8;
    const PAD_RIGHT = 60;
    const PAD_TOP = 20;
    const PAD_BOTTOM = 24;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_TOP - PAD_BOTTOM;

    // ── Take last 80 candles ────────────────────────────────────────────────
    const display = candles.slice(-80);
    const n = display.length;
    if (n < 2) {
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#4b5563";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Loading candle data...", W / 2, H / 2);
      return;
    }

    const candleW = Math.max(1, (chartW / n) * 0.8);
    const gap = chartW / n;

    // Compute SFI bands for displayed candles
    const { upper, lower, basis, ema200 } = computeSFIBands(display);

    // Price range
    let minP = Number.POSITIVE_INFINITY;
    let maxP = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      const c = display[i];
      minP = Math.min(minP, c.low);
      maxP = Math.max(maxP, c.high);
      if (!Number.isNaN(upper[i])) maxP = Math.max(maxP, upper[i]);
      if (!Number.isNaN(lower[i])) minP = Math.min(minP, lower[i]);
    }
    const priceRange = maxP - minP || 1;
    const pad = priceRange * 0.05;
    const lo = minP - pad;
    const hi = maxP + pad;
    const range = hi - lo;

    const yScale = (price: number) =>
      PAD_TOP + chartH - ((price - lo) / range) * chartH;
    const xPos = (i: number) => PAD_LEFT + i * gap + gap / 2;

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    // ── Grid lines ──────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = PAD_TOP + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(PAD_LEFT + chartW, y);
      ctx.stroke();
    }
    for (let i = 0; i < n; i += 10) {
      const x = xPos(i);
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP);
      ctx.lineTo(x, PAD_TOP + chartH);
      ctx.stroke();
    }

    // ── VERSION 102: Dark Emerald Green (bullish) / Dark Blood Red (bearish)
    // ── 40-50% opacity fill for strong visual impact ─────────────────────────
    for (let i = 0; i < n; i++) {
      if (
        Number.isNaN(upper[i]) ||
        Number.isNaN(lower[i]) ||
        Number.isNaN(basis[i])
      )
        continue;
      const c = display[i];
      const isAbove = c.close >= basis[i];
      const x = xPos(i) - gap / 2;
      const yTop = yScale(upper[i]);
      const yBot = yScale(lower[i]);
      // Dark Emerald Green: #065f46 / Dark Blood Red: #7f1d1d — at 45% opacity
      ctx.fillStyle = isAbove
        ? "rgba(6,95,70,0.45)" // Dark Emerald Green ~45% opacity
        : "rgba(127,29,29,0.45)"; // Dark Blood Red ~45% opacity
      ctx.fillRect(x, yTop, gap, yBot - yTop);
    }

    // ── VERSION 102: Upper band — thicker border (linewidth=2) ───────────────
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(upper[i])) {
        started = false;
        continue;
      }
      const x = xPos(i);
      const y = yScale(upper[i]);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(16,185,129,0.9)"; // Bright emerald border for upper
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── VERSION 102: Lower band — thicker border (linewidth=2) ───────────────
    ctx.beginPath();
    started = false;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(lower[i])) {
        started = false;
        continue;
      }
      const x = xPos(i);
      const y = yScale(lower[i]);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(220,38,38,0.9)"; // Bright red border for lower
    ctx.lineWidth = 2;
    ctx.stroke();

    // Basis line (dashed, subdued)
    ctx.beginPath();
    started = false;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(basis[i])) {
        started = false;
        continue;
      }
      const x = xPos(i);
      const y = yScale(basis[i]);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(167,139,250,0.6)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── EMA 200 — high contrast gray so it's visible over the dark cloud ─────
    ctx.beginPath();
    let started200 = false;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(ema200[i])) {
        started200 = false;
        continue;
      }
      const x = xPos(i);
      const y = yScale(ema200[i]);
      if (!started200) {
        ctx.moveTo(x, y);
        started200 = true;
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(209,213,219,0.9)"; // High-contrast gray, fully visible
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Supply / Demand Zones ────────────────────────────────────────────────
    const lookback = 5;
    const pivotHighs: number[] = [];
    const pivotLows: number[] = [];
    for (let i = lookback; i < n; i++) {
      const c = display[i];
      let isHigh = true;
      let isLow = true;
      for (let j = i - lookback; j <= i - 1; j++) {
        if (display[j].high >= c.high) isHigh = false;
        if (display[j].low <= c.low) isLow = false;
      }
      if (isHigh) pivotHighs.push(c.high);
      if (isLow) pivotLows.push(c.low);
    }

    // Draw Supply zones (red)
    const supplyZones = pivotHighs.slice(-3);
    for (const ph of supplyZones) {
      const zoneH = ph * 0.001;
      const y1 = yScale(ph + zoneH);
      const y2 = yScale(ph - zoneH);
      ctx.fillStyle = "rgba(239,68,68,0.18)";
      ctx.fillRect(PAD_LEFT, y1, chartW, y2 - y1);
      ctx.strokeStyle = "rgba(239,68,68,0.6)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(PAD_LEFT, y1, chartW, y2 - y1);
      ctx.fillStyle = "rgba(252,165,165,0.9)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("SUPPLY", PAD_LEFT + 4, y1 + 9);
    }

    // Draw Demand zones (green)
    const demandZones = pivotLows.slice(-3);
    for (const pl of demandZones) {
      const zoneH = pl * 0.001;
      const y1 = yScale(pl + zoneH);
      const y2 = yScale(pl - zoneH);
      ctx.fillStyle = "rgba(34,197,94,0.18)";
      ctx.fillRect(PAD_LEFT, y1, chartW, y2 - y1);
      ctx.strokeStyle = "rgba(34,197,94,0.6)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(PAD_LEFT, y1, chartW, y2 - y1);
      ctx.fillStyle = "rgba(134,239,172,0.9)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("DEMAND", PAD_LEFT + 4, y2 - 2);
    }

    // ── Candlestick bars ─────────────────────────────────────────────────────
    const BUY_COLOR = "#22c55e";
    const SELL_COLOR = "#ef4444";

    // Find signal flip candles for BUY/SELL labels
    let prevState: "BUY" | "SELL" | null = null;
    const flipCandles: Array<{ idx: number; type: "BUY" | "SELL" }> = [];

    for (let i = 0; i < n; i++) {
      const c = display[i];
      if (Number.isNaN(upper[i]) || Number.isNaN(lower[i])) continue;
      if (c.close > upper[i] && prevState !== "BUY") {
        flipCandles.push({ idx: i, type: "BUY" });
        prevState = "BUY";
      } else if (c.close < lower[i] && prevState !== "SELL") {
        flipCandles.push({ idx: i, type: "SELL" });
        prevState = "SELL";
      }
    }

    for (let i = 0; i < n; i++) {
      const c = display[i];
      const x = xPos(i);
      const isBull = c.close >= c.open;
      const color = isBull ? BUY_COLOR : SELL_COLOR;

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, yScale(c.high));
      ctx.lineTo(x, yScale(c.low));
      ctx.stroke();

      // Body
      const bodyTop = yScale(Math.max(c.open, c.close));
      const bodyBot = yScale(Math.min(c.open, c.close));
      const bodyH = Math.max(1, bodyBot - bodyTop);
      ctx.fillStyle = isBull ? `${BUY_COLOR}cc` : `${SELL_COLOR}cc`;
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
    }

    // ── BUY / SELL labels — high contrast, visible over dark cloud ───────────
    for (const flip of flipCandles) {
      const c = display[flip.idx];
      const x = xPos(flip.idx);
      if (flip.type === "BUY") {
        const y = yScale(c.low) + 14;
        // Shadow for legibility over dark cloud
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 7, y + 3);
        ctx.lineTo(x + 7, y + 3);
        ctx.closePath();
        ctx.fillStyle = "#4ade80";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BUY", x, y + 16);
        ctx.shadowBlur = 0;
      } else {
        const y = yScale(c.high) - 14;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 7, y - 3);
        ctx.lineTo(x + 7, y - 3);
        ctx.closePath();
        ctx.fillStyle = "#f87171";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("SELL", x, y - 7);
        ctx.shadowBlur = 0;
      }
    }

    // ── Price axis (right) ───────────────────────────────────────────────────
    ctx.fillStyle = "rgba(209,213,219,0.9)";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const price = lo + (range / ticks) * i;
      const y = yScale(price);
      ctx.fillText(
        price.toFixed(asset === "BTC" ? 0 : asset === "XAU/USD" ? 1 : 4),
        PAD_LEFT + chartW + 4,
        y + 3,
      );
    }

    // ── Time axis (bottom) ────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(156,163,175,0.7)";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i += 20) {
      const c = display[i];
      const x = xPos(i);
      const d = new Date(c.time);
      const label = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      ctx.fillText(label, x, PAD_TOP + chartH + 14);
    }

    // ── Border ───────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, chartW, chartH);
  }, [candles, signals, asset, timeframe]);

  // Resize observer
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const obs = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (canvas) canvas.width = 0;
    });
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, []);

  const currentSignal = signals.find(
    (s) => s.asset === asset && s.timeframe === timeframe,
  );
  const signalColor =
    currentSignal?.signal === "BUY"
      ? "#22c55e"
      : currentSignal?.signal === "SELL"
        ? "#ef4444"
        : "#f59e0b";

  return (
    <div className="trading-card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-black/20">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: hasData ? "#22c55e" : "#6b7280" }}
          />
          <span className="text-xs font-mono font-semibold text-foreground/80">
            SFI Cloud v102 — {asset} {timeframe}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span
              className="w-3 h-2 rounded-sm"
              style={{
                background: "rgba(6,95,70,0.7)",
                border: "1.5px solid rgba(16,185,129,0.9)",
              }}
            />
            <span className="text-muted-foreground">Bullish</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span
              className="w-3 h-2 rounded-sm"
              style={{
                background: "rgba(127,29,29,0.7)",
                border: "1.5px solid rgba(220,38,38,0.9)",
              }}
            />
            <span className="text-muted-foreground">Bearish</span>
          </div>
          {currentSignal && (
            <span
              className="text-[10px] font-bold font-mono px-2 py-0.5 rounded"
              style={{
                color: signalColor,
                border: `1px solid ${signalColor}40`,
                backgroundColor: `${signalColor}15`,
              }}
            >
              {currentSignal.signal}
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="w-full" style={{ height: 300 }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: 300 }}
        />
      </div>

      {/* Zone legend */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-border/20 bg-black/10">
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span
            className="w-3 h-2 rounded-sm"
            style={{
              background: "rgba(239,68,68,0.3)",
              border: "1px solid rgba(239,68,68,0.5)",
            }}
          />
          <span className="text-muted-foreground">Supply</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span
            className="w-3 h-2 rounded-sm"
            style={{
              background: "rgba(34,197,94,0.3)",
              border: "1px solid rgba(34,197,94,0.5)",
            }}
          />
          <span className="text-muted-foreground">Demand</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span
            className="w-5 h-0.5"
            style={{
              background: "rgba(209,213,219,0.9)",
              borderTop: "1.5px dashed rgba(209,213,219,0.9)",
            }}
          />
          <span className="text-muted-foreground">EMA 200</span>
        </div>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">
          {candles.length} candles
        </span>
      </div>
    </div>
  );
}
