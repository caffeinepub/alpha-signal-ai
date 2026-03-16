# Alpha Signal AI

## Current State
The Economic Calendar exists as `EconomicCalendarPanel.tsx` with basic FMP API fetch, static fallback events, impact color coding, filter tabs, and Gemini AI explanation per event. It lacks: real-time section grouping (Upcoming/Live/Completed), countdown timers per event, 5-minute auto-refresh, and a polished card+table layout.

## Requested Changes (Diff)

### Add
- `ProfessionalEconomicCalendar.tsx` — new component replacing/superseding EconomicCalendarPanel
- Three sections: Upcoming Events, Live Events (starting within 15 min), Completed Events (past)
- Countdown timer per event showing `XXh XXm` or `XXm XXs` for near events
- 5-minute auto-refresh interval (down from 10 min)
- Live countdown ticking every second
- Section headers with event counts
- Event cards in table layout with all required fields

### Modify
- `EconomicCalendarPanel.tsx` — replace its usage on Dashboard with the new component
- Auto-refresh interval: 600s → 300s
- Impact colors: high=red, medium=yellow, low=blue (already present, kept)
- Gemini AI analysis per event (already present, enhanced inline)

### Remove
- Static STATIC_EVENTS fallback — keep only the API call with a graceful error message if API fails

## Implementation Plan
1. Create `src/frontend/src/components/ProfessionalEconomicCalendar.tsx`
   - Fetch from FMP economic calendar API (demo key), fall back gracefully to error message
   - Parse event datetime, compare to `new Date()` to bucket into Upcoming/Live/Completed
   - Countdown timer with `setInterval` every second
   - 5-minute auto-refresh for data
   - Three collapsible sections with counts
   - Table layout with: Event, Country, Currency, Date, Time, Impact badge, Previous, Forecast, Actual, Countdown, AI button
   - Gemini AI analysis inline (same `callGeminiRaw` pattern)
   - Error state: "Economic calendar data temporarily unavailable."
2. Update Dashboard to use `ProfessionalEconomicCalendar` instead of `EconomicCalendarPanel`
