# ADR‑006 — Passwordless, Magic-Link Identity

**Status:** Accepted · 2026‑07 · (implemented in Prompt 5)

## Context
The Adventure Pass exists to *increase signups* — it is a top-of-funnel email-capture and value-delivery tool, not a secured account system holding sensitive data. Every field, password, or extra step is friction that reduces the signup rate, and signup rate is one of the two metrics that decide phase two (Report §15). The data behind a member account (saved itineraries, profile) is low-sensitivity and already protected by RLS.

## Decision
Identity is **passwordless and magic-link only**, via Supabase Auth:

- **One account per email.** The email address is the identity. Same email → same user, always.
- **No usernames, no passwords.** Nothing to choose, remember, or reset.
- **Magic link (OTP email) is the only login method** for v1. Request a link → click → authenticated.
- **Profile completion is optional and happens *after* login** ("Why are you visiting?" → `user_types`). It never blocks signup.
- Sessions persist across refresh and expire per Supabase defaults.

## Consequences
- **Positive:** Lowest possible signup friction — no password UX, no reset flow, no credential storage/breach surface.
- **Positive:** "One account per email" makes returning-visitor detection trivial and keeps the member table clean.
- **Positive:** Optional-profile-after-login means the onboarding question can drive personalization without gating the email capture.
- **Cost:** Login requires inbox access each time (mitigated by session persistence — infrequent re-auth). Deliverability of magic-link emails becomes load-bearing → use a verified sending domain (Resend/Supabase SMTP), monitored.
- **Deferred:** Social logins (Google/Apple), passwordless passkeys, and any password option are out of scope for v1; revisit only if magic-link friction shows up in the signup funnel.
- **Verification:** the auth flow is validated against the checklist in `docs/STAGING_CHECKLIST.md` §D — it can only be exercised against a live Supabase project.
