import { test, expect } from '@playwright/test';

// Representative slice of the 23 production pages: homepage, two SEO landing
// pages, a corporate/crew-relevant page, and the 404. Screenshots here are the
// visual contract — if a foundation/tooling change alters any of them, this fails.
const PAGES = [
  { name: 'home', path: '/index.html' },
  { name: 'things-to-do', path: '/things-to-do-vernal-utah.html' },
  { name: 'extended-stay', path: '/extended-stay-hotel-vernal-utah.html' },
  { name: 'workforce-housing', path: '/workforce-housing-vernal-utah.html' },
  { name: 'not-found', path: '/404.html' },
];

for (const p of PAGES) {
  test(`visual: ${p.name}`, async ({ page }) => {
    // Determinism: neutralize JS timer-driven motion (the homepage hero runs a
    // setInterval autoplay slideshow) so consecutive frames are identical. This
    // does NOT touch .rv/.on (IntersectionObserver) or the scroll chrome (events).
    await page.addInitScript(() => {
      // Deliberately stub timers for a stable snapshot.
      window.setInterval = (() => 0) as typeof window.setInterval;
    });
    // 'load' (not 'networkidle'): the homepage autoplays a video, so the
    // network never goes idle. Media is frozen/masked at capture.
    await page.goto(p.path, { waitUntil: 'load' });
    // Guard against serving the wrong project (a sibling Astro app uses the same
    // default port). Every page carries the hotel brand; fail loudly if it doesn't.
    await expect(page.locator('body')).toContainText('Best Western', { timeout: 5000 });
    // Wait for web fonts (Playfair/Lato via Google Fonts) to finish loading —
    // text reflows/renders differently before vs. after, the main flakiness source.
    await page.evaluate(() => document.fonts.ready);
    // Reveal-on-scroll (.rv/.on) fades sections in on intersection; scroll the
    // whole page so every section is in its final visible state before capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
      // Freeze any autoplaying media to a fixed frame for a deterministic capture.
      document.querySelectorAll('video').forEach((v) => {
        v.pause();
        v.autoplay = false;
        v.currentTime = 0;
      });
      // Force all lazy images to load + decode before capture. On the tall
      // desktop fullPage view, images decoding mid-stabilization change pixels
      // every frame and prevent a stable screenshot.
      const imgs = Array.from(document.images);
      imgs.forEach((img) => {
        img.loading = 'eager';
      });
      await Promise.all(
        imgs
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((res) => {
                img.addEventListener('load', () => res(), { once: true });
                img.addEventListener('error', () => res(), { once: true });
              })
          )
      );
    });
    // Freeze all transitions/animations/transforms for a deterministic frame.
    // The hero runs a continuous 8s Ken Burns `transform` zoom via inline style,
    // which animations:'disabled' alone doesn't fully pin. Test-only style; the
    // real build is untouched.
    await page.addStyleTag({
      content: `*,*::before,*::after{transition:none!important;animation:none!important}
                .hero-kb{transform:none!important}
                /* Hide async/cross-origin media (YouTube iframes, video) but keep
                   their layout boxes — removes nondeterministic pixels without reflow. */
                iframe,video{visibility:hidden!important}`,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });
}
