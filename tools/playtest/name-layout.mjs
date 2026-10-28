// Name Train layout check: for each word and screen, is everything on screen, are the letter blocks big enough,
// does anything hide behind the bubble? Screenshots plus a JSON report.
// usage: BASE=http://127.0.0.1:4173 node name-layout.mjs [level] [WORD,WORD… or - for the level's own] [landscape,portrait]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [levelArg = '5', wordsArg = 'ZOSIA,KOT,BERNADKA', screensArg = 'landscape,portrait'] = process.argv.slice(2);
const level = Number(levelArg);
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/name-layout-L${level}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const SCREENS = { landscape: { width: 1180, height: 820 }, portrait: { width: 820, height: 1180 } };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];

for (const screen of screensArg.split(',')) {
  const page = await browser.newPage({ viewport: SCREENS[screen] });
  await page.addInitScript((level) => localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { name: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } })), level);
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:4173'}/?q=low#name`);
  await page.waitForFunction(() => window.__pup?.getStage()?.kind === 'name', null, { timeout: 40000 });
  for (const word of wordsArg.split(',')) {
    // the level row is shared with the game's level table: narrowing its words forces the next pick
    await page.evaluate((w) => { const s = window.__pup.getStage(); if (w !== '-') s.L.words = [w]; return window.__pup.game.startMission('name'); }, word); // ('-': keep the level's words)
    await page.waitForFunction((w) => { const s = window.__pup.getStage(); return s?.kind === 'name' && (s.word === w || s.mode === 'whose') && (s.learn?.isOpen); }, word, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const s = window.__pup.getStage(), cam = window.__pup.camera;
      const W = innerWidth, H = innerHeight;
      const box = (o) => {
        o.updateMatrixWorld(true);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        o.traverse((c) => {
          if (!c.isMesh || !c.visible || !c.geometry || c.material?.transparent) return; // (smoke and glows don't count)
          c.geometry.computeBoundingBox();
          const b = c.geometry.boundingBox;
          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
            const p = c.localToWorld(b.min.clone().set(x, y, z)).project(cam);
            const sx = (p.x + 1) / 2 * W, sy = (1 - p.y) / 2 * H;
            x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
          }
        });
        return { x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
      };
      const inside = (b) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H;
      const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const r = document.querySelector('.bubble:not(.hidden)')?.getBoundingClientRect();
      const bubble = r ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null;
      const girl = box(s.girl), pup = box(s.pup);
      const out = { word: s.word || s.trains.map((t) => t.userData.word).join('/'), mode: s.mode, W, H, minWidth: s.view.minWidth, girl, pup, heroesInside: inside(girl) && inside(pup) };
      if (s.mode === 'whose') {
        out.boards = s.trains.map((t) => ({ word: t.userData.word, ...box(t.userData.board) }));
        out.trainsInside = s.trains.every((t) => inside(box(t)));
        out.boardsUnderBubble = bubble ? out.boards.filter((b) => overlap(b, bubble) > 0).map((b) => b.word) : [];
        out.boardOverlaps = out.boards.flatMap((a, i) => out.boards.slice(i + 1).filter((b) => overlap(a, b) > 0).map((b) => `${a.word}×${b.word}`));
      } else {
        const blocks = s.blocks.filter((b) => b.parent && b.userData.letter).map((b) => ({ letter: b.userData.letter, ...box(b) }));
        const train = box(s.train);
        out.train = train;
        out.trainInside = inside(train);
        out.blocks = blocks.length;
        out.smallestBlock = Math.min(...blocks.map((b) => Math.min(b.w, b.h)));
        out.blocksInside = blocks.every(inside);
        out.trainUnderBubble = bubble ? overlap(train, bubble) : 0;
        out.blockOverlaps = blocks.flatMap((a, i) => blocks.slice(i + 1).filter((b) => overlap(a, b) > 0.15 * a.w * a.h).map((b) => `${a.letter}×${b.letter}`));
        out.heroOnBlock = blocks.filter((b) => overlap(b, girl) > 0.1 * b.w * b.h || overlap(b, pup) > 0.1 * b.w * b.h).map((b) => b.letter);
      }
      return out;
    });
    const name = `${screen}-${m.word.replace(/\//g, '-')}`;
    await page.screenshot({ path: `${OUT}${name}.png` }).catch(() => {});
    report.push({ screen, ...m });
    console.log(JSON.stringify({ screen, ...m, girl: undefined, pup: undefined, train: undefined, boards: m.boards?.map((b) => `${b.word} ${b.w}x${b.h}@${b.x0},${b.y0}`) }));
  }
  await page.close();
}
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
await browser.close();
