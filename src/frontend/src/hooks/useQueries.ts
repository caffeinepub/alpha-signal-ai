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
export function useTopGainers() {
  return useQuery<Gainer[]>({
    queryKey: ["topGainers"],
    queryFn: async () => [],
    enabled: false,
  });
}
export function useTopLosers() {
  return useQuery<Gainer[]>({
    queryKey: ["topLosers"],
    queryFn: async () => [],
    enabled: false,
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
