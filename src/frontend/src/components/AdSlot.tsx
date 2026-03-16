interface Props {
  placement: "banner" | "sidebar" | "inline";
  className?: string;
}

export function AdSlot({ placement, className = "" }: Props) {
  const heights: Record<string, string> = {
    banner: "h-12",
    sidebar: "h-60",
    inline: "h-20",
  };

  return (
    <div
      data-ocid={`ad.${placement}.panel`}
      className={`flex items-center justify-center rounded-lg border border-dashed border-border/30 bg-white/[0.015] text-muted-foreground/30 text-[10px] font-mono tracking-widest uppercase ${heights[placement]} ${className}`}
    >
      Advertisement
    </div>
  );
}
