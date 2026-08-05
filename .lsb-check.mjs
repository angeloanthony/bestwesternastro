import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const OUT = process.argv[2] ?? 'shot';

const browser = await chromium.launch();

async function run(name, viewport, path = '/') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.js') || r.url().includes('open-meteo')) reqs.push(r.url());
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lsb', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const text = await page.locator('.lsb').innerText().catch(() => '(no .lsb found)');
  const box = await page.locator('.lsb').boundingBox().catch(() => null);
  console.log(`\n### ${name} ${path}`);
  console.log('  text  :', JSON.stringify(text));
  console.log('  box   :', JSON.stringify(box));
  console.log('  reqs  :', reqs.map((u) => u.split('/').pop().slice(0, 40)).join(', '));
  console.log('  errors:', errors.length ? errors : 'none');

  await page.screenshot({ path: `${OUT}-${name}-top.png` });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(600);
  const boxScrolled = await page.locator('.lsb').boundingBox().catch(() => null);
  console.log('  box@scroll:', JSON.stringify(boxScrolled));
  await page.screenshot({ path: `${OUT}-${name}-scrolled.png` });
  await ctx.close();
}

await run('desktop', { width: 1440, height: 900 });
await run('mobile', { width: 390, height: 844 });
await run('desktop-faq', { width: 1440, height: 900 }, '/faq');

// No-JS check: the strip must not appear at all.
const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE + '/', { waitUntil: 'load' });
console.log('\n### no-JS  .lsb count:', await p.locator('.lsb').count());
await ctx.close();

await browser.close();
