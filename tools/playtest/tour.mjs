// tour.mjs <island|space|sea> : walks the island and the maps by touch on the real GPU and films every transition
// (verification tooling, written for the November review). env: BASE, OUTDIR, W, H, Q, SUGGEST (a game place Chase suggests, e.g. counting)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [what = 'island'] = process.argv.slice(2);
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const OUT = `${process.env.OUTDIR || 'tour'}/${what}-${W}x${H}/`;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4190';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
const page = await context.newPage();
const errors = [], notes = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  const t0 = performance.now();
  const log = (window.__timeline = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push({ t: Math.round(performance.now() - t0), text }); return Array.prototype.push.call(say, text); };
  window.__T = () => Math.round(performance.now() - t0);
});
const st = (fn, a) => page.evaluate(fn, a);
let n = 0;
const snap = async (name) => { const f = `${String(++n).padStart(3, '0')}-${name}`; try { await page.screenshot({ path: `${OUT}${f}.jpg`, type: 'jpeg', quality: 70, timeout: 8000 }); } catch {} return f; };
const film = async (name, seconds, every = 700) => { const end = Date.now() + seconds * 1000; let i = 0; while (Date.now() < end) { await snap(`${name}-${String(++i).padStart(2, '0')}`); await page.waitForTimeout(every); } };
const note = async (text) => { const t = await st(() => window.__T()); notes.push(`${(t / 1000).toFixed(1).padStart(6)}  ${text}`); };
const tap = async (x, y, why) => { await note(`TAP ${why} at ${Math.round(x)},${Math.round(y)}`); await page.touchscreen.tap(x, y); };
const stage = () => st(() => { const s = window.__pup.getStage(); return { kind: s?.kind, area: s?.area, state: s?.state, busy: Boolean(s?.busy), asleep: Boolean(s?.asleep), suggested: s?.suggested, visiting: s?.visiting, ctor: s?.constructor?.name }; });
const waitFor = async (pred, ms = 30000) => { const end = Date.now() + ms; for (;;) { const s = await stage(); if (pred(s)) return s; if (Date.now() > end) return null; await page.waitForTimeout(150); } };
const markerAt = (kind) => st((kind) => { const { getStage, camera } = window.__pup; const m = getStage().markers?.[kind]?.marker; if (!m) return null; const p = m.getWorldPosition(m.position.clone()); p.project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, kind);
const stops = () => st(() => window.__pup.getStage().stopsOnScreen?.() || []);
const holdHome = async () => { const b = await page.locator('.home.hold').first().boundingBox().catch(() => null); if (!b) return false; const cdp = await context.newCDPSession(page); const pt = [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await page.waitForTimeout(1100); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return true; };

await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
await page.waitForSelector('.start .play', { timeout: 30000 });
await page.waitForTimeout(1500);
await snap('start-screen');
if (process.env.SUGGEST) await st((k) => { window.__pup.dev.suggestOnce = k; }, process.env.SUGGEST);
const pb = await page.locator('.play').boundingBox();
await tap(pb.x + pb.width / 2, pb.y + pb.height / 2, 'play');
await film('greet', 7, 900);
await waitFor((s) => s.area === 'island' && !s.busy, 20000);
await page.waitForTimeout(1500);
await snap('island-idle');
const s0 = await stage();
await note(`island: suggested=${s0.suggested}`);

if (what === 'island') {
  // a quick child: taps two places almost at once, then keeps tapping during the drive
  const a = await markerAt(s0.suggested || 'letters'), b = await markerAt('counting');
  await tap(a.x, a.y, `star of ${s0.suggested}`);
  await page.waitForTimeout(150);
  await tap(b.x, b.y, 'star of counting, 150 ms later');
  await film('drive', 4, 600);
  const m = await waitFor((s) => s.kind && s.area === 'island' && s.ctor !== 'Hub', 20000);
  await note(`after two quick taps the game opened: ${m?.kind}`);
  await page.waitForTimeout(1500);
  await snap('mission-open');
  // a single tap on home does nothing (it needs a hold); then the hold
  const hb = await page.locator('.home.hold').first().boundingBox();
  await tap(hb.x + hb.width / 2, hb.y + hb.height / 2, 'home, one tap');
  await page.waitForTimeout(1200);
  await note(`after one tap on home: ${(await stage()).kind}`);
  await holdHome();
  await film('back-home', 5, 800);
  await waitFor((s) => s.ctor === 'Hub' && !s.busy, 20000);
  await snap('island-after-quit');
  // every place on the island: its star's position and size on screen
  const places = await st(() => { const { getStage, camera } = window.__pup; const s = getStage(); return Object.entries(s.markers).map(([kind, { marker }]) => { const p = marker.getWorldPosition(marker.position.clone()); p.project(camera); return { kind, x: Math.round((p.x + 1) / 2 * innerWidth), y: Math.round((1 - p.y) / 2 * innerHeight) }; }); });
  await note(`markers: ${JSON.stringify(places)}`);
  // pokes at the heroes, the cruiser, the sea, the lighthouse, the shelf
  for (const [x, y, why] of [[W / 2, H * 0.55, 'the cruiser'], [W * 0.1, H * 0.9, 'the sea, bottom left'], [W * 0.9, H * 0.25, 'the lighthouse side'], [70, 70, 'the badge shelf']]) { await tap(x, y, why); await page.waitForTimeout(900); await snap(`poke-${why.replace(/[^a-z]+/g, '-')}`); const after = await stage(); await note(`after the tap on ${why}: ${after.ctor}, ${after.busy ? 'BUSY (a drive started)' : 'idle (no drive)'}`); if (after.busy) await waitFor((s) => s.ctor !== 'Hub' || !s.busy, 20000); }
}

const visitMap = async (area, entry, startSel) => {
  const m = await markerAt(entry);
  await tap(m.x, m.y, `${entry} star`);
  await film(`to-${entry}`, 6, 700);
  const btn = await page.waitForSelector(startSel, { timeout: 60000 }).catch(() => null);
  await snap(`${entry}-button`);
  if (btn) { const bb = await btn.boundingBox(); await tap(bb.x + bb.width / 2, bb.y + bb.height / 2, startSel); }
  await film(`${area}-launch`, 9, 800);
  const ok = await waitFor((s) => s.state === 'waiting', 90000);
  await note(`${area} map waiting: ${Boolean(ok)}`);
  await page.waitForTimeout(1500);
  await snap(`${area}-map`);
  const list = await stops();
  await note(`stops: ${JSON.stringify(list.map((s) => ({ kind: s.kind, x: Math.round(s.x), y: Math.round(s.y), d: Math.round(s.r * 2) })))}`);
  const home = { space: 'earth', sea: 'island' }[area];
  for (const { kind } of [...list.filter((s) => s.kind !== home), ...list.filter((s) => s.kind === home)]) {
    const cur = (await stops()).find((x) => x.kind === kind);
    if (!cur) { await note(`${kind}: gone from the map`); continue; }
    const before = await stage();
    await tap(cur.x, cur.y, `stop ${kind}`);
    await film(`${kind}-fly`, 3.2, 800);
    const after = await waitFor((s) => s.kind !== before.kind || s.state === 'visiting' || s.area === 'island', 60000);
    await page.waitForTimeout(1500);
    await snap(`${kind}-arrived`);
    await note(`${kind}: ${JSON.stringify(after)}`);
    if (!after) continue;
    if (after.area === 'island' && after.ctor === 'Hub') { await note(`${kind} took her home to the island`); return; }
    if (after.state === 'visiting') {
      const shown = (await stops()).find((x) => x.kind === kind);
      if (shown) { await tap(shown.x, shown.y, `${kind} itself`); await page.waitForTimeout(1200); await snap(`${kind}-react`); }
      await page.waitForTimeout(2500);
      const back = await page.locator('.space-back').first().boundingBox().catch(() => null);
      if (back) await tap(back.x + back.width / 2, back.y + back.height / 2, 'back to the map'); else await note(`${kind}: no back button`);
    } else {
      await page.waitForTimeout(800);
      await holdHome();
    }
    const home = await waitFor((s) => s.state === 'waiting', 60000);
    if (!home) { await note(`${kind}: never came back to the map`); await snap(`${kind}-lost`); break; }
    await page.waitForTimeout(700);
  }
  await snap(`${area}-map-after`);
};
if (what === 'space') await visitMap('space', 'rocket', '.rocket-start');
if (what === 'sea') await visitMap('sea', 'harbour', '.boat-horn');

const said = await st(() => window.__timeline);
writeFileSync(`${OUT}notes.txt`, [...notes, '', 'SAID:', ...said.map((e) => `${(e.t / 1000).toFixed(1).padStart(6)}  ${e.text}`), '', `errors: ${JSON.stringify(errors)}`].join('\n'));
console.log(`${what} ${W}x${H}: ${n} frames, ${errors.length} errors → ${OUT}`);
await browser.close();
