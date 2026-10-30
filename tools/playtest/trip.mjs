// Takes the whole space trip with real taps, the way she would: island, rocket, countdown, START, the map, every
// stop, back to the map, and home through Earth. Saves a screenshot of each beat and prints what it measured
// (the rocket's and every stop's tap size, the map's draw calls, page errors).
// usage: BASE=http://localhost:4181 OUTDIR=trip node trip.mjs [width] [height] [quality]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [w = 1180, h = 820, quality = 'medium'] = process.argv.slice(2);
const OUT = new URL(`./${process.env.OUTDIR || 'trip'}/${w}x${h}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4181';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [], logs = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => logs.push(m.text()));
const report = { viewport: `${w}x${h}`, quality, beats: [], stops: {}, errors, failures: [] };
let n = 0;
const snap = async (name) => { const f = `${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: OUT + f }); report.beats.push(f); };
const st = (fn, arg) => page.evaluate(fn, arg);
const fail = (why) => { report.failures.push(why); console.log(`FAIL ${why}`); };
const until = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
// a finger lands on the middle of the button (the pulsing ones never count as still for Playwright's own click)
const press = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) return null; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return b; };

await page.goto(`${BASE}/?q=${quality}&spacelog`);
await page.waitForSelector('.start .play', { timeout: 30000 });
await page.waitForTimeout(1500);
await press('.start .play');
if (!(await until(() => { const s = window.__pup?.getStage(); return s?.area === 'island' && s.markers?.rocket && !s.silent; }))) fail('the island never showed the rocket');
await page.waitForTimeout(3500);
await snap('island');

// the rocket's star, as a box on screen
const rocket = await st(() => {
  const { getStage, camera } = window.__pup;
  const m = getStage().markers.rocket.marker;
  const Vec = m.position.constructor;
  const pts = [];
  m.updateWorldMatrix(true, true);
  m.traverse((o) => { if (!o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vec(x, y, z).applyMatrix4(o.matrixWorld)); });
  const s = pts.map((p) => p.project(camera)).map((p) => [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]);
  const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
});
report.rocket = { w: Math.round(rocket.w), h: Math.round(rocket.h) };
if (Math.min(rocket.w, rocket.h) < 70) fail(`the rocket's star is ${Math.round(rocket.w)}x${Math.round(rocket.h)} px, under 70`);
await page.mouse.click(rocket.x, rocket.y);

const t0 = Date.now();
if (!(await until(() => document.querySelector('.rocket-start'), null, 60000))) fail('no START button within 60 s of tapping the rocket');
report.toStartMs = Date.now() - t0;
await snap('countdown-start');
const sb = await press('.rocket-start');
report.startButton = sb && { w: Math.round(sb.width), h: Math.round(sb.height) };
await page.waitForTimeout(1200);
await snap('lift-off');
if (!(await until(() => { const s = window.__pup.getStage(); return s?.kind === 'space-map' && s.state === 'waiting'; }, null, 60000))) fail('the map never reached waiting after START');
report.toMapMs = Date.now() - t0;
await page.waitForTimeout(1500);
await snap('map');
report.drawCalls = logs.filter((l) => /calls/i.test(l));
report.suggested = await st(() => window.__pup.getStage().suggested ?? null);
// what she sees, not just what she can tap: each stop's whole visible body and the parked rocket inside the screen
const seen = await st(() => {
  const { getStage, camera } = window.__pup;
  const g = getStage();
  // every vertex, since box corners land wider than round pads under a tilted camera; see-through glows fade out
  // past their edges on purpose, so only solid things count
  const box = (o) => {
    const Vec = o.position.constructor, pts = [];
    o.updateWorldMatrix(true, true);
    o.traverse((m) => { if (!m.geometry || !m.visible || m.material?.visible === false || m.isSprite || m.isPoints || m.material?.transparent) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) pts.push(new Vec().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld)); });
    const s = pts.map((p) => p.project(camera)).map((p) => [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]);
    return { l: Math.min(...s.map((p) => p[0])), r: Math.max(...s.map((p) => p[0])), t: Math.min(...s.map((p) => p[1])), b: Math.max(...s.map((p) => p[1])) };
  };
  // (the road and its stop pads are merged into one mesh, so the road's box stands for every pad)
  return { rocket: box(g.rocket), bodies: Object.fromEntries([...Object.entries(g.bodies).map(([k, b]) => [k, box(b)]), ['the road and its stop pads', box(g.road)]]) };
});
const inside = (b) => b.l >= 0 && b.t >= 0 && b.r <= +w && b.b <= +h;
if (!inside(seen.rocket)) fail(`the parked rocket is not fully on screen (${Math.round(seen.rocket.l)},${Math.round(seen.rocket.t)} to ${Math.round(seen.rocket.r)},${Math.round(seen.rocket.b)})`);
for (const [k, b] of Object.entries(seen.bodies)) if (!inside(b)) fail(`${k} is cut off at the screen edge`);

const stops = await st(() => window.__pup.getStage().stopsOnScreen());
for (const s of stops) report.stops[s.kind] = { d: Math.round(s.r * 2), x: Math.round(s.x), y: Math.round(s.y), onScreen: s.x - s.r >= 0 && s.y - s.r >= 0 && s.x + s.r <= +w && s.y + s.r <= +h };
for (const [k, s] of Object.entries(report.stops)) {
  if (s.d < 70) fail(`${k} tap target ${s.d} px, under 70`);
  if (!s.onScreen) fail(`${k} is not fully on screen`);
}

for (const { kind } of stops.filter((s) => s.kind !== 'earth')) {
  const s = (await st(() => window.__pup.getStage().stopsOnScreen())).find((x) => x.kind === kind);
  await page.mouse.click(s.x, s.y);
  const t = Date.now();
  // a stop with a game flies there and starts it; she leaves with the hold-to-leave home button
  if (!(await until((k) => { const g = window.__pup.getStage(); return g.kind === k || (g.state === 'visiting' && g.visiting === k && document.querySelector('.space-back')); }, kind, 60000))) { fail(`${kind}: never arrived`); continue; }
  if (await st((k) => window.__pup.getStage().kind === k, kind)) {
    report.stops[kind].flightMs = Date.now() - t;
    report.stops[kind].game = true;
    await page.waitForTimeout(2500);
    await snap(`game-${kind}`);
    const b = await page.locator('.home').first().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
    if (!(await until((k) => { const g = window.__pup.getStage(); return g.kind === 'space-map' && g.state === 'waiting' && g.at === k; }, kind, 60000))) fail(`${kind}: leaving the game did not bring her back to the map at ${kind}`);
    await page.waitForTimeout(1200);
    await snap(`back-from-${kind}`);
    continue;
  }
  if (!(await until((k) => { const g = window.__pup.getStage(); return g.state === 'visiting' && g.visiting === k; }, kind, 60000))) { fail(`${kind}: never arrived`); continue; }
  report.stops[kind].flightMs = Date.now() - t;
  await page.waitForTimeout(1500);
  await snap(`visit-${kind}`);
  await page.mouse.click(+w / 2, +h / 2);
  await page.waitForTimeout(800);
  if (!(await press('.space-back'))) { fail(`${kind}: no back-to-map button`); continue; }
  if (!(await until(() => window.__pup.getStage().state === 'waiting', null, 30000))) fail(`${kind}: never came back to the map`);
  await page.waitForTimeout(600);
}

const earth = (await st(() => window.__pup.getStage().stopsOnScreen())).find((x) => x.kind === 'earth');
if (!earth) fail('no Earth stop on the map');
else {
  await page.mouse.click(earth.x, earth.y);
  if (!(await until(() => { const s = window.__pup.getStage(); return s?.area === 'island' && s.markers && !s.silent; }, null, 60000))) fail('tapping Earth never brought her home');
  await page.waitForTimeout(1500);
  await snap('home');
}

writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ viewport: report.viewport, rocket: report.rocket, suggested: report.suggested, startButton: report.startButton, drawCalls: report.drawCalls, toMapMs: report.toMapMs, stops: Object.fromEntries(Object.entries(report.stops).map(([k, s]) => [k, `${s.d}px${s.flightMs ? ` ${s.flightMs}ms` : ''}`])), errors, failures: report.failures }, null, 1));
await browser.close();
process.exit(report.failures.length || errors.length ? 1 : 0);
