# Alpha Signal AI

## Current State
- Backend `registerUser` always assigns `role = "user"` regardless of email.
- `loginWithEmail` and `verifyOTP` return whatever role is stored in the user record.
- Frontend `login()` in `useAuth.tsx` accepts the role from the backend as-is with no admin email check.
- Sidebar already conditionally shows Admin Panel based on `user.role === "admin" || user.email === ADMIN_EMAIL`.
- ProtectedRoute already shows "Access Denied" for role mismatch.
- Header already shows ADMIN badge for admin role.

## Requested Changes (Diff)

### Add
- Backend constant `ADMIN_EMAIL = "prakash.brjn01@gmail.com"` used in all auth functions.
- Frontend constant `ADMIN_EMAIL` in `useAuth.tsx`, enforced in `login()` to override role to `"admin"` if email matches.

### Modify
- Backend `registerUser`: assign `role = "admin"` if email matches ADMIN_EMAIL.
- Backend `loginWithEmail`: return `role = "admin"` if email matches ADMIN_EMAIL (regardless of stored role).
- Backend `verifyOTP`: return `role = "admin"` if the resolved user's email matches ADMIN_EMAIL.
- Backend `validateSession`: return `role = "admin"` if the user's email matches ADMIN_EMAIL.
- Frontend `useAuth.tsx` `login()`: if email param matches ADMIN_EMAIL, force role to `"admin"` before storing in localStorage.
- Frontend `AuthService.ts`: pass email back in login/verifyOTP responses so frontend can perform the check.

### Remove
- Nothing removed.

## Implementation Plan
1. Add `let adminEmail = "prakash.brjn01@gmail.com"` constant in `main.mo`.
2. Update `registerUser` to assign `role = if (email == adminEmail) "admin" else "user"`.
3. Update `loginWithEmail` to override role in the returned value: `role = if (email == adminEmail) "admin" else user.role`.
4. Update `verifyOTP` to override role similarly using the resolved user's email.
5. Update `validateSession` to override role in returned value.
6. Update frontend `useAuth.tsx` `login()` to enforce admin email → role override.
7. Update `LoginPage.tsx` to pass email to `login()` on successful auth so the override can fire.
