import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LiquidationState {
  longLiquidations: number; // USD value of long liquidations (last 1 hour)
  shortLiquidations: number; // USD value of short liquidations (last 1 hour)
  liquidationBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  // BULLISH = short liqs > long liqs * 1.5 (shorts being liquidated → price going up)
  // BEARISH = long liqs > short liqs * 1.5
  lastUpdated: Date | null;
  isConnected: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidation event storage
// ─────────────────────────────────────────────────────────────────────────────

interface LiqEvent {
  time: number; // Date.now()
  usdValue: number;
  type: "long" | "short";
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const WS_URL = "wss://fstream.binance.com/stream?streams=btcusdt@forceOrder";
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useLiquidationData(): LiquidationState {
  const [state, setState] = useState<LiquidationState>({
    longLiquidations: 0,
    shortLiquidations: 0,
    liquidationBias: "NEUTRAL",
    lastUpdated: null,
    isConnected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const unmountedRef = useRef(false);
  const eventsRef = useRef<LiqEvent[]>([]);

  const computeState = useCallback((connected: boolean): LiquidationState => {
    const now = Date.now();
    // Prune events older than 1 hour
    eventsRef.current = eventsRef.current.filter(
      (e) => now - e.time < ONE_HOUR_MS,
    );

    const longLiquidations = eventsRef.current
      .filter((e) => e.type === "long")
      .reduce((sum, e) => sum + e.usdValue, 0);

    const shortLiquidations = eventsRef.current
      .filter((e) => e.type === "short")
      .reduce((sum, e) => sum + e.usdValue, 0);

    let liquidationBias: LiquidationState["liquidationBias"];
    if (shortLiquidations > longLiquidations * 1.5) {
      liquidationBias = "BULLISH"; // Shorts being wiped out → bullish
    } else if (longLiquidations > shortLiquidations * 1.5) {
      liquidationBias = "BEARISH"; // Longs being wiped out → bearish
    } else {
      liquidationBias = "NEUTRAL";
    }

    return {
      longLiquidations,
      shortLiquidations,
      liquidationBias,
      lastUpdated: eventsRef.current.length > 0 ? new Date() : null,
      isConnected: connected,
    };
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // Clean up existing socket
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, isConnected: true }));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (unmountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            data: {
              o: {
                S: "BUY" | "SELL";
                q: string;
                p: string;
                z: string;
              };
            };
          };

          const o = msg?.data?.o;
          if (!o) return;

          // BUY side = short position liquidated → short liquidation (bullish)
          // SELL side = long position liquidated → long liquidation (bearish)
          const side = o.S;
          const filledQty = Number.parseFloat(o.z);
          const price = Number.parseFloat(o.p);
          const usdValue = filledQty * price;

          if (usdValue <= 0 || !Number.isFinite(usdValue)) return;

          const type: LiqEvent["type"] = side === "BUY" ? "short" : "long";
          eventsRef.current.push({
            time: Date.now(),
            usdValue,
            type,
          });

          setState(computeState(true));
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnect
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setState((prev) => ({ ...prev, isConnected: false }));

        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(
          BASE_RECONNECT_DELAY * 2 ** attempts,
          MAX_RECONNECT_DELAY,
        );
        reconnectAttemptsRef.current = attempts + 1;

        reconnectTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connect();
        }, delay);
      };
    } catch {
      // WebSocket construction failed (e.g., in a restricted environment)
      // Gracefully degrade — leave state as default (not connected)
    }
  }, [computeState]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    // Periodic cleanup of old events (every 30 seconds)
    const cleanupInterval = setInterval(() => {
      if (!unmountedRef.current) {
        setState(computeState(wsRef.current?.readyState === WebSocket.OPEN));
      }
    }, 30_000);

    return () => {
      unmountedRef.current = true;
      clearInterval(cleanupInterval);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, computeState]);

  return state;
}
