import { useCallback, useEffect, useRef, useState } from "react";
import type { GeminiInstitutionalBias } from "../utils/geminiClient";
import { callGeminiInstitutionalBias } from "../utils/geminiClient";
import type { SFISignal } from "./useSFIEngine";

// Cache key = `${asset}:${signal}:${Math.floor(price/100)}`
// This prevents hammering the API on every candle tick.
// Cache TTL = 5 minutes.

const CACHE_TTL_MS = 5 * 60 * 1000;
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;
// Minimum gap between consecutive API calls (60 seconds)
const MIN_FETCH_GAP_MS = 60 * 1000;

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
  rateLimited: boolean;
}

// Hook: fetches Gemini institutional bias once per signal state change.
// Rate-limited: minimum 60s between calls, debounced to prevent retry loops.
export function useGeminiConfirmation(
  signal: SFISignal | undefined,
): GeminiConfirmationState {
  const [state, setState] = useState<GeminiConfirmationState>({
    data: null,
    loading: false,
    error: null,
    rateLimited: false,
  });

  const lastKeyRef = useRef<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  // Ref mirror of loading state so useCallback doesn't need loading in deps
  const isLoadingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBias = useCallback(async (sig: SFISignal) => {
    // Rate limit: don't fire if another fetch is in progress
    if (isLoadingRef.current) return;

    // Rate limit: enforce minimum 60s between fetches
    const now = Date.now();
    const elapsed = now - lastFetchTimeRef.current;
    if (elapsed < MIN_FETCH_GAP_MS && lastFetchTimeRef.current > 0) {
      setState((prev) => ({ ...prev, rateLimited: true }));
      return;
    }

    const key = makeCacheKey(sig.asset, sig.signal, sig.entry);
    const cached = biasCache.get(key);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      setState({
        data: cached.result,
        loading: false,
        error: null,
        rateLimited: false,
      });
      return;
    }

    lastFetchTimeRef.current = now;
    isLoadingRef.current = true;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      rateLimited: false,
    }));
    try {
      const result = await callGeminiInstitutionalBias(
        sig.asset,
        sig.signal,
        sig.entry,
        sig.rsi,
      );
      biasCache.set(key, { result, timestamp: Date.now() });
      isLoadingRef.current = false;
      setState({
        data: result,
        loading: false,
        error: null,
        rateLimited: false,
      });
    } catch (_err) {
      isLoadingRef.current = false;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "AI connection retrying...",
        rateLimited: false,
      }));
      // Wait 60 seconds before allowing retry after an error
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        lastFetchTimeRef.current = 0; // reset rate limit so next trigger can retry
      }, MIN_FETCH_GAP_MS);
    }
  }, []);

  useEffect(() => {
    if (!signal || signal.entry === 0) return;

    const key = makeCacheKey(signal.asset, signal.signal, signal.entry);

    // Trigger a new fetch when signal state changes
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      fetchBias(signal);
    }

    // Background refresh every 5 minutes
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (signal) fetchBias(signal);
    }, REFETCH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [signal, fetchBias]);

  return state;
}
