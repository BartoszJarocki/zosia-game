// The Lookout's floor layout, measured on screen: is each kitten nearest its own floor's sign, do the signs overlap,
// how big are they? Puts a kitten on every floor of a level and projects kittens and signs to screen pixels.
// usage: BASE=http://127.0.0.1:4193 node lookout-probe.mjs <level> [width height]   (writes <OUTDIR>/layout-L<level>-<w>x<h>.png)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [level = 1, w = 1180, h = 820] = process.argv.slice(2).map(Number);
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:4193';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((level) => {
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { lookout: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, level);
await page.goto(`${BASE}/?q=low#lookout`);
await page.waitForFunction(() => window.__pup?.getStage()?.kind === 'lookout' && window.__pup.getStage().learn?.isOpen, null, { timeout: 60000 });
await page.evaluate(() => { const s = window.__pup.getStage(); for (let f = 1; f <= s.N; f++) if (s.waiting?.userData.floor !== f) s.kittenOn(f); });
// (slow software rendering: wait until every kitten has landed and the camera has settled)
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s.scene.children.filter((o) => o.userData.kitten).every((k) => Math.abs(k.position.y - s.floorY(k.userData.floor)) < 0.01); }, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const m = await page.evaluate(() => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const px = (v) => { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
  const at = (o, dy = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += dy; return p; };
  const scaleY = (o) => o.getWorldScale(o.scale.clone()).y;
  const signs = s.signs.map((sg, i) => {
    const c = at(sg), r = (sg.userData.radius ?? 0.42) * scaleY(sg);
    const top = px(c.clone().setY(c.y + r)), bot = px(c.clone().setY(c.y - r));
    return { floor: i + 1, ...px(c), d: Math.abs(bot.y - top.y), top: top.y, bot: bot.y };
  });
  const kittens = s.scene.children.filter((o) => o.userData.floor && o.userData.kitten).map((k) => {
    const H = 1.13 * scaleY(k); // the kitten model is 1.13 tall (paws to ears) at scale 1
    return { floor: k.userData.floor, ...px(at(k, H / 2)), h: Math.abs(px(at(k, H)).y - px(at(k)).y) };
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rows = kittens.sort((a, b) => a.floor - b.floor).map((k) => {
    const ranked = signs.map((sg) => ({ floor: sg.floor, d: dist(k, sg) })).sort((a, b) => a.d - b.d);
    const own = ranked.find((r) => r.floor === k.floor).d, other = ranked.find((r) => r.floor !== k.floor);
    return { floor: k.floor, nearest: ranked[0].floor, ownPx: Math.round(own), otherPx: Math.round(other.d), otherFloor: other.floor, ratio: +(other.d / own).toFixed(2), kittenPx: Math.round(k.h) };
  });
  const gaps = signs.slice(1).map((sg, i) => Math.round(signs[i].top - sg.bot)); // signs[i] is below sg: positive = clear space between them
  return { N: s.N, rows, signs: signs.map(({ floor, x, y, d }) => ({ floor, x, y, d })), signPx: signs.map((sg) => Math.round(sg.d)), gaps, onScreen: signs.every((sg) => sg.top > 0 && sg.bot < innerHeight) };
});
const shot = `${OUT}layout-L${level}-${w}x${h}.png`;
await page.screenshot({ path: shot });
const bad = m.rows.filter((r) => r.nearest !== r.floor || r.ratio < 1.5);
console.log(`L${level} ${w}x${h}: ${m.N} floors · sign Ø ${Math.min(...m.signPx)}–${Math.max(...m.signPx)} px · smallest gap between signs ${Math.min(...m.gaps)} px · all signs on screen: ${m.onScreen}`);
for (const r of m.rows) console.log(`  kitten ${r.floor}: nearest sign ${r.nearest}${r.nearest === r.floor ? '' : '  WRONG'} · own ${r.ownPx} px, next ${r.otherFloor} at ${r.otherPx} px (×${r.ratio}) · kitten ${r.kittenPx} px tall`);
console.log(bad.length ? `✗ ${bad.length} kitten(s) not clearly beside their own sign (nearest must be own, next ≥ 1.5× farther)` : '✓ every kitten is clearly beside its own sign');
if (Math.min(...m.gaps) < 0) console.log('✗ signs overlap');
// a lit sign must look brighter, not paler: its own colours stay as saturated, and a bright ring appears round it
const sg = m.signs[Math.floor(m.N / 2)];
const sample = (png) => page.evaluate(async ({ b64, x, y, r }) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = new OffscreenCanvas(img.width, img.height).getContext('2d');
  c.drawImage(img, 0, 0);
  const stats = (r0, r1) => {
    let n = 0, sat = 0, lum = 0;
    for (let dy = -r1; dy <= r1; dy++) for (let dx = -r1; dx <= r1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < r0 || d > r1) continue;
      const [R, G, B] = c.getImageData(Math.round(x + dx), Math.round(y + dy), 1, 1).data;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      sat += mx ? (mx - mn) / mx : 0; lum += (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255; n++;
    }
    return { sat: +(sat / n).toFixed(2), lum: +(lum / n).toFixed(2) };
  };
  return { disc: stats(r * 0.6, r * 0.85), ring: stats(r * 1.08, r * 1.25) }; // (the disc's coloured band, outside the numeral)
}, { b64: png.toString('base64'), x: sg.x, y: sg.y, r: sg.d / 2 });
const unlit = await sample(await page.screenshot());
await page.evaluate((f) => { const s = window.__pup.getStage(); s.here ? s.here(f) : s.lightSign(f); }, sg.floor); // (lightSign: the code before the polish pass)
await page.waitForTimeout(800);
const litShot = `${OUT}layout-L${level}-${w}x${h}-lit${sg.floor}.png`;
const lit = await sample(await page.screenshot({ path: litShot }));
console.log(`  sign ${sg.floor} unlit: colour saturation ${unlit.disc.sat}, ring brightness ${unlit.ring.lum} · lit: saturation ${lit.disc.sat}, ring brightness ${lit.ring.lum}`);
const paler = lit.disc.sat < unlit.disc.sat - 0.05 || lit.ring.lum < unlit.ring.lum + 0.15;
console.log(paler ? '✗ the lit sign does not stand out (paler, or no bright ring)' : '✓ the lit sign keeps its colours and gets a bright ring');
writeFileSync(`${OUT}layout-L${level}-${w}x${h}.json`, JSON.stringify({ ...m, lit: { floor: sg.floor, unlit, lit }, errors }, null, 1));
console.log(`  → ${shot}${errors.length ? `  errors: ${errors.join(' | ')}` : ''}`);
await browser.close();
process.exitCode = bad.length || Math.min(...m.gaps) < 0 || paler ? 1 : 0;
