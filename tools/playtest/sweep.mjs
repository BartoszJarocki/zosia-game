// Replays every level of every mission in GAME.md with walk.mjs, a few at a time, and says which did not reach the
// celebration or had page errors. Writes <OUTDIR>/summary.json and exits 1 if any run failed.
// usage: BASE=http://localhost:4180 OUTDIR=sweep-base [ENDS=1] node sweep.mjs [jobs] [kind...]
// ENDS=1 plays only each mission's first and last level.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseGame } from '../../src/levels/parse.js';
import { CONFIG } from '../../src/config.js';

const [jobsArg, ...only] = process.argv.slice(2);
const jobs = Number(jobsArg) || 6;
const OUTDIR = process.env.OUTDIR || 'sweep';
const here = new URL('./', import.meta.url).pathname;
const { levels } = parseGame(readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8'), { childName: CONFIG.childName });
const runs = Object.entries(levels).filter(([k]) => !only.length || only.includes(k)).flatMap(([kind, rows]) => rows.map((_, i) => [kind, i + 1]).filter(([, l]) => !process.env.ENDS || l === 1 || l === rows.length));

function walk([kind, level]) {
  return new Promise((done) => {
    const p = spawn('timeout', ['420', 'node', 'walk.mjs', kind, String(level)], { cwd: here, env: process.env, stdio: 'ignore' });
    p.on('close', (code) => {
      let r;
      try {
        const t = JSON.parse(readFileSync(`${here}${OUTDIR}/${kind}-L${level}/timeline.json`, 'utf8'));
        r = { kind, level, celebrated: t.timeline.some((e) => e.type === 'me' && e.text === 'celebration'), errors: t.errors };
      } catch { r = { kind, level, celebrated: false, errors: [`walker exited ${code} without a timeline`] }; }
      console.log(`${r.celebrated && !r.errors.length ? 'ok  ' : 'FAIL'} ${kind} L${level}${r.errors.length ? `  ${r.errors.join(' | ')}` : ''}${r.celebrated ? '' : '  (no celebration)'}`);
      done(r);
    });
  });
}

const results = [];
const queue = [...runs];
await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) results.push(await walk(queue.shift())); }));
results.sort((a, b) => a.kind.localeCompare(b.kind) || a.level - b.level);
mkdirSync(`${here}${OUTDIR}`, { recursive: true });
writeFileSync(`${here}${OUTDIR}/summary.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.celebrated || r.errors.length);
console.log(`${results.length} runs, ${results.length - failed.length} reached the celebration with 0 page errors, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
