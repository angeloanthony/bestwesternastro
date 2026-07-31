#!/usr/bin/env node
// scripts/verify-schema-entity.mjs
//
// Asserts that the built site describes ONE hotel, not several.
//
// WHY THIS EXISTS: before the `@id` consolidation, six JSON-LD nodes across five
// pages described the hotel with no `@id` between them — under two different
// names ("Best Western Vernal Inn" / "Best Western Extended Stay Vernal") and two
// different phone numbers (+14357896625 / +18015971696). Every one of those was
// live. The schema blocks were migrated from the legacy HTML as opaque strings, so
// `business.ts` — the file whose entire purpose is preventing a NAP mismatch —
// never reached them.
//
// This is a TRUTH check, so it FAILS CLOSED (exit 1), per ADR-008. Conflicting NAP
// is not a maintenance signal; it is wrong information already published.
//
// Usage: npm run build && npm run verify:schema

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const HOTELISH = /Hotel|LodgingBusiness|LocalBusiness|Motel|Resort/;

const ids = new Map();
const names = new Map();
const phones = new Map();
const anonymous = [];
const parseFailures = [];

const add = (map, key, file) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(file);
};

function walk(node, file) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, file));

  const type = Array.isArray(node['@type']) ? node['@type'].join('+') : node['@type'];
  if (type && HOTELISH.test(type)) {
    if (!node['@id']) {
      anonymous.push({ file, type, name: node.name ?? '(unnamed)' });
    } else {
      add(ids, node['@id'], file);
      // A bare reference ({@type,@id}) carries no NAP to disagree with — skip it.
      if (node.name) add(names, node.name, file);
      if (node.telephone) add(phones, node.telephone, file);
    }
  }
  for (const value of Object.values(node)) walk(value, file);
}

const htmlFiles = readdirSync(DIST, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.html'));

for (const file of htmlFiles) {
  const html = readFileSync(join(DIST, file), 'utf8');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      walk(JSON.parse(m[1]), file);
    } catch (e) {
      parseFailures.push({ file, message: e.message });
    }
  }
}

const problems = [];

if (parseFailures.length) {
  problems.push('JSON-LD that does not parse:');
  for (const p of parseFailures) problems.push(`    ${p.file}: ${p.message}`);
}

if (anonymous.length) {
  problems.push('Hotel node with no @id (splits the entity):');
  for (const a of anonymous) problems.push(`    ${a.file}: ${a.type} "${a.name}"`);
}

for (const [label, map] of [
  ['@id', ids],
  ['name', names],
  ['telephone', phones],
]) {
  if (map.size > 1) {
    problems.push(`Conflicting hotel ${label} — the site describes more than one business:`);
    for (const [value, files] of map) {
      problems.push(`    ${JSON.stringify(value)}  on ${[...files].sort().join(', ')}`);
    }
  }
}

if (problems.length) {
  console.error('FAIL — hotel identity is not consistent across the built site.\n');
  for (const line of problems) console.error(`  ${line}`);
  console.error('\nFix: build the node from src/data/schema.ts (hotelNode / hotelNodeFull /');
  console.error('hotelRef). Never hand-write a hotel node in a page.');
  process.exit(1);
}

const [id] = ids.keys();
console.log('PASS — one hotel entity across the built site.');
console.log(`  @id        ${id ?? '(no hotel node found)'}`);
console.log(`  name       ${[...names.keys()][0] ?? '—'}`);
console.log(`  telephone  ${[...phones.keys()][0] ?? '—'}`);
console.log(`  declared on ${ids.get(id)?.size ?? 0} page(s) of ${htmlFiles.length} built`);
