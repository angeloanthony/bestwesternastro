# ADR‑003 — Adopt Supabase over a FastAPI Stack

**Status:** Accepted · 2026‑07

## Context
Earlier specs proposed FastAPI + PostgreSQL + Redis + Meilisearch + Cloudflare R2 + Railway — six services to provision, secure, monitor, and pay for, for a product with **one** customer (a hotel in a town of ~10,000). The project is built and maintained primarily by one developer and must stay maintainable for years on a ~$110/month budget.

## Decision
Use **Supabase** (Postgres 16 + PostGIS + pgvector + Auth + Storage + Row Level Security + auto‑generated REST) as the entire backend. Postgres full‑text search replaces Meilisearch; pgvector replaces a dedicated vector DB; RLS replaces a hand‑rolled auth layer. Reach for a Cloudflare Worker only when server‑side secrets or logic genuinely can't live in a Postgres function (the AI Concierge, lead‑notify, trip planner).

## Consequences
- **Positive:** One managed service instead of six; ~$60–120/month avoided; far less operational surface.
- **Positive:** Migration path out is a `pg_dump` — it's still just Postgres underneath.
- **Positive:** RLS is set on day one (migration 001), avoiding the pain of retrofitting permissions after data exists.
- **Cost:** Ties the project to Supabase's platform conventions (Auth, RLS policy model). Acceptable given the single‑tenant scale.
- **Guardrail:** Supabase **Pro** ($25/mo) from day one — the free tier pauses idle projects, which is unacceptable for a production database.
