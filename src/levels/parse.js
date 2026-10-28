// Reads the level tables out of GAME.md and checks them.
// Pure JS (no DOM), so the game, the voice recorder and the build check all share it.
//
// In GAME.md:
//   ## Letter sets        → a table:  | Set | Letters |
//   ### Name · `kind`     → a mission; the first table after it has one row per level.

import { parseNeeds } from './gate.js';

/** Letters whose sound can be held and heard on its own (Kitty Park "sound" levels): aaa, mmm, sss… */
export const SOUNDABLE = 'AEFHILMNORSUWZ';

/** What each mission's columns mean, their allowed values and limits (the game's capabilities). */
export const SCHEMA = {
  letters: {
    pool: { type: 'letters' },
    choices: { type: 'int', min: 2, max: 4 },
    ask: { type: 'enum', values: ['match', 'name', 'audio', 'word', 'sound'], optional: true },
    show: { type: 'enum', values: ['letter', 'picture'], optional: true }, // (older tables: letter = name, picture = word)
    similar: { type: 'bool' },
    needs: { type: 'needs', optional: true },
    rounds: { type: 'int', min: 1, max: 8, optional: true, default: 4 }, // kittens to find
  },
  balloons: {
    pool: { type: 'letters' },
    targets: { type: 'int', min: 1, max: 4 },
    total: { type: 'int', min: 3, max: 9 },
    speed: { type: 'range', min: 0.1, max: 2, float: true },
    similar: { type: 'bool' },
    rounds: { type: 'int', min: 1, max: 8, optional: true, default: 3 }, // letters to pop
  },
  name: {
    words: { type: 'words', minLen: 2, maxLen: 8, extra: 'Y' }, // (Y only in names, e.g. RYSIEK: shown and named, never asked elsewhere)
    mode: { type: 'enum', values: ['ghost', 'word', 'missing', 'highlight', 'whose'], optional: true },
    gaps: { type: 'int', min: 1, max: 3, optional: true, default: 2 }, // (missing: how many letters are missing)
    ghost: { type: 'bool', optional: true },                      // (older tables: ghost yes = mode ghost)
    bubble: { type: 'enum', values: ['letter', 'word'], optional: true }, // (older tables: word = mode highlight)
    extras: { type: 'int', min: 0, max: 3, optional: true, default: 0 }, // (whose: always three trains)
    similar: { type: 'bool', optional: true, default: false },
  },
  cones: {
    max: { type: 'int', min: 2, max: 10 },
    choices: { type: 'int', min: 2, max: 4 },
    bubble: { type: 'enum', values: ['both', 'numeral', 'dots', 'name'] },
    sign: { type: 'enum', values: ['both', 'numeral', 'dots'] },
    dots: { type: 'enum', values: ['line', 'dice'], optional: true, default: 'line' },
    count: { type: 'bool', optional: true, default: true }, // count the dots aloud after a right answer
    rounds: { type: 'int', min: 1, max: 8, optional: true, default: 3 }, // cones on the road
  },
  stones: {
    n: { type: 'int', min: 2, max: 9 },
    rounds: { type: 'int', min: 1, max: 6, optional: true, default: 2 }, // rivers to cross
    bubble: { type: 'enum', values: ['numeral', 'next', 'missing'] },
    choices: { type: 'int', min: 2, max: 3, optional: true, default: 2 }, // stones in each row
    foils: { type: 'enum', values: ['far', 'near'], optional: true, default: 'far' }, // the other numbers in a row (missing: the wrong stone)
  },
  counting: {
    types: { type: 'list', values: ['give', 'howMany', 'share', 'hidden', 'flash'] },
    give: { type: 'range', min: 1, max: 10 },
    howMany: { type: 'range', min: 1, max: 9, optional: true },
    share: { type: 'range', min: 2, max: 4, optional: true }, // friends at the table: Chase and kittens
    hidden: { type: 'range', min: 2, max: 4, optional: true }, // treats under the bowl in the end: some, then one more
    flash: { type: 'range', min: 1, max: 4, optional: true }, // treats seen for a moment (a die's patterns)
    auto: { type: 'bool' },
    slots: { type: 'bool', optional: true, default: true }, // ghost spots for the treats (give rounds)
    rounds: { type: 'int', min: 1, max: 8, optional: true, default: 3 }, // tasks
  },
  delivery: {
    pool: { type: 'letters' },
    choices: { type: 'int', min: 2, max: 4 },
    mode: { type: 'enum', values: ['pictureSound', 'soundLetter'] },
    similar: { type: 'bool', optional: true, default: false },
    rounds: { type: 'int', min: 1, max: 8, optional: true, default: 4 }, // parcels
    needs: { type: 'needs', optional: true },
  },
  picnic: {
    max: { type: 'int', min: 3, max: 10 },
    modes: { type: 'list', values: ['more', 'less', 'same'] },
    close: { type: 'bool' },
    numerals: { type: 'bool' },
    rounds: { type: 'int', min: 1, max: 8, optional: true, default: 3 },
  },
  lookout: {
    max: { type: 'int', min: 2, max: 9 },
    bubble: { type: 'enum', values: ['both', 'numeral'] },
    mode: { type: 'enum', values: ['go', 'pickup', 'find', 'relative', 'dice'] },
    rounds: { type: 'int', min: 1, max: 3, optional: true, default: 1 }, // elevator trips, a kitten each (the car seats 3)
    dice: { type: 'range', min: 1, max: 6, optional: true }, // (mode dice) how many floors up the die can say
  },
  garage: {
    modes: { type: 'list', values: ['shapes', 'pattern', 'sort'] }, // taking turns, one per round
    shapes: { type: 'enum', values: ['shown', 'name', 'turned'], optional: true },
    pattern: { type: 'enum', values: ['AB', 'gap', 'ABB'], optional: true },
    sort: { type: 'enum', values: ['colour', 'size', 'switch'], optional: true },
    rounds: { type: 'int', min: 1, max: 6, optional: true, default: 3 },
  },
};

const clean = (s) => s.replace(/`/g, '').replace(/\*\*/g, '').trim();
const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map(clean);

/** All markdown tables in a block of lines, as arrays of row objects keyed by header. */
function tableAfter(lines, start) {
  let i = start;
  while (i < lines.length && !lines[i].trim().startsWith('|')) {
    if (/^#{1,3}\s/.test(lines[i]) && i > start) return null; // next heading came first
    i++;
  }
  if (i >= lines.length) return null;
  const header = splitRow(lines[i]);
  const rows = [];
  for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
    const cells = splitRow(lines[j]);
    rows.push({ line: j + 1, cells: Object.fromEntries(header.map((h, k) => [h, cells[k] ?? ''])) });
  }
  return { header, rows, line: i + 1 };
}

/**
 * Parse GAME.md. Returns { levels, letterSets, missions, errors }.
 * childName fills in {name} in letter sets and word lists.
 */
export function parseGame(md, { childName = '' } = {}) {
  const lines = md.split(/\r?\n/);
  const errors = [];
  const name = childName.toUpperCase().replace(/[^A-Z]/g, '');

  // ---- letter sets ----
  const letterSets = {};
  const setsAt = lines.findIndex((l) => /^##\s+Letter sets/i.test(l));
  if (setsAt < 0) errors.push('GAME.md: missing the "## Letter sets" table');
  else {
    const t = tableAfter(lines, setsAt);
    for (const r of t?.rows || []) {
      const set = r.cells.Set || r.cells.set;
      const expr = r.cells.Letters || r.cells.letters;
      if (!set) continue;
      try { letterSets[set] = resolveLetters(expr, letterSets, name); }
      catch (e) { errors.push(`GAME.md line ${r.line} (letter set ${set}): ${e.message}`); }
    }
    if (!letterSets.ALL) errors.push('GAME.md: the letter sets need an "ALL" row (every letter the game may use)');
  }

  // ---- Name Train words: each word's syllables (the finale claps them) and whose it is ("pociąg Zosi") ----
  const nameWords = {};
  const wordsAt = lines.findIndex((l) => /^#{2,4}\s+Name Train words/i.test(l));
  for (const r of (wordsAt < 0 ? null : tableAfter(lines, wordsAt))?.rows || []) {
    const word = (r.cells.Word || r.cells.word || '').toUpperCase();
    const syllables = (r.cells.syllables || '').toUpperCase().split('-').map((s) => s.trim()).filter(Boolean);
    const whose = r.cells.whose && !/^[—-]$/.test(r.cells.whose) ? r.cells.whose : null;
    if (syllables.join('') !== word) errors.push(`GAME.md line ${r.line} (Name Train words): the syllables "${r.cells.syllables}" must spell ${word}`);
    nameWords[word] = { syllables, whose };
  }

  // ---- missions ----
  const levels = {}, missions = {};
  lines.forEach((l, i) => {
    const m = l.match(/^###\s+(.*?)\s*·\s*`?([a-z]+)`?\s*$/i);
    if (!m) return;
    const [, title, kind] = m;
    const schema = SCHEMA[kind];
    if (!schema) { errors.push(`GAME.md line ${i + 1}: unknown mission "${kind}" (known: ${Object.keys(SCHEMA).join(', ')})`); return; }
    const t = tableAfter(lines, i);
    if (!t || !t.rows.length) { errors.push(`GAME.md line ${i + 1}: ${title} has no level table`); return; }
    missions[kind] = { title: title.replace(/^[^\p{L}]+/u, '').trim() };
    const cols = t.header.filter((h) => !/^level$/i.test(h));
    for (const c of cols) if (!schema[c]) errors.push(`GAME.md line ${t.line}: ${title} has an unknown column "${c}" (allowed: ${Object.keys(schema).join(', ')})`);
    levels[kind] = t.rows.map((r, idx) => {
      const where = `GAME.md line ${r.line} (${title}, level ${idx + 1})`;
      const lvl = Number(r.cells.Level ?? r.cells.level);
      if (lvl !== idx + 1) errors.push(`${where}: levels must be numbered 1, 2, 3… in order (found "${r.cells.Level ?? r.cells.level}")`);
      const out = {};
      for (const [key, spec] of Object.entries(schema)) {
        const raw = r.cells[key];
        if (raw === undefined || raw === '' || raw === '—' || raw === '-') {
          if (spec.optional) { if (spec.default !== undefined) out[key] = spec.default; continue; }
          errors.push(`${where}: missing "${key}"`);
          continue;
        }
        try { out[key] = value(raw, spec, { letterSets, name }); }
        catch (e) { errors.push(`${where}: ${key} ${e.message}`); }
      }
      crossCheck(kind, out, where, errors, { nameWords });
      return out;
    });
  });
  for (const k of Object.keys(SCHEMA)) if (!levels[k]) errors.push(`GAME.md: no level table for mission "${k}"`);
  return { levels, letterSets, missions, errors };
}

function value(raw, spec, ctx) {
  const v = raw.trim();
  switch (spec.type) {
    case 'int': {
      const n = Number(v);
      if (!Number.isInteger(n)) throw new Error(`must be a whole number (got "${v}")`);
      if (n < spec.min || n > spec.max) throw new Error(`must be ${spec.min}–${spec.max} (got ${n})`);
      return n;
    }
    case 'bool':
      if (/^(yes|tak|true|✓)$/i.test(v)) return true;
      if (/^(no|nie|false|✗)$/i.test(v)) return false;
      throw new Error(`must be yes or no (got "${v}")`);
    case 'enum':
      if (!spec.values.includes(v)) throw new Error(`must be one of: ${spec.values.join(', ')} (got "${v}")`);
      return v;
    case 'list': {
      const items = v.split(/\s*[,+]\s*/).filter(Boolean);
      for (const it of items) if (!spec.values.includes(it)) throw new Error(`"${it}" is not one of: ${spec.values.join(', ')}`);
      if (!items.length) throw new Error('needs at least one value');
      return items;
    }
    case 'range': {
      const m = v.match(/^(\d+(?:[.,]\d+)?)\s*(?:–|-|—|to|\.\.)\s*(\d+(?:[.,]\d+)?)$/);
      if (!m) throw new Error(`must be a range like 1–3 (got "${v}")`);
      const a = Number(m[1].replace(',', '.')), b = Number(m[2].replace(',', '.'));
      if (!spec.float && (!Number.isInteger(a) || !Number.isInteger(b))) throw new Error(`must use whole numbers (got "${v}")`);
      if (a > b) throw new Error(`goes backwards (${v})`);
      if (a < spec.min || b > spec.max) throw new Error(`must stay within ${spec.min}–${spec.max} (got ${v})`);
      return [a, b];
    }
    case 'needs': return parseNeeds(v);
    case 'letters': {
      const s = resolveLetters(v, ctx.letterSets, ctx.name);
      if (s.length < 2) throw new Error(`needs at least 2 letters (got "${s}")`);
      return s;
    }
    case 'words': {
      const words = v.split(/\s*,\s*/).filter(Boolean).map((w) => (/^\{name\}$/i.test(w) ? ctx.name : w.toUpperCase()));
      for (const w of words) {
        if (!/^[A-Z]+$/.test(w)) throw new Error(`"${w}" must be plain letters A–Z`);
        if (w.length < spec.minLen || w.length > spec.maxLen) throw new Error(`"${w}" must be ${spec.minLen}–${spec.maxLen} letters long`);
        const missing = [...w].filter((c) => !((ctx.letterSets.ALL || '') + (spec.extra || '')).includes(c));
        if (missing.length) throw new Error(`"${w}" uses letters not in the ALL set${spec.extra ? ` (or ${spec.extra})` : ''}: ${[...new Set(missing)].join('')}`);
      }
      if (!words.length) throw new Error('needs at least one word');
      return words;
    }
  }
  throw new Error('has an unknown type');
}

/** "START + EULDPKBW" → unique letters. Tokens: a set name, {name}, or literal capital letters. */
export function resolveLetters(expr, sets, name) {
  if (!expr) throw new Error('is empty');
  let out = '';
  for (const tok of expr.split('+').map((s) => s.trim()).filter(Boolean)) {
    if (/^\{name\}$/i.test(tok)) out += name;
    else if (sets[tok] !== undefined) out += sets[tok];
    else if (/^[A-Z]+$/.test(tok)) out += tok;
    else throw new Error(`"${tok}" is not a letter set name, {name}, or capital letters`);
  }
  return [...new Set(out)].join('');
}

function crossCheck(kind, s, where, errors, { nameWords = {} } = {}) {
  if (kind === 'balloons' && s.targets >= s.total) errors.push(`${where}: targets (${s.targets}) must be fewer than total (${s.total})`);
  if (kind === 'cones' && s.choices > s.max) errors.push(`${where}: choices (${s.choices}) can't be more than max (${s.max})`);
  if (kind === 'cones' && s.bubble === 'name' && s.sign === 'numeral') errors.push(`${where}: bubble "name" asks "which cone has N dots?", so the signs need dots (sign: dots or both)`);
  if (kind === 'cones' && s.bubble === 'dots' && s.sign === 'dots') errors.push(`${where}: bubble "dots" asks for the numeral, so the signs need numerals (sign: numeral or both)`);
  if (kind === 'cones' && s.dots === 'dice' && s.max > 6) errors.push(`${where}: dice patterns go up to 6, so numbers up to ${s.max} need dots in rows of five (dots: line)`);
  if (kind === 'cones' && s.count && s.sign === 'numeral') errors.push(`${where}: count "yes" lights the sign's dots as they are counted, so the signs need dots (sign: dots or both)`);
  if (kind === 'letters' && s.pool && s.choices > s.pool.length) errors.push(`${where}: choices (${s.choices}) can't be more than the letters in pool (${s.pool.length})`);
  if (kind === 'delivery' && s.pool && s.choices > s.pool.length) errors.push(`${where}: choices (${s.choices}) can't be more than the letters in pool (${s.pool.length})`);
  if (kind === 'name') {
    s.mode ||= s.ghost ? 'ghost' : s.bubble === 'word' ? 'highlight' : 'ghost'; // (older tables used ghost + bubble)
    const short = s.mode === 'missing' ? (s.words || []).filter((w) => w.length <= s.gaps) : [];
    if (short.length) errors.push(`${where}: with ${s.gaps} missing letter(s), every word needs more letters than that (${short.join(', ')})`);
    // what the mission needs to know about its words, keyed by word
    const words = s.words || [];
    const unknown = words.filter((w) => !nameWords[w]);
    if (unknown.length) errors.push(`${where}: add ${unknown.join(', ')} to the "Name Train words" table (syllables, and whose it is for names)`);
    s.syllables = Object.fromEntries(words.filter((w) => nameWords[w]).map((w) => [w, nameWords[w].syllables]));
    s.whose = Object.fromEntries(words.filter((w) => nameWords[w]?.whose).map((w) => [w, nameWords[w].whose]));
    if (s.mode === 'whose' && Object.keys(s.whose).length < 3) errors.push(`${where}: "whose" asks for three different trains, so it needs at least 3 words with a "whose" form (got ${Object.keys(s.whose).join(', ') || 'none'})`);
  }
  if (kind === 'letters') {
    s.ask ||= s.show === 'picture' ? 'word' : 'name'; // (older tables used "show")
    const odd = s.ask === 'sound' ? [...(s.pool || '')].filter((c) => !SOUNDABLE.includes(c)) : [];
    if (odd.length) errors.push(`${where}: ask "sound" only works for letters you can hold (${SOUNDABLE}); not ${odd.join('')}`);
  }
  if (kind === 'lookout' && s.mode === 'relative' && s.max < 3) errors.push(`${where}: "relative" needs at least 3 floors`);
  if (kind === 'lookout' && s.mode === 'relative' && s.rounds < 2) errors.push(`${where}: "relative" needs at least 2 rounds (the first trip is a normal one)`);
  if (kind === 'lookout' && (s.mode === 'pickup' || s.mode === 'find') && s.rounds >= s.max) errors.push(`${where}: "${s.mode}" needs more floors than rounds (a kitten waits on a different floor each time)`);
  if (kind === 'lookout' && s.mode === 'dice' && !s.dice) errors.push(`${where}: "dice" needs a dice range, like 1–2 (how many floors up the die can say)`);
  if (kind === 'lookout' && s.mode === 'dice' && s.dice && s.max < s.rounds * s.dice[0]) errors.push(`${where}: "dice" rides only go up: ${s.rounds} rides of at least ${s.dice[0]} floor(s) need ${s.rounds * s.dice[0]}+ floors`);
  if (kind === 'stones' && s.bubble === 'missing' && (s.n < 3 || s.n > 9)) errors.push(`${where}: "missing" needs 3–9 stones (got ${s.n})`);
  if (kind === 'stones' && s.bubble !== 'missing' && s.n > 7) errors.push(`${where}: a river of rows fits at most 7 stones (got ${s.n})`);
  if (kind === 'counting') {
    for (const t of ['howMany', 'share', 'hidden', 'flash']) if (s.types?.includes(t) && !s[t]) errors.push(`${where}: types includes ${t}, so set a ${t} range`);
    const unseen = (s.types || []).filter((t) => t === 'hidden' || t === 'flash');
    if (unseen.length && s.auto) errors.push(`${where}: ${unseen.join(' and ')} need auto "no" (she decides when Chase has the same, then taps him)`);
    if (s.types && !s.types.some((t) => ['howMany', 'flash', 'hidden'].includes(t))) errors.push(`${where}: needs a howMany, flash or hidden round (give with auto and share don't count towards levelling, and a gentler run turns auto on)`);
    if (s.types && s.rounds < s.types.length) errors.push(`${where}: every kind of round comes up each time, so rounds must be at least ${s.types.length}`);
  }
  if (kind === 'garage') for (const m of s.modes || []) if (!s[m]) errors.push(`${where}: modes includes ${m}, so set the ${m} column`);
}
