import { ExternalLink } from "lucide-react";
import { useActor } from "../hooks/useActor";

interface Exchange {
  name: string;
  label: string;
  url: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const EXCHANGES: Exchange[] = [
  {
    name: "binance",
    label: "Trade on Binance",
    url: "https://www.binance.com/en/trade",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10 hover:bg-yellow-400/20",
    borderColor: "border-yellow-400/30",
  },
  {
    name: "bybit",
    label: "Trade on Bybit",
    url: "https://www.bybit.com/trade",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10 hover:bg-orange-400/20",
    borderColor: "border-orange-400/30",
  },
  {
    name: "okx",
    label: "Trade on OKX",
    url: "https://www.okx.com/trade",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10 hover:bg-blue-400/20",
    borderColor: "border-blue-400/30",
  },
];

interface Props {
  assetSymbol: string;
}

export function AffiliateLinksSection({ assetSymbol }: Props) {
  const { actor } = useActor();

  const handleClick = async (exchange: Exchange) => {
    if (actor) {
      try {
        await actor.trackAffiliateClick(exchange.name, assetSymbol);
      } catch {
        // Silent fail - tracking is non-critical
      }
    }
    window.open(exchange.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {EXCHANGES.map((exchange) => (
        <button
          key={exchange.name}
          type="button"
          data-ocid={`affiliate.${exchange.name}.button`}
          onClick={() => handleClick(exchange)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold font-mono border transition-all ${
            exchange.bgColor
          } ${exchange.borderColor} ${exchange.color}`}
        >
          {exchange.label}
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
      ))}
    </div>
  );
}
