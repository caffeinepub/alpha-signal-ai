# Alpha Signal AI

## Current State

- Charts.tsx has a custom SVG candlestick chart built with Recharts/SVG with EMA 10/20, support/resistance lines, and a volume bar chart
- AI signal engine (useSignalEngine.ts) generates STRONG BUY / STRONG SELL / WAIT signals for BTC and XAU
- Live prices stream via Binance WebSocket (BTC/ETH) and forex REST (XAU)

## Requested Changes (Diff)

### Add
- TradingView Advanced Chart widget embedded via `<script>` tag (official TradingView widget embed from `https://s3.tradingview.com/tv.js`) inside an iframe-style container using the TradingView `new TradingView.widget({...})` API
- Asset selector: BTCUSDT (default) and XAUUSD — maps directly to TradingView symbol format
- Multiple timeframes: 1m, 5m, 15m, 1H, 4H, 1D — passed as `interval` to the widget config
- Candlestick chart type enabled by default (chart_type: "candlesticks")
- Zoom controls and full toolbar enabled (hide_top_toolbar: false, hide_legend: false)
- AI signal overlay panel: shown below or alongside the chart — displays the current AI signal for the selected asset (STRONG BUY / STRONG SELL / WAIT), entry price, SL, TP, confidence score — updates live from useSignalEngine
- The widget auto-updates in real time since TradingView streams live data natively for these symbols

### Modify
- Charts.tsx: replace the entire custom SVG candlestick chart and volume chart with a TradingView widget container; keep the asset/timeframe selector UI but wire it to the TradingView widget config; remove old CandlestickChart, VolumeChart, calcEMA, detectSupportResistance functions
- Chart legend: replace EMA/S&R legend with a TradingView attribution note and AI signal legend (BUY = green, SELL = red)

### Remove
- Old SVG CandlestickChart component
- Old VolumeChart component
- Old calcEMA and detectSupportResistance helper functions in Charts.tsx
- useCandlestickData import from useQueries (no longer needed on Charts page)

## Implementation Plan

1. In Charts.tsx:
   - Remove old chart components, helpers, and useCandlestickData import
   - Create a `TradingViewWidget` React component that:
     - Renders a div container with a unique id (e.g. "tradingview_chart")
     - On mount, dynamically loads the TradingView widget script (`https://s3.tradingview.com/tv.js`) then instantiates `new TradingView.widget({...})` with:
       - autosize: true
       - symbol: maps BTC → "BINANCE:BTCUSDT", XAU → "OANDA:XAUUSD"
       - interval: selected timeframe (mapped: "1m"→"1", "5m"→"5", "15m"→"15", "1H"→"60", "4H"→"240", "1D"→"D")
       - timezone: "Etc/UTC"
       - theme: "dark"
       - style: "1" (candlesticks)
       - locale: "en"
       - toolbar_bg: "#0f1117"
       - enable_publishing: false
       - hide_top_toolbar: false
       - hide_legend: false
       - save_image: false
       - container_id: the div id
     - On symbol or interval change, destroy and re-init the widget
   - Asset selector: "BTC" and "XAU" tabs (remove ETH/GOLD since TradingView handles those natively)
   - Timeframe selector: 1m, 5m, 15m, 1H, 4H, 1D
   - Below the TradingView chart: AI Signal Panel — reads from useSignalEngine, filters to selected asset, displays signal card with direction badge, confidence bar, entry/SL/TP levels, and explanation text

2. AI Signal overlay panel styling:
   - Shown as a card beneath the chart
   - STRONG BUY = green border + badge, STRONG SELL = red, WAIT = amber
   - Shows: asset, signal type, confidence %, entry price, stop loss, TP1, TP2, risk level, SMC tags, explanation
   - Updates live as useSignalEngine recalculates
