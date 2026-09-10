import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import path from 'path';
const root = path.resolve('dist');
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const srv=createServer(async(req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';let f=path.join(root,p);try{const s=await stat(f);if(s.isDirectory())f=path.join(f,'index.html');}catch{if(!path.extname(f))f+='.html';}try{const b=await readFile(f);res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end('nf');}});
await new Promise(r=>srv.listen(4392,r));
const b = await chromium.launch();
let failures = 0;

async function scenario(name, first, second, wantPortrait, shot) {
  const pg = await b.newPage({ viewport:first });
  const bad = []; const ok200 = new Set();
  pg.on('response', r => { const u = decodeURIComponent(r.url()); if (r.status() >= 400) bad.push(r.status()+' '+u.replace(/^https?:\/\/[^/]+/,'')); else if (/\.webp$/.test(u)) ok200.add(u.replace(/^https?:\/\/[^/]+\/images\//,'')); });
  await pg.goto('http://localhost:4392/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(2800);                       // let the idle "rest" promotion run
  if (second) { await pg.setViewportSize(second); await pg.waitForTimeout(700); }
  await pg.hover('#hero');
  await pg.evaluate(()=>document.getElementById('ei-badge')?.remove());
  const n = await pg.evaluate(()=>document.querySelectorAll('.hero-slide').length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    let guard = 0;
    while (await pg.evaluate(()=>[...document.querySelectorAll('.hero-slide')].findIndex(s=>s.classList.contains('active'))) !== i && guard++ < 20) { await pg.click('#hnext'); await pg.waitForTimeout(120); }
    await pg.waitForTimeout(250);
    const r = await pg.evaluate(async (i)=>{
      const kb = document.querySelectorAll('.hero-slide')[i].querySelector('.hero-kb');
      const abs = (getComputedStyle(kb).backgroundImage.match(/url\("?([^")]+)"?\)/)||[])[1] || '';
      let status = 0, w = 0;
      try { status = (await fetch(abs, { cache:'no-store' })).status; } catch {}
      try { const im = new Image(); im.src = abs; await im.decode(); w = im.naturalWidth; } catch {}
      return { abs, status, w };
    }, i);
    const p = r.abs.replace(/^https?:\/\/[^/]+/, '');
    const isPortrait = /phoneview/i.test(p);
    const good = r.status === 200 && r.w > 0 && !p.startsWith('/_astro/') && isPortrait === wantPortrait;
    if (!good) failures++;
    rows.push(`   ${i}  ${good ? 'OK  ' : 'FAIL'}  ${String(r.status).padEnd(3)}  ${String(r.w).padStart(4)}px  ${p}`);
    if (shot && i === 1) await pg.screenshot({ path: shot });
  }
  console.log(`\n${name}`); console.log(rows.join('\n'));
  if (bad.length) { failures += bad.length; console.log('   HTTP errors on this page:', [...new Set(bad)]); } else console.log('   HTTP errors on this page: none');
  if (wantPortrait) {
    const landscapeHero = await pg.evaluate(()=>[...document.querySelectorAll('.hero-slide .hero-kb')].map((k,i)=> i===0 ? (k.style.backgroundImage.match(/images\/([^'")]+)/)||[])[1] : (k.style.getPropertyValue('--hbg').match(/images\/([^'")]+)/)||[])[1]));
    if (!second) { const leaked = landscapeHero.filter(f => ok200.has(f)); console.log('   landscape hero frames successfully downloaded on this phone load:', leaked.length ? leaked : 'none'); }
  }
  await pg.close();
}

const P = {width:390,height:844}, D = {width:1280,height:900};
await scenario('A  opened narrow',              P, null, true,  process.argv[2]);
await scenario('B  opened wide, then narrowed', D, P,    true,  process.argv[3]);
await scenario('C  opened narrow, then widened',P, D,    false, null);
await scenario('D  desktop',                    {width:1440,height:900}, null, false, null);
console.log(`\nTOTAL FAILURES: ${failures}`);
await b.close(); srv.close();
