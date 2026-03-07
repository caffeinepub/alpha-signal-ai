import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineSignal } from "./useSignalEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Browser Web Notifications hook
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationPermission = "granted" | "denied" | "default";

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<void>;
  sendSignalNotification: (signal: EngineSignal) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (!isSupported) return "denied";
    return Notification.permission as NotificationPermission;
  });

  // Sync permission state if user changes it in browser settings
  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission as NotificationPermission);
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
    } catch {
      // Some browsers don't support the promise-based API
      Notification.requestPermission((result) => {
        setPermission(result as NotificationPermission);
      });
    }
  }, [isSupported]);

  // Dedup ref: track last fired key per symbol
  // Key format: `${symbol}-${direction}-${signalTime.getTime()}`
  const lastFiredRef = useRef<Map<string, string>>(new Map());

  const sendSignalNotification = useCallback(
    (signal: EngineSignal) => {
      // Only for actionable signals
      if (signal.direction === "WAIT") return;
      if (!isSupported) return;
      if (permission !== "granted") return;

      // Build dedup key using signalTime (locked) so we don't re-fire same lock
      const signalTimeMs = signal.signalTime?.getTime() ?? 0;
      const dedupKey = `${signal.symbol}-${signal.direction}-${signalTimeMs}`;
      const lastKey = lastFiredRef.current.get(signal.symbol);

      if (lastKey === dedupKey) {
        // Already sent this exact signal notification
        return;
      }

      // Update dedup record
      lastFiredRef.current.set(signal.symbol, dedupKey);

      // Format price
      const fmt = (p: number) =>
        p > 1000
          ? `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `$${p.toFixed(2)}`;

      const assetLabel = signal.symbol === "XAU" ? "XAU" : signal.symbol;

      const body = [
        `${assetLabel} ${signal.direction}`,
        `Entry: ${fmt(signal.entryPrice)}`,
        `Stop Loss: ${fmt(signal.stopLoss)}`,
        `Take Profit: ${fmt(signal.tp1)}`,
        `Confidence: ${signal.confidence}%`,
      ].join("\n");

      try {
        const notification = new Notification("Alpha Signal AI Alert", {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `alpha-signal-${signal.symbol}`, // replaces same-symbol notifs
          requireInteraction: false,
          silent: false,
        });

        // Auto-close after 8 seconds
        setTimeout(() => notification.close(), 8000);
      } catch {
        // Notification API can throw in some environments
      }
    },
    [isSupported, permission],
  );

  return {
    permission,
    isSupported,
    requestPermission,
    sendSignalNotification,
  };
}
