// npm run check — validates the level tables in GAME.md (also runs before every build).
import fs from 'node:fs';
import { parseGame } from '../src/levels/parse.js';
import { CONFIG } from '../src/config.js';
import { allSegments } from '../src/lang/pl.js';
import { clipKey } from '../src/voice-key.js';

const { levels, letterSets, missions, errors } = parseGame(fs.readFileSync('GAME.md', 'utf8'), { childName: CONFIG.childName });
if (errors.length) {
  console.error(`\n✗ GAME.md has ${errors.length} problem${errors.length > 1 ? 's' : ''}:\n`);
  for (const e of errors) console.error('  • ' + e);
  console.error('');
  process.exit(1);
}
console.log('✓ GAME.md levels are valid');
for (const [kind, rows] of Object.entries(levels)) console.log(`  ${(missions[kind]?.title || kind).padEnd(14)} ${rows.length} level${rows.length > 1 ? 's' : ''}`);
console.log(`  letters: ALL = ${letterSets.ALL}`);

// voice lines the levels need but that aren't recorded yet (they'd use the device voice instead)
const missing = allSegments(levels, letterSets.ALL).filter((t) => !fs.existsSync(`public/voice/${clipKey(t, CONFIG)}.mp3`));
if (missing.length) {
  console.warn(`\n! ${missing.length} spoken line${missing.length > 1 ? 's are' : ' is'} not recorded yet — run: npm run voices`);
  for (const t of missing.slice(0, 8)) console.warn('    ' + t);
  if (missing.length > 8) console.warn(`    …and ${missing.length - 8} more`);
}
