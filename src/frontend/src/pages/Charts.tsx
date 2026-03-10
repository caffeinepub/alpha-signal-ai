import { cn } from "@/lib/utils";
import { useState } from "react";

const ASSETS = [
  { label: "BTC", value: "BTC", symbol: "BINANCE:BTCUSDT" },
  { label: "ETH", value: "ETH", symbol: "BINANCE:ETHUSDT" },
  { label: "XAU", value: "XAU", symbol: "OANDA:XAUUSD" },
];

const TIMEFRAMES = [
  { label: "1m", value: "1" },
  { label: "3m", value: "3" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
];

export default function Charts() {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTf, setSelectedTf] = useState("15");

  const asset = ASSETS.find((a) => a.value === selectedAsset) || ASSETS[0];

  const chartUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(asset.symbol)}&interval=${selectedTf}&theme=dark&style=1&locale=en&toolbar_bg=%230a0b0e&enable_publishing=false&hide_side_toolbar=0&allow_symbol_change=false&details=true&hotlist=false&calendar=false&hide_top_toolbar=0`;

  return (
    <div className="flex flex-col h-full" data-ocid="charts.page">
      <div className="flex items-center gap-4 px-4 lg:px-6 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-1">
          {ASSETS.map((a) => (
            <button
              key={a.value}
              type="button"
              data-ocid="charts.asset.tab"
              onClick={() => setSelectedAsset(a.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-mono font-semibold rounded transition-all",
                selectedAsset === a.value
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              data-ocid="charts.timeframe.tab"
              onClick={() => setSelectedTf(tf.value)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-mono rounded transition-all",
                selectedTf === tf.value
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <iframe
          key={`${asset.symbol}-${selectedTf}`}
          src={chartUrl}
          title={`${asset.label} Chart`}
          className="w-full h-full border-0"
          style={{ minHeight: "500px" }}
          allow="fullscreen"
          data-ocid="charts.canvas_target"
        />
      </div>
    </div>
  );
}
