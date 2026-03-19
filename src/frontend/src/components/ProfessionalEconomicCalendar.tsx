import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { callGeminiRaw } from "../utils/geminiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImpactLevel = "high" | "medium" | "low";

interface CalendarEvent {
  id: string;
  event: string;
  country: string;
  currency: string;
  date: string;
  time: string;
  impact: ImpactLevel;
  previous: string;
  forecast: string;
  actual: string;
  datetime: Date;
}

type FilterTab = "all" | "high" | "usd" | "crypto";
type Section = "live" | "upcoming" | "completed";

interface SectionedEvents {
  live: CalendarEvent[];
  upcoming: CalendarEvent[];
  completed: CalendarEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyEvent(event: CalendarEvent, now: Date): Section {
  const diff = (event.datetime.getTime() - now.getTime()) / 1000 / 60;
  if (diff >= -5 && diff <= 15) return "live";
  if (diff > 15) return "upcoming";
  return "completed";
}

function formatCountdown(event: CalendarEvent, now: Date): string {
  const diffMs = event.datetime.getTime() - now.getTime();
  if (diffMs <= 0) return "";
  const totalSecs = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (totalSecs < 300)
    return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (h > 0)
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function impactClass(impact: ImpactLevel) {
  if (impact === "high")
    return "text-red-400 bg-red-500/10 border border-red-500/30";
  if (impact === "medium")
    return "text-yellow-400 bg-yellow-500/10 border border-yellow-500/30";
  return "text-blue-400 bg-blue-500/10 border border-blue-500/30";
}

function impactLabel(impact: ImpactLevel) {
  if (impact === "high") return "HIGH";
  if (impact === "medium") return "MED";
  return "LOW";
}

function isCryptoRelevant(event: CalendarEvent): boolean {
  const keywords = [
    "cpi",
    "inflation",
    "interest rate",
    "fomc",
    "fed",
    "gdp",
    "nfp",
    "payroll",
    "unemployment",
    "ppi",
    "monetary",
    "federal",
    "treasury",
    "yield",
  ];
  const lower = event.event.toLowerCase();
  return keywords.some((k) => lower.includes(k)) || event.currency === "USD";
}

// ─── Fallback Data ────────────────────────────────────────────────────────────

function generateFallbackEvents(): CalendarEvent[] {
  const now = new Date();
  const addDays = (d: Date, days: number, hour = 14, min = 0) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + days);
    dt.setHours(hour, min, 0, 0);
    return dt;
  };
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const fmtTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const events: Array<Omit<CalendarEvent, "id" | "date" | "time">> = [
    {
      event: "FOMC Interest Rate Decision",
      country: "United States",
      currency: "USD",
      impact: "high",
      previous: "5.50%",
      forecast: "5.50%",
      actual: "",
      datetime: addDays(now, 1, 18, 0),
    },
    {
      event: "CPI (YoY)",
      country: "United States",
      currency: "USD",
      impact: "high",
      previous: "3.2%",
      forecast: "3.1%",
      actual: "",
      datetime: addDays(now, 2, 12, 30),
    },
    {
      event: "Non-Farm Payrolls",
      country: "United States",
      currency: "USD",
      impact: "high",
      previous: "256K",
      forecast: "175K",
      actual: "",
      datetime: addDays(now, 3, 12, 30),
    },
    {
      event: "GDP (QoQ)",
      country: "United States",
      currency: "USD",
      impact: "high",
      previous: "3.1%",
      forecast: "2.6%",
      actual: "",
      datetime: addDays(now, 4, 12, 30),
    },
    {
      event: "ECB Interest Rate Decision",
      country: "Eurozone",
      currency: "EUR",
      impact: "high",
      previous: "4.50%",
      forecast: "4.25%",
      actual: "",
      datetime: addDays(now, 5, 12, 15),
    },
    {
      event: "Retail Sales (MoM)",
      country: "United States",
      currency: "USD",
      impact: "medium",
      previous: "0.4%",
      forecast: "0.2%",
      actual: "",
      datetime: addDays(now, 6, 12, 30),
    },
    {
      event: "Unemployment Rate",
      country: "United States",
      currency: "USD",
      impact: "high",
      previous: "4.1%",
      forecast: "4.1%",
      actual: "",
      datetime: addDays(now, 7, 12, 30),
    },
    {
      event: "PPI (YoY)",
      country: "United States",
      currency: "USD",
      impact: "medium",
      previous: "1.8%",
      forecast: "1.9%",
      actual: "",
      datetime: addDays(now, 8, 12, 30),
    },
    {
      event: "BOJ Interest Rate Decision",
      country: "Japan",
      currency: "JPY",
      impact: "high",
      previous: "0.25%",
      forecast: "0.50%",
      actual: "",
      datetime: addDays(now, 9, 3, 0),
    },
    {
      event: "ISM Manufacturing PMI",
      country: "United States",
      currency: "USD",
      impact: "medium",
      previous: "49.3",
      forecast: "49.8",
      actual: "",
      datetime: addDays(now, 10, 15, 0),
    },
    {
      event: "Consumer Confidence",
      country: "United States",
      currency: "USD",
      impact: "medium",
      previous: "104.1",
      forecast: "103.0",
      actual: "",
      datetime: addDays(now, 11, 15, 0),
    },
    {
      event: "Fed Chair Powell Speech",
      country: "United States",
      currency: "USD",
      impact: "high",
      previous: "",
      forecast: "",
      actual: "",
      datetime: addDays(now, 12, 16, 30),
    },
  ];

  return events.map((e, idx) => ({
    ...e,
    id: `fallback-${idx}`,
    date: fmt(e.datetime),
    time: fmtTime(e.datetime),
  }));
}

// ─── FMP Fetch ────────────────────────────────────────────────────────────────

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const today = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Try multiple free/public sources
  const sources = [
    `https://financialmodelingprep.com/api/v3/economic_calendar?from=${fmt(today)}&to=${fmt(to)}&apikey=demo`,
    "https://financialmodelingprep.com/api/v3/economic_calendar?apikey=demo",
  ];

  for (const url of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const now = new Date();
      const events: CalendarEvent[] = raw
        .map((item: Record<string, unknown>, idx: number) => {
          const dateStr = String(item.date || "");
          const datePart = dateStr.split(" ")[0] || dateStr.split("T")[0] || "";
          const timePart = dateStr.includes(" ")
            ? dateStr.split(" ")[1]
            : dateStr.includes("T")
              ? dateStr.split("T")[1]?.slice(0, 5)
              : "00:00";
          const dt = new Date(`${datePart}T${timePart || "00:00"}:00`);

          let impact: ImpactLevel = "low";
          const imp = String(item.impact || "").toLowerCase();
          if (imp === "high") impact = "high";
          else if (imp === "medium" || imp === "med") impact = "medium";

          return {
            id: `fmp-${datePart}-${idx}`,
            event: String(item.event || "Unknown Event"),
            country: String(item.country || ""),
            currency: String(item.currency || ""),
            date: datePart,
            time: timePart || "00:00",
            impact,
            previous: item.previous != null ? String(item.previous) : "",
            forecast: item.estimate != null ? String(item.estimate) : "",
            actual: item.actual != null ? String(item.actual) : "",
            datetime: Number.isNaN(dt.getTime()) ? new Date() : dt,
          } as CalendarEvent;
        })
        // Only today and future events
        .filter(
          (e) =>
            e.datetime >=
            new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        );

      if (events.length > 0) return events;
    } catch {
      // Try next source
    }
  }

  throw new Error("All sources failed");
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: ImpactLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider ${impactClass(impact)}`}
    >
      <span
        className={`w-1 h-1 rounded-full inline-block ${impact === "high" ? "bg-red-400" : impact === "medium" ? "bg-yellow-400" : "bg-blue-400"}`}
      />
      {impactLabel(impact)}
    </span>
  );
}

function SectionDivider({
  label,
  count,
  isLive,
}: { label: string; count: number; isLive?: boolean }) {
  return (
    <tr>
      <td colSpan={11} className="py-0">
        <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border-y border-border/20">
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          )}
          <span
            className={`text-[10px] font-bold font-mono tracking-widest uppercase ${isLive ? "text-emerald-400" : "text-muted-foreground/70"}`}
          >
            {label}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40">
            · {count}
          </span>
          <div className="flex-1 h-px bg-border/20" />
        </div>
      </td>
    </tr>
  );
}

function AIAnalysisPanel({
  event,
  onClose,
}: { event: CalendarEvent; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    const prompt = `You are an institutional market analyst.

Event: "${event.event}" (${event.currency}, ${event.country})
Scheduled: ${event.date} at ${event.time} UTC
Impact Level: ${event.impact.toUpperCase()}
Previous: ${event.previous || "N/A"} | Forecast: ${event.forecast || "N/A"} | Actual: ${event.actual || "Pending"}

In 3-4 concise sentences, explain how this event is likely to affect:
1. BTC (Bitcoin)
2. Gold (XAUUSD)
3. US Dollar (DXY/USD)

Be direct and professional. Focus on cause-and-effect market mechanics.`;

    callGeminiRaw(prompt).then((result) => {
      setText(
        result ||
          "AI analysis temporarily unavailable. Please try again later.",
      );
      setLoading(false);
    });
  }, [event]);

  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <td colSpan={11} className="px-4 py-0">
        <div className="mx-1 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary tracking-wide">
                AI IMPACT ANALYSIS
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-primary animate-spin" />
              <span className="text-[10px] text-muted-foreground font-mono">
                Generating analysis...
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line font-mono">
              {text}
            </p>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

function EventRow({
  event,
  index,
  section,
  now,
  onAiToggle,
  expandedAI,
}: {
  event: CalendarEvent;
  index: number;
  section: Section;
  now: Date;
  onAiToggle: (id: string) => void;
  expandedAI: string | null;
}) {
  const isCompleted = section === "completed";
  const isLive = section === "live";
  const isExpanded = expandedAI === event.id;
  const countdown =
    !isCompleted && !isLive ? formatCountdown(event, now) : null;

  return (
    <>
      <tr
        data-ocid={`professional-calendar.item.${index + 1}`}
        className={`border-b border-border/10 hover:bg-white/[0.02] transition-colors duration-100 ${isCompleted ? "opacity-60" : ""}`}
      >
        <td className="px-3 py-2">
          <div className="text-[11px] font-medium text-foreground leading-tight max-w-[180px] truncate">
            {event.event}
          </div>
        </td>
        <td className="px-3 py-2 hidden md:table-cell">
          <span className="text-[10px] text-muted-foreground font-mono">
            {event.country}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className="text-[10px] font-bold font-mono text-foreground/80">
            {event.currency}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {event.date}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {event.time}
          </span>
        </td>
        <td className="px-3 py-2">
          <ImpactBadge impact={event.impact} />
        </td>
        <td className="px-3 py-2">
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {event.previous || "—"}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {event.forecast || "—"}
          </span>
        </td>
        <td className="px-3 py-2">
          {event.actual ? (
            <span className="text-[10px] font-bold font-mono text-emerald-400">
              {event.actual}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-3 py-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              LIVE NOW
            </span>
          ) : isCompleted ? (
            <span className="text-[10px] font-mono text-muted-foreground/50">
              {event.time}
            </span>
          ) : countdown ? (
            <span className="text-[10px] font-mono text-primary/80">
              in {countdown}
            </span>
          ) : null}
        </td>
        <td className="px-3 py-2">
          <button
            type="button"
            data-ocid={`professional-calendar.ai_button.${index + 1}`}
            onClick={() => onAiToggle(event.id)}
            className={`p-1 rounded transition-colors duration-150 ${isExpanded ? "text-primary bg-primary/20" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10"}`}
            title="AI Impact Analysis"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <Brain className="w-3 h-3" />
            )}
          </button>
        </td>
      </tr>
      <AnimatePresence>
        {isExpanded && (
          <AIAnalysisPanel event={event} onClose={() => onAiToggle(event.id)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfessionalEconomicCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [now, setNow] = useState(new Date());
  const [nextRefresh, setNextRefresh] = useState(300);
  const [expandedAI, setExpandedAI] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCountRef = useRef(300);

  const loadEvents = useCallback(async (isRetry = false) => {
    if (!isRetry) {
      setLoading(true);
      setError(false);
      setUsingFallback(false);
      setRetryIn(null);
    }
    try {
      const data = await fetchCalendarEvents();
      setEvents(data);
      setError(false);
      setUsingFallback(false);
      setRetryIn(null);
      setNextRefresh(300);
      refreshCountRef.current = 300;
    } catch {
      // On failure, use fallback data and schedule retry in 10s
      setUsingFallback(true);
      setError(false); // Don't show error — show fallback
      const fallback = generateFallbackEvents();
      setEvents(fallback);

      // Retry after 10 seconds
      let countdown = 10;
      setRetryIn(countdown);
      retryRef.current = setTimeout(() => {
        setRetryIn(null);
        loadEvents(true);
      }, 10_000);
      const retryCountdown = setInterval(() => {
        countdown -= 1;
        setRetryIn(countdown > 0 ? countdown : null);
        if (countdown <= 0) clearInterval(retryCountdown);
      }, 1000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [loadEvents]);

  useEffect(() => {
    refreshRef.current = setInterval(() => loadEvents(), 300_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [loadEvents]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNow(new Date());
      refreshCountRef.current -= 1;
      if (refreshCountRef.current < 0) refreshCountRef.current = 300;
      setNextRefresh(refreshCountRef.current);
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleAiToggle = useCallback((id: string) => {
    setExpandedAI((prev) => (prev === id ? null : id));
  }, []);

  const filteredEvents = events.filter((e) => {
    if (filter === "high") return e.impact === "high";
    if (filter === "usd") return e.currency === "USD";
    if (filter === "crypto") return isCryptoRelevant(e);
    return true;
  });

  const sectioned: SectionedEvents = { live: [], upcoming: [], completed: [] };
  for (const e of filteredEvents) {
    sectioned[classifyEvent(e, now)].push(e);
  }
  sectioned.upcoming.sort(
    (a, b) => a.datetime.getTime() - b.datetime.getTime(),
  );
  sectioned.live.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  sectioned.completed.sort(
    (a, b) => b.datetime.getTime() - a.datetime.getTime(),
  );

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All Events" },
    { key: "high", label: "High Impact" },
    { key: "usd", label: "USD Events" },
    { key: "crypto", label: "Crypto Impact" },
  ];

  const fmtRefresh = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <motion.div
      data-ocid="professional-calendar.panel"
      className="bg-card/50 backdrop-blur border border-border/50 rounded-xl overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground tracking-wide">
            Professional Economic Calendar
          </span>
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-[9px] font-bold font-mono text-primary tracking-widest">
              LIVE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {usingFallback && retryIn !== null && (
            <span className="text-[9px] font-mono text-yellow-400/70">
              retrying in {retryIn}s
            </span>
          )}
          {!loading && !error && !usingFallback && (
            <span className="text-[9px] font-mono text-muted-foreground/60">
              refresh in {fmtRefresh(nextRefresh)}
            </span>
          )}
          <Button
            data-ocid="professional-calendar.refresh_button"
            variant="ghost"
            size="sm"
            onClick={() => loadEvents()}
            disabled={loading}
            className="h-6 px-2 text-[10px] gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Fallback notice */}
      {usingFallback && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-500/5 border-b border-yellow-500/20">
          <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
          <span className="text-[10px] font-mono text-yellow-400/80">
            Live feed unavailable — showing scheduled events.{" "}
            {retryIn !== null ? `Retrying in ${retryIn}s...` : ""}
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            data-ocid="professional-calendar.filter.tab"
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded text-[10px] font-bold font-mono tracking-wide transition-all duration-150 ${
              filter === key
                ? key === "high"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-primary/20 text-primary border border-primary/40"
                : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div
          data-ocid="professional-calendar.loading_state"
          className="flex items-center justify-center gap-2 py-12"
        >
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-[11px] font-mono text-muted-foreground">
            Loading economic calendar...
          </span>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[500px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-card/90 backdrop-blur">
              <tr className="border-b border-border/30">
                {[
                  "Event",
                  "Country",
                  "CCY",
                  "Date",
                  "Time",
                  "Impact",
                  "Prev",
                  "Fcst",
                  "Actual",
                  "Countdown",
                  "AI",
                ].map((col, i) => (
                  <th
                    key={col}
                    className={`px-3 py-2 text-left text-[9px] font-bold text-muted-foreground/60 font-mono tracking-widest uppercase ${i === 1 ? "hidden md:table-cell" : ""}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectioned.live.length > 0 && (
                <>
                  <SectionDivider
                    label="Live Now"
                    count={sectioned.live.length}
                    isLive
                  />
                  {sectioned.live.map((ev, idx) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      index={idx}
                      section="live"
                      now={now}
                      onAiToggle={handleAiToggle}
                      expandedAI={expandedAI}
                    />
                  ))}
                </>
              )}
              {sectioned.upcoming.length > 0 && (
                <>
                  <SectionDivider
                    label="Upcoming Events"
                    count={sectioned.upcoming.length}
                  />
                  {sectioned.upcoming.map((ev, idx) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      index={idx}
                      section="upcoming"
                      now={now}
                      onAiToggle={handleAiToggle}
                      expandedAI={expandedAI}
                    />
                  ))}
                </>
              )}
              {sectioned.completed.length > 0 && (
                <>
                  <SectionDivider
                    label="Completed"
                    count={sectioned.completed.length}
                  />
                  {sectioned.completed.map((ev, idx) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      index={idx}
                      section="completed"
                      now={now}
                      onAiToggle={handleAiToggle}
                      expandedAI={expandedAI}
                    />
                  ))}
                </>
              )}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <span className="text-[11px] font-mono text-muted-foreground/50">
                      No events match the current filter.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/20 bg-white/[0.01]">
        <span className="text-[9px] text-muted-foreground/40 font-mono">
          Source: Financial Modeling Prep · Auto-refresh every 5 min · Times in
          UTC
        </span>
      </div>
    </motion.div>
  );
}
