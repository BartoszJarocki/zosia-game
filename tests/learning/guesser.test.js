import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../../src/places.js';

const tool = fileURLToPath(new URL('../../tools/learning/guesser.mjs', import.meta.url));
const game = fs.readFileSync(new URL('../../GAME.md', import.meta.url), 'utf8');
const run = (env = {}) => spawnSync(process.execPath, [tool, '200', '--missions'], { encoding: 'utf8', env: { ...process.env, ...env } });
const row = (out, kind) => out.stdout.split('\n').find((line) => line.startsWith(`${kind} `));

test('the guessing check covers every mission and a random tapper cannot beat chance by 15 points in any', () => {
  const out = run();
  assert.equal(out.status, 0, out.stdout + out.stderr);
  for (const kind of GAMES) assert.ok(row(out, kind), `${kind} is missing from the check`);
  assert.match(out.stdout, new RegExp(`${GAMES.length} of ${GAMES.length} missions pass`));
});

test('a level whose runs hold one scored question is called thin', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guesser-'));
  const edited = game.replace('| 3 | jump, howMany | 2–5 | 2–5 | no | no | 4 |', '| 3 | jump, howMany | 2–5 | 2–5 | yes | no | 3 |');
  assert.notEqual(edited, game, 'the Moon level 3 row moved: update this test');
  fs.writeFileSync(path.join(dir, 'GAME.md'), edited);
  const out = run({ GAME_MD: path.join(dir, 'GAME.md') });
  assert.match(row(out, 'moon'), /L1,2,3/);
  assert.ok(!/L1,2,3/.test(row(run(), 'moon')), 'the real Moon level 3 is not thin');
  fs.rmSync(dir, { recursive: true });
});
