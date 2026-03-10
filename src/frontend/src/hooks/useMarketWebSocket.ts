import { useEffect, useRef, useState } from "react";
import { useActor } from "./useActor";

export interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
}

const BINANCE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker";

const COINBASE_XAU_URL = "https://api.coinbase.com/v2/prices/XAU-USD/spot";

const DEFAULT_ASSETS: MarketAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: 67000,
    change24h: 0,
    high24h: 67500,
    low24h: 66500,
    volume: 0,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: 3500,
    change24h: 0,
    high24h: 3550,
    low24h: 3450,
    volume: 0,
  },
  {
    symbol: "XAU",
    name: "Gold",
    price: 2350,
    change24h: 0,
    high24h: 2360,
    low24h: 2340,
    volume: 0,
  },
];

export function useMarketWebSocket() {
  const { actor, isFetching } = useActor();
  const [marketData, setMarketData] = useState<MarketAsset[]>(DEFAULT_ASSETS);
  const [lastTickTimes, setLastTickTimes] = useState<Map<string, number>>(
    new Map(),
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectDelayRef = useRef(1000);
  const xauIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const xauSessionRef = useRef<{
    open: number;
    high: number;
    low: number;
  } | null>(null);
  const mountedRef = useRef(true);

  // Seed from backend on mount
  useEffect(() => {
    if (!actor || isFetching) return;
    actor
      .getMarketData()
      .then((data) => {
        if (!mountedRef.current) return;
        setMarketData((prev) => {
          const updated = [...prev];
          for (const d of data) {
            const idx = updated.findIndex((a) => a.symbol === d.symbol);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...d };
            }
          }
          return updated;
        });
      })
      .catch(() => {});
  }, [actor, isFetching]);

  // Binance WebSocket for BTC + ETH
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      const ws = new WebSocket(BINANCE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          const d = msg?.data;
          if (!d) return;
          const sym =
            d.s === "BTCUSDT" ? "BTC" : d.s === "ETHUSDT" ? "ETH" : null;
          if (!sym) return;

          const now = Date.now();
          setLastTickTimes((prev) => new Map(prev).set(sym, now));
          setMarketData((prev) =>
            prev.map((a) =>
              a.symbol === sym
                ? {
                    ...a,
                    price: Number.parseFloat(d.c),
                    change24h: Number.parseFloat(d.P),
                    high24h: Number.parseFloat(d.h),
                    low24h: Number.parseFloat(d.l),
                    volume: Number.parseFloat(d.v),
                  }
                : a,
            ),
          );
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        if (!mountedRef.current) return;
        const delay = Math.min(reconnectDelayRef.current, 30000);
        reconnectDelayRef.current = Math.min(delay * 2, 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Coinbase for XAU - poll every 3 seconds
  useEffect(() => {
    let active = true;

    async function fetchXau() {
      try {
        const res = await fetch(COINBASE_XAU_URL);
        if (!res.ok) return;
        const json = await res.json();
        const price = Number.parseFloat(json?.data?.amount);
        if (Number.isNaN(price) || !active) return;

        const now = Date.now();
        if (!xauSessionRef.current) {
          xauSessionRef.current = { open: price, high: price, low: price };
        } else {
          if (price > xauSessionRef.current.high)
            xauSessionRef.current.high = price;
          if (price < xauSessionRef.current.low)
            xauSessionRef.current.low = price;
        }

        const sessionOpen = xauSessionRef.current.open;
        const change24h =
          sessionOpen > 0 ? ((price - sessionOpen) / sessionOpen) * 100 : 0;

        setLastTickTimes((prev) => new Map(prev).set("XAU", now));
        setMarketData((prev) =>
          prev.map((a) =>
            a.symbol === "XAU"
              ? {
                  ...a,
                  price,
                  change24h,
                  high24h: xauSessionRef.current!.high,
                  low24h: xauSessionRef.current!.low,
                }
              : a,
          ),
        );
      } catch {}
    }

    fetchXau();
    xauIntervalRef.current = setInterval(fetchXau, 3000);
    return () => {
      active = false;
      if (xauIntervalRef.current) clearInterval(xauIntervalRef.current);
    };
  }, []);

  return { marketData, lastTickTimes };
}
