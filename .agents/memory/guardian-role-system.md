---
name: Guardian Role System
description: How the User/Guardian role is stored, exposed, and used to control routing and UI.
---

## Rule
Role is persisted as `typetalk_role` in AsyncStorage with values `"user"` or `"guardian"`. It defaults to `"user"` on fresh installs and is cleared on logout.

**Why:** Guardians need a monitoring dashboard instead of the TTS interface. Role is decoupled from auth — the same account can switch roles without re-login.

**How to apply:**
- `useAuth().role` returns the current role everywhere.
- `useAuth().setRole(role)` persists to AsyncStorage and updates state.
- `_layout.tsx` `RootLayoutNav` routes to `/guardian-dashboard` when `role === "guardian"` and profileSeen.
- `MenuDrawer.tsx` switches its nav item list based on `role`.
- `login.tsx` shows a User/Guardian toggle above the auth form; calls `setRole()` after successful auth before routing.

## Guardian purple color constants
- `#7C6AF7` (primary), `#5B4DD6` (darker gradient end)
