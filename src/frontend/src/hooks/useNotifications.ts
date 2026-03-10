import { useEffect, useRef } from "react";
import type { SignalResult } from "./useSignalEngine";

const sentNotificationsRef: Set<string> = new Set();

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else if (typeof Notification !== "undefined") {
      permissionRef.current = Notification.permission;
    }
  }, []);

  function notifySignal(signal: SignalResult) {
    if (signal.type === "WAIT") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const key = `${signal.symbol}-${signal.lockedAt}`;
    if (sentNotificationsRef.has(key)) return;
    sentNotificationsRef.add(key);

    const dir = signal.type;
    const entry = signal.entryPrice.toFixed(2);
    const sl = signal.stopLoss.toFixed(2);
    const tp = signal.takeProfit1.toFixed(2);
    const conf = Math.round(signal.confidence);

    new Notification("Alpha Signal AI Alert", {
      body: `${signal.symbol} STRONG ${dir}\nEntry: $${entry}\nStop Loss: $${sl}\nTake Profit: $${tp}\nConfidence: ${conf}%`,
      icon: "/assets/generated/logo.png",
      tag: key,
    });
  }

  return { notifySignal };
}
