# Alpha Signal AI

## Current State
- `/admin` route is open to everyone — ProtectedRoute is a passthrough, no auth check
- AdminDashboard shows all sections (User Management, Affiliate Stats, System Status, Login Activity) to any visitor
- Videos page "Add Video" button is visible and functional for everyone
- No 2FA or secret key gate exists
- `useAuth` always returns ADMIN_USER unconditionally

## Requested Changes (Diff)

### Add
- `useAdminGate` hook: stores admin session in sessionStorage (tab-scoped); exports `isAdminVerified`, `verifyAdmin(email, secretKey)`, `lockAdmin()`
- `AdminGate.tsx` component: full-screen lock screen shown to anyone hitting `/admin` who hasn't passed 2FA. Requires email = `prakash.brjn01@gmail.com` AND Admin Secret Key = `AlphaSignal2024!`. On wrong credentials: shows "Access Denied" error. On success: grants session, reveals dashboard.
- `Master_Admin` flag: all localStorage video entries include `uploadedBy: 'Master_Admin'` when added by the verified admin session
- Non-admin access to `/admin`: immediate redirect to `/` (home)

### Modify
- `ProtectedRoute.tsx`: when `requiredRole === 'admin'`, check `useAdminGate` — if not verified, render `<AdminGate />` (not a redirect, so the gate is shown inline; the URL stays /admin)
- `AdminDashboard.tsx`: wrap entire content in admin-gate check; add lock icon header showing "ADMIN LOCKED" badge; Affiliate Click Stats and System Status sections only rendered when verified
- `VideosPage.tsx`: "Add Video" button only shown when `useAdminGate().isAdminVerified` is true
- `App.tsx`: pass `requiredRole="admin"` to the `/admin` ProtectedRoute

### Remove
- No changes to Gold price system, market data, SFI engine, or any other modules

## Implementation Plan
1. Create `src/hooks/useAdminGate.ts` — sessionStorage-based gate with hardcoded credentials
2. Create `src/components/AdminGate.tsx` — 2FA lock screen UI (dark themed, matching glassmorphism style)
3. Update `ProtectedRoute.tsx` — check `requiredRole` prop and render gate when needed
4. Update `App.tsx` — add `requiredRole="admin"` to admin route
5. Update `AdminDashboard.tsx` — add admin badge header, keep all sections gated
6. Update `VideosPage.tsx` — hide Add Video button for non-verified users
