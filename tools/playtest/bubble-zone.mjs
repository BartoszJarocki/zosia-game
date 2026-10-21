// Where does the speech bubble sit over the river? Project its rect onto the water plane (y = 0.18).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[1180, 820], [1024, 768], [1366, 1024]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://127.0.0.1:4173/?q=low#stones');
  await page.waitForFunction(() => document.querySelector('.bubble:not(.hidden)') && window.__pup?.getStage()?.tappables?.length >= 3, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const cam = window.__pup.camera;
    const r = document.querySelector('.bubble').getBoundingClientRect();
    const toWorld = (px, py) => {
      const v = new cam.position.constructor((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1, 0.5).unproject(cam);
      const d = v.sub(cam.position).normalize();
      const t = (0.18 - cam.position.y) / d.y;
      return [+(cam.position.x + d.x * t).toFixed(2), +(cam.position.z + d.z * t).toFixed(2)];
    };
    const edge = (px, py) => toWorld(px, py);
    const right = [0, 0.25, 0.5, 0.75, 1].map((f) => edge(r.right, r.bottom - f * (r.bottom - r.top)));
    const bottom = [0, 0.25, 0.5, 0.75, 1].map((f) => edge(r.left + f * (r.right - r.left), r.bottom));
    return { bottom, right, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), bottomLeft: edge(r.left, r.bottom), bottomRight: edge(r.right, r.bottom), screenTopLeft: edge(0, 0), screenBottomRight: edge(innerWidth, innerHeight), screenLeftAtRiver: edge(0, innerHeight * 0.5) };
  });
  console.log(w, h, JSON.stringify(out));
  await page.close();
}
await browser.close();
