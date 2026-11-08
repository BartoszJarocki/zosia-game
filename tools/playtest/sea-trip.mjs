// Takes the whole bay trip with real taps, the way she would: island, the harbour's star, the horn, the bay map,
// every stop (visit, reaction, back), then home through the island. Saves a screenshot of each beat and prints
// what it measured (the harbour's and every stop's tap size, the map's draw calls, page errors).
// usage: BASE=http://localhost:4181 OUTDIR=sea-trip node sea-trip.mjs [width] [height] [quality]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [w = 1180, h = 820, quality = 'medium'] = process.argv.slice(2);
const OUT = new URL(`./${process.env.OUTDIR || 'sea-trip'}/${w}x${h}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4181';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [], logs = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => logs.push(m.text()));
const report = { failures: [], errors, harbour: {}, horn: {}, stops: {}, calls: [] };
let n = 0;
const snap = async (name) => { const f = `${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: OUT + f }); };
const st = (fn, arg) => page.evaluate(fn, arg);
const fail = (why) => { report.failures.push(why); console.log(`FAIL ${why}`); };
const until = (fn, arg, ms = 60000) => page.waitForFunction(`(${fn})(${JSON.stringify(arg ?? null)}) && !document.querySelector('.iris.on')`, null, { timeout: ms }).then(() => true, () => false);
const press = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) return null; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return b; };

await page.goto(`${BASE}/?q=${quality}&maplog`);
await page.waitForSelector('.start .play', { timeout: 30000 });
await page.waitForTimeout(1500);
await press('.start .play');
if (!(await until(() => { const s = window.__pup?.getStage(); return s?.area === 'island' && s.markers?.harbour && !s.silent; }))) fail('the island never showed the harbour');
await page.waitForTimeout(3500);
await snap('island');

// the harbour star, as a box on screen
const harbour = await st(() => {
  const { getStage, camera } = window.__pup;
  const m = getStage().markers.harbour.marker;
  const Vec = m.position.constructor;
  const pts = [];
  m.updateWorldMatrix(true, true);
  m.traverse((o) => { if (!o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vec(x, y, z).applyMatrix4(o.matrixWorld)); });
  const s = pts.map((p) => p.project(camera)).map((p) => [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]);
  const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
});
report.harbour = { w: Math.round(harbour.w), h: Math.round(harbour.h) };
if (Math.min(harbour.w, harbour.h) < 70) fail(`the harbour's star is ${report.harbour.w}x${report.harbour.h} px, under 70`);
await page.mouse.click(harbour.x, harbour.y);

if (!(await until(() => document.querySelector('.boat-horn'), null, 60000))) fail('no horn button within 60 s of tapping the harbour');
await page.waitForTimeout(1000);
await snap('boat-horn');
const horn = await page.locator('.boat-horn').first().boundingBox().catch(() => null);
if (!horn) fail('the horn button has no box');
else {
  report.horn = { w: Math.round(horn.width), h: Math.round(horn.height) };
  if (Math.min(horn.width, horn.height) < 70) fail(`the horn is ${report.horn.w}x${report.horn.h} px, under 70`);
}
await press('.boat-horn');
if (!(await until(() => { const s = window.__pup.getStage(); return s?.kind === 'sea-map' && s.state === 'waiting'; }, null, 60000))) fail('the bay map never reached waiting after the horn');
await page.waitForTimeout(2500);
await snap('map');
report.calls = logs.filter((l) => /calls/i.test(l));

const stops = await st(() => window.__pup.getStage().stopsOnScreen());
for (const s of stops) report.stops[s.kind] = { d: Math.round(s.r * 2) };
for (const s of stops) {
  if (report.stops[s.kind].d < 70) fail(`${s.kind} tap target ${report.stops[s.kind].d} px, under 70`);
  if (s.x - s.r < 0 || s.y - s.r < 0 || s.x + s.r > +w || s.y + s.r > +h) fail(`${s.kind} is not fully on screen`);
}

for (const { kind } of stops.filter((s) => s.kind !== 'island')) {
  const target = (await st(() => window.__pup.getStage().stopsOnScreen())).find((x) => x.kind === kind);
  await page.mouse.click(target.x, target.y);
  if (!(await until((k) => { const g = window.__pup.getStage(); return g.state === 'visiting' && g.visiting === k && document.querySelector('.space-back'); }, kind, 60000))) { fail(`${kind}: never arrived`); continue; }
  await page.waitForTimeout(1200);
  await snap(`visit-${kind}`);
  const shown = (await st(() => window.__pup.getStage().stopsOnScreen())).find((x) => x.kind === kind);
  if (!shown) fail(`${kind}: not on screen in its visit`);
  else await page.mouse.click(shown.x, shown.y);
  await page.waitForTimeout(600);
  await snap(`react-${kind}`);
  if (!(await press('.space-back'))) { fail(`${kind}: no back-to-map button`); continue; }
  if (!(await until(() => window.__pup.getStage().state === 'waiting', null, 30000))) fail(`${kind}: never came back to the map`);
  await page.waitForTimeout(500);
}

const island = (await st(() => window.__pup.getStage().stopsOnScreen())).find((x) => x.kind === 'island');
if (!island) fail('no island stop on the bay map');
else {
  await page.mouse.click(island.x, island.y);
  if (!(await until(() => { const s = window.__pup.getStage(); return s?.area === 'island' && s.markers && !s.silent; }, null, 60000))) fail('tapping the island never brought her home');
  await page.waitForTimeout(1500);
  await snap('home');
}

writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ viewport: `${w}x${h}`, harbour: report.harbour, horn: report.horn, stops: Object.fromEntries(Object.entries(report.stops).map(([k, s]) => [k, `${s.d}px`])), calls: report.calls, errors, failures: report.failures }, null, 1));
await browser.close();
process.exit(report.failures.length || errors.length ? 1 : 0);
