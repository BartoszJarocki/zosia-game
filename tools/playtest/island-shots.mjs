// island-shots.mjs <label> : the island at each graphics setting and both iPad shapes, one picture each, plus where every place sits on screen (verification tooling)
// env: BASE (default http://localhost:4190), OUTDIR (default island-shots), QS (low,medium,high), SIZES (1180x820,820x1180), DSF (2),
//      SUGGEST (a game place, e.g. name: Chase suggests that one in every picture; default: whichever the session picks)
// Run it once against main and once against a branch with two labels ("before", "after"); it ends by laying each label's
// pictures side by side per shape (<label>-tiers-<W>x<H>.jpg, needs ImageMagick's montage).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [label = 'now'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:4190';
const OUT = process.env.OUTDIR || 'island-shots';
const QS = (process.env.QS || 'low,medium,high').split(',');
const SIZES = (process.env.SIZES || '1180x820,820x1180').split(',').map((s) => s.split('x').map(Number));
const DSF = Number(process.env.DSF || 2);
const SUGGEST = process.env.SUGGEST || null;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = [];
for (const [w, h] of SIZES) {
  for (const q of QS) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: DSF, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/?q=${q}`);
    await page.waitForSelector('.start .play', { timeout: 30000 });
    await page.waitForTimeout(1200);
    if (SUGGEST) await page.evaluate((kind) => { window.__pup.dev.suggestOnce = kind; }, SUGGEST);
    const b = await page.locator('.play').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
    await page.waitForTimeout(4000);
    const file = `${label}-${q}-${w}x${h}.jpg`;
    await page.screenshot({ path: `${OUT}/${file}`, type: 'jpeg', quality: 82, scale: 'css' });
    const where = await page.evaluate(() => {
      const { getStage, camera } = window.__pup;
      const s = getStage();
      const px = (v) => { v = v.clone().project(camera); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight) }; };
      const marks = Object.entries(s.markers).map(([kind, { marker }]) => ({ kind, ...px(marker.getWorldPosition(marker.position.clone())) }));
      const cut = [];
      for (const o of s.tappables.filter((t) => t.userData.zone)) { // each place's tap zone is the room it needs on screen
        const { radiusTop: r, height: hh } = o.geometry.parameters;
        const pts = [];
        for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [0, hh]) { const v = o.position.clone(); v.x += dx; v.z += dz; v.y = y; pts.push(px(v)); }
        if (Math.min(...pts.map((p) => p.x)) < 0 || Math.max(...pts.map((p) => p.x)) > innerWidth || Math.min(...pts.map((p) => p.y)) < 0 || Math.max(...pts.map((p) => p.y)) > innerHeight) cut.push(Object.entries(s.markers).map(([kind, { marker }]) => [kind, Math.hypot(marker.position.x - o.position.x, marker.position.z - o.position.z)]).sort((a, b) => a[1] - b[1])[0][0]);
      }
      return { suggested: s.suggested || null, marks, cut };
    });
    const outside = where.marks.filter((m) => m.x < 0 || m.y < 0 || m.x > w || m.y > h).map((m) => m.kind);
    report.push({ file, q, w, h, suggested: where.suggested, starsOutsideTheScreen: outside, placesCut: where.cut, errors });
    writeFileSync(`${OUT}/${label}-${q}-${w}x${h}.json`, JSON.stringify({ ...where, errors }, null, 1));
    await context.close();
  }
}
await browser.close();
for (const [w, h] of SIZES) {
  const files = QS.map((q) => `${OUT}/${label}-${q}-${w}x${h}.jpg`);
  spawnSync('montage', ['-label', '%t', '-pointsize', '14', ...files, '-tile', `${QS.length}x`, '-geometry', w > h ? '700x486+4+4' : '420x604+4+4', '-quality', '82', `${OUT}/${label}-tiers-${w}x${h}.jpg`]);
}
writeFileSync(`${OUT}/${label}-report.json`, JSON.stringify(report, null, 1));
console.log(report.map((r) => `${r.file} suggested=${r.suggested} outside=[${r.starsOutsideTheScreen}] cut=[${r.placesCut}] errors=${r.errors.length}`).join('\n'));
