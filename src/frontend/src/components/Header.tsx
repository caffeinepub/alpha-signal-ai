import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, RefreshCw, Shield } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <header
      className="grid px-3 lg:px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30"
      style={{ gridTemplateColumns: "auto 1fr auto", alignItems: "center" }}
    >
      <style>{`
        @keyframes sunPulse {
          0% {
            filter: drop-shadow(0 0 6px rgba(255,200,0,0.8)) drop-shadow(0 0 12px rgba(255,140,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.8));
            transform: scale(1);
          }
          100% {
            filter: drop-shadow(0 0 12px rgba(255,220,0,1)) drop-shadow(0 0 24px rgba(255,160,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.8));
            transform: scale(1.05);
          }
        }
        @keyframes sunRaysRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sunShinePass {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .sun-logo-wrapper {
          animation: sunPulse 3s ease-in-out infinite alternate;
        }
        .sun-rays {
          transform-origin: 20px 20px;
          animation: sunRaysRotate 8s linear infinite;
        }
        .sun-shine {
          transform-origin: 20px 20px;
          animation: sunShinePass 6s linear infinite;
        }
      `}</style>

      {/* LEFT: menu toggle (mobile only) */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle sidebar"
          data-ocid="header.menu.button"
          className="lg:invisible p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* CENTER: branding */}
      <div className="flex items-center justify-center">
        <div
          className="inline-flex items-center gap-2"
          style={{ filter: "drop-shadow(0 0 8px rgba(255,200,0,0.6))" }}
        >
          {/* 3D Glowing Sun Logo */}
          <div className="sun-logo-wrapper relative flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 flex-shrink-0">
            <svg
              viewBox="0 0 40 40"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              aria-hidden="true"
              overflow="visible"
            >
              <defs>
                <radialGradient id="sunGrad" cx="50%" cy="35%" r="55%">
                  <stop offset="0%" stopColor="#FFF176" />
                  <stop offset="40%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FF8C00" />
                </radialGradient>
                <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFD700" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
                </radialGradient>
                <filter
                  id="sunGlow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="rayGlow"
                  x="-100%"
                  y="-100%"
                  width="300%"
                  height="300%"
                >
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient
                  id="shineGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="40%" stopColor="white" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Outer soft glow halo */}
              <circle cx="20" cy="20" r="19" fill="url(#glowGrad)" />

              {/* 8 rotating rays */}
              <g className="sun-rays" filter="url(#rayGlow)">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <rect
                    key={angle}
                    x="19"
                    y="3"
                    width="2"
                    height="5.5"
                    rx="1"
                    fill="rgba(255,200,50,0.85)"
                    transform={`rotate(${angle} 20 20)`}
                  />
                ))}
              </g>

              {/* Sun body with 3D gradient */}
              <circle
                cx="20"
                cy="20"
                r="11"
                fill="url(#sunGrad)"
                filter="url(#sunGlow)"
              />

              {/* Inner highlight for 3D depth */}
              <circle cx="17" cy="16" r="4" fill="white" opacity="0.2" />

              {/* Outer ring highlight */}
              <circle
                cx="20"
                cy="20"
                r="10.5"
                fill="none"
                stroke="rgba(255,255,200,0.5)"
                strokeWidth="0.5"
              />

              {/* Rotating shine overlay */}
              <circle
                cx="20"
                cy="20"
                r="11"
                fill="url(#shineGrad)"
                opacity="0.6"
                className="sun-shine"
              />
            </svg>
          </div>

          {/* Brand name */}
          <span
            className="text-base lg:text-lg font-bold tracking-tight"
            style={{
              background:
                "linear-gradient(90deg, #fff7e0 0%, #FFD700 40%, #ffffff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Alpha Signal AI
          </span>
        </div>
      </div>

      {/* RIGHT: refresh + admin */}
      <div className="flex items-center gap-2">
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

        <div
          data-ocid="header.user.panel"
          className="flex items-center gap-2 pl-2 border-l border-border/40"
        >
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/40">
            <Shield className="w-3 h-3 text-hold" />
            <span className="text-xs font-medium text-foreground">Admin</span>
            <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-hold/20 text-hold">
              ADMIN
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
