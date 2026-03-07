import { Skeleton } from "@/components/ui/skeleton";
import { Activity, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { useMarketWebSocket } from "../hooks/useMarketWebSocket";
import {
  useAISignals,
  useMarketSentiment,
  useTopGainers,
  useTopLosers,
} from "../hooks/useQueries";

function PriceCard({
  symbol,
  name,
  price,
  change,
  volume,
  high,
  low,
}: {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  high: number;
  low: number;
}) {
  const isUp = change >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;

  const formatPrice = (p: number) => {
    if (p > 1000)
      return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (p > 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };

  const formatVol = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <div className="trading-card p-4 hover:border-primary/40 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold font-mono text-primary">
              {symbol === "GOLD" ? "AU" : symbol.slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {symbol}
            </div>
            <div className="text-[10px] text-muted-foreground">{name}</div>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold font-mono ${
            isUp ? "signal-buy" : "signal-sell"
          } border`}
        >
          <Icon className="w-3 h-3" />
          {isUp ? "+" : ""}
          {change.toFixed(2)}%
        </div>
      </div>

      {/* Price */}
      <div className="mb-3">
        <div className="text-2xl font-bold font-mono text-foreground group-hover:text-primary transition-colors">
          {formatPrice(price)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Volume</div>
          <div className="font-mono text-foreground font-medium">
            {formatVol(volume)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">24H High</div>
          <div className="font-mono text-bull font-medium">
            {formatPrice(high)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">24H Low</div>
          <div className="font-mono text-bear font-medium">
            {formatPrice(low)}
          </div>
        </div>
      </div>

      {/* Progress bar for position in range */}
      <div className="mt-3">
        <div className="h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, ((price - low) / (high - low || 1)) * 100))}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span>24H Range</span>
          <span className="font-mono">
            {Math.round(((price - low) / (high - low || 1)) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const angle = (value / 100) * 180 - 90;

  const getZoneColor = (v: number) => {
    if (v <= 20) return "oklch(0.60 0.22 25)"; // Extreme Fear
    if (v <= 40) return "oklch(0.65 0.20 40)"; // Fear
    if (v <= 60) return "oklch(0.75 0.18 80)"; // Neutral
    if (v <= 80) return "oklch(0.65 0.18 145)"; // Greed
    return "oklch(0.55 0.20 145)"; // Extreme Greed
  };

  const color = getZoneColor(value);

  return (
    <div className="trading-card p-4 flex flex-col items-center">
      <div className="text-sm font-semibold text-muted-foreground mb-3 self-start w-full">
        Fear & Greed Index
      </div>

      <div className="relative w-48 h-28">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          <title>Fear and Greed gauge</title>
          {/* Background arc zones */}
          {/* Extreme Fear */}
          <path
            d="M 20 100 A 80 80 0 0 1 44 43"
            fill="none"
            stroke="oklch(0.60 0.22 25 / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Fear */}
          <path
            d="M 44 43 A 80 80 0 0 1 80 17"
            fill="none"
            stroke="oklch(0.65 0.20 40 / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Neutral */}
          <path
            d="M 80 17 A 80 80 0 0 1 120 17"
            fill="none"
            stroke="oklch(0.75 0.18 80 / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Greed */}
          <path
            d="M 120 17 A 80 80 0 0 1 156 43"
            fill="none"
            stroke="oklch(0.65 0.18 145 / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Extreme Greed */}
          <path
            d="M 156 43 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="oklch(0.55 0.20 145 / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Value arc */}
          {value > 0 && (
            <path
              d="M 20 100 A 80 80 0 0 1 100 20"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(value / 100) * 251} 251`}
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
          )}

          {/* Needle */}
          <g transform={`rotate(${angle}, 100, 100)`}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="28"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill={color} />
            <circle cx="100" cy="100" r="3" fill="oklch(0.12 0.02 250)" />
          </g>

          {/* Value text */}
          <text
            x="100"
            y="112"
            textAnchor="middle"
            fill={color}
            fontSize="22"
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
          >
            {value}
          </text>
        </svg>
      </div>

      <div className="text-center mt-1">
        <div className="text-base font-bold" style={{ color }}>
          {label}
        </div>
        <div className="flex justify-between w-full mt-2 text-[9px] text-muted-foreground font-mono">
          <span>0 Extreme Fear</span>
          <span>100 Extreme Greed</span>
        </div>
      </div>
    </div>
  );
}

function SignalWidget({
  direction,
  confidence,
  riskLevel,
  entryPrice,
  stopLoss,
  takeProfit,
  symbol,
  reasoning,
}: {
  direction: string;
  confidence: number;
  riskLevel: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  symbol: string;
  reasoning: string;
}) {
  const dirClass =
    direction === "BUY"
      ? "signal-buy"
      : direction === "SELL"
        ? "signal-sell"
        : "signal-hold";

  const rr = Math.abs(
    (takeProfit - entryPrice) / (entryPrice - stopLoss || 1),
  ).toFixed(2);

  return (
    <div className="trading-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-muted-foreground">
          AI Signal — {symbol}
        </span>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${dirClass}`}
        >
          {direction}
        </span>
      </div>

      {/* Confidence */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-mono font-bold text-foreground">
            {confidence}%
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              direction === "BUY"
                ? "bg-bull"
                : direction === "SELL"
                  ? "bg-bear"
                  : "bg-hold"
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Levels */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Entry
          </div>
          <div className="text-xs font-mono font-bold text-foreground mt-0.5">
            $
            {entryPrice.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-bear/10 rounded p-2 text-center border border-bear/20">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Stop Loss
          </div>
          <div className="text-xs font-mono font-bold text-bear mt-0.5">
            $
            {stopLoss.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-bull/10 rounded p-2 text-center border border-bull/20">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Take Profit
          </div>
          <div className="text-xs font-mono font-bold text-bull mt-0.5">
            $
            {takeProfit.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-muted-foreground">Risk/Reward</span>
        <span className="font-mono font-bold text-primary">1:{rr}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded font-semibold ${
            riskLevel === "LOW"
              ? "signal-buy"
              : riskLevel === "HIGH"
                ? "signal-sell"
                : "signal-hold"
          } border`}
        >
          {riskLevel} RISK
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
        {reasoning}
      </p>
    </div>
  );
}

function GainersLosersTable({
  items,
  title,
  isGainer,
}: {
  items: Array<{
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
  }>;
  title: string;
  isGainer: boolean;
}) {
  return (
    <div className="trading-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {isGainer ? (
          <TrendingUp className="w-4 h-4 text-bull" />
        ) : (
          <TrendingDown className="w-4 h-4 text-bear" />
        )}
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={item.symbol}
            className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono w-4">
                {i + 1}
              </span>
              <div>
                <div className="text-xs font-bold text-foreground">
                  {item.symbol}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {item.name}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-semibold text-foreground">
                $
                {item.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div
                className={`text-[10px] font-mono font-bold ${
                  item.changePercent >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {item.changePercent >= 0 ? "+" : ""}
                {item.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { marketData, isConnected, isConnecting } = useMarketWebSocket();
  const marketLoading = marketData.length === 0;
  const { data: aiSignals, isLoading: signalsLoading } = useAISignals();
  const { data: sentiment, isLoading: sentimentLoading } = useMarketSentiment();
  const { data: gainers, isLoading: gainersLoading } = useTopGainers();
  const { data: losers, isLoading: losersLoading } = useTopLosers();

  const btcSignal = aiSignals?.find((s) => s.symbol === "BTC");

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Market Overview Header */}
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Market Overview
        </span>
        <div className="flex-1 h-px bg-border" />
        {/* Live indicator */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          data-ocid="market.panel"
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-bull" />
              </span>
              <span className="text-[10px] font-bold font-mono text-bull tracking-widest">
                LIVE
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                · Live Feed
              </span>
            </>
          ) : isConnecting ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hold opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-hold" />
              </span>
              <span className="text-[10px] font-bold font-mono text-hold tracking-widest">
                CONNECTING...
              </span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-bear" />
              </span>
              <span className="text-[10px] font-bold font-mono text-bear tracking-widest">
                OFFLINE
              </span>
            </>
          )}
        </div>
      </div>

      {/* Price Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {marketLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton loader
              <div key={i} className="trading-card p-4">
                <Skeleton className="h-20 w-full bg-secondary" />
              </div>
            ))
          : marketData.map((asset) => (
              <PriceCard
                key={asset.symbol}
                symbol={asset.symbol}
                name={asset.name}
                price={asset.price}
                change={asset.change24h}
                volume={asset.volume}
                high={asset.high24h}
                low={asset.low24h}
              />
            ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Signal Widget */}
        {signalsLoading ? (
          <div className="trading-card p-4">
            <Skeleton className="h-48 w-full bg-secondary" />
          </div>
        ) : btcSignal ? (
          <SignalWidget
            symbol={btcSignal.symbol}
            direction={btcSignal.direction}
            confidence={Number(btcSignal.confidence)}
            riskLevel={btcSignal.riskLevel}
            entryPrice={btcSignal.entryPrice}
            stopLoss={btcSignal.stopLoss}
            takeProfit={btcSignal.takeProfit}
            reasoning={btcSignal.reasoning}
          />
        ) : null}

        {/* Fear & Greed */}
        {sentimentLoading ? (
          <div className="trading-card p-4">
            <Skeleton className="h-48 w-full bg-secondary" />
          </div>
        ) : sentiment ? (
          <FearGreedGauge
            value={Number(sentiment.fearGreedIndex)}
            label={sentiment.fearGreedLabel}
          />
        ) : null}
      </div>

      {/* Gainers / Losers */}
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Market Movers
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {gainersLoading ? (
          <div className="trading-card p-4">
            <Skeleton className="h-48 w-full bg-secondary" />
          </div>
        ) : gainers && gainers.length > 0 ? (
          <GainersLosersTable
            title="Top Gainers"
            items={gainers}
            isGainer={true}
          />
        ) : (
          <div className="trading-card p-4" data-ocid="gainers.empty_state">
            <p className="text-muted-foreground text-sm text-center py-4">
              No data available
            </p>
          </div>
        )}

        {losersLoading ? (
          <div className="trading-card p-4">
            <Skeleton className="h-48 w-full bg-secondary" />
          </div>
        ) : losers && losers.length > 0 ? (
          <GainersLosersTable
            title="Top Losers"
            items={losers}
            isGainer={false}
          />
        ) : (
          <div className="trading-card p-4" data-ocid="losers.empty_state">
            <p className="text-muted-foreground text-sm text-center py-4">
              No data available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
