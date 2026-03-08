import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderBookState {
  buyPressure: number; // 0-100 (% of total volume that is bids)
  sellPressure: number; // 0-100 (100 - buyPressure)
  buyVolume: number; // total bid quantity (BTC)
  sellVolume: number; // total ask quantity (BTC)
  totalVolume: number;
  label: "BULLISH PRESSURE" | "BEARISH PRESSURE" | "BALANCED";
  lastUpdated: Date | null;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 3000;
const ORDER_BOOK_URL =
  "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=100";

function sumQuantities(entries: [string, string][]): number {
  return entries.reduce((sum, [, qty]) => sum + Number.parseFloat(qty), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useOrderBook(): OrderBookState {
  const [state, setState] = useState<OrderBookState>({
    buyPressure: 50,
    sellPressure: 50,
    buyVolume: 0,
    sellVolume: 0,
    totalVolume: 0,
    label: "BALANCED",
    lastUpdated: null,
    isLoading: true,
  });

  const unmountedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    unmountedRef.current = false;

    const fetchOrderBook = async () => {
      try {
        const res = await fetch(ORDER_BOOK_URL, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          bids: [string, string][];
          asks: [string, string][];
        };

        if (unmountedRef.current) return;

        const buyVolume = sumQuantities(json.bids);
        const sellVolume = sumQuantities(json.asks);
        const totalVolume = buyVolume + sellVolume;

        if (totalVolume === 0) return;

        const buyPressure = Math.round((buyVolume / totalVolume) * 1000) / 10;
        const sellPressure = Math.round((100 - buyPressure) * 10) / 10;

        let label: OrderBookState["label"];
        if (buyPressure > 55) label = "BULLISH PRESSURE";
        else if (sellPressure > 55) label = "BEARISH PRESSURE";
        else label = "BALANCED";

        setState({
          buyPressure,
          sellPressure,
          buyVolume,
          sellVolume,
          totalVolume,
          label,
          lastUpdated: new Date(),
          isLoading: false,
        });
      } catch {
        // Graceful degradation — keep last known state, just mark not loading
        if (!unmountedRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: prev.lastUpdated === null,
          }));
        }
      }
    };

    // Initial fetch
    fetchOrderBook();

    // Poll every 3 seconds
    intervalRef.current = setInterval(fetchOrderBook, POLL_INTERVAL_MS);

    return () => {
      unmountedRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return state;
}
