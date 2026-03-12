# Alpha Signal AI

## Current State
A production trading dashboard with BTC, ETH, XAU live data, AI signal engine, Scalper Mode, Gemini 2.0 Flash analysis panel, Economic Calendar, and Live Headlines. Navigation has: Dashboard, Charts, AI Signals, Liquidation, Performance.

## Requested Changes (Diff)

### Add
- New `/research` route and `Research.tsx` page
- "Research" nav item in Sidebar (after Performance) with a `FlaskConical` or `BookOpen` icon
- `researchWithGemini` backend function in main.mo that uses `gemini-1.5-pro` model for deep-dive reports
- Research report sections: Executive Summary, Fundamental Health (AI-estimated), Technical Outlook, Price Targets (Bear/Base/Bull), Risk Assessment, Key Catalysts
- Asset search input supporting any ticker plus quick-pick presets: NVDA, AAPL, BTC, ETH, XAU/USD
- Asset type selector: Stock | Crypto | Forex
- AI disclaimer banner on all AI-generated fundamental data
- Loading state with animated progress during report generation
- GEMINI-1.5-PRO model badge

### Modify
- `Sidebar.tsx`: add Research nav entry
- `App.tsx`: register `/research` route and add to PAGE_META
- `main.mo`: add `researchWithGemini` function with gemini-1.5-pro endpoint

### Remove
- Nothing removed

## Implementation Plan
1. Add `researchWithGemini(ticker, assetType)` to main.mo — calls gemini-1.5-pro with a structured deep-analysis prompt, returns a multi-section report as text
2. Create `Research.tsx` — search UI, quick picks, report generation, section cards, disclaimer
3. Update Sidebar.tsx with Research nav item
4. Update App.tsx with Research route and PAGE_META entry
