# Alpha Signal AI

## Current State
- Admin gate uses hardcoded credentials: `prakash.brjn01@gmail.com` + `Admin@123` or legacy `AlphaSignal2024!`
- SFI engine runs on **closed candles only** (`isClosed: true` filter in `useSFIEngine.ts`) — signals lag behind TradingView
- `useBinanceKlines` only streams BTCUSDT and PAXGUSDT — EUR/USD always shows WAIT
- Admin Dashboard shows 4 cards: Total Users, Active Sessions, Admin Users, Banned Users (some are mock/ephemeral)
- Gemini Institutional Bias section has a retry loop when API fails — no dedupe/backoff guard
- Market Overview price cards update on WebSocket tick (~1s naturally) but the hook reconnect polling is 15s
- `/privacy-policy` page exists with proper Risk Disclaimer
- No `/terms` page exists
- Video admin upload is controlled by `isAdminVerified` from `useAdminGate`

## Requested Changes (Diff)

### Add
- Password `AlphaSignal2026#` as an accepted admin credential in `useAdminGate.ts`
- EURUSDT 3m and 15m WebSocket streams + REST seed in `useBinanceKlines.ts`
- On-tick SFI signal evaluation: after each WebSocket tick, synthesize a "live candle" using locked `hlc3` from historical data + live close, and re-run signal logic — this reduces lag from candle-close to real-time
- `/terms` route and `TermsOfService.tsx` page with Play Store-compliant content
- Terms link in footer/sidebar and login screens

### Modify
- `useAdminGate.ts`: accept `AlphaSignal2026#` as valid password (alongside existing `Admin@123` and `AlphaSignal2024!`)
- `useSFIEngine.ts`: add on-tick mode — accept optional `livePrices` map; when provided, synthesize an open candle from last closed candle + live price and run the state machine over it without committing to history
- `useBinanceKlines.ts`: add EURUSDT 3m and 15m to both REST seed and WebSocket stream
- `AdminDashboard.tsx`: simplify stat cards to only show **Total Users** and **Active Sessions** (remove Admin Users and Banned Users cards)
- `useGeminiConfirmation.ts`: add `isLoading` guard so parallel calls don't stack up; add 60s minimum interval between calls to prevent retry loop
- `useMarketWebSocket.ts`: force re-render every 1 second for BTC and Gold cards via a `setInterval` ticker (prices already arrive on tick, but this ensures 1s max display lag)
- `PrivacyPolicy.tsx`: add link to `/terms` at bottom; update footer link text
- `App.tsx`: add `/terms` route
- `Sidebar.tsx`: update footer to show both Privacy Policy and Terms links

### Remove
- Admin Users and Banned Users stat cards from Admin Dashboard top row

## Implementation Plan
1. Update `useAdminGate.ts` — add `AlphaSignal2026#` to credential check
2. Update `useBinanceKlines.ts` — add EURUSDT 3m/15m to REST + WS
3. Update `useSFIEngine.ts` — on-tick mode using live close price
4. Update `AdminDashboard.tsx` — trim to 2 stat cards
5. Update `useGeminiConfirmation.ts` — debounce/rate-limit fix
6. Update `useMarketWebSocket.ts` — 1s refresh ticker for display
7. Create `TermsOfService.tsx` page
8. Update `App.tsx` — add /terms route
9. Update `Sidebar.tsx` + `PrivacyPolicy.tsx` — add Terms links
