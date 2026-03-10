import { useEffect, useRef, useState } from "react";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const MAX_CANDLES = 200;

function parseRestCandles(raw: number[][]): Candle[] {
  return raw.map((k) => ({
    time: k[0],
    open: Number.parseFloat(String(k[1])),
    high: Number.parseFloat(String(k[2])),
    low: Number.parseFloat(String(k[3])),
    close: Number.parseFloat(String(k[4])),
    volume: Number.parseFloat(String(k[5])),
  }));
}

export function useBinanceKlines() {
  const [btcCandles, setBtcCandles] = useState<Candle[]>([]);
  const [ethCandles, setEthCandles] = useState<Candle[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(1000);
  const mountedRef = useRef(true);

  // Fetch REST history
  useEffect(() => {
    async function fetchHistory() {
      try {
        const [btcRes, ethRes] = await Promise.all([
          fetch(
            "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=200",
          ),
          fetch(
            "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1m&limit=200",
          ),
        ]);
        const [btcData, ethData] = await Promise.all([
          btcRes.json(),
          ethRes.json(),
        ]);
        if (mountedRef.current) {
          setBtcCandles(parseRestCandles(btcData));
          setEthCandles(parseRestCandles(ethData));
        }
      } catch {}
    }
    fetchHistory();
  }, []);

  // WebSocket kline stream
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      const ws = new WebSocket(
        "wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/ethusdt@kline_1m",
      );
      wsRef.current = ws;

      ws.onopen = () => {
        delayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          const k = msg?.data?.k;
          if (!k || !k.x) return; // Only closed candles

          const candle: Candle = {
            time: k.t,
            open: Number.parseFloat(k.o),
            high: Number.parseFloat(k.h),
            low: Number.parseFloat(k.l),
            close: Number.parseFloat(k.c),
            volume: Number.parseFloat(k.v),
          };

          const sym = msg?.data?.s;
          if (sym === "BTCUSDT") {
            setBtcCandles((prev) => {
              const next = [...prev.slice(-MAX_CANDLES + 1), candle];
              return next;
            });
          } else if (sym === "ETHUSDT") {
            setEthCandles((prev) => {
              const next = [...prev.slice(-MAX_CANDLES + 1), candle];
              return next;
            });
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        if (!mountedRef.current) return;
        const delay = Math.min(delayRef.current, 30000);
        delayRef.current = Math.min(delay * 2, 30000);
        reconnectRef.current = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []);

  return { btcCandles, ethCandles };
}
