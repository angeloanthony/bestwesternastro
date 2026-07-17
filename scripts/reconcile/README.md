# Reconciliation matcher (M8)

Off-browser staff tool that links imported partner report rows (M6,
`partner_report_line`) to outbound booking intents (migration 006,
`booking_intent`) and produces verified stays, attributed revenue, and
commission. It is the step that turns "we recorded the click and imported the
report" into "we know which clicks became paid stays, and what they're worth."

It never matches from the browser — like the importer and `verify-db.mjs`, it
runs with the **service-role key** and aborts on error (not fail-open).

## Run

```
PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  npm run reconcile:run -- --partner best-western-vernal [--period 2026-06] [--dry-run]
```

| Flag | Meaning |
|---|---|
| `--partner <slug>` | required — partner registry slug |
| `--period <YYYY-MM>` | only reconcile lines whose arrival falls in that month |
| `--window-days <n>` | arrival tolerance for promo+arrival matching (default 1) |
| `--age-days <n>` | also age unmatched intents older than n days to `no_match` |
| `--operator <name>` | who ran it |
| `--dry-run` | compute + report the plan; **make no writes** |

Always start with `--dry-run` to review the plan before writing.

## How it decides (confidence tiers)

Strongest → weakest, per `docs/PARTNER_REFERRAL_ARCHITECTURE.md §4`:

1. **ref_code** — the per-click code echoed on the line (unique).
2. **promo + arrival + name** — promo code, arrival within ±1 day, member last name.
3. **promo + arrival** — promo code and arrival within ±1 day.
4. **promo only** — weak; matched only when a single candidate exists.

**Never guesses:** a line that strongly matches more than one available intent is
flagged `ambiguous` for a human, never auto-matched. **Never double-matches:**
one line ↔ one intent, backed by a unique index (migration 010).

## Commission

Computed only on completed stays: `round(revenue_cents × commission_percent ÷ 100)`.
Cancelled/refunded lines earn 0. **If the partner has no `commission_percent` on
record, commission is left `NULL`** (never invented) and the run reports how many
stays were affected.

## Idempotent

Writes are guarded by source status (`unmatched` lines; `clicked`/`confirmed`
intents), so re-running changes nothing and a partial run is resumed by running
again.

## Files

| File | Role |
|---|---|
| `rules.mjs` | pure classification (the tiers) |
| `match.mjs` | pure, deterministic matching engine → a plan |
| `commission.mjs` | pure commission + outcome derivation |
| `persist.mjs` | service-role fetch / apply / age |
| `cli.mjs` | injectable orchestration |
| `../reconcile.mjs` | entry-point shell |
| `*.test.mjs` | `node --test` unit tests |

Tests: `node --test scripts/reconcile/*.test.mjs`
