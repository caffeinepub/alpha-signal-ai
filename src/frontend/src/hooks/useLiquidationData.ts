import { useCallback, useEffect, useRef, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────────

export interface LiquidationState {
  longLiquidations: number; // USD value of long liquidations (last 1 hour)
  shortLiquidations: number; // USD value of short liquidations (last 1 hour)
  liquidationBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  lastUpdated: Date | null;
  isConnected: boolean;
  statusMessage: string;
  isSimulated: boolean; // true when showing generated fallback data
}

// ──────────────────────────────────────────────────────────────────────────────────
// Liquidation event storage
// ──────────────────────────────────────────────────────────────────────────────────

interface LiqEvent {
  time: number;
  usdValue: number;
  type: "long" | "short";
  simulated?: boolean;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
// Use the combined stream endpoint — subscribe after connect
const WS_URL = "wss://fstream.binance.com/ws";
const STREAM_NAME = "btcusdt@forceOrder";
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 2000;
// Number of real events before simulation is disabled
const REAL_EVENT_THRESHOLD = 3;

// ──────────────────────────────────────────────────────────────────────────────────
// Simulation helpers
// ──────────────────────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateSimulatedEvent(): LiqEvent {
  // 60% chance of short liquidation (bullish), 40% long
  const type: LiqEvent["type"] = Math.random() < 0.6 ? "short" : "long";
  const usdValue = randomBetween(50_000, 500_000);
  const event: LiqEvent = {
    time: Date.now(),
    usdValue,
    type,
    simulated: true,
  };
  console.log(
    `[Liquidation] Simulated event: ${type} $${(usdValue / 1000).toFixed(1)}K`,
  );
  return event;
}

// ──────────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────────

export function useLiquidationData(): LiquidationState {
  const [state, setState] = useState<LiquidationState>({
    longLiquidations: 0,
    shortLiquidations: 0,
    liquidationBias: "NEUTRAL",
    lastUpdated: null,
    isConnected: false,
    statusMessage: "Connecting to liquidation feed…",
    isSimulated: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const unmountedRef = useRef(false);
  const eventsRef = useRef<LiqEvent[]>([]);
  const realEventCountRef = useRef(0);
  const isConnectedRef = useRef(false);

  // ── Compute state from current events ────────────────────────────────────
  const computeState = useCallback(
    (connected: boolean, statusMessage: string): LiquidationState => {
      const now = Date.now();
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
        liquidationBias = "BULLISH";
      } else if (longLiquidations > shortLiquidations * 1.5) {
        liquidationBias = "BEARISH";
      } else {
        liquidationBias = "NEUTRAL";
      }

      const hasSimulated = eventsRef.current.some((e) => e.simulated);
      const hasReal = eventsRef.current.some((e) => !e.simulated);
      const isSimulated = hasSimulated && !hasReal;

      return {
        longLiquidations,
        shortLiquidations,
        liquidationBias,
        lastUpdated: eventsRef.current.length > 0 ? new Date() : null,
        isConnected: connected,
        statusMessage,
        isSimulated,
      };
    },
    [],
  );

  // ── Simulation engine: fires when no real data yet ────────────────────────
  const scheduleSimulation = useCallback(() => {
    if (unmountedRef.current) return;
    if (realEventCountRef.current >= REAL_EVENT_THRESHOLD) return;

    const delay = randomBetween(4000, 7000);
    simTimerRef.current = setTimeout(() => {
      if (unmountedRef.current) return;
      if (realEventCountRef.current >= REAL_EVENT_THRESHOLD) return;

      const evt = generateSimulatedEvent();
      eventsRef.current.push(evt);
      setState(
        computeState(
          isConnectedRef.current,
          isConnectedRef.current
            ? `Connected — ${eventsRef.current.length} events (simulated)"`
            : "Syncing…",
        ),
      );
      scheduleSimulation();
    }, delay);
  }, [computeState]);

  const stopSimulation = useCallback(() => {
    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  // ── WebSocket connect / reconnect ─────────────────────────────────────────
  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectedRef.current = false;
    setState((prev) => ({
      ...prev,
      statusMessage: `Connecting… (attempt ${reconnectAttemptsRef.current + 1})`,
    }));

    // Start simulation while waiting for real data
    if (realEventCountRef.current < REAL_EVENT_THRESHOLD) {
      scheduleSimulation();
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        reconnectAttemptsRef.current = 0;
        isConnectedRef.current = true;
        // Subscribe to the forceOrder stream after connection
        const subscribeMsg = JSON.stringify({
          method: "SUBSCRIBE",
          params: [STREAM_NAME],
          id: 1,
        });
        ws.send(subscribeMsg);

        // Keep-alive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: "LIST_SUBSCRIPTIONS", id: 99 }));
          } else {
            clearInterval(keepAliveInterval);
          }
        }, 30_000);
        (
          ws as WebSocket & { _keepAlive?: ReturnType<typeof setInterval> }
        )._keepAlive = keepAliveInterval;

        console.log(
          "[Liquidation] WebSocket connected, subscribed to",
          STREAM_NAME,
        );
        setState((prev) => ({
          ...prev,
          isConnected: true,
          statusMessage: "Connected — monitoring BTC liquidations",
        }));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (unmountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as Record<
            string,
            unknown
          >;

          // Ignore subscription confirmation messages
          if (msg?.result !== undefined || msg?.id !== undefined) return;

          // Handle stream wrapper format: { stream: ..., data: { ... } }
          const rawOrder =
            (msg?.data as Record<string, unknown> | undefined) ?? msg;
          const o = rawOrder?.o as Record<string, string> | undefined;
          if (!o) return;

          const side = o.S;
          const filledQty = Number.parseFloat(o.z);
          const price = Number.parseFloat(o.p);
          const usdValue = filledQty * price;

          if (usdValue <= 0 || !Number.isFinite(usdValue)) return;

          // BUY side = short position liquidated (bullish)
          // SELL side = long position liquidated (bearish)
          const type: LiqEvent["type"] = side === "BUY" ? "short" : "long";
          eventsRef.current.push({ time: Date.now(), usdValue, type });
          realEventCountRef.current += 1;

          // Once we have enough real events, stop simulation
          if (realEventCountRef.current >= REAL_EVENT_THRESHOLD) {
            stopSimulation();
            // Remove simulated events to keep data clean
            eventsRef.current = eventsRef.current.filter((e) => !e.simulated);
          }

          setState(
            computeState(
              true,
              `Live — ${eventsRef.current.length} events (1h)`,
            ),
          );
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = (err) => {
        console.error("[Liquidation] WebSocket error:", err);
      };

      ws.onclose = (event) => {
        // Clear keep-alive if it exists
        const keepAlive = (
          ws as WebSocket & { _keepAlive?: ReturnType<typeof setInterval> }
        )._keepAlive;
        if (keepAlive) clearInterval(keepAlive);
        if (unmountedRef.current) return;
        isConnectedRef.current = false;
        console.warn(
          "[Liquidation] WebSocket closed:",
          event.code,
          event.reason,
        );
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(
          BASE_RECONNECT_DELAY * 2 ** attempts,
          MAX_RECONNECT_DELAY,
        );
        reconnectAttemptsRef.current = attempts + 1;
        setState((prev) => ({
          ...prev,
          isConnected: false,
          statusMessage: `Disconnected (code ${event.code}). Reconnecting in ${Math.round(delay / 1000)}s…`,
        }));
        reconnectTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connect();
        }, delay);
      };
    } catch (err) {
      console.error("[Liquidation] WebSocket construction failed:", err);
      isConnectedRef.current = false;
      setState((prev) => ({
        ...prev,
        isConnected: false,
        statusMessage: "WebSocket unavailable in this environment",
      }));
    }
  }, [computeState, scheduleSimulation, stopSimulation]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    const cleanupInterval = setInterval(() => {
      if (!unmountedRef.current) {
        setState(
          computeState(
            isConnectedRef.current,
            isConnectedRef.current
              ? `Live — ${eventsRef.current.length} events (1h)`
              : "Reconnecting…",
          ),
        );
      }
    }, 30_000);

    return () => {
      unmountedRef.current = true;
      clearInterval(cleanupInterval);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (simTimerRef.current) {
        clearTimeout(simTimerRef.current);
        simTimerRef.current = null;
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
