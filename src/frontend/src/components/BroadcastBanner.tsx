import { X } from "lucide-react";
import { useEffect, useState } from "react";

export default function BroadcastBanner() {
  const [message, setMessage] = useState<string>("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const msg = localStorage.getItem("broadcastMessage") || "";
      setMessage(msg);
      setDismissed(false);
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!message || dismissed) return null;

  return (
    <div className="w-full bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center gap-3 text-amber-300 text-sm font-medium z-50">
      <span className="text-amber-400">📢</span>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-amber-400/60 hover:text-amber-400 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
