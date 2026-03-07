import { useQuery } from "@tanstack/react-query";
import type {
  AISignal,
  Candle,
  Gainer,
  LiquidationZone,
  MarketAsset,
  MarketSentiment,
  PerformanceStats,
  SmcSignal,
  TradeRecord,
} from "../backend.d";
import { useActor } from "./useActor";

export function useMarketData() {
  const { actor, isFetching } = useActor();
  return useQuery<MarketAsset[]>({
    queryKey: ["marketData"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.refreshMarketData();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCandlestickData(symbol: string, timeframe: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Candle[]>({
    queryKey: ["candlestick", symbol, timeframe],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCandlestickData(symbol, timeframe);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAISignals() {
  const { actor, isFetching } = useActor();
  return useQuery<AISignal[]>({
    queryKey: ["aiSignals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAISignals();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useLiquidationData(symbol: string) {
  const { actor, isFetching } = useActor();
  return useQuery<LiquidationZone[]>({
    queryKey: ["liquidation", symbol],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLiquidationData(symbol);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useMarketSentiment() {
  const { actor, isFetching } = useActor();
  return useQuery<MarketSentiment | null>({
    queryKey: ["marketSentiment"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMarketSentiment();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTopGainers() {
  const { actor, isFetching } = useActor();
  return useQuery<Gainer[]>({
    queryKey: ["topGainers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopGainers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTopLosers() {
  const { actor, isFetching } = useActor();
  return useQuery<Gainer[]>({
    queryKey: ["topLosers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopLosers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePerformanceStats() {
  const { actor, isFetching } = useActor();
  return useQuery<PerformanceStats | null>({
    queryKey: ["performanceStats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPerformanceStats();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTradeHistory() {
  const { actor, isFetching } = useActor();
  return useQuery<TradeRecord[]>({
    queryKey: ["tradeHistory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTradeHistory();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSmcSignals() {
  const { actor, isFetching } = useActor();
  return useQuery<SmcSignal[]>({
    queryKey: ["smcSignals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSmcSignals();
    },
    enabled: !!actor && !isFetching,
  });
}
