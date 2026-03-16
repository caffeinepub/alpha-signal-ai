import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { callGeminiRaw } from "../utils/geminiClient";

interface CalendarEvent {
  id: string;
  event: string;
  country: string;
  currency: string;
  date: string;
  time: string;
  impact: "high" | "medium" | "low";
  previous: string;
  forecast: string;
  actual: string;
}

type Filter = "all" | "high" | "usd" | "crypto";

const STATIC_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    event: "FOMC Interest Rate Decision",
    country: "United States",
    currency: "USD",
    date: "2026-03-19",
    time: "18:00",
    impact: "high",
    previous: "5.50%",
    forecast: "5.25%",
    actual: "",
  },
  {
    id: "2",
    event: "CPI m/m",
    country: "United States",
    currency: "USD",
    date: "2026-03-12",
    time: "12:30",
    impact: "high",
    previous: "0.3%",
    forecast: "0.2%",
    actual: "",
  },
  {
    id: "3",
    event: "Non-Farm Payrolls",
    country: "United States",
    currency: "USD",
    date: "2026-04-04",
    time: "12:30",
    impact: "high",
    previous: "256K",
    forecast: "200K",
    actual: "",
  },
  {
    id: "4",
    event: "GDP q/q",
    country: "United States",
    currency: "USD",
    date: "2026-03-27",
    time: "12:30",
    impact: "high",
    previous: "2.1%",
    forecast: "2.0%",
    actual: "",
  },
  {
    id: "5",
    event: "Core Retail Sales m/m",
    country: "United States",
    currency: "USD",
    date: "2026-03-17",
    time: "12:30",
    impact: "medium",
    previous: "0.4%",
    forecast: "0.3%",
    actual: "",
  },
  {
    id: "6",
    event: "Fed Chair Powell Speaks",
    country: "United States",
    currency: "USD",
    date: "2026-03-15",
    time: "16:00",
    impact: "high",
    previous: "",
    forecast: "",
    actual: "",
  },
  {
    id: "7",
    event: "ECB Interest Rate Decision",
    country: "Euro Zone",
    currency: "EUR",
    date: "2026-03-20",
    time: "12:15",
    impact: "high",
    previous: "3.15%",
    forecast: "2.90%",
    actual: "",
  },
  {
    id: "8",
    event: "UK CPI y/y",
    country: "United Kingdom",
    currency: "GBP",
    date: "2026-03-19",
    time: "07:00",
    impact: "medium",
    previous: "2.5%",
    forecast: "2.8%",
    actual: "",
  },
  {
    id: "9",
    event: "BOJ Policy Rate",
    country: "Japan",
    currency: "JPY",
    date: "2026-03-19",
    time: "03:00",
    impact: "high",
    previous: "0.50%",
    forecast: "0.50%",
    actual: "",
  },
  {
    id: "10",
    event: "PPI m/m",
    country: "United States",
    currency: "USD",
    date: "2026-03-13",
    time: "12:30",
    impact: "medium",
    previous: "0.4%",
    forecast: "0.3%",
    actual: "",
  },
  {
    id: "11",
    event: "Unemployment Claims",
    country: "United States",
    currency: "USD",
    date: "2026-03-20",
    time: "12:30",
    impact: "low",
    previous: "220K",
    forecast: "218K",
    actual: "",
  },
  {
    id: "12",
    event: "ISM Manufacturing PMI",
    country: "United States",
    currency: "USD",
    date: "2026-04-01",
    time: "14:00",
    impact: "medium",
    previous: "50.9",
    forecast: "50.5",
    actual: "",
  },
];

function isCryptoImpactEvent(ev: CalendarEvent): boolean {
  if (ev.currency === "USD" && ev.impact === "high") return true;
  const name = ev.event.toLowerCase();
  return (
    name.includes("fomc") ||
    name.includes("fed") ||
    name.includes("cpi") ||
    name.includes("nfp") ||
    name.includes("non-farm") ||
    name.includes("gdp")
  );
}

function impactClasses(impact: CalendarEvent["impact"]) {
  if (impact === "high")
    return {
      badge: "text-red-400 bg-red-500/10 border border-red-500/30",
      dot: "bg-red-400",
      label: "HIGH",
    };
  if (impact === "medium")
    return {
      badge: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/30",
      dot: "bg-yellow-400",
      label: "MED",
    };
  return {
    badge: "text-blue-400 bg-blue-500/10 border border-blue-500/30",
    dot: "bg-blue-400",
    label: "LOW",
  };
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "All Events",
  high: "High Impact Only",
  usd: "USD Events",
  crypto: "Crypto Impact Events",
};

const REFRESH_SECONDS = 600;

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime() + 14 * 86400000)
      .toISOString()
      .split("T")[0];
    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=demo`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("non-ok");
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("empty");
    return raw.slice(0, 40).map(
      (e: any, i: number): CalendarEvent => ({
        id: String(i + 1),
        event: e.event ?? "",
        country: e.country ?? "",
        currency: e.currency ?? "",
        date: (e.date ?? "").split(" ")[0],
        time: (e.date ?? "").split(" ")[1]?.slice(0, 5) ?? e.time ?? "",
        impact: (["high", "medium", "low"].includes(e.impact?.toLowerCase())
          ? e.impact.toLowerCase()
          : "low") as CalendarEvent["impact"],
        previous: e.previous != null ? String(e.previous) : "",
        forecast: e.estimate != null ? String(e.estimate) : "",
        actual: e.actual != null ? String(e.actual) : "",
      }),
    );
  } catch {
    return [];
  }
}

export function EconomicCalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>(
    {},
  );
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState(REFRESH_SECONDS);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    const fetched = await fetchCalendarEvents();
    if (fetched.length > 0) {
      setEvents(fetched.sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      // fall back to static
      const hasReal = fetched.length > 0;
      if (!hasReal) {
        setEvents(
          [...STATIC_EVENTS].sort((a, b) => a.date.localeCompare(b.date)),
        );
      }
    }
    setIsLoading(false);
    setNextRefresh(REFRESH_SECONDS);
  }, []);

  useEffect(() => {
    load();
    refreshTimerRef.current = setInterval(load, REFRESH_SECONDS * 1000);
    countdownRef.current = setInterval(() => {
      setNextRefresh((prev) => (prev <= 1 ? REFRESH_SECONDS : prev - 1));
    }, 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [load]);

  const handleAiClick = useCallback(
    async (ev: CalendarEvent) => {
      if (expandedEventId === ev.id) {
        setExpandedEventId(null);
        return;
      }
      setExpandedEventId(ev.id);
      if (aiExplanations[ev.id]) return;
      setAiLoadingId(ev.id);
      const prompt = `You are a financial market expert. Analyze this economic event and explain its likely market impact in 3-4 sentences.

Event: ${ev.event}
Country: ${ev.country}
Currency: ${ev.currency}
Impact Level: ${ev.impact}
Previous: ${ev.previous || "N/A"}
Forecast: ${ev.forecast || "N/A"}
Actual: ${ev.actual || "Pending"}

Explain how this event could affect:
1. BTC (Bitcoin)
2. Gold (XAUUSD)
3. US Dollar (DXY)

Keep response concise and professional. Format as plain text, no markdown.`;
      const result = await callGeminiRaw(prompt);
      setAiExplanations((prev) => ({
        ...prev,
        [ev.id]: result || "Analysis temporarily unavailable.",
      }));
      setAiLoadingId(null);
    },
    [expandedEventId, aiExplanations],
  );

  const filteredEvents = events.filter((ev) => {
    if (filter === "high") return ev.impact === "high";
    if (filter === "usd") return ev.currency === "USD";
    if (filter === "crypto") return isCryptoImpactEvent(ev);
    return true;
  });

  const formatDate = (d: string) => {
    try {
      return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div
      className="bg-card/50 backdrop-blur border border-border/50 rounded-xl p-4"
      data-ocid="economic-calendar.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Economic Calendar
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Refreshes in {nextRefresh}s
          </span>
        </div>
        <button
          type="button"
          data-ocid="economic-calendar.refresh_button"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/40 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            data-ocid="economic-calendar.filter.tab"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-[10px] font-semibold border transition-all ${
              filter === f
                ? "bg-primary/20 text-primary border-primary/30"
                : "text-muted-foreground border-border/30 hover:border-border/60 hover:text-foreground"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div
          className="text-center py-8"
          data-ocid="economic-calendar.error_state"
        >
          <p className="text-sm text-muted-foreground">
            Economic calendar data temporarily unavailable
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-3 px-3 py-1.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <div className="space-y-2" data-ocid="economic-calendar.loading_state">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <Skeleton key={i} className="h-10 w-full bg-secondary/60 rounded" />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <div className="max-h-[420px] overflow-y-auto rounded border border-border/30">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 z-10 bg-card/90 backdrop-blur">
                <tr className="border-b border-border/40">
                  <th className="text-left px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Event
                  </th>
                  <th className="text-left px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap hidden md:table-cell">
                    Country
                  </th>
                  <th className="text-left px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Ccy
                  </th>
                  <th className="text-left px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Time
                  </th>
                  <th className="text-left px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Impact
                  </th>
                  <th className="text-right px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Prev
                  </th>
                  <th className="text-right px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Forecast
                  </th>
                  <th className="text-right px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    Actual
                  </th>
                  <th className="text-center px-2 py-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                    AI
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No events match this filter
                    </td>
                  </tr>
                )}
                {filteredEvents.map((ev, idx) => {
                  const ic = impactClasses(ev.impact);
                  const isExpanded = expandedEventId === ev.id;
                  const aiLoading = aiLoadingId === ev.id;
                  const aiText = aiExplanations[ev.id];
                  return (
                    <>
                      <tr
                        key={ev.id}
                        data-ocid={`economic-calendar.item.${idx + 1}`}
                        className={`border-b border-border/20 hover:bg-white/[0.02] transition-colors ${
                          isExpanded ? "bg-white/[0.03]" : ""
                        }`}
                      >
                        <td className="px-2 py-2 font-medium text-foreground max-w-[200px]">
                          <span className="line-clamp-1" title={ev.event}>
                            {ev.event}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {ev.country}
                        </td>
                        <td className="px-2 py-2 font-mono font-bold text-foreground whitespace-nowrap">
                          {ev.currency}
                        </td>
                        <td className="px-2 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {formatDate(ev.date)}
                        </td>
                        <td className="px-2 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {ev.time}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${ic.badge}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${ic.dot}`}
                            />
                            {ic.label}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {ev.previous || "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {ev.forecast || "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-mono whitespace-nowrap">
                          {ev.actual ? (
                            <span className="text-primary font-bold">
                              {ev.actual}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            data-ocid={`economic-calendar.ai_button.${idx + 1}`}
                            onClick={() => handleAiClick(ev)}
                            disabled={aiLoading}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded transition-all ${
                              isExpanded
                                ? "bg-primary/20 text-primary"
                                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            } disabled:opacity-50`}
                            title="AI market impact analysis"
                          >
                            {aiLoading ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <Brain className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr
                          key={`${ev.id}-ai`}
                          className="border-b border-border/20"
                        >
                          <td colSpan={10} className="px-3 pb-3 pt-1">
                            <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Brain className="w-3 h-3 text-primary" />
                                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                                  Gemini AI Analysis — BTC · Gold · USD Impact
                                </span>
                              </div>
                              {aiLoading || !aiText ? (
                                <div className="space-y-1.5">
                                  <Skeleton className="h-3 w-full bg-secondary/60" />
                                  <Skeleton className="h-3 w-4/5 bg-secondary/60" />
                                  <Skeleton className="h-3 w-3/5 bg-secondary/60" />
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                  {aiText}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      {!isLoading && !error && (
        <div className="mt-2 text-[10px] text-muted-foreground/50 text-right">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
          {" · "}
          Auto-refreshes every 10 minutes
        </div>
      )}
    </div>
  );
}
