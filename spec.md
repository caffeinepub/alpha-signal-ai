# Alpha Signal AI — SFI Signal System Upgrade

## Current State
Signals.tsx still uses old signal engine hooks (useSignalEngine, useGoldSignalEngine, usePredictionEngine, useMultiTimeframe). useSFIEngine already exists. No Chat page exists.

## Requested Changes (Diff)

### Add
- ChatPage.tsx with Gemini chat + CompactSFIWidget below input
- CompactSFIWidget.tsx showing all 3 assets x 2 timeframes
- /chat route in App.tsx and Sidebar.tsx

### Modify
- Signals.tsx: remove all old logic, SFI-only panels

### Remove
- Old signal hooks from Signals.tsx

## Implementation Plan
1. Create CompactSFIWidget.tsx
2. Rewrite Signals.tsx with SFI-only panels
3. Create ChatPage.tsx with CompactSFIWidget
4. Update App.tsx and Sidebar.tsx
