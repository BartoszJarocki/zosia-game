// How logical is the River path? Lay out 1000 rivers per GAME.md level with the scene's own generator, follow
// her hops (her bank → the right stone of each row → the far bank) and count the ones that go backwards
// (towards her bank) or mostly sideways. The same definitions measured production's random grid on 2026-10-21:
// level 1 47%, level 2 57%, level 4 62% of hops backwards or sideways.
// The scene itself is checked by walk.mjs, which logs a STEP for every stone she lands on.
import { readFileSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { riverRows, START, LAND } from '../../src/levels/river.js';

const { levels } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: 'Zosia' });
export const hopCensus = (path) => {
  let back = 0, sideways = 0;
  for (let k = 1; k < path.length; k++) {
    const dz = path[k].z - path[k - 1].z, dx = path[k].x - path[k - 1].x; // forward = towards Chase = z going down
    if (dz > 0.3) back++;
    else if (Math.abs(dx) > Math.abs(dz) * 1.5) sideways++;
  }
  return { hops: path.length - 1, back, sideways };
};
if (import.meta.url === `file://${process.argv[1]}`) {
  levels.stones.forEach((L, i) => {
    if (L.bubble === 'missing') return console.log(`level ${i + 1}: missing stone (the path lies in order, no choosing)`);
    const t = { hops: 0, back: 0, sideways: 0 };
    for (let k = 0; k < 1000; k++) {
      const { rows } = riverRows({ n: L.n, choices: L.choices, foils: L.foils });
      const c = hopCensus([START, ...rows.map((r) => r.stones.find((s) => s.right)), LAND]);
      for (const key in t) t[key] += c[key];
    }
    console.log(`level ${i + 1}: 1000 rivers, ${t.hops} hops: ${t.back} backwards (${Math.round((100 * t.back) / t.hops)}%), ${t.sideways} mostly sideways (${Math.round((100 * t.sideways) / t.hops)}%)`);
  });
}
