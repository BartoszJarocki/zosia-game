// The level data, read from GAME.md (the same file people edit).
import md from '../../GAME.md?raw';
import { parseGame } from './parse.js';
import { CONFIG } from '../config.js';

const parsed = parseGame(md, { childName: CONFIG.childName });
if (parsed.errors.length) console.error('GAME.md has problems:\n' + parsed.errors.join('\n'));

export const LEVELS = parsed.levels;
export const LETTER_SETS = parsed.letterSets;
export const ALL_LETTERS = parsed.letterSets.ALL || 'ABCDEFGHIJKLMNOPRSTUWZ';
/** How many levels a mission has (= rows in its table). */
export const maxLevel = (kind) => Math.max(1, LEVELS[kind]?.length || 1);
