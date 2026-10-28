// Plays one mission on the production build the way a parent would and writes a timeline:
// every spoken line, every synth sound, every speech clip (and whether it was cut off), taps, learning events.
// usage: node walk.mjs <mission> <level> [quality]
import { chromium } from 'playwright-core';
import { mkdirSync as mkdirTmp } from 'node:fs';
// Chromium's GPU process needs writable temp space; /tmp can be a full per-user tmpfs, which crashes WebGL
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirTmp(process.env.TMPDIR, { recursive: true });
import { writeFileSync, mkdirSync } from 'node:fs';

const [kind, levelArg, quality = 'low'] = process.argv.slice(2);
const level = Number(levelArg || 1);
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/${kind}-L${level}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'https://pup-patrol-theta.vercel.app';
const URL_ = `${BASE}/?q=${quality}`;

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(([kind, level]) => {
  const t0 = performance.now();
  const T = () => Math.round(performance.now() - t0);
  const log = (window.__timeline = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push({ t: T(), type: 'say', text }); return Array.prototype.push.call(say, text); };
  const AC = window.AudioContext || window.webkitAudioContext;
  const osc = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () {
    const o = osc.call(this);
    const f = o.frequency, set = f.setValueAtTime.bind(f), ramp = f.exponentialRampToValueAtTime.bind(f), lin = f.linearRampToValueAtTime.bind(f);
    f.setValueAtTime = (v, t) => { o.__from ??= v; return set(v, t); };
    f.exponentialRampToValueAtTime = (v, t) => { o.__to = v; return ramp(v, t); };
    f.linearRampToValueAtTime = (v, t) => { o.__to = v; return lin(v, t); };
    const start = o.start.bind(o);
    o.start = (when = 0) => { const from = Math.round(o.__from ?? f.value), to = Math.round(o.__to ?? from); log.push({ t: T(), type: 'tone', hz: from, to, wave: o.type, delay: Math.round(Math.max(0, when - this.currentTime) * 1000) }); start(when); };
    return o;
  };
  const mk = AC.prototype.createBuffer;
  AC.prototype.createBuffer = function (...a) { const b = mk.apply(this, a); b.__noise = true; return b; };
  const buf = AC.prototype.createBufferSource;
  AC.prototype.createBufferSource = function () {
    const s = buf.call(this);
    const start = s.start.bind(s), stop = s.stop.bind(s);
    s.start = (...a) => {
      const len = s.buffer ? Math.round(s.buffer.duration * 1000) : 0;
      // long buffers are speech clips; short noise buffers are sound effects
      s.__rec = { t: T(), type: s.buffer?.__noise ? 'noise' : 'clip', ms: len };
      log.push(s.__rec);
      s.onended = ((prev) => function (e) { if (s.__rec) s.__rec.ended = T(); prev?.call(this, e); })(s.onended);
      start(...a);
    };
    s.stop = (...a) => { if (s.__rec) { s.__rec.stoppedAt = T(); s.__rec.cut = T() - s.__rec.t < s.__rec.ms - 60; } stop(...a); };
    return s;
  };
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { [kind]: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  window.__mark = (text) => log.push({ t: T(), type: 'me', text });
}, [kind, level]);

await page.goto(URL_);
const st = (fn, a) => page.evaluate(fn, a);
const mark = (text) => st((x) => window.__mark(x), text);
let shot = 0;
const snap = async (name) => {
  const path = `${OUT}${String(++shot).padStart(2, '0')}-${name}.png`;
  for (let i = 0; i < 3; i++) { try { await page.screenshot({ path, timeout: 8000 }); return; } catch { await page.waitForTimeout(300); } }
  await mark(`(screenshot ${name} failed)`);
};

// what is on offer right now: [{ label, x, y, right, kind }] from the mission's own objects
const options = () => st((kind) => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const proj = (o, lift = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += lift; p.project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
  const out = [];
  if (kind === 'lookout') {
    document.querySelectorAll('.lift-btn').forEach((b) => { const r = b.getBoundingClientRect(); out.push({ label: b.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, right: Number(b.textContent) === s.last }); });
    return out;
  }
  for (const o of s.tappables) {
    const u = o.userData;
    if (u.letter !== undefined && u.letter) out.push({ label: u.letter, ...proj(o, kind === 'delivery' && u.tapHeight === 1.9 ? 1.9 : 0.4), right: u.letter === s.last });
    else if (u.word) out.push({ label: u.word, ...proj(u.board, 0), right: u.word === s.last }); // (Name Train "whose": tap the name board)
    else if (u.num !== undefined && (kind !== 'cones' || u.sign)) out.push({ label: String(u.num), ...proj(o, kind === 'cones' ? 2.7 : 0.3), right: u.num === s.last, at: [+o.position.x.toFixed(2), +o.position.z.toFixed(2)] });
    else if (kind === 'picnic' && o.geometry?.type === 'BoxGeometry' && o.material?.visible === false) out.push({ label: o.position.x < 0 ? 'left' : 'right', ...proj(o, -0.4), right: null });
    else if (kind === 'counting' && u.drag) out.push({ label: 'bone', ...proj(o, 0.2), right: true });
    else if (kind === 'counting' && u.hungry !== undefined) out.push({ label: 'plate', ...proj(o, 0), right: u.hungry });
  }
  return out;
}, kind);

const waitAsked = (ms = 40000) => page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.learn?.isOpen && !s.speaking && (s.learn.current.promptEndAt !== null || performance.now() - s.learn.current.openedAt > 1500); }, null, { timeout: ms }).then(() => true, () => false);
const question = () => st(() => { const s = window.__pup.getStage(); return s.learn?.current ? { skill: s.learn.current.skill, item: s.learn.current.item, round: s.roundIndex, rounds: s.rounds, bubble: document.querySelector('.bubble')?.innerText.replace(/\s+/g, ' ').trim() } : null; });
const tap = async (o, why) => { await mark(`TAP ${o.label} (${why})`); await page.mouse.click(o.x, o.y); };
// the object under a screen point, its pose now and its biggest change over the next 600 ms
const motion = (o) => st(async ({ x, y, kind }) => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const near = (obj) => { const p = obj.getWorldPosition(obj.position.clone()); p.project(cam); return Math.hypot((p.x + 1) / 2 * innerWidth - x, (1 - p.y) / 2 * innerHeight - y); };
  const pool = kind === 'lookout' ? [] : s.tappables.filter((t) => t.visible);
  const obj = pool.sort((a, b) => near(a) - near(b))[0];
  if (!obj) return { moved: null };
  const p0 = obj.position.clone(), r0 = obj.rotation.clone(), s0 = obj.scale.x;
  let moved = 0, frames = 0;
  await new Promise((done) => { const t0 = performance.now(); const f = () => { frames++; moved = Math.max(moved, obj.position.distanceTo(p0) + Math.abs(obj.rotation.x - r0.x) + Math.abs(obj.rotation.y - r0.y) + Math.abs(obj.rotation.z - r0.z) + Math.abs(obj.scale.x - s0)); if (performance.now() - t0 < 600) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
  return { moved: Math.round(moved * 100) / 100, frames }; // headless frames can be slow: few frames can miss a shake
}, { x: o.x, y: o.y, kind });

await mark('page loaded');
// like a parent: tap the start paw (this is what switches sound on), then pick the place on the island
await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1500);
const pb = await page.locator('.play').boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
await page.waitForTimeout(3500);
await mark('island');
await snap('island');
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== kind; i++) { await mark(`starting ${kind}`); await st((k) => window.__pup.game.startMission(k), kind); await page.waitForTimeout(700); }
await mark(`mission ${kind} started`);
const plan = ['right', 'wrong-then-right', 'hesitate', 'double-wrong', 'right', 'right', 'right', 'right'];
for (let r = 0; r < 16; r++) { // (rounds past the plan: right answers, so long missions finish)
  if (!(await waitAsked())) { await mark('no open question (mission over?)'); break; }
  const q = await question();
  await mark(`QUESTION r${q.round + 1}/${q.rounds} ${q.skill}:${q.item} bubble="${q.bubble}"`);
  await snap(`r${r + 1}-asked`);
  const how = plan[r];
  const opts = await options();
  await mark(`OPTIONS ${opts.map((o) => `${o.label}${o.right ? '*' : ''}`).join(' ')}`);
  const right = opts.find((o) => o.right) || opts[0];
  const wrong = opts.find((o) => o.right === false);
  if (how === 'hesitate') { await mark('waiting 20 s like a thinking child'); await page.waitForTimeout(20000); await snap(`r${r + 1}-after-wait`); }
  if ((how === 'wrong-then-right' || how === 'double-wrong') && wrong) {
    const mv = motion(wrong);
    await tap(wrong, 'wrong on purpose');
    await mark(`MOTION ${JSON.stringify(await mv)}`);
    await snap(`r${r + 1}-wrong`);
    if (how === 'double-wrong') { await page.waitForTimeout(400); const w2 = (await options()).find((o) => o.right === false) || wrong; await tap(w2, 'wrong again, quickly'); await page.waitForTimeout(250); await snap(`r${r + 1}-wrong2`); }
    await page.waitForTimeout(2500);
  }
  // re-read positions (things move: balloons, removed options)
  let now = (await options()).find((o) => o.right) || right;
  if (kind === 'picnic') {
    // she can't see the answer in code: try left, then right
    const [a, b] = await options();
    await tap(a, 'picnic: try left'); await page.waitForTimeout(900);
    const ev = await st(() => window.__pup.learning.recent(1)[0]);
    if (!ev?.correct) { await page.waitForTimeout(1500); await tap(b, 'picnic: then right'); }
  } else if (kind === 'counting' && now.label === 'plate') {
    for (let i = 0; i < 5; i++) { const p = (await options()).find((o) => o.label === 'plate' && o.right); if (!p) break; await tap(p, `plate ${i + 1}`); await page.waitForTimeout(800); }
  } else if (kind === 'counting' && now.label === 'bone') {
    const n = Number(q.item);
    for (let i = 0; i < n; i++) { const b = (await options()).find((o) => o.label === 'bone'); if (!b) break; await tap(b, `treat ${i + 1}/${n}`); await page.waitForTimeout(700); }
    const pup = await st(() => { const s = window.__pup.getStage(); if (s.L.auto) return null; const p = s.pup.getWorldPosition(s.pup.position.clone()); p.y += 0.8; p.project(window.__pup.camera); return { label: 'Chase', x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; });
    if (pup) { await page.waitForTimeout(600); await tap(pup, 'done: tap Chase'); } // (levels where she decides when to stop)
  } else {
    await tap(now, 'right');
    if (kind === 'stones' && now.at) await mark(`STEP ${now.label} ${now.at.join(' ')}`); // where she landed, for the hop census
  }
  await page.waitForTimeout(300); await snap(`r${r + 1}-tapped-right`);
  await page.waitForTimeout(1200);
}
await page.waitForSelector('.celebrate', { timeout: 60000 }).then(() => mark('celebration'), () => mark('no celebration within 60 s'));
await page.waitForTimeout(2500);
await snap('end');
const timeline = await st(() => window.__timeline);
const events = await st(() => window.__pup.learning.recent(50));
writeFileSync(`${OUT}timeline.json`, JSON.stringify({ kind, level, errors, timeline, events }, null, 1));
// a readable transcript
const lines = timeline.map((e) => {
  const t = (e.t / 1000).toFixed(1).padStart(6);
  if (e.type === 'say') return `${t}  SAY   ${e.text}`;
  if (e.type === 'me') return `${t}  ----  ${e.text}`;
  if (e.type === 'clip') return `${t}  clip  ${e.ms} ms${e.cut ? `  CUT OFF after ${e.stoppedAt - e.t} ms` : ''}`;
  if (e.type === 'tone') return `${t}  tone  ${e.hz} Hz ${e.wave}${e.delay ? ` +${e.delay}ms` : ''}`;
  return `${t}  ${e.type} ${e.ms ?? ''}`;
});
writeFileSync(`${OUT}transcript.txt`, lines.join('\n') + `\n\nerrors: ${JSON.stringify(errors)}\n`);
console.log(`${kind} L${level}: ${timeline.length} timeline entries, ${errors.length} errors → ${OUT}`);
await browser.close();
