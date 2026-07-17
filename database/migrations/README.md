# database/migrations/

Numbered, version-controlled SQL migrations for Supabase/Postgres, applied **in order** via the
Supabase SQL Editor (this repo does not use the Supabase CLI migration layout — see
[docs/PROVISIONING.md §2](../../docs/PROVISIONING.md) and
[docs/LOCAL_SUPABASE_SETUP.md](../../docs/LOCAL_SUPABASE_SETUP.md)). Each migration is additive
and idempotent; `001` enables the `postgis`, `vector`, and `uuid-ossp` extensions.

| File | Purpose |
| --- | --- |
| `001_schema.sql` | Base schema — tables, enums, indexes |
| `002_rls.sql` | Row Level Security (default-deny) |
| `003_functions.sql` | RPC functions (`is_open_now`, `nearby`, `match_locations`, `rebuild_near_edges`) |
| `004_grants.sql` | Table privileges (grant baseline) |
| `005_favorite.sql` | Saved Adventures (favorites) |
| `006_booking_intent.sql` | Booking attribution spine (`booking_intent` + `partner` columns) |
| `007_location_fields.sql` | Location catalogue fields (Knowledge Base) |
| `008_booking_journey.sql` | Booking-intent journey snapshot |
| `009_partner_report.sql` | Partner report import tables (`partner_report`, `partner_report_line`) |
| `010_reconciliation.sql` | Reconciliation — status widen, matcher indexes, double-match unique index |
