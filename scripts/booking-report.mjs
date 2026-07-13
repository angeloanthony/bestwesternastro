// Internal operational report for the Partner Referral Engine (M7 Phase 6).
//
// booking_intent is service_role-only by design (no client SELECT — see
// 006_booking_intent.sql). So this dashboard is generated OFF the browser: a
// staff member runs it with the service-role key and opens the resulting static
// HTML. Nothing is exposed to the public and no SSR/endpoint is added — it
// mirrors the script-tooling pattern of verify-db.mjs / generate-catalogue.mjs.
//
//   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node scripts/booking-report.mjs
//
// Writes reports/booking-report.html (gitignored — the rows carry member UUIDs).
// Shows: total clicks, per-partner, top landing pages, Pass vs anonymous,
// status breakdown, and recent referral history. NO financial reconciliation —
// this is operational, not commission math.

import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.REPORT_OUT_DIR || join(here, '..', 'reports');
const OUT = join(OUT_DIR, 'booking-report.html');
const HISTORY_LIMIT = 200;

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Missing credentials. This report reads booking_intent, which is\n' +
      'service_role-only (no anon/authenticated SELECT). Set:\n' +
      '  PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/booking-report.mjs\n' +
      'The service-role key is a server secret — never put it in the site build or a browser.'
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('booking_intent')
  .select(
    'created_at, partner_slug, ref_code, promo_code, user_id, status, checkin, checkout, party_size, landing_page, referrer, utm_source, device, saved_slugs, interests, has_itinerary'
  )
  .order('created_at', { ascending: false });

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

const rows = data ?? [];

// ── Aggregations ────────────────────────────────────────────────────────────
const total = rows.length;
const memberClicks = rows.filter((r) => r.user_id).length;
const anonClicks = total - memberClicks;

const tally = (items) => {
  const m = new Map();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const byPartner = tally(rows.map((r) => r.partner_slug || '(unknown)'));
const byStatus = tally(rows.map((r) => r.status || '(none)'));
const byLanding = tally(rows.map((r) => r.landing_page || '(direct / none)')).slice(0, 15);

// ── HTML (self-contained, theme-aware, no external resources) ────────────────
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const NOW = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const statTiles = [
  ['Total referral clicks', total],
  ['Pass members', memberClicks],
  ['Anonymous', anonClicks],
  ['Partners', byPartner.length],
]
  .map(
    ([label, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${label}</div></div>`
  )
  .join('');

const rowsList = (pairs, klabel) =>
  pairs.length
    ? `<table><thead><tr><th>${klabel}</th><th class="r">Clicks</th></tr></thead><tbody>${pairs
        .map(([k, n]) => `<tr><td>${esc(k)}</td><td class="r">${n}</td></tr>`)
        .join('')}</tbody></table>`
    : `<p class="empty">No data yet.</p>`;

const historyRows = rows
  .slice(0, HISTORY_LIMIT)
  .map(
    (r) => `<tr>
      <td class="mono">${esc(r.created_at?.replace('T', ' ').slice(0, 16))}</td>
      <td>${esc(r.partner_slug)}</td>
      <td class="mono">${esc(r.ref_code)}</td>
      <td><span class="pill s-${esc(r.status)}">${esc(r.status)}</span></td>
      <td>${r.user_id ? 'Member' : 'Anon'}</td>
      <td>${esc(r.checkin || '')}${r.checkout ? '&nbsp;→&nbsp;' + esc(r.checkout) : ''}</td>
      <td class="r">${(r.saved_slugs || []).length}</td>
      <td class="r">${(r.interests || []).length}</td>
      <td>${r.has_itinerary ? '✓' : ''}</td>
      <td>${esc(r.device || '')}</td>
      <td>${esc(r.utm_source || '')}</td>
    </tr>`
  )
  .join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Partner Referrals — Operational Report</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#1a2e52; --mut:#6b7280; --line:#e5e7eb; --card:#faf9f6; --gold:#c9a84c; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0e1c33; --fg:#e8eefc; --mut:#9aa7bd; --line:#24344f; --card:#14243f; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; padding:2rem 1.25rem 4rem; }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  .sub { color:var(--mut); margin:0 0 1.5rem; font-size:.9rem; }
  h2 { font-size:1.05rem; margin:2rem 0 .75rem; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:.75rem; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:.6rem; padding:1rem; }
  .tile .n { font-size:1.9rem; font-weight:800; color:var(--gold); }
  .tile .l { color:var(--mut); font-size:.8rem; text-transform:uppercase; letter-spacing:.05em; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
  @media (max-width:720px){ .cols{ grid-template-columns:1fr; } }
  table { width:100%; border-collapse:collapse; font-size:.85rem; }
  th,td { text-align:left; padding:.45rem .6rem; border-bottom:1px solid var(--line); white-space:nowrap; }
  th { color:var(--mut); font-weight:600; text-transform:uppercase; font-size:.7rem; letter-spacing:.05em; }
  td.r,th.r { text-align:right; }
  .mono { font-family:ui-monospace,'SFMono-Regular',Menlo,monospace; font-size:.8rem; }
  .scroll { overflow-x:auto; border:1px solid var(--line); border-radius:.6rem; }
  .pill { display:inline-block; padding:.05rem .5rem; border-radius:1rem; font-size:.72rem; font-weight:700; background:var(--line); }
  .s-confirmed,.s-stayed { background:#1f7a4d; color:#fff; }
  .s-clicked { background:var(--gold); color:#0e1c33; }
  .s-no_match,.s-cancelled { background:#9aa7bd; color:#0e1c33; }
  .empty { color:var(--mut); font-style:italic; }
  .note { color:var(--mut); font-size:.8rem; margin-top:2.5rem; border-top:1px solid var(--line); padding-top:1rem; }
</style></head>
<body><div class="wrap">
  <h1>Partner Referrals — Operational Report</h1>
  <p class="sub">Generated ${NOW} · ${total} booking-intent record${total === 1 ? '' : 's'} · operational only, no financial reconciliation.</p>

  <div class="tiles">${statTiles}</div>

  <div class="cols">
    <div><h2>Clicks by partner</h2>${rowsList(byPartner, 'Partner')}</div>
    <div><h2>Booking-intent status</h2>${rowsList(byStatus, 'Status')}</div>
  </div>

  <h2>Top landing pages</h2>
  ${rowsList(byLanding, 'Landing page')}

  <h2>Referral history <span style="color:var(--mut);font-weight:400">(most recent ${Math.min(total, HISTORY_LIMIT)})</span></h2>
  ${
    total
      ? `<div class="scroll"><table><thead><tr>
          <th>When</th><th>Partner</th><th>Ref code</th><th>Status</th><th>Who</th>
          <th>Dates</th><th class="r">Saved</th><th class="r">Interests</th><th>Itin.</th><th>Device</th><th>UTM src</th>
        </tr></thead><tbody>${historyRows}</tbody></table></div>`
      : `<p class="empty">No referral clicks recorded yet. Once /go is live and a visitor clicks "Book Now", rows appear here.</p>`
  }

  <p class="note">Internal document — booking_intent rows carry member UUIDs. Do not share externally.
  Reconciliation (revenue / commission / confirmations) is a later milestone; this report intentionally shows none.</p>
</div></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${total} record(s) → ${OUT}`);
console.log('Open that file in a browser. It is gitignored (reports/) — never commit it.');
