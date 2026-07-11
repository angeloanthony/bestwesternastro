import { defineConfig, devices } from '@playwright/test';

// Visual-regression harness. Builds nothing itself — it serves the existing
// `dist/` via `astro preview` and screenshots representative production pages.
// The committed *-snapshots/ baselines are the "zero regression" reference that
// must hold as Tailwind / Preact / AdventureOS components are introduced.
export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/__snapshots__',
  fullyParallel: true,
  reporter: 'list',
  // The media-heavy homepage full-page shot can flake ~1 frame in ~10. Retries
  // absorb that: a real regression moves far more than the tolerance and fails
  // every attempt, while a rare 1-frame flake passes on retry.
  retries: 2,
  expect: {
    // Timeout raised from 5s: the tall desktop homepage needs headroom to reach a
    // stable frame after lazy images decode (applies to the screenshot stabilizer).
    timeout: 20_000,
    // Small tolerance for anti-aliasing; a real regression moves far more pixels.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    // Dedicated port for THIS project. The sibling `adventureastro` project uses
    // Astro's default 4321; sharing it let reuseExistingServer capture the wrong
    // site. Pin a unique port + never reuse a foreign server.
    baseURL: 'http://localhost:4331',
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  // Serve the already-built dist on this project's dedicated port. Run
  // `npm run build` before the visual test. reuseExistingServer:false so it
  // always serves THIS project's dist and never latches onto another server.
  webServer: {
    command: 'npm run preview -- --port 4331',
    url: 'http://localhost:4331',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
