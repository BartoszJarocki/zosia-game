// probes.mjs <name> : one short scenario each, reproducing a defect the way she would meet it (verification tooling).
// names: lamp, guess, asleep, maphome, farflight, windmill
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
const [name] = process.argv.slice(2);
const OUT = `${process.env.OUTDIR || 'probes'}/${name}/`;
mkdirSync(OUT, { recursive: true });
const W = 1180, H = 820;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true });
const page = await context.newPage();
const errors = [], out = [];
page.on('pageerror', (e) => errors.push(e.message));
const seed = { lamp: { lighthouse: 3 }, guess: { shallows: 2 } }[name] || {};
await page.addInitScript((seed) => {
  const t0 = performance.now();
  const log = (window.__said = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push(`${((performance.now() - t0) / 1000).toFixed(1)} ${text}`); return Array.prototype.push.call(say, text); };
  window.__T = () => (performance.now() - t0) / 1000;
  const missions = Object.fromEntries(Object.entries(seed).map(([k, level]) => [k, { level, good: 0, lastAcc: 1 }]));
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, seed);
const st = (fn, a) => page.evaluate(fn, a);
const T = () => st(() => window.__T());
let n = 0;
const snap = async (label) => { await page.screenshot({ path: `${OUT}${String(++n).padStart(2, '0')}-${label}.jpg`, type: 'jpeg', quality: 72 }); };
const note = async (text) => { const line = `${(await T()).toFixed(1).padStart(6)}  ${text}`; out.push(line); console.log(line); };
const tap = (x, y) => page.touchscreen.tap(x, y);
const stageInfo = () => st(() => { const s = window.__pup.getStage(); return { kind: s?.kind, area: s?.area, state: s?.state, ctor: s?.constructor?.name, busy: Boolean(s?.busy), asleep: Boolean(s?.asleep), phase: s?.phase, count: s?.count, target: s?.target }; });
const until = async (pred, ms = 40000) => { const end = Date.now() + ms; for (;;) { const s = await stageInfo(); if (pred(s)) return s; if (Date.now() > end) return null; await page.waitForTimeout(100); } };
const at = (fn, a) => st(fn, a);
const project = (expr) => st(new Function('arg', `const { getStage, camera } = window.__pup; const s = getStage(); const o = (${expr})(s); if (!o) return null; const p = o.getWorldPosition(o.position.clone()); p.y += (o.userData.tapHeight ?? 0.3); p.project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };`));
const marker = (kind) => st((kind) => { const { getStage, camera } = window.__pup; const m = getStage().markers?.[kind]?.marker; if (!m) return null; const p = m.getWorldPosition(m.position.clone()); p.project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, kind);

await page.goto(`${process.env.BASE || 'http://localhost:4190'}/?q=high`);
await page.waitForSelector('.start .play', { timeout: 90000 }); // (slow when the GPU is shared)
await page.waitForTimeout(1200);
const pb = await page.locator('.play').boundingBox();
await tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const start = (kind) => st((k) => window.__pup.game.startMission(k), kind);

if (name === 'lamp') {
  // Lighthouse level 3: the sail shows N. She taps the lamp N times at her own quick pace, then the boat.
  await start('lighthouse');
  await until((s) => s.kind === 'lighthouse' && s.phase === 'making');
  await page.waitForTimeout(4500); // the question has been asked
  const info = await stageInfo();
  const lamp = await project('(s) => s.lamp');
  const boat = await project('(s) => s.boat');
  await note(`asked to make ${info.target} flashes; she taps the lamp ${info.target} times, 300 ms apart`);
  await snap('asked');
  for (let i = 0; i < info.target; i++) { await tap(lamp.x, lamp.y); await page.waitForTimeout(300); }
  await page.waitForTimeout(1500);
  await note(`the game counted ${(await stageInfo()).count} of her ${info.target} taps`);
  await snap('after-taps');
  await tap(boat.x, boat.y);
  await page.waitForTimeout(2500);
  await snap('verdict');
  await note(`after tapping the boat she hears: ${(await st(() => window.__said.slice(-2))).join(' | ')}`);
}

if (name === 'guess') {
  // Floats or sinks, level 2: she guesses wrong on purpose every time. What does the game save?
  await start('shallows');
  let wrongs = 0;
  for (let r = 0; r < 4; r++) {
    const s = await until((x) => x.kind === 'shallows' && x.phase === 'guessing', 30000);
    if (!s) break;
    await page.waitForTimeout(1200);
    const side = await st(() => window.__pup.getStage().last);
    const other = side === 'float' ? 'sink' : 'float';
    const p = await st((other) => { const { getStage, camera } = window.__pup; const o = getStage().shelves[other]; const v = o.getWorldPosition(o.position.clone()); v.y += 1.2; v.project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, other);
    await tap(p.x, p.y);
    wrongs++;
    await note(`round ${r + 1}: the answer is "${side}", she taps "${other}"`);
    await until((x) => x.phase !== 'guessing', 5000);
    await page.waitForTimeout(600);
  }
  await page.waitForFunction(() => document.querySelector('.celebrate'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await snap('celebration');
  const saved = await st(() => JSON.parse(localStorage.getItem('pup-patrol-progress')).missions.shallows);
  await note(`${wrongs} wrong guesses out of 4. The save now says: ${JSON.stringify(saved)}`);
}

if (name === 'asleep') {
  // The session winds down (forced here, as after a distracted spell): the goodnight, then she taps Chase and a place.
  const session = () => st(() => window.__pup.session().id);
  const first = await session();
  await st(() => { const s = window.__pup.session(); s.endedEarly = true; });
  await st(() => window.__pup.game.hub());
  const t0 = await T();
  await page.waitForTimeout(3000);
  await snap('goodnight-starts');
  await until((s) => s.asleep, 60000);
  await note(`the goodnight took ${((await T()) - t0).toFixed(1)} s; asleep: ${(await stageInfo()).asleep}`);
  await page.waitForTimeout(1500);
  await snap('island-asleep');
  const chase = await project('(s) => s.pup');
  await tap(chase.x, chase.y);
  await page.waitForTimeout(2500);
  await note(`tap on Chase: still asleep ${(await stageInfo()).asleep}; she hears: ${(await st(() => window.__said.slice(-1)))[0]}`);
  const m = await marker('counting');
  const t1 = await T();
  await tap(m.x, m.y);
  await page.waitForTimeout(200);
  await note(`200 ms after a tap on the Treat House star: drowsy ${(await st(() => window.__pup.getStage().drowsy)).toFixed(2)} (1 = asleep)`);
  await page.waitForTimeout(500);
  await snap('waking');
  const opened = await until((s) => s.kind === 'counting', 20000);
  await note(`${((await T()) - t1).toFixed(1)} s after the tap: ${opened ? 'the Treat House is open' : 'NOTHING OPENED'}; she heard: ${(await st(() => window.__said.slice(-2))).join(' | ')}`);
  await note(`a new session: ${(await session()) !== first}; night tint gone: ${!(await st(() => document.getElementById('game').classList.contains('night')))}`);
  await page.waitForTimeout(2500);
  await snap('mission-open');
}

if (name === 'maphome' || name === 'farflight') {
  const m = await marker('rocket');
  const t0 = await T();
  await tap(m.x, m.y);
  const btn = await page.waitForSelector('.rocket-start', { timeout: 60000 });
  const bb = await btn.boundingBox();
  await note(`START appeared ${((await T()) - t0).toFixed(1)} s after the tap on the rocket`);
  await tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await until((s) => s.state === 'waiting', 60000);
  await note(`the space map could be tapped ${((await T()) - t0).toFixed(1)} s after the tap on the rocket`);
  await page.waitForTimeout(1000);
  if (name === 'maphome') {
    const hb = await page.locator('.space-home').boundingBox();
    const t1 = await T();
    await tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await note('one tap on the house button on the map');
    const home = await until((s) => s.ctor && s.area === 'island' && !s.busy && s.state === undefined, 60000);
    await note(`back on the island ${((await T()) - t1).toFixed(1)} s later: ${Boolean(home)}`);
    await snap('island-again');
  } else {
    const stops = await st(() => window.__pup.getStage().stopsOnScreen());
    const far = stops.find((s) => s.kind === 'stars');
    const t1 = await T();
    await tap(far.x, far.y);
    await note('from Earth she taps the star picture stop');
    // she changes her mind and taps Mars twice on the way
    const mars = stops.find((s) => s.kind === 'mars');
    await page.waitForTimeout(2500); await tap(mars.x, mars.y);
    await page.waitForTimeout(2500); await tap(mars.x, mars.y);
    const arrived = await until((s) => s.kind === 'stars' || s.kind === 'mars', 90000);
    await note(`${((await T()) - t1).toFixed(1)} s later the game opened: ${arrived?.kind} (her two taps on Mars during the flight did nothing if this says stars)`);
    await snap('arrived');
  }
}

if (name === 'windmill') {
  // Taps on things that belong to a place but are toys: does the place open?
  const spots = await st(() => {
    const { getStage, camera } = window.__pup; const s = getStage();
    const proj = (o, lift = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += lift; p.project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
    const wm = s.placeGroups?.balloons?.windmill;
    return { windmill: wm ? proj(wm, 2.2) : null, lighthouse: s.lighthouse ? proj(s.lighthouse, 4) : null };
  });
  await snap('island');
  for (const [what, p] of Object.entries(spots)) {
    if (!p) { await note(`${what}: not found`); continue; }
    await tap(p.x, p.y);
    await page.waitForTimeout(3500);
    const s = await stageInfo();
    await note(`tap on the ${what} at ${Math.round(p.x)},${Math.round(p.y)}: ${s.ctor === 'Hub' || s.area === 'island' && !s.kind ? 'still on the island, no mission' : `opened ${s.kind}`}; she hears: ${(await st(() => window.__said.slice(-1)))[0]}`);
    await snap(`after-${what}`);
    if (s.kind) { await st(() => window.__pup.game.hub()); await page.waitForTimeout(3000); }
  }
}

writeFileSync(`${OUT}notes.txt`, [...out, '', 'SAID:', ...(await st(() => window.__said)), '', `errors: ${JSON.stringify(errors)}`].join('\n'));
await browser.close();
