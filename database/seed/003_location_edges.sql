-- ============================================================================
-- AdventureOS — Seed 003: Location relationship graph (M6)
-- Populates `location_edge` — the foundation for trip planning, recommendations,
-- and future AI. Two kinds of edges:
--
--   1. PROXIMITY ('near') — NOT hand-authored. Generated from PostGIS by
--      rebuild_near_edges() (migration 003) at the bottom of this file, so
--      distances stay correct if a location's gps changes. Re-running that
--      function first deletes the 'near' edges it owns, so it is idempotent.
--
--   2. SEMANTIC edges — hand-authored below. Per the M6 decision, these reuse
--      the existing rel_type enum (no enum migration) and carry the specific
--      relationship in `note` / `to_ref` / `weight`:
--        • part_of        — a sub-site belongs to a parent (Cub Creek → DNM)
--        • alternative_to — Rain Alternative / Indoor Backup   (note says which)
--        • suitable_for   — Sunset / Family / season targets    (to_ref)
--        • recommended_for— Family Combo / Half-day & Full-day Pair / Kid
--                           Friendly Sequence pairings          (note says which)
--
-- Idempotent: deletes the semantic edges it owns for Vernal locations, then
-- re-inserts. Requires seed 002 (locations) applied first.
-- ============================================================================

-- Clear the semantic edges this seed owns (leave 'near' to rebuild_near_edges).
delete from location_edge
where rel in ('part_of','alternative_to','suitable_for','recommended_for')
  and from_id in (
    select id from location
    where destination_id = (select id from destination where slug='vernal')
  );

with loc as (
  select slug, id from location
  where destination_id = (select id from destination where slug='vernal')
),
e(from_slug, to_slug, rel, to_ref, weight, note) as (
  values
  -- part_of: sub-sites belong to a parent destination ------------------------
  ('dnm-cub-creek-petroglyphs',  'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('josie-morris-cabin',         'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('dnm-sound-of-silence-trail', 'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('split-mountain-boat-ramp',   'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('split-mountain-campground',  'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('green-river-campground',     'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('rainbow-park',               'dinosaur-national-monument', 'part_of', null, 1.0, 'Inside Dinosaur National Monument'),
  ('green-river-rafting',        'dinosaur-national-monument', 'part_of', null, 0.8, 'Runs through Dinosaur National Monument'),
  ('red-fleet-dinosaur-trackway','red-fleet-state-park',       'part_of', null, 1.0, 'Inside Red Fleet State Park'),
  ('steinaker-boat-ramp',        'steinaker-state-park',       'part_of', null, 1.0, 'Inside Steinaker State Park'),
  ('flaming-gorge-dam-visitor-center','flaming-gorge',         'part_of', null, 1.0, 'Part of Flaming Gorge NRA'),
  ('red-canyon-overlook',        'flaming-gorge',              'part_of', null, 1.0, 'Part of Flaming Gorge NRA'),
  ('sheep-creek-canyon',         'flaming-gorge',              'part_of', null, 1.0, 'Part of Flaming Gorge NRA'),
  ('swett-ranch',                'flaming-gorge',              'part_of', null, 1.0, 'Part of Flaming Gorge NRA'),
  ('flaming-gorge-marina',       'flaming-gorge',              'part_of', null, 1.0, 'Part of Flaming Gorge NRA'),
  ('jones-hole-trail',           'jones-hole-fish-hatchery',   'part_of', null, 1.0, 'Trailhead at the hatchery'),
  ('mcconkie-ranch-petroglyphs', 'dry-fork-canyon',            'part_of', null, 0.9, 'Located in Dry Fork Canyon'),
  ('dry-fork-flume-trail',       'mccoy-flats-trails',         'part_of', null, 0.8, 'Part of the McCoy Flats trail network'),

  -- alternative_to: Rain Alternative / Indoor Backup -------------------------
  ('utah-field-house-museum',    'dinosaur-national-monument', 'alternative_to', null, 0.9, 'Indoor backup for a rainy Quarry day'),
  ('utah-field-house-museum',    'red-fleet-state-park',       'alternative_to', null, 0.7, 'Indoor backup if the trail is wet'),
  ('uintah-heritage-museum',     'mcconkie-ranch-petroglyphs', 'alternative_to', null, 0.8, 'Rain alternative — history indoors'),
  ('uintah-heritage-museum',     'moonshine-arch',             'alternative_to', null, 0.7, 'Rain alternative — history indoors'),
  ('downtown-vernal',            'dinosaur-national-monument', 'alternative_to', null, 0.6, 'Rain alternative — dining & Main Street'),

  -- suitable_for: Sunset / Family (non-location target via to_ref) -----------
  ('fantasy-canyon',        null, 'suitable_for', 'sunset', 1.0, 'Sunset location — extraordinary light'),
  ('red-canyon-overlook',   null, 'suitable_for', 'sunset', 0.9, 'Sunset location over the reservoir'),
  ('moonshine-arch',        null, 'suitable_for', 'sunset', 0.8, 'Sunset location — golden arch'),
  ('red-fleet-state-park',  null, 'suitable_for', 'sunset', 0.7, 'Sunset location on the water'),
  ('utah-field-house-museum', null, 'suitable_for', 'family', 1.0, 'Kid friendly — dinosaurs indoors & out'),
  ('jones-hole-fish-hatchery',null, 'suitable_for', 'family', 0.9, 'Kid friendly — thousands of trout'),
  ('red-fleet-state-park',  null, 'suitable_for', 'family', 0.9, 'Kid friendly — swim & tracks'),
  ('steinaker-state-park',  null, 'suitable_for', 'family', 0.8, 'Kid friendly — calm reservoir'),
  ('dinosaurland-welcome-center', null, 'suitable_for', 'family', 0.6, 'Kid friendly — start here'),

  -- recommended_for: Family Combo / Half-day & Full-day Pair / Kid Sequence --
  ('utah-field-house-museum', 'red-fleet-state-park',       'recommended_for', null, 0.9, 'Family combo — museum + dinosaur trackway'),
  ('utah-field-house-museum', 'downtown-vernal',            'recommended_for', null, 0.7, 'Family combo — museum + Main Street'),
  ('moonshine-arch',          'utah-field-house-museum',    'recommended_for', null, 0.8, 'Half-day pair — quick hike + museum'),
  ('red-fleet-state-park',    'steinaker-state-park',       'recommended_for', null, 0.8, 'Half-day pair — two reservoirs'),
  ('dinosaur-national-monument','downtown-vernal',          'recommended_for', null, 0.9, 'Full-day pair — Quarry then dinner in town'),
  ('flaming-gorge',           'sheep-creek-canyon',         'recommended_for', null, 0.8, 'Full-day pair on the scenic byway'),
  ('pelican-lake',            'ouray-wildlife-refuge',      'recommended_for', null, 0.7, 'Half-day pair — fishing + birding'),
  ('jones-hole-fish-hatchery','red-fleet-dinosaur-trackway','recommended_for', null, 0.8, 'Kid friendly sequence — fish then footprints')
)
insert into location_edge (from_id, to_id, rel, to_ref, weight, note)
select lf.id, lt.id, e.rel::rel_type, e.to_ref, e.weight, e.note
from e
join loc lf on lf.slug = e.from_slug
left join loc lt on lt.slug = e.to_slug
where e.to_slug is null or lt.id is not null;   -- skip edges to a missing target

-- PROXIMITY: (re)build 'near' edges from PostGIS for the Vernal destination.
select rebuild_near_edges((select id from destination where slug='vernal'));
