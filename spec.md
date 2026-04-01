# Alpha Signal AI — Pine Script Sync Update

## Current State
- SFI engine uses hlc3-based volatility bands (Basis ± smoothVol × 2.0), trend state machine, and fixed SL rules
- EUR/USD SL is currently 0.003 (30 pips) — should be 15 pips (0.0015)
- Gemini uses `models/gemini-1.5-pro-latest` with `v1beta` endpoint (already correct)
- Market Movers uses Binance 24h API via `useTopGainers`/`useTopLosers`
- Liquidation uses `wss://fstream.binance.com/ws` WebSocket
- Charts page has TradingView widget + SignalChartOverlay (Recharts line chart with buy/sell markers)
- No canvas overlay showing Supply/Demand zones or EMA cloud on the Charts page

## Requested Changes (Diff)

### Add
- `SFICanvasOverlay.tsx` — new Canvas-based chart component for the Charts page:
  - Draws candlestick bars from real Binance OHLC data
  - Supply zones (red boxes) from pivot highs (ta.pivothigh equivalent: 5-bar lookback)
  - Demand zones (green boxes) from pivot lows (ta.pivotlow equivalent: 5-bar lookback)
  - BUY/SELL text labels on candles where SFI trend flips
  - EMA cloud: renders the Basis line and Upper/Lower bands as a shaded cloud overlay
  - Asset selector (BTC, XAU/USD, EUR/USD) matches Charts page selection
  - Timeframe (3m/15m) matching the selected asset's candle data

### Modify
- `useSFIEngine.ts`: Change EUR/USD fixed SL from 0.003 → 0.0015 (15 pips)
- `Charts.tsx`: Replace old SignalChartOverlay with new SFICanvasOverlay below TradingView widget
  - Pass candle data and SFI signals to the canvas component

### Remove
- Old `SignalChartOverlay.tsx` usage in Charts (replaced by canvas version)

## Implementation Plan
1. Fix EUR/USD SL in `useSFIEngine.ts`
2. Create `SFICanvasOverlay.tsx` — canvas chart with pivot zones, BUY/SELL labels, EMA cloud
3. Update `Charts.tsx` to import and use `SFICanvasOverlay` with correct candle data
4. Verify Gemini model string is correct (`models/gemini-1.5-pro-latest`, `v1beta` endpoint)
5. Validate build
