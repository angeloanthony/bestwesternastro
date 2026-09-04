import { chromium } from 'playwright';
const b = await chromium.launch();
const reader = await (await b.newContext()).newPage();
const lin = c => { c/=255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const L = ([r,g,bb]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(bb);
const ratio = (a,c) => { const l1=Math.max(L(a),L(c)), l2=Math.min(L(a),L(c)); return (l1+0.05)/(l2+0.05); };
const NAVY=[26,46,82], GOLD=[138,106,28];
async function p2(buf) {
  const d = 'data:image/png;base64,' + buf.toString('base64');
  return reader.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const g = c.getContext('2d'); g.drawImage(img,0,0);
    const px = g.getImageData(0,0,c.width,c.height).data; const arr=[];
    for (let i=0;i<px.length;i+=4) arr.push([px[i],px[i+1],px[i+2]]);
    arr.sort((a,b)=>(0.2126*a[0]+0.7152*a[1]+0.0722*a[2])-(0.2126*b[0]+0.7152*b[1]+0.0722*b[2]));
    return arr[Math.floor(arr.length*0.02)];
  }, d);
}
const LARGE = new Set(['h1','price']);
const VIEWPORTS=[[1440,900,false,'desktop'],[1280,800,false,'laptop'],[1024,768,false,'sm-laptop'],[900,1100,false,'tablet'],[768,1024,false,'tablet-sm'],[430,860,true,'mobile-l'],[390,800,true,'mobile'],[360,740,true,'mobile-s']];
let wS={r:99}, wL={r:99}, n=0;
for (const [vw,vh,mob,vname] of VIEWPORTS) {
 for (const slug of ['studio-king','studio-two-queen','accessible-studio-king','pet-friendly-studio-two-queen','pet-friendly-room']) {
  const ctx = await b.newContext({ viewport:{width:vw,height:vh}, deviceScaleFactor: mob?2:1, isMobile:mob, hasTouch:mob });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:4348/rooms/${slug}`, { waitUntil:'networkidle' });
  await p.waitForTimeout(1000);
  const cnt = Math.max(1, await p.evaluate(()=>document.querySelectorAll('.rm-hero-dot').length));
  for (let s=0;s<cnt;s++){
    if(cnt>1){ await p.evaluate(i=>document.querySelectorAll('.rm-hero-dot')[i].click(), s); await p.waitForTimeout(820); }
    await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(110);
    const runs = await p.evaluate(()=>{
      if (window.scrollY !== 0) throw new Error('scrolled');
      const out=[];
      for (const [k,q] of [['eyebrow','.rm-eyebrow'],['h1','.rm-hero h1'],['price','.rm-hero .rm-price-amt'],['per','.rm-hero .rm-price-per'],['weekly','.rm-hero .rm-weekly'],['tax','.rm-hero .rm-price-tax'],['foot','.rm-hero .rm-foot']]) {
        const el=document.querySelector(q); if(!el) continue;
        const r=document.createRange(); r.selectNodeContents(el);
        for (const bb of r.getClientRects()) { if(bb.width<4||bb.height<4) continue;
          out.push({k,x:Math.max(0,Math.round(bb.x)),y:Math.max(0,Math.round(bb.y)),width:Math.round(bb.width),height:Math.round(bb.height)}); }
      }
      document.querySelectorAll('.rm-hero-cnt *').forEach(e=>{e.style.visibility='hidden';});
      return out;
    });
    for (const box of runs) {
      const {k,...clip}=box; n++;
      const px = await p2(await p.screenshot({clip}));
      const r = ratio(k==='price'?GOLD:NAVY, px);
      if (LARGE.has(k)) { if(r<wL.r) wL={r,slug,s,k,vname,px}; }
      else if (r<wS.r) wS={r,slug,s,k,vname,px};
    }
    await p.evaluate(()=>document.querySelectorAll('.rm-hero-cnt *').forEach(e=>{e.style.visibility='';}));
  }
  await ctx.close();
 }
}
const f=x=>`${x.r.toFixed(2)}:1  (${x.slug} slide ${x.s+1} @${x.vname}, behind ${x.k})`;
console.log(`${n} samples — 8 viewports x 5 rooms x every hero slide`);
console.log('small text  needs 4.5 : '+f(wS)+'  '+(wS.r>=4.5?'PASS':'FAIL'));
console.log('large text  needs 3.0 : '+f(wL)+'  '+(wL.r>=3?'PASS':'FAIL'));
await b.close();
