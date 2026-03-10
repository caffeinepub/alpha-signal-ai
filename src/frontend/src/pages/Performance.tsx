import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useBinanceKlines } from "../hooks/useBinanceKlines";
import { useMarketWebSocket } from "../hooks/useMarketWebSocket";
import { useSignalEngine } from "../hooks/useSignalEngine";
import { useSignalTracker } from "../hooks/useSignalTracker";
import { useXauCandles } from "../hooks/useXauCandles";

export default function Performance() {
  const { marketData } = useMarketWebSocket();
  const { btcCandles } = useBinanceKlines();

  const btc = marketData.find((a) => a.symbol === "BTC");
  const xau = marketData.find((a) => a.symbol === "XAU");

  const xauCandles = useXauCandles(xau?.price || 0);

  const btcSignal = useSignalEngine(btcCandles, btc?.price || 0, "BTC");
  const xauSignal = useSignalEngine(xauCandles, xau?.price || 0, "XAU");

  const btcTracker = useSignalTracker(btcSignal, btc?.price || 0);
  const xauTracker = useSignalTracker(xauSignal, xau?.price || 0);

  const allSignals = [
    ...btcTracker.recentSignals,
    ...xauTracker.recentSignals,
  ].sort((a, b) => b.lockedAt - a.lockedAt);

  const totalSignals = allSignals.length;
  const wins = allSignals.filter(
    (s) => s.outcome === "WIN_TP1" || s.outcome === "WIN_TP2",
  ).length;
  const losses = allSignals.filter((s) => s.outcome === "LOSS").length;
  const pending = allSignals.filter((s) => s.outcome === "PENDING").length;
  const closed = wins + losses;
  const winRate = closed > 0 ? Math.round((wins / closed) * 100) : 0;

  // Average R:R calculation
  const closedSignals = allSignals.filter((s) => s.outcome !== "PENDING");
  const avgRR =
    closedSignals.length > 0
      ? closedSignals.reduce((sum, s) => {
          const risk = Math.abs(s.entryPrice - s.stopLoss);
          const reward = Math.abs(s.takeProfit1 - s.entryPrice);
          return sum + (risk > 0 ? reward / risk : 0);
        }, 0) / closedSignals.length
      : 0;

  function fmtPrice(sym: string, v: number) {
    return sym === "XAU"
      ? `$${v.toFixed(2)}`
      : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function outcomeColor(o: string) {
    if (o === "WIN_TP1" || o === "WIN_TP2")
      return "bg-bull/20 text-bull border-bull/30";
    if (o === "LOSS") return "bg-bear/20 text-bear border-bear/30";
    return "bg-hold/10 text-hold border-hold/30";
  }

  function outcomeLabel(o: string) {
    if (o === "WIN_TP1") return "WIN TP1";
    if (o === "WIN_TP2") return "WIN TP2";
    if (o === "LOSS") return "LOSS";
    return "PENDING";
  }

  return (
    <div className="p-4 lg:p-6 space-y-6" data-ocid="performance.page">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border md:col-span-1">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-mono font-bold text-primary">
              {winRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-mono font-bold text-foreground">
              {totalSignals}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-mono font-bold text-bull">{wins}</div>
            <div className="text-xs text-muted-foreground mt-1">Wins</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-mono font-bold text-bear">
              {losses}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Losses</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-mono font-bold text-cyan">
              {avgRR.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Avg R:R</div>
          </CardContent>
        </Card>
      </div>

      {/* Win Rate Bar */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Performance Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-bull">Wins ({wins})</span>
              <span className="text-bear">Losses ({losses})</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
              {closed > 0 && (
                <>
                  <div
                    className="bg-bull h-full transition-all"
                    style={{ width: `${(wins / closed) * 100}%` }}
                  />
                  <div
                    className="bg-bear h-full transition-all"
                    style={{ width: `${(losses / closed) * 100}%` }}
                  />
                </>
              )}
            </div>
            {pending > 0 && (
              <p className="text-xs text-muted-foreground">
                {pending} signal{pending !== 1 ? "s" : ""} pending
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signal History Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Signal History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allSignals.length === 0 ? (
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              data-ocid="performance.signals.empty_state"
            >
              No signals recorded yet. Signals appear here once generated.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Asset</TableHead>
                  <TableHead className="text-xs">Dir</TableHead>
                  <TableHead className="text-xs">Entry</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">
                    SL
                  </TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">
                    TP1
                  </TableHead>
                  <TableHead className="text-xs hidden md:table-cell">
                    TP2
                  </TableHead>
                  <TableHead className="text-xs">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSignals.map((sig, idx) => (
                  <TableRow
                    key={sig.lockedAt}
                    className="border-border"
                    data-ocid={`performance.signal.item.${idx + 1}`}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {new Date(sig.lockedAt).toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">
                      {sig.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] font-mono",
                          sig.type === "BUY"
                            ? "bg-bull/20 text-bull border-bull/30"
                            : "bg-bear/20 text-bear border-bear/30",
                        )}
                      >
                        {sig.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtPrice(sig.symbol, sig.entryPrice)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-bear hidden sm:table-cell">
                      {fmtPrice(sig.symbol, sig.stopLoss)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-bull hidden sm:table-cell">
                      {fmtPrice(sig.symbol, sig.takeProfit1)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-bull hidden md:table-cell">
                      {fmtPrice(sig.symbol, sig.takeProfit2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] font-mono",
                          outcomeColor(sig.outcome),
                        )}
                      >
                        {outcomeLabel(sig.outcome)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
