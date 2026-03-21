# Alpha Signal AI – SFI Signal Engine Replacement

## Current State
- AI signal engine uses Gemini AI calls, complex multi-indicator logic (EMA crossover, RSI/MACD, SMC, volume, liquidity zones) to generate BUY/SELL/WAIT signals
- Signals shown for BTC and XAU (ETH included in market data)
- No EUR/USD support
- No explicit 3m/15m dual-timeframe signal display
- `useSignalEngine.ts`, `usePredictionEngine.ts`, `useRealGeminiEngine.ts`, `useGoldSignalEngine.ts`, `useScalperEngine.ts` all contain old signal logic
- `CleanSignalCard.tsx`, `ScalperActionCard.tsx` render old signals

## Requested Changes (Diff)

### Add
- `useSFIEngine.ts` – new hook implementing SFI color logic:
  - Computes SFI color (GREEN/RED/NEUTRAL) from candle data per asset per timeframe (3m, 15m)
  - SFI logic: momentum-based candle-strength indicator (sum of body direction weighted by volume relative to ATR)
  - Sideways market filter: if EMA50/EMA200 are very close (<0.3% apart), RSI between 45–55, and low candle range → WAIT signal
  - Outputs: signal (BUY/SELL/WAIT), sfiColor (GREEN/RED/NEUTRAL), entry, stopLoss, target (1:3 RR), EMA50, EMA200, support/resistance zones
  - For 3m and 15m timeframes separately
- `SFISignalCard.tsx` – new UI card showing dual-timeframe signals per asset
  - Shows BUY/SELL/WAIT clearly with SFI color indicator dot
  - Shows 3m and 15m side by side
  - Shows Entry / SL / Target
  - Shows EMA50/EMA200 for visual confirmation (labeled as confirmation only)
  - Shows Support/Resistance zones
  - Shows "Sideways Market" label when WAIT
- EUR/USD price feed via a public REST polling endpoint (exchangerate-api or frankfurter.app – CORS-friendly)
- `useEURUSD.ts` – hook to poll EUR/USD price every 30s and generate synthetic candles for SFI calculations

### Modify
- `Dashboard.tsx` – replace old signal cards with new `SFISignalCard` for BTC, XAU, EUR/USD
- Remove Gemini-based signal calls from dashboard signal section (keep Research Terminal and Gemini Analysis Panel intact)
- `useBinanceKlines.ts` – extend to also stream 15m candles for BTC (add `btcusdt@kline_15m`)

### Remove
- Old signal logic from `useSignalEngine.ts`, `usePredictionEngine.ts`, `useScalperEngine.ts`, `useGoldSignalEngine.ts` (keep files but gut signal generation, replace with SFI delegation)
- `CleanSignalCard.tsx` and `ScalperActionCard.tsx` signal display replaced by `SFISignalCard`

## Implementation Plan
1. Extend `useBinanceKlines.ts` to stream 3m and 15m BTC candles
2. Create `useEURUSD.ts` for EUR/USD price polling and synthetic candle generation
3. Create `useSFIEngine.ts` with:
   - EMA calculation utility
   - RSI calculation utility
   - ATR calculation utility
   - SFI color computation (momentum/body-strength)
   - Sideways market detection
   - Support/Resistance zone detection (swing highs/lows)
   - Risk management (1:3 RR entry/SL/target)
   - Runs for 3m and 15m per asset
4. Create `SFISignalCard.tsx` – professional dual-timeframe signal UI
5. Update `Dashboard.tsx` to use new SFI cards for BTC, XAU, EUR/USD signal section
