// syllable-steps.mjs [tap|example|replay|all] : the Name Train's syllable train, played the way she would meet it, on the
// real GPU with touch input (verification tooling for docs/FIX-PLAN-2026-11-13.md unit FX7, lanes 4, 7 and 8).
//   tap      level 10: a wrong block first, then each right one. Each tap says its whole syllable, never letter names;
//            the wrong one swaps out and the right one stays; the joined word is said.
//   example  level 12: one block on, then the word card mid-question. The example shows (the bubble, the empty wagon, the
//            card) with the block still on the train and the same question open, and the round goes on to the next word.
//   replay   level 12: one block on, then a tap on the bubble. The question is said again and no block moves.
// env: BASE, OUTDIR (default syllable-steps), Q, W, H. Writes syll-<step>.png, steps.txt, prints PASS or FAIL; exits 1 on a FAIL.
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;

const OUT = `${process.env.OUTDIR || 'syllable-steps'}/`;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4190';
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const which = process.argv[2] || 'all';
const LETTER_NAMES = ['Em!', 'A!', 'Te!', 'El!'];
/** The voice log holds one entry per utterance: its segments, joined. These are its words, as said. */
const words = (lines) => lines.join(' ').split(/\s+/).filter(Boolean);

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const results = [], log = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`; log.push(line); console.log(line); };

async function play(level, steps) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([level, v]) => {
    const t0 = performance.now();
    window.__sayLog = [];
    window.__said = [];
    window.__sayLog.push = (text) => { window.__said.push({ t: Math.round(performance.now() - t0), text }); return Array.prototype.push.call(window.__sayLog, text); };
    localStorage.setItem('pup-patrol-progress', JSON.stringify({ v, missions: { name: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  }, [level, VERSION]);
  const st = (fn, a) => page.evaluate(fn, a);
  const sleep = (ms) => page.waitForTimeout(ms);
  await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
  await page.waitForSelector('.play', { timeout: 60000 });
  await sleep(1200);
  const pb = await page.locator('.play').boundingBox();
  await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
  await sleep(2000);
  for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== 'name'; i++) { await st(() => window.__pup.game.startMission('name')); await sleep(700); }

  /** The train, the blocks and the question as the scene holds them; each block's place on the screen. */
  const state = () => st(() => {
    const s = window.__pup.getStage(), cam = window.__pup.camera;
    const at = (o, lift = 0) => { const p = o.getWorldPosition(o.position.clone()); const world = p.clone(); p.y += lift; p.project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, world: world.toArray().map((v) => Math.round(v * 1000) / 1000) }; };
    const q = s.learn?.current;
    return {
      kind: s.kind, mode: s.mode, round: s.roundIndex, word: s.word, example: Boolean(s.example), last: s.last,
      q: q ? `${q.skill}:${q.item}:${q.openedAt}` : null, prompt: s.prompt, speaking: Boolean(s.speaking),
      onTrain: (s.wagons || []).filter((w) => w.slot !== null).map((w) => `${w.slot}:${w.syllable}`).sort(),
      blocks: (s.blocks || []).filter((b) => b.parent).map((b) => ({ syllable: b.userData.wagon?.syllable, choice: b.userData.choice ?? null, slot: b.userData.wagon?.slot ?? null, ...at(b) })),
      ghosts: (s.ghosts || []).map((g) => Boolean(g?.parent && g.visible)),
      card: s.card ? at(s.card.userData.face) : null,
      bubble: document.querySelector('.bubble')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      celebrated: Boolean(document.querySelector('.celebrate')), said: window.__said.length,
    };
  });
  const said = (from = 0) => st((from) => window.__said.slice(from).map((x) => x.text), from);
  const waitFor = async (pred, ms = 20000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) { const s = await state(); if (pred(s)) return s; } return null; };
  const tap = async (p, what) => { log.push(`TAP ${what} at ${Math.round(p.x)},${Math.round(p.y)}`); await page.touchscreen.tap(Math.round(p.x), Math.round(p.y)); };
  const shot = (slug) => page.screenshot({ path: `${OUT}${slug}.png`, scale: 'css' });
  const ready = await waitFor((s) => s.kind === 'name' && s.q && s.blocks.some((b) => b.choice === s.last));
  check(`level ${level}: a syllable round opens`, Boolean(ready), ready ? `${ready.mode}, ${ready.word}` : 'no question');
  if (ready) { await sleep(1500); await steps({ state, said, waitFor, tap, shot, sleep, st }); }
  check(`level ${level}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  writeFileSync(`${OUT}said-L${level}.txt`, (await said()).join('\n'));
  await context.close();
}

if (which === 'tap' || which === 'all') await play(10, async ({ state, said, waitFor, tap, shot, sleep }) => {
  let s = await state();
  const word = s.word, right = s.last;
  const wrong = s.blocks.find((b) => b.choice && b.choice !== right);
  let from = s.said;
  await tap(wrong, `wrong ${wrong.choice}`);
  await sleep(2200);
  const afterWrong = await said(from);
  const wrongSyllable = `${wrong.choice[0]}${wrong.choice.slice(1).toLowerCase()}!`;
  check('a wrong block says its own syllable first', words(afterWrong)[0] === wrongSyllable, afterWrong.slice(0, 2).join(' | '));
  s = await state();
  const back = s.blocks.find((b) => b.syllable === wrong.choice && b.slot === null);
  check('the wrong block is back on the grass', Boolean(back && Math.hypot(back.x - wrong.x, back.y - wrong.y) < 4), back ? `${Math.round(back.x)},${Math.round(back.y)}` : 'gone');
  const heard = [];
  for (let i = 0; i < 2; i++) {
    s = await state();
    const block = s.blocks.find((b) => b.choice === s.last);
    if (!block) break;
    from = s.said;
    await tap(block, `right ${block.choice}`);
    await sleep(1400);
    if (i === 0) {
      const mid = await state();
      check('after the first right block the train holds it', mid.onTrain.length === 1, mid.onTrain.join(' '));
      await shot('syll-tap');
    }
    heard.push(...(await said(from)));
  }
  await waitFor((x) => x.word !== word || x.celebrated, 8000);
  const all = await said(0);
  const syllable = `${right[0]}${right.slice(1).toLowerCase()}!`;
  check('each right block says its whole syllable', words(heard).filter((w) => w === syllable).length >= 2, heard.join(' | '));
  check('no tap says letter names', !words(all).some((w) => LETTER_NAMES.includes(w)), words(all).filter((w) => LETTER_NAMES.includes(w)).join(' '));
  const wordLine = `${word[0]}${word.slice(1).toLowerCase()}!`;
  check('the joined word is said', words(all).includes(wordLine), wordLine);
});

if (which === 'example' || which === 'all') await play(12, async ({ state, said, waitFor, tap, shot, sleep }) => {
  let s = await state();
  const word = s.word, round = s.round;
  await tap(s.blocks.find((b) => b.choice === s.last), 'right block');
  await sleep(1400);
  s = await state();
  check('one block is on the train before the card', s.onTrain.length === 1, s.onTrain.join(' '));
  check('no written word before the card', !/[A-Z]/.test(s.bubble) && !s.ghosts.some(Boolean), `bubble "${s.bubble}"`);
  const before = s;
  await tap(s.card, 'word card');
  await sleep(1200);
  s = await state();
  await shot('syll-example');
  check('the example shows: the word in the bubble', s.bubble.replace(/[^A-Z]/g, '') === word, `bubble "${s.bubble}"`);
  check('the example shows: the empty wagon shows its syllable', s.ghosts.some(Boolean), JSON.stringify(s.ghosts));
  check('the block on the train stays', JSON.stringify(s.onTrain) === JSON.stringify(before.onTrain), s.onTrain.join(' '));
  check('the same question is still open (nothing restarted)', s.q === before.q && s.round === round && s.word === word, `${s.q} round ${s.round}`);
  await tap(s.blocks.find((b) => b.choice === s.last), 'right block');
  const next = await waitFor((x) => x.round > round || x.celebrated, 12000);
  check('the round goes on: the word is built and the next word comes', Boolean(next), next ? `round ${next.round}, ${next.word}` : 'stuck');
  check('the next word starts without the example', next ? !next.example : false);
});

if (which === 'replay' || which === 'all') await play(12, async ({ state, said, waitFor, tap, shot, sleep, st }) => {
  let s = await state();
  await tap(s.blocks.find((b) => b.choice === s.last), 'right block');
  await sleep(3500); // (the block has landed and the next question has been said)
  const before = await state();
  const bubble = await st(() => { const r = document.querySelector('.bubble').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await tap(bubble, 'bubble');
  await sleep(1800);
  s = await state();
  await shot('syll-replay');
  const heard = await said(before.said);
  check('the question is said again, and only it', heard.join(' ') === before.prompt.join(' '), heard.join(' | '));
  const moved = s.blocks.filter((b, i) => !before.blocks[i] || Math.hypot(...b.world.map((v, k) => v - before.blocks[i].world[k])) > 0.01);
  check('no block moved', moved.length === 0 && s.blocks.length === before.blocks.length, moved.map((b) => b.syllable).join(' '));
  check('the train holds what it held', JSON.stringify(s.onTrain) === JSON.stringify(before.onTrain), s.onTrain.join(' '));
  check('the same question is open', s.q === before.q);
});

await browser.close();
writeFileSync(`${OUT}steps.txt`, log.join('\n'));
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length} of ${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
