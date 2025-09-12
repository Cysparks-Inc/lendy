## Security Guide

This document explains the current authentication, MFA, and security tooling in the app, along with operator guidance for admins.

### Overview

- Authentication is handled by Supabase Auth.
- Multi‑Factor Authentication (MFA) supports TOTP (authenticator apps) and email OTP fallback.
- A lightweight, per‑user local flag in `localStorage` indicates an MFA‑verified session window and is honored by the app router to prevent MFA loops.

### MFA Flow

Routes and pages:
- `\mfa` → `MfaPrompt`: prompts for TOTP or lets the user request/verify email OTP.
- `\mfa\enroll` → `MfaEnroll`: enrolls TOTP (shows QR, verifies 6‑digit code).
- `\security\mfa` → `SecurityMfa`: user self‑service page to see status, enable/disable TOTP (client‑side via Supabase SDK where available).

App guard:
- `RequireMfa` (in `src/App.tsx`) requires MFA for every authenticated user.
- After successful verification, a per‑user key `mfa_verified_<userId>` is stored in `localStorage` with a 12‑hour expiry.
- Sign‑out clears this flag. Any SIGNED_OUT auth event also clears all such flags.

Changing the session window:
- The current expiry is 12 hours. To change it, update the two places in `src/pages/MfaPrompt.tsx` that set `expiresAt` and the check in `RequireMfa` in `src/App.tsx`.
- To require MFA every login regardless of time, remove the local flag write and its check in `RequireMfa`.

### User Security Page (`/security`)

- Accessible to all authenticated users.
- Non‑admin users: can change their own password (self mode).
- Super admins: can reset any user’s password (admin mode) and can disable user MFA (see below).

Components:
- `ResetPasswordDialog` supports two modes:
  - Self: calls `supabase.auth.updateUser({ password })` for the current user.
  - Admin: calls the edge function `reset-user-password` (if configured) to set another user’s password.
- `DisableMfaDialog` (super admin only): allows selecting a user and disabling their MFA factors using the `disable-user-mfa` edge function.

### Admin: Disable a User’s MFA

Edge Function: `supabase/functions/disable-user-mfa/index.ts`
- Purpose: Remove all MFA factors for a user (service role required), so they can re‑enroll on next login.
- Adds verbose logs and CORS handling for browser calls.

Required project secrets:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (e.g., `https://<project-ref>.supabase.co`)

Deploy and test:
1) Link project (once):
   - `supabase link`
2) Set secrets:
   - `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=https://<project-ref>.supabase.co`
3) Deploy:
   - `supabase functions deploy disable-user-mfa --no-verify-jwt`
4) Invoke (manual test):
   - `supabase functions invoke disable-user-mfa --no-verify-jwt --data '{"userId":"<USER_UUID>"}'`
5) Check logs: Supabase Dashboard → Functions → disable-user-mfa → Logs

Client usage:
- The Security page’s `DisableMfaDialog` calls the edge function via `supabase.functions.invoke('disable-user-mfa', { body: { userId } })`.

### Supabase Auth Settings (reference)

`supabase/config.toml` should reflect:
- `auth.mfa.totp.enroll_enabled = true`
- `auth.mfa.totp.verify_enabled = true`
- Ensure your `site_url` and `additional_redirect_urls` include all frontend URLs.

### Troubleshooting

- MFA loop after login:
  - Ensure `MfaPrompt` actually verifies via `supabase.auth.mfa.verify(...)` and then sets the local flag.
  - Ensure `RequireMfa` checks the local flag with expiry and allows navigation when valid.

- “A factor with the friendly name "" for this user already exists” during re‑enroll:
  - User already has a TOTP factor. Use the super admin “Disable MFA” action to remove factors, then re‑enroll.

- Edge function fails with OPTIONS/wrong method:
  - Confirm CORS preflight is handled (this repo’s function already does). Redeploy and retry.

- Edge function auth errors:
  - Verify `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set as secrets in the project.

### Files of Interest

- `src/App.tsx` → `RequireMfa` guard and routes
- `src/pages/MfaPrompt.tsx` → verification and local flag storage
- `src/pages/MfaEnroll.tsx` → TOTP enrollment
- `src/pages/SecurityMfa.tsx` → self‑service MFA view
- `src/pages/Security.tsx` → Security hub (self/admin features)
- `src/components/security/ResetPasswordDialog.tsx`
- `src/components/security/DisableMfaDialog.tsx`
- `supabase/functions/disable-user-mfa/index.ts`


