// How big each stop's planet looks on the space map (its sphere's width in CSS px), for a given screen size.
// usage: node space-sizes.mjs <port> <width> <height>
import { chromium } from 'playwright-core';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
const [port, w, h] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.goto(`http://localhost:${port}/?q=low#space`);
await page.waitForFunction(() => window.__pup?.getStage()?.kind === 'space-map' && window.__pup.getStage().state === 'waiting', null, { timeout: 60000 });
await page.waitForTimeout(2500);
const r = await page.evaluate(() => {
  const { getStage, camera } = window.__pup; const g = getStage();
  const size = (o) => { const Vec = o.position.constructor, pts = []; o.updateWorldMatrix(true, true);
    o.traverse((m) => { if (!m.geometry || !m.visible || m.material?.visible === false || m.isSprite || m.geometry.type !== 'SphereGeometry') return; m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vec(x, y, z).applyMatrix4(m.matrixWorld)); });
    if (!pts.length) return null; const xs = pts.map((p) => (p.project(camera).x + 1) / 2 * innerWidth); return Math.round(Math.max(...xs) - Math.min(...xs)); };
  return Object.fromEntries(Object.entries(g.bodies).map(([k, b]) => [k, size(b)]));
});
console.log(w + 'x' + h, JSON.stringify(r));
await browser.close();
