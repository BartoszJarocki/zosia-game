// island-stray.mjs : taps on the grass and the sea a little way from each place's star, and counts how many start a drive (verification tooling)
// A tap that hits only the ground is a stray tap. The island takes it to the nearest thing it can tap only within a small share of the screen's short side.
// env: BASE (default http://localhost:4190), W, H (viewport, default 1180 x 820), SHARE (default 0.06: just outside the island's 5%, inside the old 7%)
import { chromium } from 'playwright-core';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
const BASE = process.env.BASE || 'http://localhost:4190';
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const SHARE = Number(process.env.SHARE || 0.06);
const KINDS = ['letters', 'balloons', 'name', 'cones', 'stones', 'counting', 'delivery', 'picnic', 'garage', 'lookout'];
const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true })).newPage();
await page.goto(`${BASE}/?q=high`);
await page.waitForSelector('.start .play', { timeout: 30000 });
await page.waitForTimeout(1000);
const play = await page.locator('.play').boundingBox();
await page.touchscreen.tap(play.x + play.width / 2, play.y + play.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  const s = window.__pup.getStage();
  window.__went = [];
  s.go = (kind) => window.__went.push(kind);
  const ground = s.tappables.find((o) => o.geometry?.parameters?.width === 700);
  const onTap = ground.userData.onTap;
  ground.userData.onTap = (t) => { window.__went.push('ground'); return onTap(t); };
});
const taps = [];
for (const [dx, dy] of SIDES) {
  for (const kind of KINDS) {
    const at = await page.evaluate(([kind, share, dx, dy]) => {
      const { getStage, camera } = window.__pup;
      const m = getStage().markers[kind].marker;
      const p = m.getWorldPosition(m.position.clone()).project(camera);
      const d = share * Math.min(innerWidth, innerHeight);
      return { x: (p.x + 1) / 2 * innerWidth + dx * d, y: (1 - p.y) / 2 * innerHeight + dy * d };
    }, [kind, SHARE, dx, dy]);
    if (at.x < 5 || at.y < 5 || at.x > W - 5 || at.y > H - 5) continue;
    await page.evaluate(() => (window.__went = []));
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(120);
    taps.push({ kind, side: `${dx},${dy}`, went: (await page.evaluate(() => window.__went)).join('+') });
  }
}
const strays = taps.filter((t) => t.went.startsWith('ground'));
const drives = strays.filter((t) => t.went !== 'ground');
console.log(`${BASE} ${W}x${H}: ${taps.length} taps ${SHARE * 100}% of the short side from a star, ${strays.length} hit only the ground, ${drives.length} of those started a drive`);
if (drives.length) console.log(drives.map((t) => `${t.kind} ${t.side} -> ${t.went.replace('ground+', '')}`).join('\n'));
await browser.close();
process.exit(drives.length ? 1 : 0);
