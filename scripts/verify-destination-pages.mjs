#!/usr/bin/env node
// scripts/verify-destination-pages.mjs
//
// Checks the MECHANICAL items of docs/DESTINATION_PAGE_STANDARD.md against the built
// output in dist/. Items 2, 9 and 10 are human judgement and are reported as reminders,
// never as passes — a script cannot tell a sourced fact from a confident invention.
//
// Usage: npm run build && npm run verify:pages

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

/** Pages held to the destination standard. Add a slug here when a page is rewritten. */
const DESTINATION_PAGES = [
  'hotel-near-ashley-national-forest',
  'hotel-near-jensen-utah',
  'hotel-near-dinosaur-national-monument',
];

const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

function checkPage(slug) {
  const file = join(DIST, `${slug}.html`);
  if (!existsSync(file)) return [{ ok: false, label: 'page exists in dist/', detail: file }];

  const html = readFileSync(file, 'utf8');
  const text = strip(html);
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, '')
      .trim()
      .toLowerCase()
  );
  const has = (re) => headings.some((h) => re.test(h));

  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);
  let parsed = [];
  let jsonOk = true;
  for (const b of blocks) {
    try {
      parsed.push(JSON.parse(b));
    } catch {
      jsonOk = false;
    }
  }
  const types = parsed.map((p) => p['@type']);
  const entityBlock = parsed.find((p) => p.sameAs && Array.isArray(p.sameAs) && p.sameAs.length);

  // Any URL inside structured data that still points at a redirecting .html
  const ldHtmlUrls = blocks
    .join(' ')
    .match(/https:\/\/bestwesternvernalinn\.com\/[A-Za-z0-9._/-]*\.html/g);

  const supCount = (html.match(/<sup>/g) || []).length;

  return [
    { ok: /<h1[^>]*>/.test(html), label: '1. has an H1' },
    {
      ok: /utah/i.test(text) && /(county|vernal)/i.test(text),
      label: '1. entity anchored to Utah + county/Vernal',
    },
    { ok: supCount >= 3, label: '3. inline citation markers', detail: `${supCount} <sup> markers` },
    { ok: has(/source/), label: '3. visible Sources section' },
    { ok: has(/season/), label: '4. seasonal section' },
    { ok: has(/planning|plan your/), label: '5. planning section' },
    { ok: has(/frequently asked|faq/), label: '6. FAQ section' },
    { ok: jsonOk && blocks.length > 0, label: '7. all JSON-LD parses', detail: types.join(', ') },
    { ok: Boolean(entityBlock), label: '7. entity block with sameAs' },
    {
      ok: !ldHtmlUrls,
      label: '7. no redirecting .html URLs in structured data',
      detail: ldHtmlUrls ? ldHtmlUrls.join(', ') : '',
    },
    { ok: !/TODO|TK\b|placeholder|Lorem/i.test(text), label: '8/9. no placeholder text' },
    { ok: has(/permit|regulation/), label: '9. permits section (links, not restated rules)' },
  ];
}

let failed = 0;
console.log('\nDestination Page Standard — mechanical checks\n');

for (const slug of DESTINATION_PAGES) {
  console.log(`  ${slug}`);
  for (const r of checkPage(slug)) {
    if (!r.ok) failed++;
    const mark = r.ok ? '✓' : '✗';
    const detail = r.detail ? `  (${r.detail})` : '';
    console.log(`    ${mark} ${r.label}${detail}`);
  }
  console.log('');
}

console.log('  Human review still required (a script cannot verify these):');
console.log('    · 2.  geographic relationships genuinely explained');
console.log('    · 9.  every factual claim traces to its cited source');
console.log('    · 10. hotel relevance present but secondary\n');

if (failed) {
  console.error(`${failed} mechanical check(s) failed.\n`);
  process.exit(1);
}
console.log('All mechanical checks passed.\n');
