import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useMarketWebSocket } from "../hooks/useMarketWebSocket";

function AssetStatusBadge({
  symbol,
  lastTickTimes,
}: {
  symbol: string;
  lastTickTimes: Map<string, number>;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  const lastTick = lastTickTimes.get(symbol) || 0;
  const elapsed = now - lastTick;
  const isLive = lastTick > 0 && elapsed < 10000;

  return isLive ? (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
      <span className="text-xs font-mono font-semibold text-bull">LIVE</span>
    </span>
  ) : (
    <span className="flex items-center gap-1.5">
      <WifiOff className="w-3 h-3 text-muted-foreground" />
      <span className="text-xs font-mono text-muted-foreground">OFFLINE</span>
    </span>
  );
}

export default function Dashboard() {
  const { marketData, lastTickTimes } = useMarketWebSocket();

  const btc = marketData.find((a) => a.symbol === "BTC");
  const eth = marketData.find((a) => a.symbol === "ETH");
  const xau = marketData.find((a) => a.symbol === "XAU");

  function fmtPrice(sym: string, v: number) {
    if (sym === "XAU") return `$${v.toFixed(2)}`;
    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <section data-ocid="market.section">
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Market Overview
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[btc, eth, xau].map((asset, i) => {
            if (!asset) return null;
            const change = asset.change24h;
            const positive = change >= 0;
            const range = asset.high24h - asset.low24h;
            return (
              <Card
                key={asset.symbol}
                className="bg-card border-border"
                data-ocid={`market.asset.card.${i + 1}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                        {asset.symbol}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {asset.name}
                      </div>
                    </div>
                    <AssetStatusBadge
                      symbol={asset.symbol}
                      lastTickTimes={lastTickTimes}
                    />
                  </div>

                  <div className="font-mono text-2xl font-bold text-foreground mb-1">
                    {fmtPrice(asset.symbol, asset.price)}
                  </div>

                  <div className="flex items-center gap-1 mb-4">
                    {positive ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-bull" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-bear" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-mono font-semibold",
                        positive ? "text-bull" : "text-bear",
                      )}
                    >
                      {positive ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">24h High</span>
                      <span className="font-mono font-semibold text-bull">
                        {fmtPrice(asset.symbol, asset.high24h)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">24h Low</span>
                      <span className="font-mono font-semibold text-bear">
                        {fmtPrice(asset.symbol, asset.low24h)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">24h Range</span>
                      <span className="font-mono font-semibold text-foreground">
                        {fmtPrice(asset.symbol, range)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="text-center text-xs text-muted-foreground py-4">
        © {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
