// How logical is the River path? For many random layouts per level, follow the hops 1 → 2 → … → far bank
// and count hops that go backwards (towards her own bank) or mostly sideways.
import { chromium } from 'playwright-core';
import { mkdirSync as mkdirTmp } from 'node:fs';
// Chromium's GPU process needs writable temp space; /tmp can be a full per-user tmpfs, which crashes WebGL
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirTmp(process.env.TMPDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const START = { x: 0, z: 5.6 }, FAR = { x: 4.5, z: -5.9 }; // src/scenes/stones.js
for (const level of (process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 2, 4])) {
  const totals = { hops: 0, back: 0, sideways: 0, layouts: 0, worstBackPerRiver: 0 };
  let example = null;
  for (let i = 0; i < 30; i++) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    try {
    await page.addInitScript((level) => localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { stones: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } })), level);
    await page.goto(`${process.env.BASE || 'https://pup-patrol-theta.vercel.app'}/?q=low#stones`);
    await page.waitForFunction(() => window.__pup?.getStage()?.tappables?.filter((o) => o.userData.num !== undefined).length >= 3, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const stones = await page.evaluate(() => window.__pup.getStage().tappables.filter((o) => o.userData.num !== undefined).map((o) => ({ n: o.userData.num, x: +o.position.x.toFixed(1), z: +o.position.z.toFixed(1) })).sort((a, b) => a.n - b.n));
    await page.close();
    var got = stones;
    } catch (e) { await page.close().catch(() => {}); i--; continue; }
    const stones = got;
    const path = [START, ...stones, FAR];
    let back = 0;
    for (let k = 1; k < path.length; k++) {
      const dz = path[k].z - path[k - 1].z, dx = path[k].x - path[k - 1].x; // forward = towards Chase = z going down
      totals.hops++;
      if (dz > 0.3) { totals.back++; back++; }
      else if (Math.abs(dx) > Math.abs(dz) * 1.5) totals.sideways++;
    }
    totals.layouts++;
    totals.worstBackPerRiver = Math.max(totals.worstBackPerRiver, back);
    if (!example || back > example.back) example = { back, stones: stones.map((s) => `${s.n}@(${s.x},${s.z})`).join(' ') };
  }
  console.log(`level ${level}: ${totals.layouts} rivers, ${totals.hops} hops: ${totals.back} backwards (${Math.round(100 * totals.back / totals.hops)}%), ${totals.sideways} mostly sideways (${Math.round(100 * totals.sideways / totals.hops)}%), worst river ${totals.worstBackPerRiver} backward hops`);
  console.log(`   worst example: ${example.stones}`);
}
await browser.close();
