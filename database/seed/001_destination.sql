-- Seed the single destination (Vernal). Coordinates match src/data/business.ts.
-- Run once after migrations: supabase db push then this file.
insert into destination (slug, name, center, timezone)
values (
  'vernal',
  'Vernal, Utah',
  st_point(-109.5194, 40.4474)::geography,  -- lng, lat (business.ts geo)
  'America/Denver'
)
on conflict (slug) do nothing;
