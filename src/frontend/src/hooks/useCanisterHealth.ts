import { useEffect, useRef, useState } from "react";
import { useActor } from "./useActor";

// Ping interval when canister is healthy (30s)
const HEALTHY_INTERVAL_MS = 30_000;
// Retry interval when canister is offline (10s aggressive retry)
const OFFLINE_RETRY_MS = 10_000;

export function useCanisterHealth() {
  const { actor } = useActor();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const actorRef = useRef(actor);
  actorRef.current = actor;

  useEffect(() => {
    mountedRef.current = true;

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function ping() {
      if (!actorRef.current || !mountedRef.current) return;
      try {
        await actorRef.current.healthCheck();
        if (mountedRef.current) {
          setIsOnline(true);
          clearTimer();
          timerRef.current = setTimeout(ping, HEALTHY_INTERVAL_MS);
        }
      } catch {
        if (mountedRef.current) {
          setIsOnline(false);
          clearTimer();
          timerRef.current = setTimeout(ping, OFFLINE_RETRY_MS);
        }
      }
    }

    if (actor) {
      ping();
    }

    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [actor]);

  return { isOnline };
}
