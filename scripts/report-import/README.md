# `scripts/report-import/` — Partner report CSV importer (M6)

Off-browser CLI tooling that ingests a partner's monthly reservation CSV into the staff-only
`partner_report` / `partner_report_line` tables. Same pattern as `scripts/booking-report.mjs`
and `scripts/verify-db.mjs`: plain `.mjs`, ESM, Node ≥22.12, run with the **service-role
key**. Unlike the read-only reports, this is a **write** tool — it is atomic and aborts on
error (not fail-open).

Entry point: [`../import-report.mjs`](../import-report.mjs) (run via `npm run report:import`).
This directory holds the step modules the entry point wires together.

See [docs/M6_CSV_IMPORTER.md](../../docs/M6_CSV_IMPORTER.md) for the schema precondition and
CSV column contract, and [docs/M6_CSV_IMPORTER_CHECKLIST.md](../../docs/M6_CSV_IMPORTER_CHECKLIST.md)
for the task breakdown.

## Module layout (built task-by-task)

| File | Task | Responsibility |
| --- | --- | --- |
| `canonical.mjs` | T03 | Canonical line-record shape shared by every step. |
| `profiles.mjs`  | T04 | Slug-keyed partner registry; the Best Western header→canonical profile. |
| `parser.mjs`    | T05a, T06 | RFC-4180 CSV reader + profile-driven transform to canonical records. |
| `validate.mjs`  | T07, T08 | Structural + row-level validation → error/warning manifest. |
| `dedup.mjs`     | T09 | File hashing + duplicate-detection helpers. |
| `persist.mjs`   | T12–T14 | Service-role insert of header + batched lines, with rollback. |

Only `canonical.mjs` and the modules above land in later tasks — this file and the usage
stub are the T02 scaffold. Core modules stay **profile-driven** with zero hotel-specific
logic; a new partner is a new profile object, never a core change.

## Dependency decision (T02): vendored reader, no `csv-parse`

The CSV reader is **vendored** (a small RFC-4180 parser authored in `parser.mjs` at T05a),
**not** the `csv-parse` npm package. Rationale:

- The repo is deliberately lean on dependencies; the report format is a simple, well-scoped
  RFC-4180 CSV that a compact hand-written reader handles (quoted fields, embedded
  commas/newlines, CRLF, BOM).
- Everything else this tool needs is already in the Node stdlib — `node:util` `parseArgs`
  for CLI args, `node:crypto` for hashing, `node:test` for unit tests — so the importer adds
  **zero** new runtime or dev dependencies.
- Fewer supply-chain surfaces on a tool that runs with the service-role key.

If a future partner ships a genuinely gnarly dialect, revisit — but the pilot does not
justify a dependency.
