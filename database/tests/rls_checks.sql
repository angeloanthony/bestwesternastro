-- ============================================================================
-- RLS verification — run AFTER migrations + seed, in the Supabase SQL editor.
-- Proves the Row Level Security policies behave before real data exists
-- (Report §6: "Adding RLS after data exists is painful"). This whole script
-- runs in a transaction that ROLLS BACK — it leaves no data behind.
--
-- Expected: every check prints "PASS". Any "FAIL" is a policy bug to fix now.
-- ============================================================================
begin;

-- Fixtures: one published + one draft location under the seeded 'vernal' dest.
do $$
declare
  dest uuid;
begin
  select id into dest from destination where slug = 'vernal';
  if dest is null then
    raise exception 'Seed database/seed/001_destination.sql first (no vernal destination).';
  end if;

  insert into location (destination_id, slug, name, type, ai_summary, gps, status)
  values
    (dest, 'rls-pub', 'RLS Published', 'other', 'published fixture',
       st_point(-109.52, 40.45)::geography, 'published'),
    (dest, 'rls-draft', 'RLS Draft', 'other', 'draft fixture',
       st_point(-109.52, 40.45)::geography, 'draft');
end $$;

-- Run the checks as the anonymous role (what the public site uses).
set local role anon;

do $$
declare
  n int;
  denied boolean;
begin
  -- 1. Public sees ONLY published locations.
  select count(*) into n from location where slug in ('rls-pub','rls-draft');
  raise notice '% : anon reads published only (expect 1, got %)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  -- 2. Anyone may INSERT a lead (the corporate form path).
  denied := false;
  begin
    insert into lead (kind, contact_name, email) values ('corporate_rate','RLS Test','rls@test.dev');
  exception when insufficient_privilege or others then denied := true;
  end;
  raise notice '% : anon can insert a lead (expect not denied)',
    case when not denied then 'PASS' else 'FAIL' end;

  -- 3. Nobody may SELECT leads with the anon key (privacy).
  select count(*) into n from lead;
  raise notice '% : anon cannot read leads (expect 0 rows, got %)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- 4. Anon may NOT insert a location (no insert policy → denied).
  denied := false;
  begin
    insert into location (destination_id, slug, name, type, ai_summary, gps, status)
    select id, 'rls-hack', 'x', 'other', 'x', st_point(-109.5,40.4)::geography, 'published'
    from destination where slug = 'vernal';
  exception when others then denied := true;
  end;
  raise notice '% : anon cannot insert a location (expect denied)',
    case when denied then 'PASS' else 'FAIL' end;
end $$;

reset role;
rollback;  -- discard all fixtures/leads created above

-- NOTE: member-scoped policies (member_profile / itinerary "own rows only")
-- require an authenticated JWT with a real auth.uid() and are best verified
-- from the app in Prompt 5, or with a signed test token. See docs/STAGING_CHECKLIST.md.
