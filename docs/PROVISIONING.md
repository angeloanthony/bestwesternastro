# Provisioning Runbook — Supabase + Lead Notifications

Everything in Prompt 4 is authored and build-verified, but **dormant until you provision the backend**. These are the steps to make it live. Nothing here can be done from the repo alone — it needs your Supabase / Cloudflare / Resend accounts.

Until these steps run, the corporate rate form still works: it **falls back to a pre-filled mailto** to the front desk, so no lead is lost.

## 1. Create the Supabase project (ADR-003)

1. Create a project at supabase.com. Choose the **Pro** tier (Baseline: avoids the free-tier pausing a production DB).
2. Note the Project URL and the **anon** and **service_role** keys (Settings → API).

## 2. Run the migrations

From the repo, using the Supabase CLI (or paste each file into the SQL editor **in order**):

```bash
supabase link --project-ref <your-ref>
supabase db push          # applies database/migrations/001,002,003 in order
# then seed the single destination:
psql "$SUPABASE_DB_URL" -f database/seed/001_destination.sql
```

Order matters: `001_schema` → `002_rls` → `003_functions`. `001` enables the `postgis`, `vector`, and `uuid-ossp` extensions (available on Supabase by default).

## 3. Wire the site env

Set these in Cloudflare Pages (Settings → Environment variables) and locally in `.env`:

```
PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

That alone activates **lead capture** — the corporate form switches from mailto fallback to writing rows into the `lead` table (RLS policy `lead_insert` allows anonymous INSERT; nobody can read leads without the service role).

Optionally also set `PUBLIC_GA4_MEASUREMENT_ID` / `PUBLIC_CALLRAIL_ID` (Prompt 3) to light up analytics.

## 4. Deploy the lead-notify Worker (email alerts)

Makes the front desk get an email the instant a lead arrives.

```bash
cd workers
npx wrangler deploy
npx wrangler secret put RESEND_API_KEY        # from resend.com
npx wrangler secret put LEAD_WEBHOOK_SECRET    # any long random string
```

Edit `workers/wrangler.toml` `FRONT_DESK_EMAIL` to the real inbox, and verify your sending domain in Resend (`FROM_EMAIL`).

## 5. Connect the Supabase webhook → Worker

Supabase Dashboard → Database → Webhooks → **Create**:

- Table: `lead`, Events: **Insert**
- Type: HTTP POST → your deployed Worker URL
- HTTP header: `x-webhook-secret: <the LEAD_WEBHOOK_SECRET you set above>`

Now: form submit → `lead` row inserted → webhook fires → Worker emails the front desk.

## 6. Verify end to end

1. Submit the form at `/corporate-rates`.
2. Confirm a row appears in `lead` (Supabase Table editor).
3. Confirm the front-desk inbox received the alert email.

## What's already done in the repo

- `database/migrations/*` — full schema + RLS + RPC functions (`is_open_now`, `nearby`, `match_locations`, `rebuild_near_edges`).
- `database/seed/001_destination.sql` — the Vernal destination row.
- `src/lib/supabase.ts` / `leads.ts` — client + submit service with mailto fallback.
- `src/islands/CorporateRateForm.tsx` + `src/pages/corporate-rates.astro` — the live form + page.
- `workers/lead-notify.ts` + `wrangler.toml` — the email Worker.

## Notes / follow-ups

- After adding real Location records, run `select rebuild_near_edges();` to generate the `near` graph.
- Replace hand-authored `src/lib/database.types.ts` with generated types:
  `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts`.
- `/corporate-rates` is `noindex` for now; the indexed corporate hub (Module 7) will link to it.
