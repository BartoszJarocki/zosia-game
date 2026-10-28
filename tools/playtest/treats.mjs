// Treat House probes: force a kind of round and a number, then check what she sees and what happens when she taps.
// usage: node treats.mjs <check> [level]     (BASE and OUTDIR as for walk.mjs)
//   layout    how-many bones (6 and 7) in landscape and portrait: screenshots, and every bone centre must be in
//             plain sight (the first thing a ray from the camera hits is the bone; not under the bubble or HUD)
//   overfeed  give two too many, tap Chase: what is said, what hops back, and that her own last tap finishes it
//   taps      Chase tapped with none, with too few, while a treat is still flying, and twice quickly
//   drag      a treat dragged onto the tray, one dragged nowhere (it floats back)
//   kinds     one round of each kind (give, howMany, share, flash, hidden), screenshots mid-question, then solved
// The ray check needs three.js from the dev server (npx vite), so run "layout" against it.
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [check, levelArg = '4'] = process.argv.slice(2);
const level = Number(levelArg);
const BASE = process.env.BASE || 'http://127.0.0.1:4194';
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/treats-${check}/`, import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const report = [];
const log = (s) => { report.push(s); console.log(s); };
let failed = 0;
const expect = (ok, what) => { log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page, shot = 0;

async function open(w = 1180, h = 820) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => log(`PAGE ERROR ${e.message}`));
  await page.addInitScript((level) => {
    window.__sayLog = [];
    localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { counting: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  }, level);
  await page.goto(`${BASE}/?q=low`);
  await page.waitForSelector('.play', { timeout: 30000 });
  await page.waitForTimeout(1200);
  const pb = await page.locator('.play').boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
}
const st = (fn, a) => page.evaluate(fn, a);
const snap = async (name) => { const p = `${OUT}${String(++shot).padStart(2, '0')}-${name}.png`; try { await page.screenshot({ path: p, timeout: 10000 }); } catch {} return p; };
const said = () => st(() => window.__sayLog.slice());
const saidSince = async (k) => (await said()).slice(k);
const events = () => st(() => window.__pup.learning.recent(50).map((e) => `${e.skill}:${e.item} ${e.correct ? 'OK' : e.errorType}${e.chosen !== undefined ? `(${e.chosen})` : ''}`));

/** Start the mission with these settings and round kinds (set before the first round begins). */
async function start(L, plan) {
  const ok = await st(({ L, plan }) => new Promise((done) => {
    const old = window.__pup.getStage();
    const t0 = performance.now();
    let tried = 0;
    const poll = () => {
      const s = window.__pup.getStage();
      if (s !== old && s?.kind === 'counting') { s.L = { ...s.L, ...L }; s.plan = plan; s.rounds = plan.length; return done(true); }
      if (performance.now() - t0 > 20000) return done(false);
      if (performance.now() - t0 > tried * 2000) { tried++; window.__pup.game.startMission('counting'); } // (ignored while a wipe runs)
      setTimeout(poll, 5);
    };
    poll();
  }), { L, plan });
  if (!ok) log('FAIL the mission did not start');
}
const asked = (ms = 40000) => page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.learn?.isOpen && !s.speaking && s.learn.current.promptEndAt !== null; }, null, { timeout: ms }).then(() => true, () => false);
const question = () => st(() => { const s = window.__pup.getStage(); const q = s.learn.current; return q && { skill: q.skill, item: Number(q.item), round: s.roundIndex }; });
const proj = (sel) => st((sel) => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const at = (o, lift = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += lift; p.project(cam); return { x: Math.round((p.x + 1) / 2 * innerWidth), y: Math.round((1 - p.y) / 2 * innerHeight) }; };
  const pick = { pile: (o) => o.userData.drag, block: (o) => o.userData.num !== undefined, plate: (o) => o.userData.hungry };
  if (sel === 'chase') return [at(s.pup, 0.8)];
  return s.tappables.filter(pick[sel]).map((o) => ({ ...at(o, 0.15), num: o.userData.num }));
}, sel);
const click = async (p) => page.mouse.click(p.x, p.y);

if (check === 'layout') {
  for (const [w, h, name] of [[1180, 820, 'landscape'], [820, 1180, 'portrait']]) {
    await open(w, h);
    for (const n of [6, 7]) {
      await start({ types: ['howMany'], howMany: [n, n] }, ['howMany']);
      await asked();
      await page.waitForTimeout(1500); // bones landed, blocks dropped
      await snap(`${name}-n${n}`);
      const r = await st(async () => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const s = window.__pup.getStage(), cam = window.__pup.camera;
        const others = new Set([s.pup, s.girl, s.box]);
        const bones = s.tappables.filter((o) => !others.has(o) && o.userData.num === undefined && !o.userData.drag && o.userData.hungry === undefined);
        const blocks = s.tappables.filter((o) => o.userData.num !== undefined);
        const covers = [...document.querySelectorAll('.bubble:not(.hidden), .topbar .home, .topbar .paws, .topbar .spacer')].map((e) => e.getBoundingClientRect());
        const ray = new THREE.Raycaster();
        ray.camera = cam; // (sprites need it)
        const camPos = cam.getWorldPosition(new THREE.Vector3());
        const inside = (o, root) => { for (let x = o; x; x = x.parent) if (x === root) return true; return false; };
        const out = bones.map((b) => {
          const c = new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3());
          ray.set(camPos, c.clone().sub(camPos).normalize());
          const first = ray.intersectObject(s.scene, true).find((h) => h.object.visible && h.object.material?.depthWrite !== false && h.object.material?.opacity !== 0);
          const p = c.clone().project(cam);
          const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
          const under = covers.some((r) => sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom);
          const hidBy = first && !inside(first.object, b) ? (blocks.find((k) => inside(first.object, k)) ? 'a numeral block' : first.object.name || first.object.type) : null;
          return { x: Math.round(sx), y: Math.round(sy), seen: !hidBy && !under, hidBy, under };
        });
        const sizes = blocks.map((k) => { const bb = new THREE.Box3().setFromObject(k); const a = bb.min.clone().project(cam), z = bb.max.clone().project(cam); return Math.round(Math.abs(z.x - a.x) / 2 * innerWidth); });
        return { out, sizes };
      });
      expect(r.out.length === n, `${name} n=${n}: ${r.out.length} bones on the tray`);
      expect(r.out.every((b) => b.seen), `${name} n=${n}: every bone centre in plain sight ${JSON.stringify(r.out.map((b) => (b.seen ? [b.x, b.y] : b)))}`);
      expect(r.sizes.every((px) => px >= 70), `${name} n=${n}: numeral blocks ${r.sizes.join(', ')} px wide (at least 70)`);
      // answer, so the next start is clean
      const right = (await proj('block')).find((b) => b.num === n);
      if (right) await click(right);
      await page.waitForTimeout(500);
    }
  }
}

if (check === 'overfeed' || check === 'taps') {
  await open();
  const n = 3;
  await start({ types: ['give'], give: [n, n], auto: false, slots: false }, ['give', 'give']);
  await asked();
  await snap('asked');
  if (check === 'taps') {
    let k = (await said()).length;
    await click((await proj('chase'))[0]);
    await page.waitForTimeout(1500);
    const none = await saidSince(k);
    expect(!none.some((l) => /Za mało|za dużo/.test(l)) && !(await events()).some((e) => e.includes('wrongChoice')), `Chase with no treats: just a bark, no wrong answer (${JSON.stringify(none)})`);
    await click((await proj('pile'))[0]);
    await page.waitForTimeout(900);
    k = (await said()).length;
    await click((await proj('chase'))[0]);
    await page.waitForTimeout(2200);
    expect(JSON.stringify(await saidSince(k)) === JSON.stringify(['Za mało! Jeszcze!']), `1 of ${n}, tap Chase: ${JSON.stringify(await saidSince(k))}`);
    await click((await proj('pile'))[0]);
    await page.waitForTimeout(700);
    // the last one: tap Chase while it is still in the air, then again at once
    k = (await said()).length;
    await click((await proj('pile'))[0]);
    await page.waitForTimeout(60);
    await click((await proj('chase'))[0]);
    await page.waitForTimeout(80);
    await click((await proj('chase'))[0]);
    await page.waitForTimeout(3500);
    const ev = await events();
    expect(ev.filter((e) => e.startsWith(`counting:${n} OK`)).length === 1, `late tap while the treat flies, twice: solved once (${ev.join(' | ')})`);
    log(`said: ${JSON.stringify(await saidSince(k))}`);
    await snap('solved');
  } else {
    for (let i = 0; i < n + 2; i++) { await click((await proj('pile'))[0]); await page.waitForTimeout(650); }
    await page.waitForTimeout(500);
    await snap('too-many-given');
    let k = (await said()).length;
    await click((await proj('chase'))[0]);
    await page.waitForTimeout(250);
    await click((await proj('chase'))[0]); // again while he's giving back: ignored
    await page.waitForFunction(() => window.__sayLog.at(-1)?.startsWith('Teraz dobrze'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const back = await saidSince(k);
    expect(JSON.stringify(back) === JSON.stringify(['Oj, za dużo! Oddaję dwa smakołyki.', 'Teraz dobrze? Dotknij Czejsa!']), `5 of 3, tap Chase: ${JSON.stringify(back)}`);
    const pileNow = (await proj('pile')).length;
    expect(pileNow === n + 3 - n, `two hopped back to the pile: ${pileNow} treats on the pile (pile was ${n + 3})`);
    await snap('gave-back');
    await page.waitForTimeout(4000);
    expect(!(await events()).some((e) => e.includes(' OK')), 'not finished for her: no right answer until she taps Chase');
    k = (await said()).length;
    await click((await proj('chase'))[0]);
    await page.waitForTimeout(2500);
    const ev = await events();
    expect(ev.some((e) => e.startsWith(`counting:${n} OK`)), `her own tap finishes it: ${JSON.stringify(await saidSince(k))} ${ev.join(' | ')}`);
    await snap('her-tap');
  }
}

if (check === 'drag') {
  await open();
  await start({ types: ['give'], give: [2, 2], auto: true, slots: true }, ['give']);
  await asked();
  // a real drag: down, a dozen moves, up; reports how far the lifted treat had travelled before letting go
  const lifted = () => st(() => Math.max(0, ...window.__pup.getStage().tappables.filter((o) => o.userData.drag).map((o) => o.position.distanceTo(o.userData.home))));
  const drag = async (from, to, steps = 12) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await page.waitForTimeout(30); } const far = await lifted(); await page.mouse.up(); return far; };
  const said1 = (text) => page.waitForFunction((t) => window.__sayLog.includes(t), text, { timeout: 8000 }).then(() => true, () => false);
  const tray = await st(() => { const s = window.__pup.getStage(), cam = window.__pup.camera; const p = s.tray.getWorldPosition(s.tray.position.clone()); p.project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; });
  const pile0 = (await proj('pile')).length;
  const settled = () => page.waitForFunction(() => window.__pup.getStage().tappables.filter((o) => o.userData.drag).every((o) => o.position.distanceTo(o.userData.home) < 0.05), null, { timeout: 8000 }).then(() => true, () => false);
  const far = await drag((await proj('pile'))[0], { x: 60, y: 760 }); // dropped nowhere near Chase
  expect(far > 1 && (await settled()) && (await proj('pile')).length === pile0, `a treat dragged ${far.toFixed(1)} away and dropped far from Chase floats back to the pile`);
  const far2 = await drag((await proj('pile'))[0], tray);
  expect(far2 > 1 && (await said1('Jeden!')), `dragged ${far2.toFixed(1)} onto the tray: "Jeden!"`);
  await snap('dragged-one');
  await drag((await proj('pile'))[0], tray);
  await page.waitForFunction(() => window.__pup.learning.recent(5).some((e) => e.correct), null, { timeout: 8000 }).catch(() => {});
  expect((await events()).some((e) => e.startsWith('counting:2 OK')), 'two dragged: done');
}

if (check === 'kinds') {
  await open(...(process.env.PORTRAIT ? [820, 1180] : [1180, 820]));
  const kinds = (process.env.KINDS || 'give,howMany,share,flash,hidden').split(',');
  await start({ auto: false, slots: false, give: [4, 4], howMany: [5, 5], share: [3, 3], flash: [3, 3], hidden: [3, 3] }, kinds);
  const bowlAt = (x) => page.waitForFunction((x) => { let bowl; window.__pup.getStage().scene.traverse((o) => { if (o.userData.to) bowl = o; }); return bowl && Math.abs(bowl.position.x - x) < 0.05; }, x, { timeout: 30000 }).catch(() => {});
  for (const kind of kinds) {
    // the moment that makes these rounds: the treats on show (flash), one more slipping under the bowl (hidden)
    if (kind === 'flash') { await page.waitForFunction(() => window.__sayLog.includes('Szybkie oko! Patrz!'), null, { timeout: 30000 }).catch(() => {}); await bowlAt(-1.75); await snap('flash-shown'); }
    if (kind === 'hidden') { await page.waitForFunction(() => window.__sayLog.at(-1) === 'I jeszcze jeden!', null, { timeout: 40000 }).catch(() => {}); await page.waitForTimeout(250); await snap('hidden-one-more'); }
    if (!(await asked())) { log(`${kind}: no question`); break; }
    const q = await question();
    await snap(`${kind}-asked`);
    log(`${kind}: ${q.skill}:${q.item} round ${q.round + 1}; said so far ${JSON.stringify((await said()).slice(-3))}`);
    if (kind === 'howMany') { await click((await proj('block')).find((b) => b.num === q.item)); }
    else if (kind === 'share') { for (let i = 0; i < 4; i++) { const p = (await proj('plate'))[0]; if (!p) break; await click(p); await page.waitForTimeout(700); } }
    else {
      for (let i = 0; i < q.item; i++) { await click((await proj('pile'))[0]); await page.waitForTimeout(650); }
      await page.waitForTimeout(500);
      await snap(`${kind}-given`);
      await click((await proj('chase'))[0]);
      await page.waitForTimeout(kind === 'give' ? 300 : 2600);
      await snap(`${kind}-checked`);
    }
    await page.waitForFunction(() => !window.__pup.getStage().learn.isOpen, null, { timeout: 20000 }).catch(() => {});
    log(`${kind}: ${(await events()).slice(-1)[0]}`);
  }
  await page.waitForSelector('.celebrate', { timeout: 60000 }).then(() => log('celebration'), () => log('no celebration'));
  log(`said: ${JSON.stringify(await said())}`);
}

writeFileSync(`${OUT}report.txt`, report.join('\n') + '\n');
await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'all checks passed', '→', OUT);
process.exit(failed ? 1 : 0);
