-- ============================================================================
-- Schema / provisioning verification — run AFTER migrations, in the Supabase
-- SQL editor. Answers "is my database EXACTLY what I think it is?" and catches
-- provisioning mistakes (missed migration, disabled extension, dropped policy)
-- immediately. Read-only; changes nothing.
--
-- Expected: every line prints PASS. Any "FAIL —" names the missing object.
-- ============================================================================

do $$
declare
  item text;
  exts  text[] := array['uuid-ossp','postgis','vector'];
  tbls  text[] := array['destination','location','location_edge','member_profile',
                        'itinerary','partner','offer','event','lead'];
  fns   text[] := array['set_updated_at','season_contains','is_open_now',
                        'nearby','match_locations','rebuild_near_edges'];
  pols  text[] := array['loc_public_read','event_public_read','offer_public_read',
                        'prof_own','itin_own','lead_insert'];
  rls   text[] := array['location','member_profile','itinerary','lead','event','offer'];
begin
  foreach item in array exts loop
    raise notice '% : extension %',
      case when exists (select 1 from pg_extension where extname = item) then 'PASS' else 'FAIL —' end, item;
  end loop;

  foreach item in array tbls loop
    raise notice '% : table public.%',
      case when to_regclass('public.' || item) is not null then 'PASS' else 'FAIL —' end, item;
  end loop;

  foreach item in array fns loop
    raise notice '% : function %()',
      case when exists (select 1 from pg_proc where proname = item) then 'PASS' else 'FAIL —' end, item;
  end loop;

  foreach item in array pols loop
    raise notice '% : policy %',
      case when exists (select 1 from pg_policies where policyname = item) then 'PASS' else 'FAIL —' end, item;
  end loop;

  foreach item in array rls loop
    raise notice '% : RLS enabled on %',
      case when (select relrowsecurity from pg_class where relname = item) then 'PASS' else 'FAIL —' end, item;
  end loop;
end $$;

-- Raw inventory (eyeball these too) -----------------------------------------
select version();
select extname, extversion from pg_extension order by extname;
select tablename from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;
select proname from pg_proc
  where pronamespace = 'public'::regnamespace order by proname;
