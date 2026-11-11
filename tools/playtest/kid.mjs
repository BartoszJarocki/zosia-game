// kid.mjs <mission> <level> <plan> : plays one mission the way a quick 3.5-year-old does, on the real GPU, with
// touch input and the graphics the iPad shows (verification tooling, written for the November review).
//   plan fast        answers right the moment an answer can be tapped, without waiting for the voice
//   plan mash        pokes everything quickly while the voice talks, then answers
//   plan polite      waits for the voice to finish (the old walker's manners)
//   plan wrong-first taps one wrong answer first (a wrong count, in the counting games), records what the game
//                    does in the next 4 s (help level, whether the answer pulsed, glowed, was named or shown), then answers
//   plan quick       taps the counting things (lamp, jumps, pebbles, horn, treats) once every 300 ms, as many times as
//                    asked, and records how many the game counted
// On a ride or a feast she can tap along with (the scene's along() names the thing), every plan but polite taps along
// every 600 ms, and a die to roll is tapped before the answer. rounds[].alongMs: the part of the wait she tapped along.
// Every plan logs each tap and the first sound after it (summary.json taps[]). tools/playtest/playcheck.mjs judges them.
// env: BASE, OUTDIR, Q (graphics tier, default high), W, H (viewport), FILM=seconds between filmstrip frames (0 = none),
//   FINALE=1 makes the session's finale due first (play it with `lookout`)
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { answerNamed, bubbleShowsAnswer } from './playcheck-rules.mjs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [kind, levelArg = '1', plan = 'fast'] = process.argv.slice(2);
const level = Number(levelArg);
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const OUT = `${process.env.OUTDIR || 'out'}/${kind}-L${level}-${plan}${process.env.FINALE ? '-finale' : ''}/`;
mkdirSync(`${OUT}film`, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4190';
const FILM = Number(process.env.FILM ?? 3);
const QUICK_MS = 300, WATCH_MS = 4000, ALONG_MS = 600; // (the first idle help comes 6 s after a tap)

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: true, isMobile: false });
const page = await context.newPage();
const errors = [], consoleErrors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

await page.addInitScript(([kind, level, v]) => {
  const t0 = performance.now();
  const T = () => Math.round(performance.now() - t0);
  const log = (window.__timeline = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push({ t: T(), type: 'say', text }); return Array.prototype.push.call(say, text); };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => {
    if (!window.__celebrated && document.querySelector('.celebrate')) { window.__celebrated = T(); log.push({ t: T(), type: 'me', text: 'celebration' }); }
  }).observe(document.body, { childList: true, subtree: true }));
  // every sound the page starts (tones, noise, voice clips), with when it is heard
  const sounds = (window.__sounds = []);
  const heard = (ctx, kind, when) => sounds.push({ t: T(), at: T() + Math.max(0, Math.round(((when || 0) - ctx.currentTime) * 1000)), kind });
  const AC = window.AudioContext || window.webkitAudioContext;
  const osc = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () {
    const o = osc.call(this), start = o.start.bind(o);
    o.start = (when, ...a) => { heard(this, 'tone', when); start(when, ...a); };
    return o;
  };
  const buf = AC.prototype.createBufferSource;
  const mk = AC.prototype.createBuffer;
  AC.prototype.createBuffer = function (...a) { const b = mk.apply(this, a); b.__noise = true; return b; };
  AC.prototype.createBufferSource = function () {
    const s = buf.call(this);
    const start = s.start.bind(s), stop = s.stop.bind(s);
    s.start = (...a) => {
      heard(this, s.buffer?.__noise ? 'noise' : 'clip', a[0]);
      const len = s.buffer ? Math.round(s.buffer.duration * 1000) : 0;
      if (!s.buffer?.__noise) { s.__rec = { t: T(), type: 'clip', ms: len }; log.push(s.__rec); }
      start(...a);
    };
    s.stop = (...a) => { if (s.__rec) { s.__rec.stoppedAt = T(); s.__rec.cut = T() - s.__rec.t < s.__rec.ms - 60; } stop(...a); };
    return s;
  };
  // every finger that lands, with what the player meant to tap (window.__aim, set before each tap)
  const taps = (window.__taps = []);
  window.addEventListener('pointerdown', (e) => taps.push({ t: T(), canvas: e.target?.tagName === 'CANVAS', ...window.__aim }), true);
  // a ride or a feast she can tap along with: when it starts and ends
  let along = false;
  setInterval(() => { const now = Boolean(window.__pup?.getStage?.()?.along?.()); if (now !== along) { along = now; log.push({ t: T(), type: 'along', on: now }); } }, 50);
  // frames per second, one sample a second
  const fps = (window.__fps = []);
  let n = 0, mark = performance.now();
  const frame = () => { n++; const now = performance.now(); if (now - mark >= 1000) { fps.push(Math.round(n * 1000 / (now - mark))); n = 0; mark = now; } requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v, missions: { [kind]: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  window.__mark = (text) => log.push({ t: T(), type: 'me', text });
  window.__T = T;
  window.__t0 = t0;
  window.__epoch0 = Date.now() - (performance.now() - t0); // (learning events carry Date.now())
}, [kind, level, VERSION]); // (the current save version: an older one is migrated and may move the level)

await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
const st = (fn, a) => page.evaluate(fn, a);
const mark = (text) => st((x) => window.__mark(x), text);
const now = () => st(() => window.__T());
let shot = 0;
const snap = async (name) => { try { await page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png`, scale: 'css', timeout: 8000 }); } catch { await mark(`(screenshot ${name} failed)`); } };
let film = 0, filming = FILM > 0;
(async () => { while (filming) { try { await page.screenshot({ path: `${OUT}film/${String(++film).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 5000 }); } catch {} await new Promise((r) => setTimeout(r, FILM * 1000)); } })();

// what she can tap now; id names the thing for the wrong-first watch (a scene object's tag, or a button's selector)
const options = () => st((kind) => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const proj = (o, lift = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += lift; p.project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
  const out = [];
  if (kind === 'lookout') {
    document.querySelectorAll('.lift-btn').forEach((b) => { const r = b.getBoundingClientRect(); out.push({ label: b.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, right: Number(b.textContent) === s.last, dom: true, id: `.lift-btn[data-floor="${b.dataset.floor}"]` }); });
    return out;
  }
  window.__kidN ||= 0;
  for (const o of s.tappables || []) {
    const u = o.userData;
    if (!o.visible) continue;
    const id = (u.__kid ||= ++window.__kidN);
    const add = (x) => out.push({ ...x, id });
    if (u.letter !== undefined && u.letter) add({ label: u.letter, ...proj(o, kind === 'delivery' && u.tapHeight === 1.9 ? 1.9 : 0.4), right: u.letter === s.last });
    else if (u.word) add({ label: u.word, ...proj(u.board, 0), right: u.word === s.last });
    else if (u.num !== undefined && (kind !== 'cones' || u.sign)) add({ label: String(u.num), ...proj(o, kind === 'cones' ? 2.7 : 0.3), right: u.num === s.last });
    else if (kind === 'picnic' && o.geometry?.type === 'BoxGeometry' && o.material?.visible === false) add({ label: o.position.x < 0 ? 'left' : 'right', ...proj(o, -0.4), right: null });
    else if (kind === 'counting' && u.drag) add({ label: 'bone', ...proj(o, 0.2), right: true });
    else if (kind === 'counting' && u.hungry !== undefined) add({ label: 'plate', ...proj(o, 0), right: u.hungry });
    else if (u.choice !== undefined) add({ label: String(u.choice), ...proj(o, u.tapHeight ?? 0.3), right: u.choice === s.last });
    else if (u.jumper) add({ label: 'Chase', ...proj(o, 0.8), right: null });
    else if (u.pebble) add({ label: 'pebble', ...proj(o, 0), right: null });
    else if (u.done) add({ label: 'done', ...proj(o, u.tapHeight ?? 0.5), right: null });
    else if (u.place) add({ label: u.place, ...proj(o, 0), right: u.place === s.last });
    else add({ label: 'other', ...proj(o, u.tapHeight ?? 0.5), right: null, other: true });
  }
  return out;
}, kind);

const aimAt = (aim) => st((aim) => {
  window.__aim = aim;
  const s = window.__pup.getStage();
  if (!s || s.__kidMiss) return;
  const missTap = s.onMissTap; // (the engine reports a tap that hit nothing here)
  s.onMissTap = function () { const t = window.__taps[window.__taps.length - 1]; if (t) t.miss = true; return missTap?.call(this); };
  s.__kidMiss = true;
}, aim);
const tap = async (o, why, aim = 'thing') => {
  await aimAt({ label: o.label, aim, dom: Boolean(o.dom) });
  await mark(`TAP ${o.label} (${why}) at ${Math.round(o.x)},${Math.round(o.y)}`);
  await page.touchscreen.tap(Math.max(2, Math.min(W - 2, o.x)), Math.max(2, Math.min(H - 2, o.y)));
};
const qState = () => st(() => { const s = window.__pup.getStage(); const q = s?.learn?.current; return { kind: s?.kind, open: Boolean(q), along: Boolean(s?.along?.()), id: q ? `${q.skill}:${q.item}:${q.round}:${q.openedAt}` : null, skill: q?.skill, item: q?.item, round: s?.roundIndex, rounds: s?.rounds, speaking: Boolean(s?.speaking), celebrated: Boolean(window.__celebrated), t: window.__T(), opened: q ? Math.round(q.openedAt - window.__t0) : null, bubble: document.querySelector('.bubble')?.innerText.replace(/\s+/g, ' ').trim() }; });
const waitFor = async (pred, ms, every = 100) => { const end = Date.now() + ms; for (;;) { const s = await qState(); if (pred(s)) return s; if (Date.now() > end) return null; await page.waitForTimeout(every); } };
const solved = (id) => (s) => s.celebrated || s.id !== id;
/** What she can tap along with now (the lit floor sign, the next treat, the die), on screen. */
const alongThing = () => st(() => {
  const s = window.__pup.getStage(), o = s?.along?.();
  if (!o) return null;
  const p = o.getWorldPosition(new o.position.constructor()); p.y += o.userData.tapHeight ?? 0.3; p.project(window.__pup.camera);
  return { label: 'along', x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
});
/** A question can start with something to watch (a quick look, pebbles falling): wait for something to answer with. */
const answerable = async (q) => {
  for (const end = Date.now() + 20000; Date.now() < end; await page.waitForTimeout(200)) {
    const s = await qState();
    if (s.celebrated || s.id !== q.id) return;
    if ((await options()).some((o) => o.right || ['plate', 'left', COUNT_THING[kind]].includes(o.label))) return;
  }
};
/** Between questions: wait for the next one, tapping along on a ride or a feast. */
const nextQuestion = async () => {
  const end = Date.now() + 45000;
  let last = 0;
  for (;;) {
    const s = await qState();
    if (s.open || s.celebrated) return s;
    if (Date.now() > end) return null;
    if (s.along && plan !== 'polite' && Date.now() - last > ALONG_MS) {
      const o = await alongThing();
      if (o) { await tap(o, 'tap along'); last = Date.now(); }
    }
    await page.waitForTimeout(100);
  }
};

// the counting games: what she taps to make the count, and the game's own count (Treat House: the treats that left the pile)
const COUNT_THING = { moon: 'Chase', blackhole: 'pebble', lighthouse: 'lamp', port: 'horn', counting: 'bone' };
const count = () => st(() => {
  const s = window.__pup.getStage();
  if (s.kind === 'lighthouse' || s.kind === 'port') return s.count;
  if (s.kind === 'counting') { let n = 0; s.scene.traverse((o) => { if (o.userData.drag && !s.tappables.includes(o)) n++; }); return n; }
  return (s.prints || s.beads || []).length;
});
const doneOption = async () => (await options()).find((x) => x.label === 'done') || (kind === 'counting' ? await st(() => {
  const s = window.__pup.getStage();
  if (s.L.auto || !s.pup) return null;
  const p = s.pup.getWorldPosition(s.pup.position.clone()); p.y += 0.8; p.project(window.__pup.camera);
  return { label: 'done', x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}) : null);
/** The counting thing she taps next: the lowest on screen (nothing stands in front of it), not one that ignored her. */
const nextThing = async (ignored = new Set()) => {
  const all = (await options()).filter((x) => x.label === COUNT_THING[kind]).sort((a, b) => b.y - a.y);
  return all.find((x) => !ignored.has(x.id)) || all[0];
};
/** Tap the counting thing until the game's count is `to` (or it stops answering). */
const countTo = async (q, rec, to, pace) => {
  let made = await count();
  const ignored = new Set();
  for (let i = 0; i < to * 4 && made < to; i++) {
    const o = await nextThing(ignored);
    if (!o) break;
    await tap(o, `${o.label} ${made + 1} of ${to}`); rec.taps++;
    await page.waitForTimeout(pace);
    const after = await count();
    if (after === made) { rec.ignored++; ignored.add(o.id); }
    made = after;
    if (!(await qState()).open) break;
  }
  return made;
};
/** Quick taps: as many as asked, one every 300 ms; then how many the game counted once its count settles. */
const quickTaps = async (q, rec, n) => {
  const before = await count(), t0 = Date.now();
  let made = 0;
  for (let i = 0; i < n; i++) {
    const o = await nextThing();
    if (!o) break;
    await page.waitForTimeout(Math.max(0, t0 + i * QUICK_MS - Date.now()));
    await tap(o, `quick ${i + 1} of ${n}`); rec.taps++; made++;
  }
  let last = await count(), since = Date.now();
  const end = Date.now() + 8000;
  while (Date.now() < end && Date.now() - since < 1500) {
    await page.waitForTimeout(250);
    if (solved(q.id)(await qState())) return { made, counted: made, what: COUNT_THING[kind] }; // (an automatic round closes on the last one counted)
    const c = await count();
    if (c !== last) { last = c; since = Date.now(); }
  }
  return { made, counted: last - before, what: COUNT_THING[kind] };
};

// ---- wrong-first: what the game shows in the 4 s after one wrong tap ----
const watch = (ids, since) => st(([ids, since]) => {
  const s = window.__pup.getStage(), q = s?.learn?.current;
  const objs = new Map();
  s.scene.traverse((o) => { if (ids.includes(o.userData.__kid)) objs.set(o.userData.__kid, o); });
  const looks = ids.map((id) => {
    if (typeof id === 'string') { const b = document.querySelector(id); return b ? { cls: b.className } : null; }
    const o = objs.get(id);
    if (!o?.parent) return null;
    // what a highlight scales: the thing, its sign, or its name board (a train's stands beside it); idle children like
    // puffs of steam scale on every option, so the scale is read from these roots only
    const parts = [o, o.userData.sign, o.userData.board].filter((x) => x?.isObject3D);
    const sc = [], gl = [], co = [];
    let hinting = false;
    for (const part of parts) { part.updateWorldMatrix(true, true); const e = part.matrixWorld.elements; sc.push(Math.hypot(e[0], e[1], e[2])); }
    for (const part of new Set(parts)) part.traverse((m) => {
      if (m.userData.hinting) hinting = true;
      if (!m.isMesh && !m.isSprite) return;
      let g = 0, c = 0;
      for (const mt of [m.material].flat()) {
        if (mt?.emissive) g += (mt.emissive.r + mt.emissive.g + mt.emissive.b) * (mt.emissiveIntensity ?? 1);
        if (mt?.color) c += mt.color.r + mt.color.g + mt.color.b;
      }
      gl.push(g); co.push(c);
    });
    return { sc, gl, co, hinting };
  });
  // answers a scene shows in its own way: the lamp or the boat shows the count again, Chase's bowl lifts
  let probe = null;
  if (s.kind === 'lighthouse' || s.kind === 'port') probe = [s.phase === 'helping' ? 1 : 0];
  if (s.kind === 'counting') { let b = null; s.scene.traverse((o) => { if (o.userData.bowl?.isObject3D && o.userData.bowl.userData.to) b = o.userData.bowl; }); probe = b ? [b.position.x, b.position.y, b.position.z, b.rotation.x] : null; }
  return {
    looks, probe,
    help: Math.max(q?.assist ?? 0, s.aid?.state?.level ?? 0),
    id: q ? `${q.skill}:${q.item}:${q.round}:${q.openedAt}` : null,
    celebrated: Boolean(window.__celebrated),
    right: window.__pup.learning.recent(6).some((e) => e.correct && e.at >= since),
  };
}, [ids, since]);
const changeOf = (before, after) => {
  const b = before.filter(Boolean), a = after.filter(Boolean);
  if (!b.length || !a.length) return {};
  if (b[0].cls !== undefined) return { cls: a.some((x) => x.cls !== b[0].cls) };
  const dev = (key, rel) => {
    let most = 0;
    b[0][key].forEach((_, j) => {
      const vals = b.map((x) => x[key][j]), lo = Math.min(...vals), hi = Math.max(...vals);
      for (const x of a) { const v = x[key][j]; if (v !== undefined) most = Math.max(most, Math.max(0, v - hi, lo - v) / (rel ? Math.max(hi, 1e-3) : 1)); }
    });
    return most;
  };
  // a pulse swells a steady thing a little and lets it settle back. Not a pulse: a thing that shrinks away, or one that
  // grows back in with an overshoot (a balloon that floated off the top inflates again at the bottom)
  const pulse = () => {
    let most = 0;
    b[0].sc.forEach((_, j) => {
      const was = b.map((x) => x.sc[j]), lo = Math.min(...was), hi = Math.max(...was);
      if (hi < 1e-3 || hi - lo > 0.05 * hi) return;
      const vs = a.map((x) => x.sc[j]).filter((v) => v !== undefined), top = vs.indexOf(Math.max(...vs)), rise = (vs[top] - hi) / hi;
      const steady = Math.min(...vs.slice(0, top + 1)) >= 0.9 * lo, settles = Math.min(...vs.slice(top)) <= vs[top] - (vs[top] - hi) / 2;
      if (rise > 0 && rise < 0.5 && steady && settles) most = Math.max(most, rise);
    });
    return most;
  };
  return { scale: pulse(), glow: dev('gl', false), colour: dev('co', true), hinting: !b.some((x) => x.hinting) && a.some((x) => x.hinting) };
};
/** Tap `wrong`, watch the right options (and the untapped wrong ones, to tell a highlight from an idle animation). */
const watchWrong = async (q, rec, wrong, rights, others, right) => {
  const ids = [...rights, ...others].map((o) => o.id);
  const before = [];
  for (let i = 0; i < 3; i++) { before.push(await watch(ids, 0)); await page.waitForTimeout(150); }
  const since = await st(() => Date.now()), tWrong = await now();
  await tap(wrong, 'wrong first');
  rec.taps++;
  const after = [];
  let closed = false;
  for (const end = Date.now() + WATCH_MS; Date.now() < end; await page.waitForTimeout(150)) {
    const v = await watch(ids, since);
    after.push(v);
    if (v.right) { await mark('(the wrong-first tap was right)'); return null; }
    if (v.celebrated || v.id !== q.id) { closed = true; break; }
  }
  const timeline = await st(() => window.__timeline);
  const lines = (from, to) => timeline.filter((e) => e.type === 'say' && e.t >= from && e.t < to).map((e) => e.text);
  // the question as asked: since the last answer to a different question (a second comet with the same letter was asked
  // before the first was caught; the first question can be asked before the mission's start is marked)
  const asked = rounds.findLast((x) => x.q !== rec.q)?.tSolved ?? 0;
  const said = lines(tWrong, tWrong + WATCH_MS), prompt = lines(asked, tWrong);
  const ch = ids.map((_, i) => changeOf(before.map((v) => v.looks[i]), after.map((v) => v.looks[i])));
  const mine = ch.slice(0, rights.length), theirs = ch.slice(rights.length);
  const most = (k) => Math.max(0, ...theirs.map((x) => x[k] || 0));
  const shown = [];
  if (mine.some((x) => x.hinting || (x.scale > 0.06 && x.scale > most('scale') + 0.03))) shown.push('pulsed');
  if (mine.some((x) => (x.glow > 0.15 && x.glow > most('glow') + 0.1) || (x.colour > 0.15 && x.colour > most('colour') + 0.05) || (x.cls && !theirs.some((y) => y.cls)))) shown.push('glowed');
  if (!bubbleShowsAnswer(kind, rec.bubble, right) && answerNamed(right, said, prompt)) shown.push('named aloud'); // (a name the bubble already shows tells her nothing new)
  const p0 = before[0].probe;
  if (p0 && after.some((v) => v.probe?.some((x, i) => Math.abs(x - p0[i]) > 0.15))) shown.push('revealed');
  const help = Math.max(0, ...after.map((v) => v.help));
  const r2 = (x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v]));
  const out = { tapped: wrong.label, help, shown, closed, said, prompt, change: { right: mine.map(r2), others: theirs.map(r2), samples: after.length } };
  await mark(`WRONG-FIRST ${wrong.label}: help ${help}${shown.length ? `, shown: ${shown.join(', ')}` : ''}${closed ? ', the game moved on' : ''}`);
  return out;
};

await mark('page loaded');
await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1200);
await snap('start-screen');
const pb = await page.locator('.play').boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
await page.waitForTimeout(2500);
if (process.env.FINALE) await st(() => { const s = window.__pup.session(); s.missionsCompleted = s.targetMissions; });
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== kind; i++) { await st((k) => window.__pup.game.startMission(k), kind); await page.waitForTimeout(700); }
const played = await st(() => window.__pup.getStage()?.level);
if (played !== level) { console.error(`${kind}: asked for level ${level} but the game plays level ${played}`); process.exit(2); }
const tStart = await now();
await mark(`mission ${kind} L${level} started, plan ${plan}`);
await page.waitForTimeout(600);
await snap('mission-open');

const rounds = [];
const rand = (a, b) => a + Math.random() * (b - a);
for (let r = 0; r < 24; r++) {
  const s0 = await nextQuestion();
  if (!s0) { await mark('STUCK: no open question and no celebration for 45 s'); await snap(`r${r + 1}-stuck`); rounds.push({ r: r + 1, stuck: true }); break; }
  if (s0.celebrated) break;
  if (plan === 'polite') await waitFor((s) => !s.speaking || s.celebrated, 30000);
  const q = await qState();
  // times are the game's own: when the question opened and when her answer counted (the player's screenshots take no part)
  const rec = { r: r + 1, q: `${q.skill}:${q.item}`, bubble: q.bubble, tOpen: q.opened ?? q.t, tSeen: q.t, spokeWhenOpen: q.speaking, taps: 0, ignored: 0 };
  await mark(`QUESTION ${rec.q} bubble="${q.bubble}" speaking=${q.speaking}`);
  await answerable(q);
  await page.waitForTimeout(350);
  await snap(`r${r + 1}-asked`);
  let opts = await options();
  rec.right = opts.find((o) => o.right)?.label ?? null;
  await mark(`OPTIONS ${opts.map((o) => `${o.label}${o.right ? '*' : ''}@${Math.round(o.x)},${Math.round(o.y)}`).join(' ')}`);
  const multi = (kind === 'counting' && opts.some((o) => o.label === 'bone')) || ((kind === 'moon' || kind === 'blackhole') && q.skill === 'counting') || (kind === 'lighthouse' && ['counting', 'sequence'].includes(q.skill)) || (kind === 'port' && q.item && !/^\d+$/.test(q.item));
  const target = multi ? (kind === 'port' ? await st(() => window.__pup.getStage().target) : Number(q.item)) : null;

  if (plan === 'mash') {
    // ten quick pokes: answers, other things, empty spots, the bubble, two fingers at once
    for (let i = 0; i < 10; i++) {
      const cur = await qState();
      if (cur.celebrated || cur.id !== q.id) break;
      const pool = (await options()).filter((o) => !o.right);
      const roll = Math.random();
      if (roll < 0.6 && pool.length) await tap(pool[Math.floor(Math.random() * pool.length)], 'mash');
      else if (roll < 0.8) await tap({ label: 'empty', x: rand(60, W - 60), y: rand(140, H - 60) }, 'mash', 'empty');
      else if (roll < 0.9) await tap({ label: 'bubble', x: 300, y: 190 }, 'mash', 'bubble');
      else { // two fingers land together
        const a = { x: rand(200, W - 200), y: rand(250, H - 100) }, b = { x: a.x + 90, y: a.y + 40 };
        await aimAt({ label: 'two fingers', aim: 'fingers' });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await mark(`TAP two fingers at ${Math.round(a.x)},${Math.round(a.y)}`);
      }
      await page.waitForTimeout(rand(110, 260));
    }
    await snap(`r${r + 1}-mashed`);
    await page.waitForTimeout(900);
  }

  let picnicFirst = null;
  if (plan === 'wrong-first') {
    if (multi) { // a wrong count: one short (one over when one is asked), then "done"
      const done = await doneOption();
      if (done) {
        const wrongCount = target > 1 ? target - 1 : target + 1;
        await countTo(q, rec, wrongCount, 450);
        if ((await count()) === wrongCount) rec.wrongFirst = await watchWrong(q, rec, (await doneOption()) || done, [], [], String(target));
      }
    } else if (kind === 'picnic') { // which blanket is right stays inside the scene: one of the two, as a guess
      const side = opts.find((o) => o.label === 'left');
      if (side) { picnicFirst = 'left'; rec.wrongFirst = await watchWrong(q, rec, side, [], opts.filter((o) => o.label === 'right'), null); }
    } else {
      const rights = opts.filter((o) => o.right), wrongs = opts.filter((o) => o.right === false && !o.other);
      if (rights.length && wrongs.length) {
        const wrong = wrongs[Math.floor(Math.random() * wrongs.length)];
        rec.wrongFirst = await watchWrong(q, rec, wrong, rights, wrongs.filter((o) => o !== wrong), rec.right);
      }
    }
    if (rec.wrongFirst === null) delete rec.wrongFirst;
    await snap(`r${r + 1}-after-wrong`);
  }

  // answer: keep doing the right thing until the question closes (a quick child taps again when nothing happens)
  const deadline = Date.now() + 60000;
  let last = null;
  while (Date.now() < deadline) {
    const cur = await qState();
    if (cur.celebrated || cur.id !== q.id) { last = cur; break; }
    if (cur.along && plan !== 'polite') { // (a die to roll first)
      const o = await alongThing();
      if (o) { await tap(o, 'first'); rec.taps++; await page.waitForTimeout(ALONG_MS); continue; }
    }
    opts = await options();
    if (kind === 'picnic') {
      const sides = opts.filter((o) => o.label === 'left' || o.label === 'right');
      const [a, b] = picnicFirst ? [sides.find((o) => o.label !== picnicFirst), sides.find((o) => o.label === picnicFirst)] : sides;
      if (!a) { await page.waitForTimeout(300); continue; }
      await tap(a, `picnic ${a.label}`); rec.taps++;
      if (!(await waitFor(solved(q.id), 1500))) { if (b) { await tap(b, `picnic ${b.label}`); rec.taps++; } await waitFor(solved(q.id), 2500); }
    } else if (kind === 'counting' && opts.some((o) => o.label === 'plate')) {
      const p = opts.find((o) => o.label === 'plate' && o.right);
      if (p) { await tap(p, 'hungry plate'); rec.taps++; }
      await page.waitForTimeout(500);
    } else if (multi) {
      if (!(await nextThing())) { await page.waitForTimeout(300); continue; } // (nothing to count with yet: she watches)
      if (plan === 'quick' && !rec.quick) {
        rec.quick = await quickTaps(q, rec, target);
        await mark(`QUICK ${rec.quick.what}: ${rec.quick.counted} of ${rec.quick.made} counted`);
        if (solved(q.id)(await qState())) continue;
      }
      await countTo(q, rec, target, plan === 'polite' ? 1500 : 450);
      await page.waitForTimeout(900);
      if (!(await waitFor(solved(q.id), 600))) {
        const done = await doneOption();
        if (done) { await tap(done, 'done'); rec.taps++; }
        await waitFor(solved(q.id), 4000);
      }
    } else {
      const right = opts.find((o) => o.right);
      if (!right) { await page.waitForTimeout(300); continue; }
      await tap(right, 'right'); rec.taps++;
      if (!rec.tFirstTap) rec.tFirstTap = await now();
      if (!(await waitFor(solved(q.id), 1200))) rec.ignored++;
    }
    if (!rec.tFirstTap) rec.tFirstTap = await now();
  }
  if (!last) { await mark('STUCK: the question did not close in 60 s of right answers'); await snap(`r${r + 1}-stuck`); rec.stuck = true; rounds.push(rec); break; }
  rec.tSolved = (await st(([skill, item, from]) => {
    const e = window.__pup.learning.recent(8).filter((x) => x.correct && x.skill === skill && x.item === item && x.at - window.__epoch0 >= from).at(-1);
    return e ? Math.round(e.at - window.__epoch0) : null;
  }, [q.skill, String(q.item), rec.tOpen])) ?? last.t;
  rec.tSolvedSeen = last.t;
  if (plan !== 'polite') { const o = await alongThing(); if (o) await tap(o, 'tap along'); } // (at once: a feast can be short)
  await page.waitForTimeout(500);
  await snap(`r${r + 1}-answered`);
  rounds.push(rec);
}
const done = await waitFor((s) => s.celebrated, 60000);
await page.waitForTimeout(2500);
await snap('end');
filming = false;
const tEnd = await now();
const timeline = await st(() => window.__timeline);
const events = await st(() => window.__pup.learning.recent(80));
const fps = await st(() => window.__fps);
const tier = await st(() => localStorage.getItem('pup-patrol-quality-v2'));
const celebratedAt = await st(() => window.__celebrated || null);
const savedLevel = await st((k) => JSON.parse(localStorage.getItem('pup-patrol-progress') || 'null')?.missions?.[k]?.level ?? null, kind);
// each round: when she could first answer, how long the game then took to ask the next thing
// (waitSeenMs: the same wait as the player saw it, after its own pauses and screenshots: how the November review measured it)
// alongMs: the part of that wait spent on a ride or a feast she tapped along with (a tap there that got a sound)
const allTaps = await st(() => window.__taps), allSounds = await st(() => window.__sounds);
const alongSpans = timeline.filter((e) => e.type === 'along').reduce((spans, e) => (e.on ? [...spans, { from: e.t, to: Infinity }] : (spans.length && (spans.at(-1).to = e.t), spans)), []);
const tappedAlong = (span) => allTaps.some((t) => t.label === 'along' && t.t >= span.from && t.t < span.to && allSounds.some((x) => x.t >= t.t && x.at - t.t <= 1000));
for (let i = 0; i < rounds.length; i++) {
  const a = rounds[i], b = rounds[i + 1];
  a.answerMs = a.tSolved != null ? a.tSolved - a.tOpen : null;
  a.waitNextMs = a.tSolved != null ? ((b?.tOpen ?? celebratedAt ?? tEnd) - a.tSolved) : null;
  a.waitSeenMs = a.tSolvedSeen != null ? ((b?.tSeen ?? celebratedAt ?? tEnd) - a.tSolvedSeen) : null;
  if (a.waitNextMs != null) {
    const from = a.tSolved, to = a.tSolved + a.waitNextMs;
    a.alongMs = alongSpans.filter(tappedAlong).reduce((ms, sp) => ms + Math.max(0, Math.min(to, sp.to) - Math.max(from, sp.from)), 0);
  }
}
// each tap: the first sound heard after it. A voice clip answers it only when its line was asked for after the tap
// (a line already being spoken just goes on).
const sounds = await st(() => window.__sounds);
const says = timeline.filter((e) => e.type === 'say');
const taps = (await st(() => window.__taps)).map((t) => {
  const first = sounds.filter((x) => x.t >= t.t && (x.kind !== 'clip' || says.some((y) => y.t >= t.t && y.t <= x.t))).reduce((m, x) => Math.min(m, x.at - t.t), Infinity);
  return { t: t.t, label: t.label ?? null, aim: t.aim ?? 'none', hit: t.canvas ? !t.miss : t.aim !== undefined, soundMs: first <= 1000 ? first : null };
});
const sorted = [...fps].sort((x, y) => x - y);
const summary = {
  kind, level, savedLevel, plan, viewport: `${W}x${H}`, celebrated: Boolean(done), missionSeconds: celebratedAt ? Math.round((celebratedAt - tStart) / 100) / 10 : null,
  rounds, taps, errors, consoleErrors: consoleErrors.slice(0, 10), fps: { min: sorted[0], median: sorted[sorted.length >> 1], n: fps.length }, tier,
  cutClips: timeline.filter((e) => e.type === 'clip' && e.cut).length, clips: timeline.filter((e) => e.type === 'clip').length,
  wrongEvents: events.filter((e) => !e.correct).map((e) => e.errorType).reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {}),
};
writeFileSync(`${OUT}summary.json`, JSON.stringify(summary, null, 1));
const silent = taps.filter((t) => t.aim === 'thing' && t.hit && (t.soundMs == null || t.soundMs > 200));
const lines = timeline.map((e) => {
  const t = (e.t / 1000).toFixed(1).padStart(6);
  if (e.type === 'say') return `${t}  SAY   ${e.text}`;
  if (e.type === 'me') return `${t}  ----  ${e.text}${/^TAP /.test(e.text) && silent.some((x) => x.t >= e.t && x.t - e.t < 300) ? '  (no sound)' : ''}`;
  if (e.type === 'clip') return `${t}  clip  ${e.ms} ms${e.cut ? `  CUT OFF after ${e.stoppedAt - e.t} ms` : ''}`;
  if (e.type === 'along') return `${t}  ----  (${e.on ? 'a ride or a feast to tap along with starts' : 'it ends'})`;
  return `${t}  ${e.type}`;
});
writeFileSync(`${OUT}transcript.txt`, lines.join('\n') + `\n\nerrors: ${JSON.stringify(errors)}\nconsole: ${JSON.stringify(consoleErrors.slice(0, 10))}\n`);
const quick = rounds.filter((x) => x.quick), wrongs = rounds.filter((x) => x.wrongFirst);
console.log(`${kind} L${level} ${plan}: ${done ? 'celebrated' : 'NO CELEBRATION'} in ${summary.missionSeconds}s, saved level ${savedLevel}, ${rounds.length} rounds, ignored taps ${rounds.reduce((n, x) => n + (x.ignored || 0), 0)}, silent taps ${silent.length}/${taps.filter((t) => t.aim === 'thing' && t.hit).length}${quick.length ? `, quick counted ${quick.map((x) => `${x.quick.counted}/${x.quick.made}`).join(' ')}` : ''}${wrongs.length ? `, after one wrong: ${wrongs.map((x) => `help ${x.wrongFirst.help}${x.wrongFirst.shown.length ? ` ${x.wrongFirst.shown.join('+')}` : ''}${x.wrongFirst.closed ? ' moved on' : ''}`).join('; ')}` : ''}, stuck ${rounds.some((x) => x.stuck)}, errors ${errors.length}, fps median ${summary.fps.median}`);
await browser.close();
