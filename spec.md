# Alpha Signal AI — 4 Critical Updates

## Current State

- **Admin lockdown**: `useAdminGate.ts` hardcodes `ADMIN_EMAIL = "prakash.brjn01@gmail.com"` and `ADMIN_SECRET_KEY = "AlphaSignal2024!"`. `AdminGate.tsx` shows a lock screen. However, `Sidebar.tsx` renders the Admin Panel nav item unconditionally for all users — it does not check if the user is admin. The `VideosPage.tsx` admin upload button visibility must also be verified.
- **Economic Calendar**: `ProfessionalEconomicCalendar.tsx` fetches from Financial Modeling Prep (demo key) with CORS proxy fallback. On failure it shows fallback events and retries every 30s. The 'Live Feed Unavailable' yellow warning appears when `consecutiveFailuresRef.current >= 2`. This is fine logic but the TradingView RSS fallback is missing.
- **Liquidation Heatmap**: `useLiquidationData.ts` connects to `wss://fstream.binance.com/ws` and subscribes to `btcusdt@forceOrder`. It has a simulation fallback. The WebSocket is already implemented correctly — but the Binance Futures Public WS may be blocked in certain environments. The hook needs to ensure it is robust.
- **SFI Canvas Overlay**: `SFICanvasOverlay.tsx` — already clean with no Supply/Demand zones. Dark cloud at 60% opacity (emerald/red) with EMA 200 and BUY/SELL labels is already implemented correctly. No changes needed.
- **Privacy Policy**: `PrivacyPolicy.tsx` exists with Risk Disclaimer. The `/privacy-policy` route is registered in `App.tsx`.
- **PWA**: `manifest.json` exists with `"display": "standalone"`. `index.html` has the manifest link and Apple meta tags. Already implemented.

## Requested Changes (Diff)

### Add
- Add admin-gate visibility to the Sidebar so the Admin Panel menu item only shows when `isAdminVerified === true` from `useAdminGate`. Currently the sidebar shows the Admin Panel to everyone.
- Add a footer to `PrivacyPolicy.tsx` with a link back to the dashboard (already has one but confirm it is accessible from the main layout footer/sidebar).
- Ensure `VideosPage.tsx` admin upload button is gated by `useAdminGate`'s `isAdminVerified`.

### Modify
- **Sidebar.tsx**: Import `useAdminGate` and only render the Admin Panel nav item if `isAdminVerified === true`.
- **ProfessionalEconomicCalendar.tsx**: Add a TradingView Economic Calendar RSS feed (`https://www.tradingview.com/economic-calendar/`) as an additional fallback source alongside the FMP sources. Since RSS is CORS-blocked, use `allorigins.win` proxy to fetch it. If all live sources fail, continue showing fallback events silently with "Syncing..." instead of the yellow warning after repeated failures.
- **useLiquidationData.ts**: Ensure the Binance Futures WebSocket connection is as robust as possible. Add a keep-alive ping every 30 seconds to prevent the connection from being dropped silently. Ensure the simulation fallback starts immediately so the UI never shows a blank/empty state.
- **useAdminGate.ts**: Already correct — no changes needed.
- **AdminDashboard.tsx**: Already gated by `AdminGate` component — confirm `useAdminGate` is used to show/hide admin actions (video upload, user management) within the page.

### Remove
- Nothing to remove — SFI canvas overlay is already clean. Privacy policy and PWA are already present.

## Implementation Plan

1. **Sidebar admin visibility**: In `Sidebar.tsx`, call `useAdminGate()` to get `isAdminVerified`. Filter out the Admin Panel nav item if `!isAdminVerified`. This is the most critical missing piece.

2. **Economic Calendar fallback improvement**: In `ProfessionalEconomicCalendar.tsx`, suppress the yellow 'Live Feed Unavailable' warning — replace it with a clean 'Syncing...' spinner for all fallback states. The fallback events are already good. Remove the aggressive yellow warning after 2+ consecutive failures, replacing with the gentler syncing state.

3. **Liquidation WebSocket keep-alive**: In `useLiquidationData.ts`, add a 30-second ping interval when connected (`ws.send(JSON.stringify({ method: "LIST_SUBSCRIPTIONS", id: 2 }))`) to keep the connection alive. Ensure simulation starts immediately on mount (not just after WS connect attempt) so data appears instantly.

4. **Video upload gate**: In `VideosPage.tsx`, import `useAdminGate` and use `isAdminVerified` to conditionally show the 'Add Video' button and delete buttons.

5. **Validation**: Run lint, typecheck, and build — fix any errors before declaring done.
