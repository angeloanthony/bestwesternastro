// Runs the live-database verification scripts and turns their PASS/FAIL notices
// into a real exit code, so `npm run verify:db` can gate a release.
//
// The SQL files (database/tests/*.sql) report failures with `raise notice
// 'FAIL —'`, which psql prints to stderr but exits 0 on. We capture that output
// and exit non-zero if any line reports FAIL — otherwise a broken schema would
// look "green". Needs a live connection string and psql on PATH.
//
//   SUPABASE_DB_URL=postgres://... npm run verify:db
//
// Get the URL from Supabase → Project Settings → Database → Connection string
// (use the session/pooler URI). This runs read-only checks; rls_checks.sql
// wraps itself in a transaction that rolls back, so it leaves no data behind.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const testsDir = join(here, '..', 'database', 'tests');
const scripts = ['schema_checks.sql', 'rls_checks.sql'];

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    'SUPABASE_DB_URL is not set.\n' +
      'This gate needs the LIVE database — it cannot run offline.\n' +
      'Either set the connection string:\n' +
      '  SUPABASE_DB_URL=postgres://... npm run verify:db\n' +
      'or paste database/tests/schema_checks.sql and rls_checks.sql into the\n' +
      'Supabase SQL editor and confirm every line prints PASS.'
  );
  process.exit(1);
}

let anyFail = false;
for (const file of scripts) {
  const path = join(testsDir, file);
  if (!existsSync(path)) {
    console.error(`FAIL — missing check script: ${path}`);
    anyFail = true;
    continue;
  }

  console.log(`\n=== ${file} ===`);
  // ON_ERROR_STOP surfaces hard SQL errors (e.g. seed missing) as a non-zero
  // psql exit; the FAIL-scan below covers the soft `raise notice` failures.
  const res = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', path], { encoding: 'utf8' });

  if (res.error) {
    if (res.error.code === 'ENOENT') {
      console.error(
        'psql not found on PATH. Install the PostgreSQL client, or run the two\n' +
          'files in the Supabase SQL editor instead.'
      );
    } else {
      console.error(res.error.message);
    }
    process.exit(1);
  }

  const out = `${res.stdout || ''}${res.stderr || ''}`;
  process.stdout.write(out);

  if (res.status !== 0) anyFail = true;
  if (/\bFAIL\b/.test(out)) anyFail = true;
}

if (anyFail) {
  console.error('\n✗ Database verification FAILED — resolve every FAIL before building on top.');
  process.exit(1);
}
console.log('\n✓ Database verification passed — schema and RLS are exactly as expected.');
