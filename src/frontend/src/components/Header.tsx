import { useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="pl-12 lg:pl-0">
        <h1 className="text-base lg:text-lg font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
          <span className="text-foreground">
            {time.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
    </header>
  );
}
