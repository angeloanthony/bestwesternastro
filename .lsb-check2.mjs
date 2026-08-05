import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.waitForSelector('.lsb', { timeout: 15000 });
await page.waitForTimeout(2000);

// Dismiss whatever overlay is sitting on top of the strip.
for (const sel of ['.pop-close', '.popup-close', '[class*="pop"] [class*="close"]', 'text=×']) {
  const el = page.locator(sel).first();
  if (await el.count()) {
    await el.click({ timeout: 2000 }).catch(() => {});
    break;
  }
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}-mobile-dismissed.png` });

const inner = page.locator('.lsb-inner');
const m = await inner.evaluate((el) => ({
  scrollWidth: el.scrollWidth,
  clientWidth: el.clientWidth,
  overflowing: el.scrollWidth > el.clientWidth,
}));
console.log('mobile .lsb-inner:', JSON.stringify(m));

// What is painting over the strip?
const covering = await page.evaluate(() => {
  const el = document.elementFromPoint(195, 86);
  return el ? `${el.tagName}.${el.className} z=${getComputedStyle(el.closest('[class]') || el).zIndex}` : 'none';
});
console.log('element at strip centre:', covering);
await ctx.close();
await browser.close();
