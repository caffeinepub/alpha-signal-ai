import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

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
          <span>Updated:</span>
          <span className="text-foreground">
            {time.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          data-ocid="header.refresh.button"
          onClick={handleRefresh}
          className="border-border hover:border-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 h-8 px-2"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline ml-1.5 text-xs">Refresh</span>
        </Button>
      </div>
    </header>
  );
}
