import { useBinanceKlines } from "../hooks/useBinanceKlines";
import { useEURUSD } from "../hooks/useEURUSD";
import {
  getConfirmationData,
  useSFIEngineLegacy as useSFIEngine,
} from "../hooks/useSFIEngine";
import type { SFISignal } from "../hooks/useSFIEngine";

function fmt(n: number, asset: string): string {
  if (n === 0) return "—";
  if (asset === "EUR/USD") return n.toFixed(5);
  if (asset === "XAU/USD") return n.toFixed(2);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "WAIT" }) {
  if (signal === "BUY")
    return (
      <span className="px-4 py-2 rounded-xl text-base font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
        BUY 🟢
      </span>
    );
  if (signal === "SELL")
    return (
      <span className="px-4 py-2 rounded-xl text-base font-bold bg-red-500/20 text-red-300 border border-red-500/40 tracking-wider flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_2px_rgba(248,113,113,0.7)]" />
        SELL 🔴
      </span>
    );
  return (
    <span className="px-4 py-2 rounded-xl text-base font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wider flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
      WAIT ⚠️
    </span>
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  const isPositive = ["Bullish", "Uptrend", "Above support"].includes(value);
  const isNegative = ["Bearish", "Downtrend", "Below support"].includes(value);
  const colorCls = isPositive
    ? "text-emerald-400"
    : isNegative
      ? "text-red-400"
      : "text-amber-400";
  const dotCls = isPositive
    ? "bg-emerald-400"
    : isNegative
      ? "bg-red-400"
      : "bg-amber-400";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={`flex items-center gap-1.5 font-semibold ${colorCls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
        {value}
      </span>
    </div>
  );
}

function SFICard({ s }: { s: SFISignal }) {
  const conf = getConfirmationData(s);
  const cardBorder =
    s.signal === "BUY"
      ? "border-emerald-500/30"
      : s.signal === "SELL"
        ? "border-red-500/30"
        : "border-amber-500/20";

  return (
    <div
      className={`bg-black/40 backdrop-blur-xl border ${cardBorder} rounded-2xl p-5 flex flex-col gap-4`}
      data-ocid={`signal.${s.asset.toLowerCase().replace("/", "")}.${s.timeframe}.card`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-white text-sm">
            {s.asset}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400 font-mono">
            [{s.timeframe}]
          </span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 tracking-widest uppercase">
          SFI ENGINE
        </span>
      </div>

      {/* ── SIGNAL SECTION ─────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Signal
        </p>
        <SignalBadge signal={s.signal} />

        {/* Sideways warning */}
        {s.isSideways && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 text-xs font-semibold">
            ⚠️ Sideways Market – No Trade Zone
          </div>
        )}

        {/* Entry / SL / Target */}
        {(s.signal === "BUY" || s.signal === "SELL") && (
          <div className="grid grid-cols-3 gap-2 text-xs mt-1">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-gray-500 mb-1">Entry</div>
              <div className="font-mono text-white font-semibold">
                {fmt(s.entry, s.asset)}
              </div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-2 text-center">
              <div className="text-red-400/70 mb-1">Stop Loss</div>
              <div className="font-mono text-red-400 font-semibold">
                {fmt(s.stopLoss, s.asset)}
              </div>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
              <div className="text-emerald-400/70 mb-1">Target</div>
              <div className="font-mono text-emerald-400 font-semibold">
                {fmt(s.target, s.asset)}
              </div>
            </div>
          </div>
        )}
        {(s.signal === "BUY" || s.signal === "SELL") && (
          <div className="text-xs text-center text-gray-500">
            Risk / Reward ·{" "}
            <span className="text-white font-mono font-semibold">1:3</span>
          </div>
        )}
      </div>

      {/* ── CONFIRMATION SECTION (DISPLAY ONLY) ────────────── */}
      <div className="bg-white/5 rounded-xl px-3 py-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-white/10 pb-1.5 mb-2">
          Confirmation{" "}
          <span className="text-zinc-700 font-normal normal-case tracking-normal">
            (Display Only — does not affect signal)
          </span>
        </p>
        <ConfirmationRow
          label="Institutional Bias"
          value={conf.institutionalBias}
        />
        <ConfirmationRow label="EMA Trend" value={conf.emaTrend} />
        <ConfirmationRow label="Liquidity" value={conf.liquidity} />
        <div className="pt-1.5 border-t border-white/5 mt-1 space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-zinc-600">EMA 50</span>
            <span className="text-blue-400/70">{fmt(s.ema50, s.asset)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-zinc-600">EMA 200</span>
            <span className="text-violet-400/70">{fmt(s.ema200, s.asset)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-zinc-600">Support</span>
            <span className="text-emerald-500/70">
              {fmt(s.support, s.asset)}
            </span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-zinc-600">Resistance</span>
            <span className="text-red-500/70">
              {fmt(s.resistance, s.asset)}
            </span>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-[10px] text-gray-600 text-right">
        Updated {new Date(s.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

const ASSETS = ["BTC", "XAU/USD", "EUR/USD"] as const;

export default function Signals() {
  const klines = useBinanceKlines();
  const eurusd = useEURUSD();
  const { signals } = useSFIEngine(
    klines.candles3m_btc,
    klines.candles15m_btc,
    klines.candles3m_xau,
    klines.candles15m_xau,
    eurusd.candles3m,
    eurusd.candles15m,
  );

  return (
    <div className="p-6 space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SFI Signal Engine
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            BTC · XAU/USD · EUR/USD — 3m &amp; 15m timeframes
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold tracking-widest">
            LIVE · NO REPAINT
          </span>
          <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 tracking-widest uppercase">
            SFI LOCKED
          </span>
        </div>
      </div>

      {/* System priority notice */}
      <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-xl px-4 py-3 text-xs text-cyan-300 flex items-start gap-3">
        <span className="text-cyan-400 text-base mt-0.5">🔒</span>
        <div>
          <span className="font-bold">SFI Engine = 100% Signal Control.</span>{" "}
          All other data (EMA, RSI, Volume, Order Flow, Institutional) is
          displayed for confirmation only and has zero impact on signal
          direction.
        </div>
      </div>

      {/* Asset sections */}
      {ASSETS.map((asset) => {
        const sig3m = signals.find(
          (s) => s.asset === asset && s.timeframe === "3m",
        );
        const sig15m = signals.find(
          (s) => s.asset === asset && s.timeframe === "15m",
        );
        return (
          <section key={asset} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-mono font-bold text-lg">
                {asset}
              </h2>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sig3m && <SFICard s={sig3m} />}
              {sig15m && <SFICard s={sig15m} />}
            </div>
          </section>
        );
      })}

      {/* Connection status */}
      <div className="text-xs text-gray-600 flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            klines.isConnected ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        Binance WebSocket: {klines.isConnected ? "Connected" : "Reconnecting…"}
        <span className="mx-2">·</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            eurusd.isConnected ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        EUR/USD Feed: {eurusd.isConnected ? "Connected" : "Polling…"}
      </div>
    </div>
  );
}
