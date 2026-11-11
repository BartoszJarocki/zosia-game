// playcheck.mjs [--missions a,b] [--levels 2,3] [--plans fast,quick] : the play check every unit is judged by
// (docs/IMPROVEMENT-PLAN.md, unit A1). Builds the game once (unless BASE is given), serves it, plays the levels with
// the child-like player (kid.mjs: real GPU, ?q=high, touch), judges the rules (playcheck-rules.mjs), makes a contact
// sheet per run (sheet.sh), writes OUTDIR/playcheck.tsv (one row per mission and level) and prints the table.
//   plans  fast and wrong-first on every level, quick on levels with counting taps, mash on each mission's first and top level
// env: BASE, OUTDIR (default tools/playtest/playcheck-out), PORT (default 4190), CONC (browsers at once, default 2)
// Exits 1 when a rule fails or a run breaks. Verification tooling.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGame } from '../../src/levels/parse.js';
import { CONFIG } from '../../src/config.js';
import { judge } from './playcheck-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../..');
const OUT = resolve(process.env.OUTDIR || join(HERE, 'playcheck-out'));
const PORT = Number(process.env.PORT || 4190), CONC = Number(process.env.CONC || 2);
const RUN_MS = 10 * 60 * 1000;
const PLANS = ['fast', 'wrong-first', 'quick', 'mash'];

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1].split(',').filter(Boolean) : null; };
const only = { missions: arg('missions'), levels: arg('levels')?.map(Number), plans: arg('plans') ?? PLANS };

// levels with counting taps (something for the quick plan to tap quickly), read from GAME.md's columns
const COUNTING_TAPS = {
  lighthouse: (row) => row.mode === 'make' || row.mode === 'more',
  moon: (row) => row.types.includes('jump'),
  blackhole: (row) => row.types.includes('drop'),
  port: (row) => row.mode !== 'which',
  counting: (row) => row.types.some((t) => ['give', 'flash', 'hidden'].includes(t)),
};
const plansFor = (kind, level, rows) => ({
  fast: true,
  'wrong-first': true,
  quick: Boolean(COUNTING_TAPS[kind]?.(rows[level - 1])),
  mash: level === 1 || level === rows.length,
});

const { levels } = parseGame(readFileSync(join(ROOT, 'GAME.md'), 'utf8'), { childName: CONFIG.childName });
const unknown = (only.missions || []).filter((k) => !levels[k]);
if (unknown.length) { console.error(`unknown missions: ${unknown.join(', ')} (known: ${Object.keys(levels).join(', ')})`); process.exit(2); }
const cells = Object.entries(levels)
  .filter(([kind]) => !only.missions || only.missions.includes(kind))
  .flatMap(([kind, rows]) => rows.map((row, i) => ({ kind, level: i + 1, row, rows })))
  .filter((c) => !only.levels || only.levels.includes(c.level));
const jobs = cells.flatMap((c) => only.plans.filter((p) => plansFor(c.kind, c.level, c.rows)[p]).map((plan) => ({ ...c, plan, dir: join(OUT, plan, `${c.kind}-L${c.level}-${plan}`) })));
mkdirSync(OUT, { recursive: true });
const LOG = join(OUT, 'playcheck.log');
const say = (line) => { console.log(line); appendFileSync(LOG, line + '\n'); };

let preview = null;
const stopPreview = () => { preview?.kill(); preview = null; };
process.on('SIGINT', () => { stopPreview(); process.exit(130); });
let BASE = process.env.BASE;
if (!BASE) {
  const vite = join(ROOT, 'node_modules/vite/bin/vite.js'), dist = join(OUT, 'dist');
  say(`building into ${dist}`);
  if (spawnSync('node', [vite, 'build', '--outDir', dist, '--emptyOutDir'], { cwd: ROOT, stdio: 'inherit' }).status !== 0) process.exit(2);
  preview = spawn('node', [vite, 'preview', '--outDir', dist, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  BASE = `http://localhost:${PORT}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch {}
    if (i > 100) { stopPreview(); console.error(`no preview at ${BASE}`); process.exit(2); }
    await new Promise((r) => setTimeout(r, 200));
  }
}
say(`${jobs.length} runs on ${BASE}, ${CONC} at a time, into ${OUT}`);

const play = (job) => new Promise((done) => {
  rmSync(job.dir, { recursive: true, force: true }); // (a run never reads an older run's summary or screenshots)
  const env = { ...process.env, BASE, OUTDIR: join(OUT, job.plan), DSF: '1', Q: 'high', FILM: process.env.FILM ?? '0' };
  const child = spawn('node', [join(HERE, 'kid.mjs'), job.kind, String(job.level), job.plan], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const timer = setTimeout(() => { out += '\nTIMEOUT'; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 10000); }, RUN_MS); // (SIGTERM: playwright closes its browser)
  child.on('close', () => {
    clearTimeout(timer);
    sheets.push(new Promise((r) => spawn('bash', [join(HERE, 'sheet.sh'), job.dir], { stdio: 'ignore' }).on('close', r))); // (the next run need not wait for it)
    const lines = out.trim().split('\n');
    say(`${String(++finished).padStart(3)}/${jobs.length}  ${existsSync(join(job.dir, 'summary.json')) ? lines.at(-1) : `${job.kind} L${job.level} ${job.plan}: BROKE ${lines.slice(-3).join(' | ')}`}`);
    done();
  });
});
let finished = 0, next = 0;
const sheets = [];
await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, async () => { while (next < jobs.length) await play(jobs[next++]); }));
stopPreview();
await Promise.all(sheets);

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const cell = (v) => `${v.pass === null ? 'n/a' : v.pass ? 'pass' : 'fail'}: ${v.why}`;
const rows = cells.map((c) => {
  const mine = jobs.filter((j) => j.kind === c.kind && j.level === c.level);
  const runs = mine.map((j) => join(j.dir, 'summary.json')).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const verdicts = judge(runs, c.row);
  const broke = mine.length - runs.length, stuck = runs.filter((r) => r.rounds.some((x) => x.stuck)).length, pageErrors = runs.reduce((n, r) => n + r.errors.length, 0);
  return {
    c, verdicts,
    celebrated: `${runs.filter((r) => r.celebrated).length}/${mine.length}`,
    errors: [pageErrors, stuck && `${stuck} stuck`, broke && `${broke} broke`].filter(Boolean).join(', '),
    fps: median(runs.map((r) => r.fps.median).filter(Number.isFinite)),
    sheets: mine.map((j) => join(j.dir, 'sheet.jpg')).filter(existsSync).map((f) => relative(OUT, f)).join(' '),
    bad: broke || stuck || pageErrors || verdicts.some((v) => v.pass === false),
  };
});
const head = ['mission', 'level', ...rows[0]?.verdicts.map((v) => `rule ${v.id} ${v.name}`) ?? [], 'celebrated', 'errors', 'fps median', 'contact sheets'];
const tsv = [head, ...rows.map((r) => [r.c.kind, r.c.level, ...r.verdicts.map(cell), r.celebrated, r.errors, r.fps ?? '', r.sheets])];
writeFileSync(join(OUT, 'playcheck.tsv'), tsv.map((l) => l.join('\t')).join('\n') + '\n');

const short = (v) => (v.pass === null ? 'n/a ' : v.pass ? 'pass' : 'FAIL');
say(`\n${'mission'.padEnd(11)} lv  r1   r2   r3   done  err  fps`);
for (const r of rows) say(`${r.c.kind.padEnd(11)} ${String(r.c.level).padStart(2)}  ${r.verdicts.map(short).join(' ')} ${r.celebrated.padStart(5)} ${String(r.errors || 0).padStart(4)} ${String(r.fps ?? '').padStart(4)}`);
for (const id of [1, 2, 3]) say(`rule ${id}: ${rows.filter((r) => r.verdicts.find((v) => v.id === id)?.pass === false).length} of ${rows.length} rows fail`);
say(`table: ${join(OUT, 'playcheck.tsv')}`);
process.exit(rows.some((r) => r.bad) ? 1 : 0);
