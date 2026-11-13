// saturn-drop.mjs [level] [landscape|portrait|both] : where does a dragged piece land on Saturn's rings? (verification tooling)
// Real GPU, ?q=high, a finger on touch input (CDP touch events). For each slot (ring, or half ring) the piece is dragged to
// points on a line across the ring's band at the slot's own angle (the front), from the planet down past the rock ring, and let
// go. The game says whether the drop was taken (a hit on some ring, right or wrong) or floated back (a miss). The log has the band
// (ice, rock, gap, planet, below) the piece's centre was over, so a hit on the wrong band, a miss on a band, and a hit between
// bands are all in it. Points are the band's centre and edges (1.5 px inside), and then every STEP px.
//   aim piece   the finger is steered until the piece's drawn centre is on the point (what she sees; the drop judges this)
//   aim finger  the finger goes to the point and the piece sits where the lift puts it (a finger on the band)
// env: BASE (default http://localhost:4257), Q (graphics tier, default high), STEP (px between sweep points, default 12; the side columns use twice that), AIM (piece, finger, both;
//   default piece), OUTDIR (default tools/playtest/playcheck-out/saturn-drop), SKY=0 (omit the overlay screenshot),
//   ONLY=<regex> (only the points whose name matches, e.g. 'centre$'), SKIP_TAPS=1 (no tap trials),
//   SHOTS=1 (a screenshot just before and after the drop at each band centre, the planet, the gap and the empty sky)
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const level = Number(process.argv[2] || 1);
const which = process.argv[3] || 'both';
const BASE = process.env.BASE || 'http://localhost:4257';
const STEP = Number(process.env.STEP || 12);
const AIMS = process.env.AIM === 'both' ? ['piece', 'finger'] : [process.env.AIM || 'piece'];
const OUT = process.env.OUTDIR || 'tools/playtest/playcheck-out/saturn-drop';
const SHOTS = process.env.SHOTS === '1', SHOTS_DIR = `${OUT}/shots`;
mkdirSync(OUT, { recursive: true });
if (SHOTS) mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const results = [];

for (const orientation of which === 'both' ? ['landscape', 'portrait'] : [which]) {
  const W = orientation === 'portrait' ? 820 : 1180, H = orientation === 'portrait' ? 1180 : 820;
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([level, v]) => {
    localStorage.setItem('pup-patrol-progress', JSON.stringify({ v, missions: { saturn: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  }, [level, VERSION]);
  await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
  await page.waitForSelector('.play', { timeout: 60000 });
  await page.waitForTimeout(1200);
  const pb = await page.locator('.play').boundingBox();
  await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const cdp = await context.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 1 })) });

  // what the page knows: the scene, the piece's drawn centre, each slot's line across its band
  const read = () => page.evaluate(() => {
    const s = window.__pup.getStage();
    if (s?.kind !== 'saturn') return { kind: s?.kind };
    const cam = window.__pup.camera, V = s.saturn.position.constructor;
    const proj = (w) => { const p = w.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
    const piece = s.pieceObj;
    const home = piece?.userData.home;
    const out = { kind: 'saturn', phase: s.phase, target: s.last, rounds: s.rounds, level: s.L.level ?? null, events: window.__pup.learning.recent(200).length };
    if (piece && home) {
      out.piece = proj(piece.getWorldPosition(new V()));
      out.atHome = Math.abs(piece.position.x - home.x) < 0.25 && Math.abs(piece.position.z - home.z) < 0.25;
      out.home = proj(home);
    }
    out.lit = s.lit ?? null;
    out.glowing = s.slots.filter((x) => x.tap?.material?.opacity > 0.2).map((x) => x.key).join('+');
    out.planet = proj(s.saturn.position);
    out.planetUp = proj(s.saturn.position.clone().setY(s.saturn.position.y + 1.6));
    out.slots = s.slots.map((slot) => ({ key: slot.key, kind: slot.kind, size: slot.size, angle: slot.angle, radii: slot.radii }));
    out.rings = { ice: [2.9, 4.05], rock: [4.2, 5.65] };
    return out;
  });
  const lineAt = (angle) => page.evaluate((angle) => {
    const s = window.__pup.getStage(), cam = window.__pup.camera, V = s.saturn.position.constructor, line = [];
    for (let r = 2.0; r <= 6.9; r += 0.02) {
      const p = s.saturn.localToWorld(new V(Math.cos(angle) * r, 0, -Math.sin(angle) * r)).project(cam);
      line.push({ r: Math.round(r * 1000) / 1000, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight });
    }
    return line;
  }, angle);
  const events = () => page.evaluate(() => window.__pup.learning.recent(200).length);
  const startRun = async () => {
    await page.evaluate(() => window.__pup.game.startMission('saturn'));
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(250); const r = await read(); if (r.kind === 'saturn' && r.phase === 'asking' && r.atHome) { await page.waitForTimeout(600); return read(); } }
    throw new Error('the mission never asked');
  };
  const ready = async () => {
    for (let i = 0; i < 48; i++) {
      const r = await read();
      if (r.kind === 'saturn' && r.phase === 'asking' && r.atHome) { await page.waitForTimeout(250); return read(); }
      await page.waitForTimeout(250);
    }
    return startRun();
  };

  const first = await startRun();
  // sample points: the named ones (band centre, 1.5 px inside each edge, 4 and 12 px outside) and every STEP px
  const bandOf = (r, rings) => (r >= rings.ice[0] && r <= rings.ice[1] ? 'ice' : r >= rings.rock[0] && r <= rings.rock[1] ? 'rock' : r < rings.ice[0] ? (r < 2.35 ? 'planet' : 'gap-planet') : r > rings.rock[1] ? 'below' : 'gap');
  // columns: a line across the rings at each slot's angle (the front), and for a ring sorted by kind two more to its sides
  const FRONT_SIDE = 0.6;
  const columns = [];
  for (const slot of first.slots) {
    if (!columns.some((c) => c.angle === slot.angle)) columns.push({ angle: slot.angle, label: slot.size ?? 'front', slots: first.slots.filter((x) => x.angle === slot.angle) });
  }
  if (!first.slots.some((x) => x.key.includes(':'))) for (const [label, d] of [['left', -FRONT_SIDE], ['right', FRONT_SIDE]]) columns.push({ angle: first.slots[0].angle + d, label, slots: [], side: true });
  const plan = [];
  for (const col of columns) {
    const pts = await lineAt(col.angle);
    const named = [];
    for (const slot of col.slots) {
      const [a, b] = first.rings[slot.kind];
      const at = (r) => pts.reduce((best, p) => (Math.abs(p.r - r) < Math.abs(best.r - r) ? p : best));
      const pa = at(a), pb = at(b), pm = at((a + b) / 2);
      const dir = Math.sign(pb.y - pa.y) || 1; // down the screen from the inner edge to the outer one
      named.push({ ...pm, name: `${slot.key} centre`, band: slot.kind });
      for (const [p, label, sign] of [[pa, 'inner edge', 1], [pb, 'outer edge', -1]]) {
        named.push({ ...p, y: p.y + sign * dir * 1.5, name: `${slot.key} ${label} in 1.5`, band: slot.kind });
        named.push({ ...p, y: p.y - sign * dir * 4, name: `${slot.key} ${label} out 4`, band: `out-${slot.kind}` });
        named.push({ ...p, y: p.y - sign * dir * 12, name: `${slot.key} ${label} out 12`, band: `out-${slot.kind}` });
      }
    }
    let lastY = -1e9;
    const swept = [];
    for (const p of pts) if (Math.abs(p.y - lastY) >= (col.side ? STEP * 2 : STEP)) { swept.push({ ...p, name: 'sweep' }); lastY = p.y; }
    for (const p of [...named, ...swept]) plan.push({ column: col.label, x: p.x, y: p.y, r: p.r, name: p.name, band: p.band ?? bandOf(p.r, first.rings) });
  }
  const frontLine = await lineAt(first.slots[0].angle);
  const gapMid = frontLine.reduce((best, p) => (Math.abs(p.r - 4.125) < Math.abs(best.r - 4.125) ? p : best));
  plan.push(
    { column: 'extra', x: first.planet.x, y: first.planet.y, r: 0, name: 'planet middle', band: 'planet' },
    { column: 'extra', x: first.planetUp.x, y: first.planetUp.y, r: 0, name: 'planet upper', band: 'planet' },
    ...(first.slots.some((x) => x.size) ? [] : [{ column: 'extra', x: gapMid.x, y: gapMid.y, r: gapMid.r, name: 'gap middle', band: 'gap' }]),
    { column: 'extra', x: W * 0.1, y: H * 0.9, r: 0, name: 'sky bottom left', band: 'sky' },
    { column: 'extra', x: W * 0.5, y: H - 40, r: 0, name: 'sky bottom middle', band: 'sky' },
    { column: 'extra', x: W * 0.9, y: H * 0.2, r: 0, name: 'sky top right', band: 'sky' },
  );
  plan.sort((a, b) => a.column.localeCompare(b.column) || a.y - b.y);
  if (process.env.ONLY) plan.splice(0, plan.length, ...plan.filter((p) => new RegExp(process.env.ONLY).test(p.name)));

  const log = [];
  for (const aim of AIMS) {
    for (const [i, pt] of plan.entries()) {
      const r0 = await ready();
      if (r0.target === undefined) continue;
      await page.evaluate(() => {
        const s = window.__pup.getStage(), d = s.pieceObj.userData.drag;
        if (!d.__probe) { const orig = d.onDrop; d.onDrop = (o, p) => { const ok = orig(o, p); window.__drop = { ok, at: performance.now() }; return ok; }; d.__probe = true; }
        window.__drop = null;
      });
      const before = await events();
      const F0 = { ...r0.piece };
      await touch('touchStart', [F0]);
      let F = { ...F0 };
      const target = { x: pt.x, y: pt.y };
      const steps = 10;
      for (let k = 1; k <= steps; k++) { await touch('touchMove', [{ x: F0.x + (target.x - F0.x) * k / steps, y: F0.y + (target.y - F0.y) * k / steps }]); await page.waitForTimeout(16); }
      F = { ...target };
      let piece = (await read()).piece;
      if (aim === 'piece') {
        for (let k = 0; k < 10; k++) {
          const err = { x: target.x - piece.x, y: target.y - piece.y };
          if (Math.hypot(err.x, err.y) < 1) break;
          F = { x: F.x + err.x, y: F.y + err.y };
          await touch('touchMove', [F]);
          await page.waitForTimeout(24);
          piece = (await read()).piece;
        }
      }
      await page.waitForTimeout(120); // (the light eases in over about 0.2 s)
      const seen = await read();
      const shotName = `${orientation}-${aim}-${pt.name.replace(/\W+/g, '-')}`;
      const looked = SHOTS && aim === AIMS[0] && /centre$|planet middle|sky bottom middle|gap middle/.test(pt.name);
      if (looked) await page.screenshot({ path: `${SHOTS_DIR}/${shotName}-held.png`, scale: 'css' });
      await touch('touchEnd', []);
      let drop = null;
      for (let k = 0; k < 20 && !drop; k++) { await page.waitForTimeout(50); drop = await page.evaluate(() => window.__drop); }
      if (looked) { await page.waitForTimeout(150); await page.screenshot({ path: `${SHOTS_DIR}/${shotName}-after.png`, scale: 'css' }); }
      await page.waitForTimeout(500);
      const accepted = Boolean(drop?.ok);
      let ring = null;
      if (accepted) {
        const ev = await page.evaluate((n) => window.__pup.learning.recent(200).slice(n).at(-1) ?? null, before);
        ring = ev ? (ev.correct ? r0.target : ev.chosen ?? '?') : '?';
      }
      const row = { orientation, aim, column: pt.column, name: pt.name, band: pt.band, r: pt.r, targetX: Math.round(pt.x), targetY: Math.round(pt.y * 10) / 10, fingerX: Math.round(F.x), fingerY: Math.round(F.y * 10) / 10, pieceX: Math.round(piece.x), pieceY: Math.round(piece.y * 10) / 10, lit: seen.lit, glowing: seen.glowing, result: accepted ? 'hit' : 'miss', ring };
      log.push(row);
      process.stdout.write(`${orientation} ${aim} ${i + 1}/${plan.length}\r`);
    }
  }
  // a tap on each ring (no drag) must still answer
  for (const slot of process.env.SKIP_TAPS ? [] : first.slots) {
    const r0 = await ready();
    const [a, b] = first.rings[slot.kind];
    const line = await lineAt(slot.angle);
    const p = line.reduce((best, q) => (Math.abs(q.r - (a + b) / 2) < Math.abs(best.r - (a + b) / 2) ? q : best));
    const before = await events();
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(700);
    const ev = await page.evaluate((n) => window.__pup.learning.recent(200).slice(n).at(-1) ?? null, before);
    log.push({ orientation, aim: 'tap', column: 'tap', name: `tap ${slot.key}`, band: slot.kind, targetX: Math.round(p.x), targetY: Math.round(p.y * 10) / 10, pieceX: Math.round(p.x), pieceY: Math.round(p.y * 10) / 10, result: ev ? 'hit' : 'miss', ring: ev ? (ev.correct ? r0.target : ev.chosen ?? '?') : null });
  }
  results.push(...log);

  if (process.env.SKY !== '0') {
    const shown = await ready();
    await page.evaluate((rows) => {
      const c = document.createElement('canvas');
      c.width = innerWidth; c.height = innerHeight;
      c.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:99';
      document.body.appendChild(c);
      const g = c.getContext('2d');
      g.font = '11px monospace';
      for (const r of rows) {
        g.fillStyle = r.result === 'hit' ? '#10c040' : '#e02020';
        g.beginPath(); g.arc(r.pieceX, r.pieceY, 3, 0, 7); g.fill();
      }
    }, log.filter((r) => r.aim === AIMS[0]));
    await page.screenshot({ path: `${OUT}/drops-${orientation}.png`, scale: 'css' });
    void shown;
  }
  if (errors.length) console.error(`page errors: ${errors.slice(0, 3).join(' | ')}`);
  await context.close();
}
await browser.close();

const header = ['orientation', 'aim', 'column', 'name', 'band', 'r', 'targetX', 'targetY', 'fingerX', 'fingerY', 'pieceX', 'pieceY', 'lit', 'glowing', 'result', 'ring'];
writeFileSync(`${OUT}/drops-L${level}.tsv`, [header.join('\t'), ...results.map((r) => header.map((k) => r[k] ?? '').join('\t'))].join('\n') + '\n');
writeFileSync(`${OUT}/drops-L${level}.json`, JSON.stringify(results, null, 1));

// the summary: per orientation, aim and column, the bands in order down the screen with their hits and misses
const lines = [];
const bands = ['planet', 'gap-planet', 'ice', 'gap', 'rock', 'below'];
for (const orientation of new Set(results.map((r) => r.orientation))) for (const aim of [...AIMS, 'tap']) {
  const mine = results.filter((r) => r.orientation === orientation && r.aim === aim);
  for (const column of new Set(mine.map((r) => r.column))) {
    const rows = mine.filter((r) => r.column === column && r.name === 'sweep');
    const cells = bands.map((b) => { const x = rows.filter((r) => r.band === b); return x.length ? `${b} ${x.filter((r) => r.result === 'hit').length}/${x.length}` : null; }).filter(Boolean);
    lines.push(`${orientation} ${aim} ${column}: ${cells.join(', ')}`);
    for (const r of mine.filter((r) => r.column === column && r.name !== 'sweep')) lines.push(`    ${r.name.padEnd(26)} piece ${String(r.pieceX).padStart(4)},${String(Math.round(r.pieceY)).padStart(4)}  ${r.result}${r.ring ? ` on ${r.ring}` : ''}`);
  }
}
console.log(lines.join('\n'));
