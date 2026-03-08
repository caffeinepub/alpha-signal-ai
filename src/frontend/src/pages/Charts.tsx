import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Brain,
  ChevronDown,
  ChevronUp,
  Clock,
  MinusCircle,
  Shield,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { EngineSignal } from "../hooks/useSignalEngine";
import { useSignalEngine } from "../hooks/useSignalEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Assets & Timeframes
// ─────────────────────────────────────────────────────────────────────────────

const ASSETS = ["BTC", "XAU"] as const;
type Asset = (typeof ASSETS)[number];

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const SYMBOL_MAP: Record<Asset, string> = {
  BTC: "BINANCE:BTCUSDT",
  XAU: "OANDA:XAUUSD",
};

const INTERVAL_MAP: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1H": "60",
  "4H": "240",
  "1D": "D",
};

const OCID_ASSET: Record<Asset, string> = {
  BTC: "charts.btc.tab",
  XAU: "charts.xau.tab",
};

const OCID_TF: Record<Timeframe, string> = {
  "1m": "charts.1m.tab",
  "5m": "charts.5m.tab",
  "15m": "charts.15m.tab",
  "1H": "charts.1h.tab",
  "4H": "charts.4h.tab",
  "1D": "charts.1d.tab",
};

// ─────────────────────────────────────────────────────────────────────────────
// TradingView widget component
// ─────────────────────────────────────────────────────────────────────────────

interface TradingViewWidgetProps {
  symbol: string;
  interval: string;
}

function TradingViewWidget({ symbol, interval }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);

  useEffect(() => {
    // Destroy previous widget if it exists
    if (widgetRef.current && typeof widgetRef.current.remove === "function") {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    // Clear container contents
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const containerId = "tradingview_chart_container";

    function initWidget() {
      if (!containerRef.current) return;
      // biome-ignore lint/suspicious/noExplicitAny: TradingView is a 3rd-party global
      const TV = (window as any).TradingView;
      if (!TV) return;

      try {
        widgetRef.current = new TV.widget({
          autosize: true,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0d1117",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          allow_symbol_change: false,
          container_id: containerId,
        });
      } catch (_e) {
        // Widget init failure is non-critical; chart container remains empty
      }
    }

    // Check if tv.js is already loaded
    // biome-ignore lint/suspicious/noExplicitAny: TradingView is a 3rd-party global
    if ((window as any).TradingView) {
      initWidget();
    } else {
      // Inject script only once
      const existingScript = document.querySelector(
        'script[src="https://s3.tradingview.com/tv.js"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", initWidget);
      } else {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = initWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [symbol, interval]);

  return (
    <div
      id="tradingview_chart_container"
      ref={containerRef}
      data-ocid="charts.tradingview.canvas_target"
      className="w-full"
      style={{ height: "clamp(380px, 55vh, 600px)" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal panel helpers
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

function timeSince(date: Date | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

const DIRECTION_CONFIG = {
  "STRONG BUY": {
    icon: ArrowUpCircle,
    label: "STRONG BUY",
    badgeCls: "signal-buy",
    barCls: "bg-bull",
    borderCls: "border-bull/30",
    textCls: "text-bull",
  },
  "STRONG SELL": {
    icon: ArrowDownCircle,
    label: "STRONG SELL",
    badgeCls: "signal-sell",
    barCls: "bg-bear",
    borderCls: "border-bear/30",
    textCls: "text-bear",
  },
  WAIT: {
    icon: MinusCircle,
    label: "WAIT",
    badgeCls: "signal-hold",
    barCls: "bg-hold",
    borderCls: "border-hold/30",
    textCls: "text-hold",
  },
} as const;

const RISK_CONFIG = {
  LOW: { cls: "signal-buy", label: "LOW RISK", icon: Shield },
  MEDIUM: { cls: "signal-hold", label: "MED RISK", icon: AlertTriangle },
  HIGH: { cls: "signal-sell", label: "HIGH RISK", icon: AlertTriangle },
} as const;

const SMC_TAG_CONFIG: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  BOS: { bg: "bg-bull/15", text: "text-bull", border: "border-bull/30" },
  CHoCH: { bg: "bg-bear/15", text: "text-bear", border: "border-bear/30" },
  "LIQ SWEEP": {
    bg: "bg-chart-5/15",
    text: "text-chart-5",
    border: "border-chart-5/30",
  },
  "ORDER BLOCK": {
    bg: "bg-primary/15",
    text: "text-primary",
    border: "border-primary/30",
  },
  "FAKE BREAKOUT": {
    bg: "bg-hold/15",
    text: "text-hold",
    border: "border-hold/30",
  },
};

function ScoreRow({
  label,
  score,
  max,
  delay,
}: {
  label: string;
  score: number;
  max: number;
  delay: number;
}) {
  const pct = (score / max) * 100;
  const barColor =
    pct >= 75
      ? "bg-bull"
      : pct >= 50
        ? "bg-primary"
        : pct >= 25
          ? "bg-hold"
          : "bg-bear";

  return (
    <motion.div
      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1, ease: "easeOut" }}
        />
      </div>
      <div className="text-[11px] font-mono font-bold text-foreground w-10 text-right">
        {score}/{max}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Panel
// ─────────────────────────────────────────────────────────────────────────────

function SignalPanel({ signal }: { signal: EngineSignal }) {
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const dir = DIRECTION_CONFIG[signal.direction];
  const DirIcon = dir.icon;
  const risk = RISK_CONFIG[signal.riskLevel];
  const RiskIcon = risk.icon;

  const rsiColor =
    signal.rsi > 55
      ? "text-bull"
      : signal.rsi < 45
        ? "text-bear"
        : "text-muted-foreground";

  const ts = signal.timeframeScores;

  return (
    <motion.div
      data-ocid="charts.signal.card"
      className="trading-card flex flex-col gap-0 overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Direction accent bar */}
      <div className={`h-0.5 w-full ${dir.barCls}`} style={{ opacity: 0.7 }} />

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xl font-bold font-mono text-foreground tracking-tight">
                {signal.symbol}
              </span>
              <span className="text-xs text-muted-foreground">
                {signal.name}
              </span>
              {/* Live indicator */}
              <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-bull/15 border border-bull/30 text-bull font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
                LIVE
              </span>
            </div>
            <div className={`text-2xl font-bold font-mono ${dir.textCls}`}>
              {formatPrice(signal.price)}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${dir.badgeCls}`}
            >
              <DirIcon className="w-3.5 h-3.5" />
              {dir.label}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {timeSince(signal.lastUpdated)}
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Brain className="w-3 h-3" />
              AI Confidence
            </span>
            <span className={`text-sm font-mono font-bold ${dir.textCls}`}>
              {signal.confidence}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${dir.barCls}`}
              initial={{ width: 0 }}
              animate={{ width: `${signal.confidence}%` }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-secondary/50 rounded-md p-2.5 text-center">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Entry
            </div>
            <div className="text-xs font-mono font-bold text-foreground">
              {formatPrice(signal.entryPrice)}
            </div>
          </div>
          <div className="bg-bear/10 rounded-md p-2.5 text-center border border-bear/20">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Stop Loss
            </div>
            <div className="text-xs font-mono font-bold text-bear">
              {formatPrice(signal.stopLoss)}
            </div>
          </div>
          <div className="bg-bull/8 rounded-md p-2.5 text-center border border-bull/15">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              TP 1
            </div>
            <div className="text-xs font-mono font-bold text-bull">
              {formatPrice(signal.tp1)}
            </div>
          </div>
          <div className="bg-bull/12 rounded-md p-2.5 text-center border border-bull/25">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              TP 2
            </div>
            <div className="text-xs font-mono font-bold text-bull">
              {formatPrice(signal.tp2)}
            </div>
          </div>
        </div>

        {/* SMC Tags */}
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            Active SMC Patterns
          </div>
          {signal.smcTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {signal.smcTags.map((tag) => {
                const cfg = SMC_TAG_CONFIG[tag] ?? {
                  bg: "bg-secondary",
                  text: "text-foreground",
                  border: "border-border",
                };
                return (
                  <span
                    key={tag}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/60 italic">
              No active SMC patterns
            </span>
          )}
        </div>

        {/* Score breakdown */}
        <div className="border border-border/60 rounded-md overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 bg-secondary/40 hover:bg-secondary/70 transition-colors"
            onClick={() => setBreakdownOpen((v) => !v)}
          >
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Score Breakdown
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-foreground">
                {signal.confidence}/100
              </span>
              {breakdownOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {breakdownOpen && (
              <motion.div
                key="breakdown"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-2 divide-y divide-border/40">
                  <ScoreRow
                    label="5m Trend (EMA50/200)"
                    score={ts.trend5m}
                    max={15}
                    delay={0.04}
                  />
                  <ScoreRow
                    label="1m Momentum (EMA9/20 + Vol)"
                    score={ts.momentum1m}
                    max={15}
                    delay={0.08}
                  />
                  <ScoreRow
                    label="3m Candle Confirmation"
                    score={ts.confirmation3m}
                    max={15}
                    delay={0.12}
                  />
                  <ScoreRow
                    label="Order Block Proximity"
                    score={ts.orderBlock}
                    max={15}
                    delay={0.16}
                  />
                  <ScoreRow
                    label="Liquidity Sweep"
                    score={ts.liqSweep}
                    max={15}
                    delay={0.2}
                  />
                  <ScoreRow
                    label="Fake Breakout"
                    score={ts.fakeBreakout}
                    max={10}
                    delay={0.24}
                  />
                  <ScoreRow
                    label="Volume Spike"
                    score={ts.volumeSpike}
                    max={10}
                    delay={0.28}
                  />
                  <ScoreRow
                    label="Liq Heatmap Pressure"
                    score={ts.liqHeatmap}
                    max={5}
                    delay={0.32}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Indicator snapshot */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 border-t border-border/40">
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">RSI</span>
            <span className={`font-mono font-bold ${rsiColor}`}>
              {signal.rsi.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">EMA9/20</span>
            <span
              className={`font-mono font-bold ${signal.ema9 > signal.ema20 ? "text-bull" : "text-bear"}`}
            >
              {signal.ema9 > signal.ema20 ? "▲" : "▼"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">EMA50/200</span>
            <span
              className={`font-mono font-bold ${signal.ema50 > signal.ema200 ? "text-bull" : "text-bear"}`}
            >
              {signal.ema50 > signal.ema200 ? "▲" : "▼"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">MACD</span>
            <span
              className={`font-mono font-bold ${signal.macdHistogram > 0 ? "text-bull" : "text-bear"}`}
            >
              {signal.macdHistogram > 0 ? "+" : ""}
              {signal.macdHistogram.toFixed(signal.price > 1000 ? 0 : 4)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">ATR</span>
            <span className="font-mono font-bold text-foreground">
              {formatPrice(signal.atr)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">BB</span>
            <span className="font-mono font-bold text-foreground">
              {signal.price >= signal.bbUpper
                ? "⬆ OB"
                : signal.price <= signal.bbLower
                  ? "⬇ OS"
                  : "MID"}
            </span>
          </div>
        </div>

        {/* Risk badge + explanation */}
        <div className="flex items-start gap-3">
          <span
            className={`text-[9px] px-2 py-1 rounded-full border font-bold flex items-center gap-0.5 shrink-0 ${risk.cls}`}
          >
            <RiskIcon className="w-2.5 h-2.5" />
            {risk.label}
          </span>
          <div
            className={`border-l-2 ${dir.textCls.replace("text-", "border-")} pl-3 flex-1`}
          >
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {signal.explanation}
            </p>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-[10px] text-muted-foreground/50 italic border-t border-border/30 pt-2">
          Signals update with live market data. Not financial advice.
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Charts page
// ─────────────────────────────────────────────────────────────────────────────

export default function Charts() {
  const [selectedAsset, setSelectedAsset] = useState<Asset>("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1H");

  const { signals } = useSignalEngine();

  // Find signal for selected asset (XAU may appear as "XAU" or "GOLD")
  const activeSignal: EngineSignal | undefined = signals.find(
    (s) =>
      s.symbol === selectedAsset ||
      (selectedAsset === "XAU" && (s.symbol === "XAU" || s.symbol === "GOLD")),
  );

  const tvSymbol = SYMBOL_MAP[selectedAsset];
  const tvInterval = INTERVAL_MAP[selectedTimeframe];

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* ── Selectors Row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Asset Tabs */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {ASSETS.map((asset) => (
            <button
              key={asset}
              type="button"
              data-ocid={OCID_ASSET[asset]}
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
        <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-1 flex-wrap">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              data-ocid={OCID_TF[tf]}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold font-mono transition-all duration-200 ${
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

      {/* ── Chart Legend ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground font-mono font-semibold">
            {selectedAsset === "BTC" ? "BINANCE:BTCUSDT" : "OANDA:XAUUSD"}
          </span>
          <span className="text-muted-foreground/50">
            Powered by TradingView
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-bull" />
            <span className="text-muted-foreground">BUY signal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-bear" />
            <span className="text-muted-foreground">SELL signal</span>
          </div>
        </div>
      </div>

      {/* ── TradingView Chart ─────────────────────────────────────────────── */}
      <div className="trading-card overflow-hidden p-0">
        <TradingViewWidget symbol={tvSymbol} interval={tvInterval} />
      </div>

      {/* ── AI Signal Panel ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeSignal ? (
          <SignalPanel key={`${selectedAsset}-signal`} signal={activeSignal} />
        ) : (
          <motion.div
            key="empty"
            data-ocid="charts.empty_state"
            className="trading-card p-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-muted-foreground text-sm">
              Waiting for live signal data…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
