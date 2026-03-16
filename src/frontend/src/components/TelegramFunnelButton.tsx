import { Send } from "lucide-react";

export function TelegramFunnelButton() {
  return (
    <a
      href="https://t.me/alphasignalai"
      target="_blank"
      rel="noopener noreferrer"
      data-ocid="telegram.funnel.button"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#229ED9] text-xs font-bold font-mono transition-all"
    >
      <Send className="w-3.5 h-3.5" />
      Join Free Signals on Telegram
    </a>
  );
}
