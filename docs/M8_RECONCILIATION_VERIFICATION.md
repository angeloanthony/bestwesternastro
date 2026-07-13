# M8 — Matching & Reconciliation Engine — Verification Report

**Status (2026-07-13):** application layer **built + offline-verified**.
M8 **completes the booking platform's revenue chain**: it links imported
partner report rows (M6) to the outbound booking intents (migration 006),
advancing each matched intent to its observed outcome (stayed / cancelled),
filling attributed revenue and room nights, and computing commission. The
gateway records the click, the importer lands the report, and M8 is the step
that turns the two into **verified, attributed, commissionable revenue**.

Additive only; no redesign, no SSR, no AI, no public-site change. See
[PARTNER_REFERRAL_ARCHITECTURE.md §4–6](PARTNER_REFERRAL_ARCHITECTURE.md) for
the underlying attribution keys and status lifecycle this implements.

The objective is **business**: prove AdventureOS can produce a defensible
monthly reconciliation. The engine is proven offline here; a live end-to-end
run additionally depends on two business inputs (see §7).

---

## 1. What changed (every affected file)

**New**

| File | Purpose |
|---|---|
| `database/migrations/010_reconciliation.sql` | Additive: widen `partner_report_line.status` to add `'ambiguous'`; add the matcher indexes 009 deferred; unique index on `booking_intent_id` (double-match backstop) |
| `scripts/reconcile/rules.mjs` | Pure confidence-based classification (the 4 attribution tiers) |
| `scripts/reconcile/match.mjs` | Pure, deterministic matching engine → a reconciliation plan |
| `scripts/reconcile/commission.mjs` | Pure commission calculator + stay-outcome derivation |
| `scripts/reconcile/persist.mjs` | Service-role fetch/apply/age + `buildIntentUpdate` |
| `scripts/reconcile/cli.mjs` | Injectable CLI orchestration (parse → fetch → match → apply → report) |
| `scripts/reconcile.mjs` | Entry-point shell (real client, clock, aging cutoff) |
| `scripts/reconcile/{rules,commission,match,persist,cli}.test.mjs` | 58 unit tests |
| `scripts/reconcile/README.md` | Operator + design notes |
| `docs/M8_RECONCILIATION_VERIFICATION.md` | This report |

**Modified**

| File | Change |
|---|---|
| `package.json` | Added the `reconcile:run` script (additive; mirrors `report:import`) |

**Not touched:** every layout, route, component, CSS file, the 23 SEO pages,
`business.ts`, the importer, the `/go` gateway, `booking_intent`'s column shape
(006 already had every reconciliation column), and the grant model
(`booking_intent` / `partner_report_line` stay service_role-only).

---

## 2. Schema (migration 010 — additive)

`booking_intent` (006) already carried the full reconciliation surface
(`status` enum, `matched_at`, `confirmation_number`, `room_nights`,
`revenue_cents`, `commission_cents`, `notes`), so **010 adds nothing there**.
It only:

- widens `partner_report_line.status` from `('unmatched','matched')` to add
  `'ambiguous'` — exactly what migration 009 anticipated ("the matcher milestone
  owns any richer lifecycle and will widen this check then");
- adds the deferred matcher indexes (`status`, `partner_slug`,
  `booking_intent_id`);
- adds a **partial unique index on `booking_intent_id`** — the database-level
  guarantee that one intent is linked by at most one line (never double-matched).

Idempotent (`drop constraint if exists` + `create index if not exists`).

---

## 3. Matching model (confidence tiers)

Per [PARTNER_REFERRAL_ARCHITECTURE.md §4](PARTNER_REFERRAL_ARCHITECTURE.md),
strongest → weakest by how safely each identifies a **unique** click:

| Tier | Signal | Confidence |
|---|---|---|
| 1 | `ref_code` echoed on the line (unique per click) | high |
| 2 | promo code + arrival within ±1 day + member last name | high |
| 3 | promo code + arrival within ±1 day | high |
| 4 | promo code alone | low |

Resolution rules (in `match.mjs`, pure + deterministic):

- **One line → one intent; one intent → one line.** Enforced in memory and
  backed by 010's unique index.
- **Never guess.** A line that matches more than one still-available intent on a
  tier is flagged **`ambiguous`** for manual review — never auto-matched.
- **Deterministic.** Stable sort (line by `external_ref`; intent by
  `created_at`), so re-running over the same inputs yields the same plan.

---

## 4. Commission & outcome (never invented)

`commission.mjs`, per the milestone's hard rules:

- **Stay outcome** is derived conservatively: non-positive revenue **or**
  non-positive nights ⇒ `cancelled` (refund/cancellation); otherwise `stayed`.
  *(The canonical import line has no explicit status column, so this is inferred.
  Revisit `deriveOutcome` when Best Western's real export format is confirmed —
  the provisional contract in [M6_CSV_IMPORTER.md §2](M6_CSV_IMPORTER.md).)*
- **Commission** = `round(revenue_cents × commission_percent ÷ 100)` on
  **stayed** rows only.
- **If the partner has no `commission_percent` on record → commission is `NULL`**
  (unknown), never `0` and never a guess. The run **reports** how many stays were
  left NULL and why.
- Cancelled / refunded rows earn **0** commission and are excluded from
  attributed revenue.

---

## 5. Idempotency & safety

- Writes are **guarded by the source status** — the intent update requires
  `status IN ('clicked','confirmed')`, the line link requires `status='unmatched'`.
  A second run therefore finds nothing to do (idempotent), and a partial run is
  simply **resumed by running again**.
- **Not fail-open** (unlike the `/go` redirect): staff tooling aborts on any
  write error.
- **Service-role only**, off-browser — the service-role key never enters the
  site build or a browser, matching the importer and `booking-report.mjs`.
- `--dry-run` computes and reports the full plan and totals with **zero writes**.

---

## 6. Verification (offline, this session)

- [x] **58/58 unit tests pass** — `node --test scripts/reconcile/*.test.mjs`
  (rules 22, commission 9, match 10, persist 11, cli 6 — see §9).
- [x] **ESLint clean** on all new files.
- [x] **Prettier clean** on all new files.
- [x] **Syntax valid** — `node --check` on all 7 modules.
- [x] **End-to-end offline smoke** — the real `cli.mjs` + `match`/`commission`
  over an in-memory dataset: a promo+arrival match, a ref-code match that
  overrides a mismatched arrival, and a refund line correctly excluded — 2 stays,
  5 room nights, $498.50 revenue, $49.85 commission @ 10%, exit 0.
- [x] **Public site untouched** — no layout/route/CSS/component/SEO-page change;
  the TECHNICAL_BASELINE §8 diff on the 23 pages is empty by construction.

**Acceptance scenarios exercised by the suite:** unique match; ref-code
override; one-intent-one-line contention; ambiguous multi-candidate (flagged,
not matched); unmatched line; unmatched (open) intent; determinism vs input
order; refund → cancelled/0; null rate → NULL commission + reported; dry-run =
no writes; guarded writes; abort-on-error; aging cutoff.

---

## 7. Business validation gate (live milestone)

M8 proves the *engine*. A live production reconciliation additionally needs the
two partner inputs from
[PARTNER_REFERRAL_ARCHITECTURE.md §7](PARTNER_REFERRAL_ARCHITECTURE.md):

- [ ] **The Best Western importer profile** (`profiles.mjs`, M6 · T04) — still
  blocked on BW confirming the CSV export format — so real report rows exist to
  reconcile.
- [ ] **`partner.commission_percent` populated** from the signed agreement — until
  then the engine runs and reports, but leaves commission NULL by design.

Live checklist (pending — not runnable this session):

- [ ] Apply `010`; `npm run verify:db` green (both tables still service_role-only).
- [ ] Import a report, then `npm run reconcile:run -- --partner best-western-vernal --period <YYYY-MM> --dry-run` → correct plan, zero writes.
- [ ] Real run → intents advance to `stayed`/`cancelled`, lines carry
  `booking_intent_id` + `status='matched'`, revenue/commission fill correctly.
- [ ] **Re-run → no changes** (idempotency confirmed live).

---

## 8. Known limitations

1. **Outcome inference** — cancellations/refunds are inferred from non-positive
   revenue/nights (no explicit status on the canonical line). Faithful to the
   provisional import contract; revisit when BW's real format is known.
2. **Member last-name tier (tier 2)** is supported but only fires when the caller
   supplies member names; the default wiring does not join `member_profile`
   (kept out to avoid extra PII coupling). Tiers 1/3/4 cover the anonymous case.
3. **Per-row writes, not one transaction** — apply updates rows individually and
   aborts on error; recovery is a re-run (safe because writes are status-guarded).
4. **`src/lib/database.types.ts`** should be regenerated for the widened
   `partner_report_line.status` union when types are next generated (cosmetic;
   the engine does not depend on it).

---

## 9. Verification run (offline)

- `node --test scripts/reconcile/*.test.mjs` — ✓ tests 58, pass 58, fail 0
- `npx eslint scripts/reconcile.mjs scripts/reconcile/` — ✓ 0 problems
- `npx prettier --check scripts/reconcile{,/**}/*.mjs` — ✓ clean
- `node --check` (7 modules) — ✓ all parse
- End-to-end CLI smoke (dry-run) — ✓ exit 0, totals correct
