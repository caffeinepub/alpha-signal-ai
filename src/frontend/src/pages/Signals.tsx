import { useBinanceKlines } from "../hooks/useBinanceKlines";
import { useEURUSD } from "../hooks/useEURUSD";
import { useSFIEngine } from "../hooks/useSFIEngine";
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

function calcInstitutionalProb(signal: SFISignal): {
  bull: number;
  bear: number;
} {
  let bullScore = 50;
  if (signal.ema50 > 0 && signal.ema200 > 0) {
    if (signal.entry > signal.ema50) bullScore += 10;
    else bullScore -= 10;
    if (signal.entry > signal.ema200) bullScore += 10;
    else bullScore -= 10;
  }
  if (signal.rsi > 55) bullScore += 10;
  else if (signal.rsi < 45) bullScore -= 10;
  bullScore = Math.max(10, Math.min(90, bullScore));
  return { bull: bullScore, bear: 100 - bullScore };
}

function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "WAIT" }) {
  if (signal === "BUY")
    return (
      <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 tracking-wider">
        BUY
      </span>
    );
  if (signal === "SELL")
    return (
      <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/40 tracking-wider">
        SELL
      </span>
    );
  return (
    <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 tracking-wider">
      WAIT
    </span>
  );
}

function SFIDot({ color }: { color: "GREEN" | "RED" | "NEUTRAL" }) {
  const cls =
    color === "GREEN"
      ? "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]"
      : color === "RED"
        ? "bg-red-400 shadow-[0_0_8px_2px_rgba(248,113,113,0.6)]"
        : "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]";
  return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />;
}

function SFICard({ s }: { s: SFISignal }) {
  const prob = calcInstitutionalProb(s);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SFIDot color={s.sfiColor} />
          <span className="font-mono font-bold text-white text-sm">
            {s.asset}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400 font-mono">
            [{s.timeframe}]
          </span>
        </div>
        <SignalBadge signal={s.signal} />
      </div>

      {/* Sideways warning */}
      {s.isSideways && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 text-xs font-semibold">
          ⚠️ Sideways Market – No Trade Zone
        </div>
      )}

      {/* Entry / SL / Target */}
      {(s.signal === "BUY" || s.signal === "SELL") && (
        <div className="grid grid-cols-3 gap-2 text-xs">
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

      {/* RR */}
      {(s.signal === "BUY" || s.signal === "SELL") && (
        <div className="text-xs text-center text-gray-500">
          Risk / Reward ·{" "}
          <span className="text-white font-mono font-semibold">1:3</span>
        </div>
      )}

      {/* EMA confirmation */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-2 py-1">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          <span className="text-gray-400">EMA50</span>
          <span className="font-mono text-blue-300">
            {fmt(s.ema50, s.asset)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-2 py-1">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
          <span className="text-gray-400">EMA200</span>
          <span className="font-mono text-violet-300">
            {fmt(s.ema200, s.asset)}
          </span>
        </div>
        <span className="text-gray-600 text-[10px] my-auto">
          (Confirmation Only)
        </span>
      </div>

      {/* Support / Resistance */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-2 py-1">
          <span className="text-emerald-500/70">Support</span>
          <span className="font-mono text-emerald-400">
            {fmt(s.support, s.asset)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-500/5 border border-red-500/20 rounded-md px-2 py-1">
          <span className="text-red-500/70">Resistance</span>
          <span className="font-mono text-red-400">
            {fmt(s.resistance, s.asset)}
          </span>
        </div>
      </div>

      {/* Institutional probability bar (visual only) */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Institutional Probability (visual only)</span>
          <span className="font-mono">
            {prob.bull}% Bull · {prob.bear}% Bear
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${prob.bull}%` }}
          />
          <div
            className="h-full bg-red-500"
            style={{ width: `${prob.bear}%` }}
          />
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
        <div className="flex items-center gap-1.5 ml-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold tracking-widest">
            LIVE · NO REPAINT
          </span>
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
          className={`w-1.5 h-1.5 rounded-full ${klines.isConnected ? "bg-emerald-500" : "bg-red-500"}`}
        />
        Binance WebSocket: {klines.isConnected ? "Connected" : "Reconnecting…"}
        <span className="mx-2">·</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${eurusd.isConnected ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        EUR/USD Feed: {eurusd.isConnected ? "Connected" : "Polling…"}
      </div>
    </div>
  );
}
