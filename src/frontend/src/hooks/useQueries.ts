import { useQuery } from "@tanstack/react-query";

// Local type stubs for missing backend types
export interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
}
export interface AISignal {
  id: string;
  symbol: string;
  signal: string;
  confidence: number;
  timestamp: number;
  direction: string;
  riskLevel: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
}
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface Gainer {
  symbol: string;
  name: string;
  change: number;
  price: number;
  changePercent: number;
}
export interface LiquidationZone {
  price: number;
  size: number;
  side: string;
  priceLevel: number;
  longLiquidations: number;
  shortLiquidations: number;
  intensity: number;
}
export interface MarketSentiment {
  score: number;
  label: string;
  fearGreedIndex: number;
  fearGreedLabel: string;
}
export interface PerformanceStats {
  totalTrades: number;
  winRate: number;
  pnl: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
}
export interface SmcSignal {
  id: string;
  signal: string;
  level: number;
}
export interface TradeRecord {
  id: string;
  symbol: string;
  pnl: number;
  timestamp: number;
  entryPrice: number;
  exitPrice: number;
  direction: string;
  size: number;
  pnlPercent: number;
  outcome: string;
}

export function useMarketData() {
  return useQuery<MarketAsset[]>({
    queryKey: ["marketData"],
    queryFn: async () => [],
    enabled: false,
  });
}
export function useCandlestickData(_symbol: string, _timeframe: string) {
  return useQuery<Candle[]>({
    queryKey: ["candlestick"],
    queryFn: async () => [],
    enabled: false,
  });
}
export function useAISignals() {
  return useQuery<AISignal[]>({
    queryKey: ["aiSignals"],
    queryFn: async () => [],
    enabled: false,
  });
}
export function useLiquidationData(_symbol: string) {
  return useQuery<LiquidationZone[]>({
    queryKey: ["liquidation"],
    queryFn: async () => [],
    enabled: false,
  });
}
export function useMarketSentiment() {
  return useQuery<MarketSentiment | null>({
    queryKey: ["sentiment"],
    queryFn: async () => null,
    enabled: false,
  });
}

// ── Binance 24h Ticker — Top Gainers & Losers ──────────────────────────────
// Uses Binance GET /api/v3/ticker/24hr to fetch all USDT pairs,
// then sorts by change % to get top gainers and top losers.

interface BinanceTicker {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  quoteVolume: string;
}

async function fetchBinanceMovers(): Promise<{
  gainers: Gainer[];
  losers: Gainer[];
}> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Binance ticker failed: ${res.status}`);
  const data: BinanceTicker[] = await res.json();

  // Filter USDT pairs only, exclude stablecoins, min volume filter
  const filtered = data.filter((t) => {
    if (!t.symbol.endsWith("USDT")) return false;
    const vol = Number.parseFloat(t.quoteVolume);
    if (vol < 1_000_000) return false; // min $1M 24h volume
    const sym = t.symbol.replace("USDT", "");
    // Exclude stablecoins
    const stables = ["USDC", "BUSD", "TUSD", "FDUSD", "DAI", "USDP", "SUSD"];
    if (stables.includes(sym)) return false;
    return true;
  });

  const toGainer = (t: BinanceTicker): Gainer => ({
    symbol: t.symbol.replace("USDT", ""),
    name: t.symbol.replace("USDT", "/USDT"),
    change: Number.parseFloat(t.priceChangePercent),
    price: Number.parseFloat(t.lastPrice),
    changePercent: Number.parseFloat(t.priceChangePercent),
  });

  const sorted = [...filtered].sort(
    (a, b) =>
      Number.parseFloat(b.priceChangePercent) -
      Number.parseFloat(a.priceChangePercent),
  );

  const gainers = sorted.slice(0, 10).map(toGainer);
  const losers = sorted.slice(-10).reverse().map(toGainer);

  return { gainers, losers };
}

export function useTopGainers() {
  return useQuery<Gainer[]>({
    queryKey: ["topGainers"],
    queryFn: async () => {
      const { gainers } = await fetchBinanceMovers();
      return gainers;
    },
    staleTime: 60_000, // cache for 60 seconds
    refetchInterval: 60_000, // refresh every 60 seconds
    retry: 2,
  });
}

export function useTopLosers() {
  return useQuery<Gainer[]>({
    queryKey: ["topLosers"],
    queryFn: async () => {
      const { losers } = await fetchBinanceMovers();
      return losers;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });
}

export function usePerformanceStats() {
  return useQuery<PerformanceStats | null>({
    queryKey: ["performanceStats"],
    queryFn: async () => null,
    enabled: false,
  });
}
export function useTradeHistory() {
  return useQuery<TradeRecord[]>({
    queryKey: ["tradeHistory"],
    queryFn: async () => [],
    enabled: false,
  });
}
export function useSmcSignals() {
  return useQuery<SmcSignal[]>({
    queryKey: ["smcSignals"],
    queryFn: async () => [],
    enabled: false,
  });
}
