import { useEffect, useRef, useState } from "react";
import type { SignalResult } from "./useSignalEngine";

export type SignalOutcome = "PENDING" | "WIN_TP1" | "WIN_TP2" | "LOSS";

export interface TrackedSignal extends SignalResult {
  outcome: SignalOutcome;
  tp1Hit: boolean;
  tp2Hit: boolean;
  slHit: boolean;
}

const STORAGE_KEY = "alpha_signal_history";
const MAX_HISTORY = 20;

function loadHistory(): TrackedSignal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(signals: TrackedSignal[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(signals.slice(-MAX_HISTORY)),
    );
  } catch {}
}

export function useSignalTracker(
  activeSignal: SignalResult | null,
  currentPrice: number,
) {
  const [recentSignals, setRecentSignals] = useState<TrackedSignal[]>(() =>
    loadHistory(),
  );
  const [tp1Hit, setTp1Hit] = useState(false);
  const [tp2Hit, setTp2Hit] = useState(false);
  const [slHit, setSlHit] = useState(false);
  const trackedLockedAtRef = useRef<number | null>(null);

  // Track new signal
  useEffect(() => {
    if (!activeSignal || activeSignal.type === "WAIT") {
      setTp1Hit(false);
      setTp2Hit(false);
      setSlHit(false);
      trackedLockedAtRef.current = null;
      return;
    }

    if (trackedLockedAtRef.current !== activeSignal.lockedAt) {
      trackedLockedAtRef.current = activeSignal.lockedAt;
      setTp1Hit(false);
      setTp2Hit(false);
      setSlHit(false);

      const tracked: TrackedSignal = {
        ...activeSignal,
        outcome: "PENDING",
        tp1Hit: false,
        tp2Hit: false,
        slHit: false,
      };

      setRecentSignals((prev) => {
        const next = [
          ...prev.filter((s) => s.lockedAt !== activeSignal.lockedAt),
          tracked,
        ].slice(-MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    }
  }, [activeSignal]);

  // Monitor price for TP/SL hits
  useEffect(() => {
    if (!activeSignal || activeSignal.type === "WAIT" || currentPrice === 0)
      return;

    const { type, stopLoss, takeProfit1, takeProfit2, lockedAt } = activeSignal;
    const isBuy = type === "BUY";

    const newTp1 = isBuy
      ? currentPrice >= takeProfit1
      : currentPrice <= takeProfit1;
    const newTp2 = isBuy
      ? currentPrice >= takeProfit2
      : currentPrice <= takeProfit2;
    const newSl = isBuy ? currentPrice <= stopLoss : currentPrice >= stopLoss;

    if (newTp2 && !tp2Hit) {
      setTp2Hit(true);
      setTp1Hit(true);
      updateOutcome(lockedAt, "WIN_TP2", true, true, false);
    } else if (newTp1 && !tp1Hit) {
      setTp1Hit(true);
      updateOutcome(lockedAt, "WIN_TP1", true, false, false);
    } else if (newSl && !slHit && !tp1Hit) {
      setSlHit(true);
      updateOutcome(lockedAt, "LOSS", false, false, true);
    }
  }, [currentPrice, activeSignal, tp1Hit, tp2Hit, slHit]);

  function updateOutcome(
    lockedAt: number,
    outcome: SignalOutcome,
    tp1: boolean,
    tp2: boolean,
    sl: boolean,
  ) {
    setRecentSignals((prev) => {
      const next = prev.map((s) =>
        s.lockedAt === lockedAt
          ? { ...s, outcome, tp1Hit: tp1, tp2Hit: tp2, slHit: sl }
          : s,
      );
      saveHistory(next);
      return next;
    });
  }

  const closedSignals = recentSignals.filter((s) => s.outcome !== "PENDING");
  const wins = closedSignals.filter(
    (s) => s.outcome === "WIN_TP1" || s.outcome === "WIN_TP2",
  ).length;
  const losses = closedSignals.filter((s) => s.outcome === "LOSS").length;
  const winRate =
    closedSignals.length > 0
      ? Math.round((wins / closedSignals.length) * 100)
      : 0;

  return {
    activeSignal,
    tp1Hit,
    tp2Hit,
    slHit,
    winRate,
    recentSignals,
    totalSignals: recentSignals.length,
    wins,
    losses,
  };
}
