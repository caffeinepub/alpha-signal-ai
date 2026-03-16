import { ExternalLink, Star } from "lucide-react";

const SPONSORED_TOOLS = [
  {
    name: "TradingView",
    description: "Professional charts & analysis",
    url: "https://www.tradingview.com",
    badge: "Charts",
  },
  {
    name: "CoinGlass",
    description: "Liquidation & open interest data",
    url: "https://www.coinglass.com",
    badge: "Data",
  },
  {
    name: "Glassnode",
    description: "On-chain analytics & metrics",
    url: "https://glassnode.com",
    badge: "On-Chain",
  },
];

export function SponsoredToolsSection() {
  return (
    <div data-ocid="sponsored.section" className="trading-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/40">
        <Star className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs font-semibold tracking-wide">
          Sponsored Trading Tools
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          Ad
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/20">
        {SPONSORED_TOOLS.map((tool, idx) => (
          <a
            key={tool.name}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            data-ocid={`sponsored.tool.item.${idx + 1}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {tool.name}
                </span>
                <span className="px-1 py-0.5 rounded text-[8px] font-bold font-mono bg-primary/10 text-primary border border-primary/20">
                  {tool.badge}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {tool.description}
              </p>
            </div>
            <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
