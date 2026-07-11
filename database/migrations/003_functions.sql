-- ============================================================================
-- AdventureOS — Migration 003: RPC functions (Report §7)
-- is_open_now (implemented here — the Report left the body as "..."),
-- nearby, match_locations, and rebuild_near_edges.
-- ============================================================================

-- season_contains: does MM-DD fall within [from, to], handling year wrap? ---
create or replace function season_contains(from_mmdd text, to_mmdd text, mmdd text)
returns boolean language sql immutable as $$
  select case
    when from_mmdd is null or to_mmdd is null then false
    when from_mmdd <= to_mmdd then mmdd >= from_mmdd and mmdd <= to_mmdd
    else mmdd >= from_mmdd or mmdd <= to_mmdd        -- wraps across year end
  end;
$$;

-- is_open_now: parse the hours JSONB. Returns:
--   true  = open at `at_ts`,  false = closed,  null = hours unknown/unspecified.
-- `tz` converts the incoming timestamptz to the destination's wall clock.
create or replace function is_open_now(h jsonb, at_ts timestamptz, tz text default 'America/Denver')
returns boolean language plpgsql stable as $$
declare
  local_ts  timestamp;
  t         time;
  mmdd      text;
  dow_key   text;
  reg       jsonb;
  s         jsonb;
  intervals jsonb;
  iv        jsonb;
  o         time;
  c         time;
  cl        jsonb;
begin
  if h is null or h = '{}'::jsonb then
    return null;                                    -- hours unknown
  end if;

  if coalesce((h->>'always_open')::boolean, false) then
    return true;
  end if;

  local_ts := at_ts at time zone tz;                -- wall-clock at destination
  t        := local_ts::time;
  mmdd     := to_char(local_ts, 'MM-DD');
  dow_key  := lower(to_char(local_ts, 'Dy'));       -- 'mon','tue',...

  -- Explicit closed dates win.
  if h ? 'closures' then
    for cl in select * from jsonb_array_elements(h->'closures') loop
      if cl->>'date' = to_char(local_ts, 'YYYY-MM-DD') then
        return false;
      end if;
    end loop;
  end if;

  -- A matching seasonal block overrides regular hours.
  reg := h->'regular';
  if h ? 'seasonal' then
    for s in select * from jsonb_array_elements(h->'seasonal') loop
      if season_contains(s->>'from', s->>'to', mmdd) then
        reg := coalesce(s->'regular', reg);
      end if;
    end loop;
  end if;

  if reg is null then
    return null;
  end if;

  intervals := reg->dow_key;
  if intervals is null then
    return null;                                    -- day not specified → unknown
  end if;
  if jsonb_array_length(intervals) = 0 then
    return false;                                   -- explicitly closed that day
  end if;

  for iv in select * from jsonb_array_elements(intervals) loop
    o := (iv->>'open')::time;
    c := (iv->>'close')::time;
    if c > o then
      if t >= o and t < c then return true; end if;
    else
      -- overnight interval, e.g. 20:00–02:00
      if t >= o or t < c then return true; end if;
    end if;
  end loop;

  return false;
end;
$$;

-- NEAR ME: distance-sorted, optionally filtered by user type ---------------
create or replace function nearby(
  lat double precision,
  lng double precision,
  radius_m int default 25000,
  for_user_type text default null,
  limit_n int default 30
) returns table (
  id uuid, name text, type location_type, ai_summary text,
  distance_m double precision, is_open_now boolean
) language sql stable as $$
  select l.id, l.name, l.type, l.ai_summary,
         st_distance(l.gps, st_point(lng, lat)::geography) as distance_m,
         is_open_now(l.hours, now()) as is_open_now
  from location l
  where l.status = 'published'
    and st_dwithin(l.gps, st_point(lng, lat)::geography, radius_m)
    and (for_user_type is null or for_user_type = any(l.good_for))
  order by distance_m
  limit limit_n;
$$;

-- SEMANTIC SEARCH: pgvector retrieval for the AI Concierge -----------------
create or replace function match_locations(
  query_embedding vector(1024),
  match_count int default 8
) returns table (id uuid, name text, ai_summary text, similarity float)
language sql stable as $$
  select l.id, l.name, l.ai_summary,
         1 - (l.embedding <=> query_embedding) as similarity
  from location l
  where l.status = 'published' and l.embedding is not null
  order by l.embedding <=> query_embedding
  limit match_count;
$$;

-- Generate 'near' edges from PostGIS (do NOT hand-author them). Re-run after
-- seeding / verification changes. Report §6 practical note.
create or replace function rebuild_near_edges(dest uuid default null)
returns void language sql as $$
  delete from location_edge where rel = 'near'
    and (dest is null or from_id in (select id from location where destination_id = dest));
  insert into location_edge (from_id, to_id, rel, weight)
  select a.id, b.id, 'near',
         1.0 / (1.0 + st_distance(a.gps, b.gps) / 1000.0)
  from location a
  join location b
    on a.id <> b.id
   and a.destination_id = b.destination_id
   and st_dwithin(a.gps, b.gps, 8000)               -- 8km radius
  where a.status = 'published' and b.status = 'published'
    and (dest is null or a.destination_id = dest);
$$;
