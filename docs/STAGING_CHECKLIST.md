# Staging Checklists

Manual verification to run against the **live** backend before building on top of it. Ordered to match the pause plan: provision → prove the lead pipeline → analytics → then Prompt 5 auth.

---

## A. Supabase provisioning (Prompt 4 activation)

- [ ] Production project created (Pro tier — no pausing)
- [ ] Dev project created (if budget allows) — separate env for safe testing
- [ ] Extensions enabled: `postgis`, `vector`, `uuid-ossp`
- [ ] Migrations applied in order: `001_schema` → `002_rls` → `003_functions`
- [ ] Seed applied: `database/seed/001_destination.sql` (vernal destination exists)
- [ ] **Schema verified** — run `database/tests/schema_checks.sql`, all lines PASS (right objects, right extensions, right policies)
- [ ] **RLS verified** — run `database/tests/rls_checks.sql`, all checks print PASS
- [ ] Storage bucket for guide PDFs created (private; served via signed URLs) — needed by Prompt 5+
- [ ] `service_role` key stored server-side only (Worker secret / never in client bundle)
- [ ] Env set in Cloudflare Pages + local `.env`: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
- [ ] CORS: confirm the site origin can call Supabase (default allows; verify once)

## B. Lead pipeline end-to-end (prove before adding auth)

Submit at `/corporate-rates` and verify each hop. Offline status recorded in
[M1_LEAD_PIPELINE_VERIFICATION.md](M1_LEAD_PIPELINE_VERIFICATION.md); ⏳ items await the live backend (its §7 runbook):

- [ ] Form → Supabase: a row appears in `lead` (Table editor) — ⏳ live (§7.1)
- [ ] Supabase → Worker: webhook fires (Worker logs / `wrangler tail`) — ⏳ live (§7.2)
- [ ] Worker → Email: Resend shows the send — ⏳ live (§7.2)
- [ ] Email received by the front-desk inbox, with correct fields + reply-to = submitter — ⏳ live (§7.2)
- [ ] `source_page` on the row = `/corporate-rates` — ⏳ live (§7.1); client sends it correctly (verified)

Input cases (behaviour should be sane, not crash):

- [ ] Valid submission → success state shown, row written — success state ✅ offline; row write ⏳ live (§7.1)
- [x] Missing required fields (name/email) → blocked client-side, no submit — ✅ browser-verified
- [x] Invalid email (`foo@`, `foo`, `foo@bar`) → blocked, inline error — ✅ browser-verified
- [ ] Extremely long notes (10k+ chars) → accepted or gracefully truncated, no error — ⏳ live (needs DB)
- [x] Duplicate submissions (same data twice) → both captured (dedupe is a later concern; confirm no crash) — ✅ client no-crash verified; "both captured" ⏳ live
- [ ] Spam-like input (URLs, script tags in notes) → stored as text, not executed anywhere it's displayed — ⏳ live (needs DB + a display surface)
- [x] Supabase env UNSET → form falls back to mailto (regression check of the fallback) — ✅ browser-verified

> Note: there is **no rate-limiting / captcha** on lead insert yet (RLS allows anon insert). If bot spam appears, add a honeypot field or a Turnstile check before the insert. Tracked, not built.

## C. Analytics (verify before real traffic)

Event wiring is verified in code + browser ([M1_LEAD_PIPELINE_VERIFICATION.md §6](M1_LEAD_PIPELINE_VERIFICATION.md)).
Three distinct lead events now exist — `corporate_lead_submit` (attempt), `corporate_lead_success`
(conversion, `via: supabase|mailto`), `corporate_lead_error` (`reason: validation|backend`) — plus
`call_click` / `book_click`. Live delivery still needs GA4: set `PUBLIC_GA4_MEASUREMENT_ID`
(+ `PUBLIC_CALLRAIL_ID`), rebuild, then in GA4 DebugView / Realtime:

- [ ] Call-click fires `call_click` (sticky bar phone + any `tel:` with `data-track`)
- [ ] Book-click fires `book_click` (sticky bar Book Now)
- [ ] Corporate submit fires `corporate_lead_submit` (form button)
- [ ] Successful lead fires `corporate_lead_success` with `via` (submit a valid request)
- [ ] Failed lead fires `corporate_lead_error` with `reason` (block on validation; force a backend error per report §7.1.5)
- [ ] Events carry `transport_type: beacon` and are not lost on navigation
- [ ] CallRail number-swap replaces the displayed phone number

## D. Adventure Pass auth (Prompt 5 — do NOT check until built)

Passwordless, magic-link only (see ADR-006):

- [ ] Magic link received
- [ ] Link expires correctly (reuse after expiry fails)
- [ ] Repeat login works (request a second link)
- [ ] New account created on first login
- [ ] Existing account reused (same email → same user)
- [ ] Logout works
- [ ] Session persists after refresh
- [ ] Session expires correctly
- [ ] Private pages protected (dashboard redirects when logged out)
- [ ] Public pages unaffected (the 23 SEO pages + conversion layer never gate)
- [ ] Optional profile completion after login (never blocks signup)

---

## E. Rollback plan (verify BEFORE shipping auth)

Authentication is the first feature that can accidentally affect the whole site — a bad guard, a global redirect, or an env misconfiguration can take down public pages. Prove the blast radius is contained and that auth can be pulled without collateral damage:

- [ ] Auth can be **disabled without affecting existing pages** — turning off signups / removing the member routes leaves the 23 SEO pages fully functional
- [ ] Anonymous visitors still browse everything public (no page silently starts requiring login)
- [ ] Existing booking flow unchanged (sticky bar, `bookingUrl`, click-to-call)
- [ ] Existing SEO pages unchanged (visual regression 12/12 still green after auth lands)
- [ ] Existing analytics still fire (`call_click` / `book_click` unaffected by auth JS)
- [ ] Existing lead form still functions (Supabase insert + mailto fallback both intact)
- [ ] A member/auth outage **fails open** for public content — if Supabase Auth is down, the marketing site and lead capture keep working; only member features degrade
- [ ] Rollback mechanics documented: which commit/tag to revert to (`v0.4-infrastructure-verified`), and that reverting the auth PR restores the last-known-good site without data loss

**Test matrix** for the auth behaviours themselves lives with Prompt 5 (new-user, returning-user, expired-link, refresh-persists, logged-out→dashboard-redirect, anonymous→guides-landing, invalid-token→graceful-recovery). Build it as the auth code is written, not after.
