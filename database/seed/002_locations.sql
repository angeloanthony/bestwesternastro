-- ============================================================================
-- AdventureOS — Seed 002: Vernal Knowledge Base locations (M6)
-- The first production dataset for the `location` table — 48 REAL Vernal-area
-- locations. Every row is a real place; no placeholders. Fields are lifted from
-- the site's published copy (the original 13) and hand-authored, verifiable
-- facts (the rest). Coordinates are approximate to each site (WGS84 lng/lat).
--
-- Requires migration 006 (adds emoji/area/drive_minutes/visit_duration/etc.).
-- Run after migrations + seed 001 (destination):
--   psql -f database/seed/002_locations.sql     (or paste into the SQL editor)
--
-- Idempotent UPSERT keyed by (destination_id, slug) — re-running refreshes the
-- catalogue in place. Slugs are the append-only contract (ADR-007): the 13
-- original slugs match src/data/attractions.generated.ts exactly so saved
-- favorites and itineraries keep resolving. status='published' so the public
-- read policy (loc_public_read) and the build-time generator pick them up.
--
-- category display string  = array_to_string(categories, ' · ')  (the generator
--                            reproduces the card label this way — keep in sync).
-- good_for                 = the catalogue's interest tags.
-- ai_summary               = the card blurb (NOT AI-generated — hand-authored).
-- ============================================================================

insert into location (
  destination_id, slug, name, type, categories, good_for, ai_summary, gps,
  emoji, area, drive_minutes, visit_duration, difficulty,
  family_friendly, pet_friendly, wheelchair_accessible,
  priority, featured, learn_more_href, status
)
values
-- ── Original 13 (verbatim contract with attractions.generated.ts) ────────────
((select id from destination where slug='vernal'), 'dinosaur-national-monument', 'Dinosaur National Monument', 'attraction',
  array['National Monument'], array['dinosaurs','outdoors','scenic','family','history'],
  'The crown jewel — the Quarry Exhibit Hall puts you face-to-face with 1,500+ dinosaur bones in the cliff face, plus canyon hikes and the Green River.',
  st_point(-109.3009, 40.4372)::geography, '🦕', 'day-trip', 20, 'full-day', null,
  true, false, true, 1, true, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'flaming-gorge', 'Flaming Gorge', 'attraction',
  array['National Recreation Area'], array['water','outdoors','scenic','family'],
  '200,000+ acres of red canyon and emerald reservoir with world-class fishing, boating, and the Flaming Gorge–Uintas National Scenic Byway.',
  st_point(-109.4213, 40.9147)::geography, '🔥', 'day-trip', 40, 'full-day', null,
  true, true, false, 2, true, 'hotel-near-flaming-gorge.html', 'published'),

((select id from destination where slug='vernal'), 'red-fleet-state-park', 'Red Fleet State Park', 'attraction',
  array['State Park','Hiking'], array['water','outdoors','dinosaurs','family'],
  '"Little Lake Powell" — hike the Dinosaur Trackway to 200-million-year-old footprints, then swim or kayak the sandstone reservoir.',
  st_point(-109.4267, 40.5814)::geography, '🦶', 'nearby', 12, 'half-day', 'easy',
  true, true, false, 3, true, 'hotel-near-red-fleet-state-park.html', 'published'),

((select id from destination where slug='vernal'), 'utah-field-house-museum', 'Utah Field House of Natural History', 'museum',
  array['Museum','State Park'], array['dinosaurs','history','family'],
  'Walk through 200 million years of geologic time. Life-sized dinosaur replicas outside, real fossils and a working prep lab inside. Right in downtown Vernal.',
  st_point(-109.5263, 40.4555)::geography, '🏛️', 'in-town', 5, 'half-day', null,
  true, false, true, 4, true, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'mcconkie-ranch-petroglyphs', 'McConkie Ranch Petroglyphs', 'attraction',
  array['Historic Site','Petroglyphs'], array['history','outdoors','scenic'],
  'Near-life-sized Fremont-era figures carved into canyon sandstone — some of the finest rock art in the American West. Free trail, best in morning light.',
  st_point(-109.6535, 40.5636)::geography, '🪨', 'nearby', 15, 'half-day', 'easy',
  false, true, false, 5, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'moonshine-arch', 'Moonshine Arch', 'attraction',
  array['Hiking','Nature'], array['outdoors','scenic','family'],
  'A 40-foot sandstone arch just 8 miles from town — an easy 2-mile round-trip hike with shaded caverns perfect for a picnic. Rarely crowded.',
  st_point(-109.4525, 40.5028)::geography, '🌉', 'nearby', 8, 'half-day', 'easy',
  true, true, false, 7, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'steinaker-state-park', 'Steinaker State Park', 'attraction',
  array['State Park','Water'], array['water','outdoors','family'],
  'Swimming, wakeboarding, kayaking, and camping around a quiet reservoir minutes from town — far fewer crowds than Red Fleet.',
  st_point(-109.5399, 40.5122)::geography, '🌊', 'nearby', 10, 'half-day', null,
  true, true, false, 8, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'fantasy-canyon', 'Fantasy Canyon', 'viewpoint',
  array['Scenic Wonder'], array['scenic','outdoors'],
  'Otherworldly sandstone formations that look like another planet. About an hour south, accessible by passenger car — extraordinary near sunset.',
  st_point(-109.3466, 40.0672)::geography, '🏜️', 'day-trip', 60, 'half-day', 'easy',
  false, true, false, 9, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'jones-hole-fish-hatchery', 'Jones Hole Fish Hatchery', 'attraction',
  array['Nature','Hiking'], array['outdoors','family','water'],
  'A working hatchery with thousands of trout, then a creek-side trail through canyon walls to Ely Creek Waterfall. Kids love the fish.',
  st_point(-109.0470, 40.5766)::geography, '🐟', 'day-trip', 30, 'half-day', 'easy',
  true, false, true, 10, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'green-river-rafting', 'Green River Rafting', 'attraction',
  array['Rafting','Adventure'], array['water','outdoors'],
  'Raft the legendary Green River through the canyons of Dinosaur National Monument. Single- and multi-day guided trips with local outfitters.',
  st_point(-109.2536, 40.4467)::geography, '🚣', 'day-trip', 20, 'full-day', null,
  false, false, false, 11, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'mccoy-flats-trails', 'McCoy Flats Trail Network', 'trailhead',
  array['Mountain Biking'], array['outdoors','scenic'],
  '100+ miles of mountain biking across McCoy Flats, Red Fleet, and the aspen-lined Dry Fork Flume Trail — all without the Moab crowds.',
  st_point(-109.6657, 40.3661)::geography, '🚵', 'nearby', 15, 'half-day', 'moderate',
  false, true, false, 12, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'dinaland-golf', 'Dinaland Golf Course', 'business',
  array['Golf'], array['outdoors','scenic'],
  'An 18-hole public course set against high-desert scenery, well-maintained and reasonably priced — a perfect morning before the canyons.',
  st_point(-109.5100, 40.4470)::geography, '⛳', 'in-town', 5, 'half-day', null,
  false, false, true, 13, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'downtown-vernal', 'Downtown Vernal', 'other',
  array['Dining','Local Life'], array['dining','family','history'],
  'A genuine small-town Main Street — top-rated Italian, Thai, Mexican and BBQ, craft beer across from the museum, and local shops worth a slow walk.',
  st_point(-109.5287, 40.4555)::geography, '🍽️', 'in-town', 5, 'quick', null,
  true, true, true, 6, true, 'explore.html#restaurants', 'published'),

-- ── M6 additional Vernal Knowledge Base locations ────────────────────────────
((select id from destination where slug='vernal'), 'flaming-gorge-dam-visitor-center', 'Flaming Gorge Dam & Visitor Center', 'attraction',
  array['National Recreation Area','Visitor Center'], array['scenic','history','family'],
  'Tour the 502-foot dam that holds back Flaming Gorge Reservoir, with a visitor center, guided walkways over the crest, and sweeping canyon views.',
  st_point(-109.4213, 40.9147)::geography, '🏞️', 'day-trip', 45, 'half-day', null,
  true, false, true, 14, false, 'hotel-near-flaming-gorge.html', 'published'),

((select id from destination where slug='vernal'), 'red-canyon-overlook', 'Red Canyon Overlook', 'viewpoint',
  array['Scenic Overlook','Visitor Center'], array['scenic','outdoors','family'],
  'A 1,360-foot sheer drop to the emerald reservoir below — arguably the most photographed view in Flaming Gorge, with a seasonal visitor center and rim trail.',
  st_point(-109.5555, 40.8815)::geography, '🌄', 'day-trip', 50, 'half-day', null,
  true, true, true, 15, false, 'hotel-near-flaming-gorge.html', 'published'),

((select id from destination where slug='vernal'), 'sheep-creek-canyon', 'Sheep Creek Canyon Geologic Loop', 'viewpoint',
  array['Scenic Drive','Geology'], array['scenic','outdoors','history'],
  'A short paved loop off the byway where the Uinta Fault tilts a billion years of rock on end — dramatic cliffs, bighorn sheep, and interpretive stops.',
  st_point(-109.6600, 40.8700)::geography, '🪨', 'day-trip', 55, 'half-day', null,
  true, true, false, 16, false, 'hotel-near-flaming-gorge.html', 'published'),

((select id from destination where slug='vernal'), 'swett-ranch', 'Swett Ranch Historic Homestead', 'attraction',
  array['Historic Site'], array['history','family','scenic'],
  'A preserved early-1900s homestead near Flaming Gorge — original cabins, barns, and equipment from the family that ranched this land off the grid for decades.',
  st_point(-109.4180, 40.9010)::geography, '🏚️', 'day-trip', 45, 'half-day', null,
  true, false, false, 17, false, 'hotel-near-flaming-gorge.html', 'published'),

((select id from destination where slug='vernal'), 'red-fleet-dinosaur-trackway', 'Red Fleet Dinosaur Trackway', 'trailhead',
  array['Trail','Dinosaur Tracks'], array['dinosaurs','outdoors','family'],
  'A 3-mile round-trip hike to a sandstone shelf stamped with 200-million-year-old dinosaur footprints at the water’s edge — bring water shoes to see them best.',
  st_point(-109.4260, 40.5860)::geography, '🦶', 'nearby', 12, 'half-day', 'moderate',
  true, true, false, 18, false, 'hotel-near-red-fleet-state-park.html', 'published'),

((select id from destination where slug='vernal'), 'dnm-cub-creek-petroglyphs', 'Cub Creek Petroglyphs', 'attraction',
  array['Petroglyphs','Scenic Drive'], array['history','scenic','family'],
  'The Tour of the Tilted Rocks drive inside Dinosaur National Monument ends at large, well-preserved Fremont lizard and figure petroglyphs on the canyon wall.',
  st_point(-109.2900, 40.4300)::geography, '🪨', 'day-trip', 25, 'half-day', null,
  true, false, false, 19, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'josie-morris-cabin', 'Josie Morris Cabin', 'attraction',
  array['Historic Site'], array['history','scenic','family'],
  'The homestead where pioneer Josie Bassett Morris lived alone for 50 years, at the end of the Cub Creek road — short trails lead to shady box canyons.',
  st_point(-109.2740, 40.4260)::geography, '🏚️', 'day-trip', 30, 'quick', null,
  true, true, false, 20, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'dnm-sound-of-silence-trail', 'Sound of Silence Trail', 'trailhead',
  array['Trail'], array['outdoors','scenic'],
  'A 3.2-mile route through the desert badlands of Dinosaur National Monument that rewards route-finding with quiet, colorful, otherworldly terrain.',
  st_point(-109.2560, 40.4380)::geography, '🥾', 'day-trip', 25, 'half-day', 'moderate',
  false, true, false, 21, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'split-mountain-boat-ramp', 'Split Mountain Boat Ramp', 'other',
  array['Boat Ramp','River Access'], array['water','outdoors'],
  'The take-out for Green River day rafts through Split Mountain Gorge and a launch for calm-water paddling, framed by the mountain’s dramatic folded strata.',
  st_point(-109.2536, 40.4467)::geography, '🚤', 'day-trip', 25, 'quick', null,
  false, true, false, 22, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'split-mountain-campground', 'Split Mountain Campground', 'other',
  array['Campground'], array['outdoors','water','family'],
  'A first-come riverside campground in Dinosaur National Monument beneath Split Mountain — a quiet base for rafting, hiking, and night skies.',
  st_point(-109.2530, 40.4455)::geography, '🏕️', 'day-trip', 25, 'full-day', null,
  true, true, false, 23, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'green-river-campground', 'Green River Campground', 'other',
  array['Campground'], array['outdoors','water','family'],
  'The monument’s largest campground, shaded by cottonwoods along the Green River — reservable sites, a boat ramp nearby, and easy access to the Quarry.',
  st_point(-109.2470, 40.4380)::geography, '🏕️', 'day-trip', 25, 'full-day', null,
  true, true, true, 24, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'rainbow-park', 'Rainbow & Island Park', 'other',
  array['River Access','Boat Ramp'], array['water','outdoors','scenic'],
  'A remote launch on the Green River reached by dirt road, gateway to the Rainbow Park petroglyphs and multi-day float trips through the monument.',
  st_point(-109.2170, 40.4720)::geography, '🚣', 'day-trip', 60, 'full-day', null,
  false, true, false, 25, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'pelican-lake', 'Pelican Lake', 'attraction',
  array['Fishing','Lake'], array['water','outdoors','family'],
  'One of the West’s most famous bluegill fisheries, also strong for largemouth bass — a shallow, weedy lake best fished from a float tube or small boat.',
  st_point(-109.6720, 40.1780)::geography, '🎣', 'day-trip', 35, 'half-day', null,
  true, true, false, 26, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'stewart-lake', 'Stewart Lake Waterfowl Area', 'attraction',
  array['Fishing','Birding'], array['outdoors','water','family'],
  'A state waterfowl management area minutes from town — seasonal bird watching, quiet trails, and bank fishing along the Green River bottoms.',
  st_point(-109.4300, 40.4200)::geography, '🦆', 'nearby', 15, 'half-day', null,
  true, true, false, 27, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'ouray-wildlife-refuge', 'Ouray National Wildlife Refuge', 'attraction',
  array['Wildlife Refuge','Birding'], array['outdoors','scenic','family'],
  'A 12-mile wildlife drive along the Green River wetlands south of Vernal — herons, eagles, and hundreds of migratory species, best at dawn and dusk.',
  st_point(-109.6560, 40.0890)::geography, '🦅', 'day-trip', 40, 'half-day', null,
  true, false, false, 28, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'red-cloud-loop', 'Red Cloud Loop Scenic Backway', 'viewpoint',
  array['Scenic Drive'], array['scenic','outdoors'],
  'A ~75-mile loop climbing from high desert into the aspen and pine of the Uinta Mountains, past East Park and Oaks Park reservoirs — best late summer to fall.',
  st_point(-109.6300, 40.6600)::geography, '🚗', 'day-trip', 30, 'full-day', null,
  false, true, false, 29, false, 'hotel-near-ashley-national-forest.html', 'published'),

((select id from destination where slug='vernal'), 'ashley-national-forest', 'Ashley National Forest', 'attraction',
  array['National Forest'], array['outdoors','scenic','family'],
  '1.4 million acres of the Uinta Mountains north of Vernal — alpine lakes, cool pine forest, trout streams, and campgrounds that escape the summer heat.',
  st_point(-109.7000, 40.6600)::geography, '🌲', 'day-trip', 35, 'full-day', null,
  true, true, false, 30, false, 'hotel-near-ashley-national-forest.html', 'published'),

((select id from destination where slug='vernal'), 'dry-fork-canyon', 'Dry Fork Canyon', 'viewpoint',
  array['Scenic Drive','Canyon'], array['scenic','history','outdoors'],
  'A red-rock canyon northwest of town lined with ranches and rock art — the setting for the McConkie Ranch petroglyphs and an easy, pretty scenic drive.',
  st_point(-109.6500, 40.5620)::geography, '🏜️', 'nearby', 15, 'half-day', null,
  true, true, false, 31, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'nine-mile-canyon', 'Nine Mile Canyon Rock Art', 'attraction',
  array['Petroglyphs','Scenic Drive'], array['history','scenic','outdoors'],
  'Called “the world’s longest art gallery” — thousands of Fremont petroglyphs and pictographs along a 40-mile back-country drive. A full day, fuel up first.',
  st_point(-110.3000, 39.7800)::geography, '🖼️', 'day-trip', 90, 'full-day', null,
  false, true, false, 32, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'john-jarvie-ranch', 'John Jarvie Historic Ranch', 'attraction',
  array['Historic Site'], array['history','scenic','outdoors'],
  'A restored 1880s trading post in remote Browns Park, on the old Outlaw Trail once ridden by Butch Cassidy — ranger-led tours and Green River access.',
  st_point(-109.1600, 40.8900)::geography, '🤠', 'day-trip', 75, 'full-day', null,
  false, true, false, 33, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'starvation-state-park', 'Starvation State Park', 'attraction',
  array['State Park','Water'], array['water','outdoors','family'],
  'A big open reservoir west of Vernal near Duchesne — boating, walleye and bass fishing, sandy swimming beaches, and lakeside camping.',
  st_point(-110.4470, 40.1660)::geography, '🌊', 'day-trip', 60, 'full-day', null,
  true, true, false, 34, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'uintah-heritage-museum', 'Uintah County Western Heritage Museum', 'museum',
  array['Museum'], array['history','family'],
  'Free local history museum with Fremont and Ute artifacts, an Ice Age mammoth, pioneer and outlaw exhibits, and the noted Ladies of the White House doll collection.',
  st_point(-109.5250, 40.4530)::geography, '🏛️', 'in-town', 5, 'half-day', null,
  true, false, true, 35, false, 'explore.html#adventures', 'published'),

((select id from destination where slug='vernal'), 'vernal-utah-temple', 'Vernal Utah Temple', 'attraction',
  array['Landmark'], array['history','scenic'],
  'A striking LDS temple converted from the 1907 Uintah Stake Tabernacle — its landscaped grounds are open to visitors and lovely for a short downtown stroll.',
  st_point(-109.5350, 40.4530)::geography, '⛪', 'in-town', 5, 'quick', null,
  false, false, true, 36, false, 'things-to-do-vernal-utah.html', 'published'),

((select id from destination where slug='vernal'), 'parcel-post-bank', 'Parcel Post Bank', 'attraction',
  array['Historic Site','Landmark'], array['history'],
  'Vernal’s famous “bank built by mail” — in 1916 the builder shipped 80,000 bricks by parcel post to dodge freight rates, still standing on Main Street.',
  st_point(-109.5280, 40.4556)::geography, '🏦', 'in-town', 5, 'quick', null,
  false, false, true, 37, false, 'things-to-do-vernal-utah.html', 'published'),

((select id from destination where slug='vernal'), 'dinosaurland-welcome-center', 'Dinosaurland Welcome Center', 'service',
  array['Visitor Center'], array['family','scenic'],
  'The regional travel information center in downtown Vernal — maps, road and trail conditions, event listings, and friendly local advice to plan your days.',
  st_point(-109.5300, 40.4556)::geography, '🦖', 'in-town', 5, 'quick', null,
  true, false, true, 38, false, 'things-to-do-vernal-utah.html', 'published'),

((select id from destination where slug='vernal'), 'vernal-brewing-co', 'Vernal Brewing Company', 'restaurant',
  array['Restaurant','Brewery'], array['dining','family'],
  'A local brewpub with house-brewed beer and a full scratch kitchen — burgers, wood-fired pizza, and salads, a popular spot after a day in the canyons.',
  st_point(-109.5228, 40.4548)::geography, '🍺', 'in-town', 5, 'quick', null,
  true, false, true, 39, false, 'explore.html#restaurants', 'published'),

((select id from destination where slug='vernal'), 'seven-eleven-ranch-restaurant', '7-11 Ranch Restaurant', 'restaurant',
  array['Restaurant','Steakhouse'], array['dining'],
  'A Vernal institution since the 1930s for hand-cut steaks, hearty ranch breakfasts, and homemade pie — classic small-town Utah cooking on Main Street.',
  st_point(-109.5290, 40.4556)::geography, '🥩', 'in-town', 5, 'quick', null,
  false, false, true, 40, false, 'explore.html#restaurants', 'published'),

((select id from destination where slug='vernal'), 'bettys-cafe', 'Betty''s Cafe', 'restaurant',
  array['Restaurant','Breakfast'], array['dining','family'],
  'A beloved no-frills breakfast-and-lunch diner known for big portions and fast, friendly service — the local pick to fuel up before an early trailhead.',
  st_point(-109.5330, 40.4556)::geography, '🍳', 'in-town', 5, 'quick', null,
  true, false, true, 41, false, 'explore.html#restaurants', 'published'),

((select id from destination where slug='vernal'), 'antica-forma', 'Antica Forma', 'restaurant',
  array['Restaurant','Italian'], array['dining','family'],
  'Neapolitan-style wood-fired pizza and fresh pasta downtown — a highly rated Italian spot that surprises first-time visitors to small-town Vernal.',
  st_point(-109.5270, 40.4556)::geography, '🍕', 'in-town', 5, 'quick', null,
  true, false, true, 42, false, 'explore.html#restaurants', 'published'),

((select id from destination where slug='vernal'), 'dinosaur-brew-haus', 'Dinosaur Brew Haus & Grill', 'restaurant',
  array['Restaurant','Grill'], array['dining','family'],
  'A casual downtown grill and sports pub with burgers, wings, and a wide tap list — an easy, family-friendly stop for a relaxed dinner in town.',
  st_point(-109.5200, 40.4556)::geography, '🍔', 'in-town', 5, 'quick', null,
  true, false, true, 43, false, 'explore.html#restaurants', 'published'),

((select id from destination where slug='vernal'), 'brush-creek-cave', 'Brush Creek Cave', 'trailhead',
  array['Cave','Trail'], array['outdoors','scenic'],
  'A short hike in the Ashley National Forest to a large limestone cave carved by Big Brush Creek — bring a headlamp and sturdy shoes for the stream crossing.',
  st_point(-109.4500, 40.7100)::geography, '🕳️', 'day-trip', 40, 'half-day', 'moderate',
  false, true, false, 44, false, 'hotel-near-ashley-national-forest.html', 'published'),

((select id from destination where slug='vernal'), 'jones-hole-trail', 'Jones Hole Creek Trail', 'trailhead',
  array['Trail','Waterfall'], array['outdoors','water','scenic'],
  'From the fish hatchery, an 8-mile round-trip along a spring-fed creek past Fremont pictographs to Ely Creek Falls and the Green River — one of the area’s best hikes.',
  st_point(-109.0470, 40.5766)::geography, '🥾', 'day-trip', 45, 'full-day', 'moderate',
  false, true, false, 45, false, 'hotel-near-dinosaur-national-monument.html', 'published'),

((select id from destination where slug='vernal'), 'dry-fork-flume-trail', 'Dry Fork Flume Trail', 'trailhead',
  array['Trail','Mountain Biking'], array['outdoors','scenic'],
  'An aspen-lined singletrack following a historic irrigation flume line — flowy, shaded riding and hiking with big views over Dry Fork Canyon.',
  st_point(-109.6600, 40.6100)::geography, '🚵', 'nearby', 20, 'half-day', 'moderate',
  false, true, false, 46, false, 'explore.html#outdoors', 'published'),

((select id from destination where slug='vernal'), 'steinaker-boat-ramp', 'Steinaker Reservoir Boat Ramp', 'other',
  array['Boat Ramp'], array['water','outdoors'],
  'The concrete launch on Steinaker Reservoir — quick water access for boating, wakeboarding, paddleboards, and warm-water fishing just north of town.',
  st_point(-109.5390, 40.5150)::geography, '🚤', 'nearby', 10, 'quick', null,
  false, true, true, 47, false, 'hotel-near-red-fleet-state-park.html', 'published'),

((select id from destination where slug='vernal'), 'flaming-gorge-marina', 'Cedar Springs Marina', 'business',
  array['Marina','Boat Ramp'], array['water','outdoors','family'],
  'The full-service marina near Flaming Gorge Dam — boat rentals, fuel, slips, and guided lake-trout charters on the reservoir’s deep, clear water.',
  st_point(-109.4470, 40.9080)::geography, '🛥️', 'day-trip', 50, 'half-day', null,
  true, true, false, 48, false, 'hotel-near-flaming-gorge.html', 'published')

on conflict (destination_id, slug) do update set
  name             = excluded.name,
  type             = excluded.type,
  categories       = excluded.categories,
  good_for         = excluded.good_for,
  ai_summary       = excluded.ai_summary,
  gps              = excluded.gps,
  emoji            = excluded.emoji,
  area             = excluded.area,
  drive_minutes    = excluded.drive_minutes,
  visit_duration   = excluded.visit_duration,
  difficulty       = excluded.difficulty,
  family_friendly  = excluded.family_friendly,
  pet_friendly     = excluded.pet_friendly,
  wheelchair_accessible = excluded.wheelchair_accessible,
  priority         = excluded.priority,
  featured         = excluded.featured,
  learn_more_href  = excluded.learn_more_href,
  status           = excluded.status,
  last_verified    = now();
