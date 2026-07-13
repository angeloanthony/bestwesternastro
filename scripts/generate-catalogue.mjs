// Build-time code generator for the Vernal attraction catalogue (M6).
//
// Reads the permanent Knowledge Base — the `location` table in Supabase — and
// emits src/data/attractions.generated.ts, the committed, app-facing catalogue
// the static Astro build compiles in. The DATABASE is the source of truth; this
// file bakes a deterministic snapshot into the build so browse never depends on
// a live query (no SSR) and never fails-closed on a database outage.
//
// Run (needs a live project; anon key is enough — loc_public_read exposes
// published rows), then format so the output matches the repo's prettier style:
//
//   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
//   PUBLIC_SUPABASE_ANON_KEY=xxxx \
//   node scripts/generate-catalogue.mjs
//
// It shells out to prettier at the end; a clean regen against the seeded DB
// leaves src/data/attractions.generated.ts unchanged (empty git diff).
//
// The app-facing `Attraction` shape is a SUBSET of the row — the DB also stores
// gps, difficulty, accessibility, etc. for future features that this catalogue
// does not surface today. See docs/M6_KNOWLEDGE_BASE_VERIFICATION.md.

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'data', 'attractions.generated.ts');
const DEST_SLUG = 'vernal';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    'Missing Supabase credentials.\n' +
      'Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)\n' +
      'then re-run: node scripts/generate-catalogue.mjs'
  );
  process.exit(1);
}

const supabase = createClient(url, key);

// Pull every published Vernal location, ordered exactly as the app ranks ties
// (priority asc). Only the columns the app-facing catalogue needs.
const { data, error } = await supabase
  .from('location')
  .select(
    'slug, name, emoji, categories, good_for, ai_summary, area, drive_minutes, visit_duration, learn_more_href, priority, status, destination:destination_id!inner(slug)'
  )
  .eq('destination.slug', DEST_SLUG)
  .eq('status', 'published')
  .order('priority', { ascending: true });

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error('No published locations found — seed the Knowledge Base first (database/seed).');
  process.exit(1);
}

// Map a DB row → the app-facing Attraction shape.
const attractions = data.map((r) => ({
  slug: r.slug,
  name: r.name,
  emoji: r.emoji,
  category: (r.categories ?? []).join(' · '),
  area: r.area,
  driveMinutes: r.drive_minutes,
  duration: r.visit_duration,
  interests: r.good_for ?? [],
  blurb: r.ai_summary,
  href: r.learn_more_href,
  priority: r.priority,
}));

const body = attractions.map((a) => `  ${JSON.stringify(a)},`).join('\n');

const file = `// ============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source of truth is the Postgres \`location\` + \`location_edge\` tables (the
// Vernal Knowledge Base — M6). Regenerate with:
//
//   PUBLIC_SUPABASE_URL=... PUBLIC_SUPABASE_ANON_KEY=... node scripts/generate-catalogue.mjs
//
// The generator reads every \`status='published'\` location for the 'vernal'
// destination and emits the app-facing \`Attraction\` shape below (a subset of
// the row — the DB also stores gps, difficulty, accessibility, etc. for future
// features). This file is committed so the static Astro build stays
// deterministic and offline-buildable, and so browse never fails-closed on a
// database outage. See docs/M6_KNOWLEDGE_BASE_VERIFICATION.md.
//
// Contract: the 13 original slugs + their fields are preserved VERBATIM so
// saved favorites resolve and the deterministic trip planner's output for the
// original catalogue is unchanged (ADR-007). Slugs are append-only.
// ============================================================================
import type { Attraction } from './attraction-types';

export const ATTRACTIONS: Attraction[] = [
${body}
];

/** Fast lookup by slug (favorites and itinerary stops are stored by slug). */
export const ATTRACTION_BY_SLUG: Record<string, Attraction> = Object.fromEntries(
  ATTRACTIONS.map((a) => [a.slug, a]),
);
`;

writeFileSync(OUT, file, 'utf8');
console.log(`Wrote ${attractions.length} locations → src/data/attractions.generated.ts`);

// Normalize to the repo's prettier style so the committed file is stable.
const res = spawnSync('npx', ['prettier', '--write', OUT], { stdio: 'inherit', shell: true });
if (res.status !== 0) {
  console.error('prettier failed — run `npm run format` before committing the generated file.');
  process.exit(1);
}
console.log('Formatted with prettier. Done.');
