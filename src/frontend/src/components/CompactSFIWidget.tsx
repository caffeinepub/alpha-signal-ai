import { useBinanceKlines } from "../hooks/useBinanceKlines";
import { useEURUSD } from "../hooks/useEURUSD";
import { getConfirmationData, useSFIEngine } from "../hooks/useSFIEngine";
import type { SFISignal } from "../hooks/useSFIEngine";

function fmt(n: number, asset: string): string {
  if (n === 0) return "—";
  if (asset === "EUR/USD") return n.toFixed(5);
  if (asset === "XAU/USD") return n.toFixed(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function TfSignal({ s }: { s: SFISignal }) {
  const label = s.timeframe;
  const conf = getConfirmationData(s);
  const confColor =
    conf.institutionalBias === "Bullish"
      ? "text-emerald-500/70"
      : conf.institutionalBias === "Bearish"
        ? "text-red-500/70"
        : "text-amber-500/70";

  if (s.signal === "BUY") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-gray-500">[{label}]</span>
          <span className="text-[11px] font-bold text-emerald-400">BUY 🟢</span>
        </div>
        <div className="font-mono text-[10px] text-gray-400 leading-tight">
          Entry: {fmt(s.entry, s.asset)} · SL: {fmt(s.stopLoss, s.asset)} · TP:{" "}
          {fmt(s.target, s.asset)}
        </div>
        <div className={`text-[9px] ${confColor}`}>
          {conf.institutionalBias} · {conf.emaTrend} · {conf.liquidity}
        </div>
      </div>
    );
  }
  if (s.signal === "SELL") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-gray-500">[{label}]</span>
          <span className="text-[11px] font-bold text-red-400">SELL 🔴</span>
        </div>
        <div className="font-mono text-[10px] text-gray-400 leading-tight">
          Entry: {fmt(s.entry, s.asset)} · SL: {fmt(s.stopLoss, s.asset)} · TP:{" "}
          {fmt(s.target, s.asset)}
        </div>
        <div className={`text-[9px] ${confColor}`}>
          {conf.institutionalBias} · {conf.emaTrend} · {conf.liquidity}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono text-gray-500">[{label}]</span>
        <span className="text-[11px] font-bold text-amber-400">WAIT ⚠️</span>
      </div>
      <div className={`text-[9px] ${confColor}`}>
        {conf.institutionalBias} · {conf.emaTrend} · {conf.liquidity}
      </div>
    </div>
  );
}

const ASSETS = ["BTC", "XAU/USD", "EUR/USD"] as const;

export default function CompactSFIWidget() {
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
    <div
      className="bg-black/60 border border-white/10 rounded-xl p-3"
      data-ocid="chat.signals.card"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-gray-300 tracking-wide">
          Live SFI Signals
        </span>
        <span className="ml-auto text-[9px] font-bold text-cyan-400 tracking-widest">
          🔒 SFI LOCKED
        </span>
      </div>
      <div className="space-y-3">
        {ASSETS.map((asset) => {
          const sig3m = signals.find(
            (s) => s.asset === asset && s.timeframe === "3m",
          );
          const sig15m = signals.find(
            (s) => s.asset === asset && s.timeframe === "15m",
          );
          return (
            <div
              key={asset}
              className="border-b border-white/5 pb-3 last:border-0 last:pb-0"
            >
              <div className="flex gap-4 flex-wrap">
                <span className="font-mono font-bold text-white text-xs w-14 shrink-0 mt-0.5">
                  {asset}:
                </span>
                <div className="flex gap-5 flex-wrap">
                  {sig3m && <TfSignal s={sig3m} />}
                  {sig15m && <TfSignal s={sig15m} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
