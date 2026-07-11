# Operations Runbook

The operational rhythm for running AdventureOS in production. This is not the
_provisioning_ guide (that's [PROVISIONING.md](PROVISIONING.md), a one-time
setup) — this is what someone does **day to day** to keep the system healthy,
including you, six months from now.

Each item names _where_ to look and _what "healthy" looks like_, so the rhythm
survives a handoff.

---

## Daily

- **Worker failures** — Cloudflare dashboard → Workers → `lead-notify` →
  Logs. Zero errors expected. A spike means leads may not be emailing the front
  desk (the row is still safe in Supabase; the alert is what's broken).
- **Lead submissions** — Supabase → Table editor → `lead`, newest first.
  Confirm real leads are landing and each has a `source_page`. Cross-check the
  front-desk inbox actually received the alert email.
- **Analytics sanity** — GA4 → Realtime. Confirm `call_click` / `book_click` /
  `corporate_lead_submit` are still firing. A flatline usually means a broken
  deploy or a missing `PUBLIC_GA4_MEASUREMENT_ID`, not a quiet day.

## Weekly

- **Unanswered AI questions** — review the concierge question log (M5). Any
  question the AI declined or answered weakly is a content gap to fill, not a
  model to blame.
- **Failed emails** — Resend dashboard → Logs. Bounces/failures mean a bad
  front-desk address or an unverified sending domain.
- **Application logs** — skim Cloudflare + Supabase logs for new error
  patterns. Note anything recurring before it becomes an incident.

## Monthly

- **Reverify stale locations** — business hours, phone numbers, and status of
  the oldest-verified `location` rows. Field data rots; guests notice first.
- **Update guides** — refresh Adventure Pass guide PDFs for anything seasonal
  or changed on the ground.
- **Review coupons / offers** — expire dead `offer` rows; confirm live ones
  still honor real partner deals.
- **Review GA4** — month-over-month trends on calls, bookings, and leads. This
  is the conversion signal the whole site exists to move.
- **Back up the database** — confirm Supabase automated backups exist AND take
  a manual export you can restore from. An untested backup is a hope, not a plan.

## Quarterly

- **Reverify every business** — a full pass over all `location` records, not
  just the stale ones.
- **Audit RLS** — re-run `npm run verify:db` against production and re-read
  [ADR-003](adr/ADR-003-adopt-supabase.md) policies. Confirm anon still cannot
  read `lead` or any member data.
- **Review dependencies** — `npm outdated`, security advisories, and the pinned
  Astro / Supabase / Tailwind majors. Patch before you're forced to.
- **Test disaster recovery** — actually restore a backup into a scratch
  project and confirm the site can point at it. A DR plan you've never executed
  is untested.

---

## Incident quick-reference

| Symptom                          | First look                                   | Likely cause                                  |
| -------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Leads not emailing               | Worker logs, Resend logs                     | Worker error, unverified domain, bad webhook  |
| Form errors on submit            | Browser console, `lead` table                | Supabase env unset → should fall back to mailto |
| Public pages requiring login     | Recent auth deploy                           | A guard leaked onto public routes — see §E rollback |
| Analytics flatline               | GA4 Realtime, latest deploy                  | Missing measurement ID, broken build          |
| Member features down             | Supabase Auth status                         | Auth outage — public site must still work     |

**Rollback of last resort:** revert to `v0.4-foundation-complete` — the tagged
infrastructure baseline with no auth. See the rollback plan in
[STAGING_CHECKLIST.md §E](STAGING_CHECKLIST.md).

## Health monitoring (planned)

A small internal status page (Database / Workers / Email / AI / Maps /
Analytics / Last backup / Last verification) is a future item — see
[ROADMAP.md](ROADMAP.md). Until it exists, the Daily checks above _are_ the
health check; do them.
