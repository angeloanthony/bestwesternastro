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

Baseline the whole product builds on. Tag when green: **`v0.4-foundation-complete`**.

- [ ] Repository baseline established
- [ ] ADRs complete ([001–006](adr/))
- [ ] Zero-regression guardrails (visual regression 12/12 green)
- [ ] Tailwind, preflight disabled ([ADR-004](adr/ADR-004-tailwind-without-preflight.md))
- [ ] Preact integration
- [ ] CI
- [ ] Supabase schema applied ([PROVISIONING.md](PROVISIONING.md))
- [ ] Schema verified (`database/tests/schema_checks.sql` — all PASS)
- [ ] RLS verified (`database/tests/rls_checks.sql` — all PASS)
- [ ] Lead pipeline proven end-to-end ([STAGING_CHECKLIST.md §B](STAGING_CHECKLIST.md))
- [ ] Analytics verified in GA4 ([STAGING_CHECKLIST.md §C](STAGING_CHECKLIST.md))
- [ ] Rollback documented ([STAGING_CHECKLIST.md §E](STAGING_CHECKLIST.md), [RUNBOOK.md](RUNBOOK.md))

Only when all of the above are green do we tag `v0.4-foundation-complete` and
begin M2.

## M2 — Identity Verified (Prompt 5)

Passwordless, magic-link only ([ADR-006](adr/ADR-006-passwordless-identity.md)).
Must prove: magic links · sessions · dashboard · member profile · protected
routes — **without** any public page starting to require login
([STAGING_CHECKLIST.md §D/§E](STAGING_CHECKLIST.md)).

## M3 — Knowledge Base Verified

Locations · events · categories · search.

## M4 — Adventure Pass Verified

Guides · trip planner · crew mode.

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
