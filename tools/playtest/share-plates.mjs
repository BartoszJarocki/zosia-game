// Treat House share round with 4 friends: every plate must take a real click (none hidden behind the treat box).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
for (const [w, h] of [[1180, 820], [820, 1180]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:4173'}/?q=low#counting`);
  await page.waitForFunction(() => window.__pup?.getStage()?.L, null, { timeout: 40000 });
  await page.evaluate(() => { const s = window.__pup.getStage(); s.L = { ...s.L, types: ['share'], share: [4, 4] }; }); // every round from the next one on
  await page.waitForTimeout(2000);
  await page.evaluate(() => { // a give round may have started already: give Chase his treats to finish it
    const s = window.__pup.getStage();
    s.tappables.filter((o) => o.userData.drag).slice(0, s.last).forEach((b) => b.userData.drag.onTap(b));
  });
  await page.waitForFunction(() => window.__pup.getStage().tappables.filter((o) => o.userData.hungry !== undefined).length === 4, null, { timeout: 40000 });
  await page.waitForTimeout(2500); // the kittens have landed
  const plates = () => page.evaluate(() => { const s = window.__pup.getStage(), cam = window.__pup.camera; return s.tappables.filter((o) => o.userData.hungry).map((o) => { const p = o.position.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, wx: o.position.x }; }); });
  for (const p of await plates()) {
    const before = (await plates()).length;
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(700);
    const fedIt = (await plates()).length === before - 1;
    const onScreen = p.x > 0 && p.x < w && p.y > 0 && p.y < h;
    if (!fedIt || !onScreen) failed++;
    console.log(`${w}x${h} plate at x=${p.wx.toFixed(1)} → screen (${Math.round(p.x)}, ${Math.round(p.y)}) ${onScreen ? 'on screen' : 'OFF SCREEN'}, click ${fedIt ? 'fed the friend' : 'DID NOT feed'}`);
  }
  await page.close();
}
await browser.close();
console.log(failed ? `FAIL: ${failed} plate(s)` : 'ok: every plate takes a click, on landscape and portrait');
