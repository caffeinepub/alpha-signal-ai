import { useCallback, useEffect, useRef, useState } from "react";
import type { GeminiInstitutionalBias } from "../utils/geminiClient";
import { callGeminiInstitutionalBias } from "../utils/geminiClient";
import type { SFISignal } from "./useSFIEngine";

// Cache key = `${asset}:${signal}:${Math.floor(price/100)}`
// This prevents hammering the API on every candle tick.
// Cache TTL = 3 minutes.

const CACHE_TTL_MS = 3 * 60 * 1000;
const REFETCH_INTERVAL_MS = 3 * 60 * 1000;

interface CacheEntry {
  result: GeminiInstitutionalBias;
  timestamp: number;
}

const biasCache = new Map<string, CacheEntry>();

function makeCacheKey(asset: string, signal: string, price: number): string {
  // Round price to 3 sig figs so small ticks don't bust the cache
  const priceKey =
    Math.round(price / Math.max(1, price * 0.001)) * Math.max(1, price * 0.001);
  return `${asset}:${signal}:${Math.round(priceKey / 100)}`;
}

export interface GeminiConfirmationState {
  data: GeminiInstitutionalBias | null;
  loading: boolean;
  error: string | null;
}

// Hook: fetches Gemini institutional bias once per signal state change.
// Updates every 3 minutes in the background.
export function useGeminiConfirmation(
  signal: SFISignal | undefined,
): GeminiConfirmationState {
  const [state, setState] = useState<GeminiConfirmationState>({
    data: null,
    loading: false,
    error: null,
  });

  const lastKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async (sig: SFISignal) => {
    const key = makeCacheKey(sig.asset, sig.signal, sig.entry);
    const cached = biasCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setState({ data: cached.result, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await callGeminiInstitutionalBias(
        sig.asset,
        sig.signal,
        sig.entry,
        sig.rsi,
      );
      biasCache.set(key, { result, timestamp: Date.now() });
      setState({ data: result, loading: false, error: null });
    } catch (_err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Confirmation unavailable",
      }));
    }
  }, []);

  useEffect(() => {
    if (!signal || signal.entry === 0) return;

    const key = makeCacheKey(signal.asset, signal.signal, signal.entry);

    // Trigger a new fetch when signal state changes
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      fetch(signal);
    }

    // Background refresh every 3 minutes
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (signal) fetch(signal);
    }, REFETCH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [signal, fetch]);

  return state;
}
