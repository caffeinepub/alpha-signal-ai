import { useEffect, useRef, useState } from "react";
import { useMarketWebSocket } from "./useMarketWebSocket";
import { useSignalEngine } from "./useSignalEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BacktestTrade {
  id: string; // `${symbol}-${timestamp}`
  symbol: string;
  direction: "STRONG BUY" | "STRONG SELL";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number; // tp1 from signal
  confidence: number;
  signalTime: Date;
  closedTime?: Date;
  status: "OPEN" | "WIN" | "LOSS";
  rrRatio: number; // |takeProfit - entry| / |stopLoss - entry|
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  winRate: number; // 0-100 percentage
  avgRR: number; // average risk-reward ratio of closed trades
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TRADES = 100;

export function useBacktestTracker(): {
  trades: BacktestTrade[];
  stats: BacktestStats;
} {
  const { signals } = useSignalEngine();
  const { marketData, lastUpdate } = useMarketWebSocket();

  // Store trades in a ref to avoid re-render loops on every price tick
  const tradesRef = useRef<BacktestTrade[]>([]);

  // Track which symbols currently have an OPEN trade (prevent duplicates per symbol)
  const openSymbolsRef = useRef<Set<string>>(new Set());

  // Tick counter to force re-renders when trades are updated
  const [, setTick] = useState(0);

  // ── Signal watcher: open new trades when a STRONG BUY/SELL fires ──────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: signals is the intended dep
  useEffect(() => {
    let changed = false;

    for (const signal of signals) {
      if (signal.direction === "WAIT") continue;
      const sym = signal.symbol;

      // Only open one trade per symbol at a time
      if (openSymbolsRef.current.has(sym)) continue;

      const entry = signal.entryPrice;
      const sl = signal.stopLoss;
      const tp = signal.tp1;

      // Compute R:R (clamped to minimum 0.1)
      const reward = Math.abs(tp - entry);
      const risk = Math.abs(sl - entry);
      const rrRatio = risk > 0 ? Math.max(0.1, reward / risk) : 0.1;

      const trade: BacktestTrade = {
        id: `${sym}-${Date.now()}`,
        symbol: sym,
        direction: signal.direction,
        entryPrice: entry,
        stopLoss: sl,
        takeProfit: tp,
        confidence: signal.confidence,
        signalTime: signal.signalTime ?? new Date(),
        status: "OPEN",
        rrRatio,
      };

      // Append, evicting oldest if over limit
      if (tradesRef.current.length >= MAX_TRADES) {
        tradesRef.current.shift();
      }
      tradesRef.current.push(trade);
      openSymbolsRef.current.add(sym);
      changed = true;
    }

    if (changed) setTick((t) => t + 1);
  }, [signals]);

  // ── Price watcher: resolve OPEN trades against live market price ──────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastUpdate is the tick trigger
  useEffect(() => {
    if (!lastUpdate) return;

    let changed = false;

    for (const asset of marketData) {
      const currentPrice = asset.price;
      const sym = asset.symbol;

      // Find the single OPEN trade for this symbol (if any)
      const trade = tradesRef.current.find(
        (t) => t.symbol === sym && t.status === "OPEN",
      );
      if (!trade) continue;

      let newStatus: "WIN" | "LOSS" | null = null;

      if (trade.direction === "STRONG BUY") {
        if (currentPrice >= trade.takeProfit) newStatus = "WIN";
        else if (currentPrice <= trade.stopLoss) newStatus = "LOSS";
      } else {
        // STRONG SELL
        if (currentPrice <= trade.takeProfit) newStatus = "WIN";
        else if (currentPrice >= trade.stopLoss) newStatus = "LOSS";
      }

      if (newStatus !== null) {
        trade.status = newStatus;
        trade.closedTime = new Date();
        openSymbolsRef.current.delete(sym);
        changed = true;
      }
    }

    if (changed) setTick((t) => t + 1);
  }, [marketData, lastUpdate]);

  // ── Compute stats from the current trade list ─────────────────────────────
  const trades = tradesRef.current;
  const wins = trades.filter((t) => t.status === "WIN").length;
  const losses = trades.filter((t) => t.status === "LOSS").length;
  const openTrades = trades.filter((t) => t.status === "OPEN").length;
  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : 0;

  const closedTrades = trades.filter((t) => t.status !== "OPEN");
  const avgRR =
    closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + t.rrRatio, 0) /
        closedTrades.length
      : 0;

  const stats: BacktestStats = {
    totalTrades: trades.length,
    wins,
    losses,
    openTrades,
    winRate,
    avgRR,
  };

  return { trades, stats };
}
