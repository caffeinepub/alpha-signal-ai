import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Clock, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useBinanceKlines } from "../hooks/useBinanceKlines";
import { useMarketWebSocket } from "../hooks/useMarketWebSocket";
import { useNotifications } from "../hooks/useNotifications";
import { type SignalResult, useSignalEngine } from "../hooks/useSignalEngine";
import {
  type TrackedSignal,
  useSignalTracker,
} from "../hooks/useSignalTracker";
import { useXauCandles } from "../hooks/useXauCandles";

function SignalLockTimer({ lockedUntil }: { lockedUntil: number }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    function update() {
      setRemaining(Math.max(0, lockedUntil - Date.now()));
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  if (remaining === 0) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <span className="flex items-center gap-1 text-xs font-mono text-hold">
      <Clock className="w-3 h-3" />
      {mins}:{String(secs).padStart(2, "0")} remaining
    </span>
  );
}

function SignalCard({
  symbol,
  signal,
  tracker,
}: {
  symbol: string;
  signal: SignalResult | null;
  tracker: ReturnType<typeof useSignalTracker>;
}) {
  const isBuy = signal?.type === "BUY";
  const isSell = signal?.type === "SELL";
  const isActive = isBuy || isSell;

  function fmt(v: number) {
    return symbol === "XAU"
      ? `$${v.toFixed(2)}`
      : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <Card className="bg-card border-border" data-ocid="signal.card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span
              className={cn(
                "font-mono font-bold",
                symbol === "XAU" ? "text-hold" : "text-primary",
              )}
            >
              {symbol}
            </span>
            <span className="text-muted-foreground font-normal text-sm">
              {symbol === "BTC"
                ? "Bitcoin"
                : symbol === "XAU"
                  ? "Gold"
                  : symbol}
            </span>
          </CardTitle>
          {isActive ? (
            <Badge
              className={cn(
                "font-mono font-bold px-3",
                isBuy
                  ? "bg-bull/20 text-bull border-bull/40"
                  : "bg-bear/20 text-bear border-bear/40",
              )}
            >
              {isBuy ? (
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 mr-1" />
              )}
              {signal?.type}
            </Badge>
          ) : (
            <Badge className="bg-secondary text-muted-foreground border-border font-mono">
              WAIT
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isActive ? (
          <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
            <Shield className="w-8 h-8 opacity-30" />
            <p className="text-sm">Monitoring market conditions...</p>
          </div>
        ) : (
          <>
            {signal && <SignalLockTimer lockedUntil={signal.lockedUntil} />}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/40 rounded-md p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Entry Price
                </div>
                <div className="font-mono font-bold text-foreground">
                  {signal && fmt(signal.entryPrice)}
                </div>
              </div>
              <div className="bg-secondary/40 rounded-md p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Stop Loss
                </div>
                <div className="font-mono font-bold text-bear">
                  {signal && fmt(signal.stopLoss)}
                </div>
              </div>
              <div
                className={cn(
                  "bg-secondary/40 rounded-md p-3",
                  tracker.tp1Hit && "bg-bull/10 border border-bull/30",
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">
                    Take Profit 1
                  </span>
                  {tracker.tp1Hit && (
                    <Badge className="text-[10px] bg-bull/20 text-bull border-bull/30 h-4 px-1">
                      HIT ✓
                    </Badge>
                  )}
                </div>
                <div className="font-mono font-bold text-bull">
                  {signal && fmt(signal.takeProfit1)}
                </div>
              </div>
              <div
                className={cn(
                  "bg-secondary/40 rounded-md p-3",
                  tracker.tp2Hit && "bg-bull/10 border border-bull/30",
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">
                    Take Profit 2
                  </span>
                  {tracker.tp2Hit && (
                    <Badge className="text-[10px] bg-bull/20 text-bull border-bull/30 h-4 px-1">
                      HIT ✓
                    </Badge>
                  )}
                </div>
                <div className="font-mono font-bold text-bull">
                  {signal && fmt(signal.takeProfit2)}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-mono font-semibold">
                  {signal && Math.round(signal.confidence)}%
                </span>
              </div>
              <Progress value={signal?.confidence || 0} className="h-1.5" />
            </div>
            {signal && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Indicator Breakdown
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "EMA Alignment",
                      val: signal.ema50 > signal.ema200 ? "BULLISH" : "BEARISH",
                      bull: signal.ema50 > signal.ema200,
                    },
                    {
                      label: "Supertrend",
                      val: signal.supertrendBullish ? "BULLISH" : "BEARISH",
                      bull: signal.supertrendBullish,
                    },
                    {
                      label: "EMA 10/20",
                      val:
                        signal.ema10 > signal.ema20 ? "CROSS UP" : "CROSS DN",
                      bull: signal.ema10 > signal.ema20,
                    },
                    { label: "ATR", val: signal.atr.toFixed(2), bull: null },
                  ].map((ind) => (
                    <div
                      key={ind.label}
                      className="flex items-center justify-between bg-secondary/30 rounded px-2 py-1.5"
                    >
                      <span className="text-xs text-muted-foreground">
                        {ind.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold",
                          ind.bull === null
                            ? "text-muted-foreground"
                            : ind.bull
                              ? "text-bull"
                              : "text-bear",
                        )}
                      >
                        {ind.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tracker.recentSignals.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              History
            </div>
            <div className="space-y-1.5" data-ocid="signal.history.list">
              {tracker.recentSignals
                .slice(-5)
                .reverse()
                .map((sig: TrackedSignal, idx: number) => (
                  <div
                    key={sig.lockedAt}
                    className="flex items-center justify-between text-xs"
                    data-ocid={`signal.history.item.${idx + 1}`}
                  >
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        sig.type === "BUY" ? "text-bull" : "text-bear",
                      )}
                    >
                      {sig.type}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {fmt(sig.entryPrice)}
                    </span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        sig.outcome === "WIN_TP1" || sig.outcome === "WIN_TP2"
                          ? "text-bull"
                          : sig.outcome === "LOSS"
                            ? "text-bear"
                            : "text-hold",
                      )}
                    >
                      {sig.outcome === "WIN_TP1"
                        ? "WIN TP1"
                        : sig.outcome === "WIN_TP2"
                          ? "WIN TP2"
                          : sig.outcome === "LOSS"
                            ? "LOSS"
                            : "PENDING"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Signals() {
  const { marketData } = useMarketWebSocket();
  const { btcCandles } = useBinanceKlines();

  const btc = marketData.find((a) => a.symbol === "BTC");
  const xau = marketData.find((a) => a.symbol === "XAU");

  const xauCandles = useXauCandles(xau?.price || 0);

  const btcSignal = useSignalEngine(btcCandles, btc?.price || 0, "BTC");
  const xauSignal = useSignalEngine(xauCandles, xau?.price || 0, "XAU");

  const btcTracker = useSignalTracker(btcSignal, btc?.price || 0);
  const xauTracker = useSignalTracker(xauSignal, xau?.price || 0);

  const { notifySignal } = useNotifications();

  const btcLockedAt = btcSignal?.lockedAt;
  const xauLockedAt = xauSignal?.lockedAt;

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire only on new signal lock
  useEffect(() => {
    if (btcSignal && btcSignal.type !== "WAIT") notifySignal(btcSignal);
  }, [btcLockedAt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire only on new signal lock
  useEffect(() => {
    if (xauSignal && xauSignal.type !== "WAIT") notifySignal(xauSignal);
  }, [xauLockedAt]);

  return (
    <div className="p-4 lg:p-6" data-ocid="signals.page">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SignalCard symbol="BTC" signal={btcSignal} tracker={btcTracker} />
        <SignalCard symbol="XAU" signal={xauSignal} tracker={xauTracker} />
      </div>
      <footer className="mt-8 text-center text-xs text-muted-foreground">
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
