# Roadmap — Verified Milestones

We track progress as **milestones that are _verified_, not phases that are
_complete_**. "Complete" says we're done; "Verified" says: we built it, we
proved it against a live environment, now we build on it. A milestone is not
verified until every criterion below is green **in production**, not just in the
repo.

Gate for every milestone: `npm run verify` (offline: build, typecheck, lint,
format) **and** `npm run verify:db` (live: schema + RLS) pass, plus the
milestone's own checks.

---

## M1 — Infrastructure Verified

Baseline the whole product builds on. Tag when green: **`v0.4-infrastructure-verified`**.

The tag name is deliberate. _Code complete_ (repo builds, 0 hints, tooling + docs
in place) is an engineering checkpoint, not this milestone — the code being clean
does not prove the backend works. M1 is reached only when the live checks below
pass, which is why the tag says **verified**, not "complete." (Production-ready —
monitoring, staff testing, rollback drill — is a later milestone again.)

- [ ] Repository baseline established
- [ ] ADRs complete ([001–006](adr/))
- [ ] Zero-regression guardrails (visual regression 12/12 green)
- [ ] Tailwind, preflight disabled ([ADR-004](adr/ADR-004-tailwind-without-preflight.md))
- [ ] Preact integration
- [ ] CI
- [x] Supabase schema applied ([PROVISIONING.md](PROVISIONING.md)) — live ([M1_VERIFICATION_REPORT.md](M1_VERIFICATION_REPORT.md))
- [x] Schema verified (`database/tests/schema_checks.sql` — all PASS) — [M1_VERIFICATION_REPORT.md §2](M1_VERIFICATION_REPORT.md)
- [x] RLS verified (`database/tests/rls_checks.sql` — all PASS) — [M1_VERIFICATION_REPORT.md §2](M1_VERIFICATION_REPORT.md)
- [~] Lead pipeline proven end-to-end ([STAGING_CHECKLIST.md §B](STAGING_CHECKLIST.md)) — **application layer verified offline** ([M1_LEAD_PIPELINE_VERIFICATION.md](M1_LEAD_PIPELINE_VERIFICATION.md)); live DB + email hops pending (its §7)
- [~] Analytics verified in GA4 ([STAGING_CHECKLIST.md §C](STAGING_CHECKLIST.md)) — 3 distinct events (submit/success/error) implemented + browser-verified; live GA4 DebugView delivery pending ([M1_LEAD_PIPELINE_VERIFICATION.md §6/§7.3](M1_LEAD_PIPELINE_VERIFICATION.md))
- [ ] Rollback documented ([STAGING_CHECKLIST.md §E](STAGING_CHECKLIST.md), [RUNBOOK.md](RUNBOOK.md))

Only when all of the above are green do we tag `v0.4-infrastructure-verified` and
begin M2. **Status (2026-07-11):** DB layer green; lead-pipeline application layer
verified offline; the tag remains **ungated** until the live DB/email/GA4 hops in
[M1_LEAD_PIPELINE_VERIFICATION.md §7](M1_LEAD_PIPELINE_VERIFICATION.md) are executed. `[~]` = partially verified.

## M2 — Identity Verified (Adventure Pass)

Passwordless, magic-link only ([ADR-006](adr/ADR-006-passwordless-identity.md)).
Must prove: magic links · sessions · dashboard · member profile · protected
routes — **without** any public page starting to require login
([STAGING_CHECKLIST.md §D/§E](STAGING_CHECKLIST.md)).

**Status (2026-07-11):** application layer **built + offline-verified** — magic-link
sign-in, `/pass` dashboard, client-side guard, optional profile, sign-out; fails-open;
public site unaffected (visual 12/12) ([M2_IDENTITY_VERIFICATION.md](M2_IDENTITY_VERIFICATION.md)).
`[~]` Remaining = live magic-link round-trip, session lifecycle, `member_profile` write,
and the outage/rollback drills (report §7). Not verified until those pass live.

- [~] Magic-link sign-in + `/pass` dashboard + session guard — built; live round-trip pending (§7)
- [~] Optional member profile write (`member_profile`) — built + typed; live write pending (§7.4)
- [x] Public pages never gate; auth fails open — offline-verified (fails-open + visual 12/12)
- [ ] Live: link → session → returning user → logout → expiry; outage + rollback drills (§7)

## M3 — Knowledge Base Verified

Locations · events · categories · search.

## M4 — Adventure Pass Verified

Saved Adventures · My Adventures · Trip Planner · Trip Status. (Guides &
crew mode remain deferred — see Report; not in this milestone.)

**Status (2026-07-11):** application layer **built + offline-verified** — favorites
(save/unsave), a My Adventures dashboard (saved / recently viewed / recommended),
a **deterministic** trip planner (dates + interests → day-by-day itinerary, no AI —
[ADR-007](adr/ADR-007-attraction-catalogue-in-typescript.md)) with persistence reusing
`member_profile` + `itinerary`, and trip status (countdown/length/season/packing).
Additive only: one migration (`005_favorite.sql`); public site untouched (visual 12/12).
([M4_ITINERARY_VERIFICATION.md](M4_ITINERARY_VERIFICATION.md)). `[~]` Remaining = live
favorites/trip read-write round-trips and RLS isolation (report §7). Not verified until those pass live.

- [~] Saved Adventures (`favorite` table, RLS `fav_own`) — built + typed; live write pending (§7.1–7.3)
- [~] Trip Planner + Trip Status (deterministic; reuses `member_profile`/`itinerary`) — built; live persistence pending (§7.5–7.8)
- [x] My Adventures dashboard with empty states; analytics events; fails open — offline-verified
- [x] Public pages never gate; additive only (one migration, no schema redesign) — offline-verified (visual 12/12)
- [ ] Live: save → reload → present; trip create/update/delete; RLS isolation between members (§7)

## M5 — Concierge Verified

AI · RAG · grounding · question logging ([ADR-005](adr/ADR-005-ai-scope-limited-to-vernal.md)).

## M6 — Beta Ready

Pilot guests · hotel staff · feedback loop.

---

## Tracked, not yet scheduled

- **Internal health/status page** — Database / Workers / Email / AI / Maps /
  Analytics / Last backup / Last verification. Simple, high value. Until it
  ships, the Daily checks in [RUNBOOK.md](RUNBOOK.md) are the health check.
- **Lead spam controls** — honeypot or Turnstile before insert, if bot spam
  appears ([STAGING_CHECKLIST.md §B](STAGING_CHECKLIST.md)).
