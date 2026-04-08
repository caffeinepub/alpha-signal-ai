import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Flame,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Play,
  Radio,
  Shield,
  X,
  Zap,
} from "lucide-react";

const navItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/",
    ocid: "nav.dashboard.link",
  },
  {
    icon: LineChart,
    label: "Charts",
    path: "/charts",
    ocid: "nav.charts.link",
  },
  {
    icon: Zap,
    label: "AI Signals",
    path: "/signals",
    ocid: "nav.signals.link",
  },
  {
    icon: MessageSquare,
    label: "Chat",
    path: "/chat",
    ocid: "nav.chat.link",
  },
  {
    icon: Flame,
    label: "Liquidation",
    path: "/liquidation",
    ocid: "nav.liquidation.link",
  },
  {
    icon: BarChart3,
    label: "Performance",
    path: "/performance",
    ocid: "nav.performance.link",
  },
  {
    icon: FlaskConical,
    label: "Research",
    path: "/research",
    ocid: "nav.research.link",
  },
  {
    icon: Play,
    label: "Videos",
    path: "/videos",
    ocid: "nav.videos.link",
  },
  {
    icon: Shield,
    label: "Admin Panel",
    path: "/admin",
    ocid: "nav.admin.link",
  },
];

interface SidebarProps {
  currentPath: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  currentPath,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/20 border border-primary/40 glow-cyan">
          <Zap className="w-5 h-5 text-primary" fill="currentColor" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground tracking-tight leading-none">
            Alpha Signal
          </div>
          <div className="text-xs font-semibold text-primary tracking-widest uppercase leading-none mt-0.5">
            AI
          </div>
        </div>
        <button
          type="button"
          className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Live Status */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Radio className="w-3.5 h-3.5 text-bull" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-bull rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-mono font-semibold text-bull tracking-widest uppercase">
            LIVE
          </span>
          <span className="text-[9px] font-mono text-primary/70 ml-1 tracking-wide">
            GEMINI 1.5 FLASH
          </span>
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {new Date().toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems
          .filter((item) => item.path !== "/admin" || isAdmin)
          .map((item) => {
            const isActive =
              item.path === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.path);
            const Icon = item.icon;
            const isAdminItem = item.path === "/admin";
            return (
              <Link
                key={item.path}
                to={item.path}
                data-ocid={item.ocid}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? isAdminItem
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-primary/15 text-primary border border-primary/30 glow-cyan"
                    : isAdminItem
                      ? "text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    isActive
                      ? isAdminItem
                        ? "text-amber-400"
                        : "text-primary"
                      : isAdminItem
                        ? "text-amber-400/70 group-hover:text-amber-400"
                        : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span>{item.label}</span>
                {isActive && (
                  <div
                    className={cn(
                      "ml-auto w-1.5 h-1.5 rounded-full",
                      isAdminItem ? "bg-amber-400" : "bg-primary",
                    )}
                  />
                )}
              </Link>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border space-y-1">
        <div className="text-[10px] text-muted-foreground text-center">
          © {new Date().getFullYear()}{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </div>
        <div className="text-[10px] text-muted-foreground/60 text-center flex items-center justify-center gap-1.5 flex-wrap">
          <a
            href="/privacy-policy"
            className="hover:text-primary transition-colors underline underline-offset-2"
            data-ocid="nav.privacy_policy.link"
          >
            Privacy Policy
          </a>
          <span>·</span>
          <a
            href="/terms"
            className="hover:text-primary transition-colors underline underline-offset-2"
            data-ocid="nav.terms.link"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMobileOpen(false);
          }}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 z-40 h-full w-60 bg-sidebar border-r border-sidebar-border transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>

      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex flex-col w-60 h-screen bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
}
