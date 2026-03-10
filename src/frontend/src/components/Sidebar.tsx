import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

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
  { icon: Zap, label: "Signals", path: "/signals", ocid: "nav.signals.link" },
  {
    icon: BarChart3,
    label: "Performance",
    path: "/performance",
    ocid: "nav.performance.link",
  },
];

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/20 border border-primary/40">
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

      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-ocid={item.ocid}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border">
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
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-card border border-border text-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
        data-ocid="nav.sidebar.toggle"
      >
        <Menu className="w-5 h-5" />
      </button>

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

      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 z-40 h-full w-60 bg-sidebar border-r border-sidebar-border transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>

      <aside className="hidden lg:flex flex-col w-60 h-screen bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
}
