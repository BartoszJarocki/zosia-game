// Pre-records every line the game says with ElevenLabs.
//   npm run voices             -> record missing clips into public/voice/
//   npm run voices -- --list   -> just print the lines + character count
//   npm run voices -- --sample "Tekst"  -> record one test line to voice-samples/sample.mp3
//   npm run voices -- --redo "Teraz Ha" -> re-record lines containing that text
//   npm run voices -- --recheck      -> re-record any clip whose length looks wrong
// Needs ELEVENLABS_API_KEY in .env.local. The voice + model come from src/config.js.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.js';
import { allSegments } from '../src/lang/pl.js';
import { parseGame } from '../src/levels/parse.js';
import { clipKey } from '../src/voice-key.js';

const OUT = 'public/voice';
const SETTINGS = CONFIG.voiceSettings;
const LANG = CONFIG.voiceModel === 'eleven_multilingual_v2' ? {} : { language_code: 'pl' }; // force Polish where supported

function env() {
  const e = { ...process.env };
  if (fs.existsSync('.env.local')) {
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return e;
}
const KEY = env().ELEVENLABS_API_KEY;
const VOICE = env().ELEVENLABS_VOICE_ID || CONFIG.voiceId;
const MODEL = CONFIG.voiceModel;

async function tts(text, { model = MODEL, attempt = 1 } = {}) {
  const v2 = model === 'eleven_multilingual_v2';
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(v2
      ? { text, model_id: model, voice_settings: { stability: 0.65, similarity_boost: 0.8, style: 0.05, use_speaker_boost: true, speed: 0.85 } }
      : { text, model_id: model, voice_settings: SETTINGS, ...LANG }),
  });
  if (r.status === 429 && attempt < 6) { await new Promise((res) => setTimeout(res, 1500 * attempt)); return tts(text, { model, attempt: attempt + 1 }); }
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---- quality gate: v3 can clip or stretch very short lines, so check each take's length ----
const seconds = (buf) => (buf.length - 400) / 8000;                // mp3 at 64 kbps
const expected = (text) => 0.3 + text.length / 11;                 // ~11 chars/second, plus breath
const badness = (text, buf) => { const r = seconds(buf) / expected(text); return r < 0.62 ? 0.62 / r : r > 1.75 ? r / 1.75 : 1; };
async function goodTake(text) {
  let best = null, bestBad = Infinity;
  for (let i = 0; i < 5; i++) {
    const buf = await tts(text);
    const b = badness(text, buf);
    if (b < bestBad) { best = buf; bestBad = b; }
    if (b === 1) return { buf: best, tries: i + 1 };
  }
  if (!MODEL.startsWith('eleven_v3')) return { buf: best, tries: 5, off: true };
  const v2 = await tts(text, { model: 'eleven_multilingual_v2' }); // stable fallback, same voice
  return { buf: badness(text, v2) <= bestBad ? v2 : best, tries: 6, fallback: true };
}

const args = process.argv.slice(2);
const game = parseGame(fs.readFileSync('GAME.md', 'utf8'), { childName: CONFIG.childName });
if (game.errors.length) { console.error('GAME.md has problems (run npm run check):\n' + game.errors.join('\n')); process.exit(1); }
const segments = allSegments(game.levels, game.letterSets.ALL);
const chars = segments.reduce((n, s) => n + s.length, 0);

if (args[0] === '--list') {
  segments.forEach((s) => console.log(s));
  console.log(`\n${segments.length} clips, ${chars} characters`);
  process.exit(0);
}
if (!KEY) { console.error('Missing ELEVENLABS_API_KEY in .env.local'); process.exit(1); }
if (args[0] === '--sample') {
  fs.mkdirSync('voice-samples', { recursive: true });
  fs.writeFileSync('voice-samples/sample.mp3', await tts(args[1] || segments[0]));
  console.log('wrote voice-samples/sample.mp3');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const wanted = new Map(segments.map((s) => [clipKey(s, { ...CONFIG, voiceId: VOICE }), s]));
const recheck = args.includes('--recheck'); // also re-record existing clips that fail the length check
// --redo "Teraz Ha!"  → throw away that line's clip(s) (substring match) and record a fresh take
const redo = args.includes('--redo') ? args[args.indexOf('--redo') + 1] : null;
if (redo) for (const [k, t] of wanted) if (t.includes(redo)) { fs.rmSync(path.join(OUT, `${k}.mp3`), { force: true }); console.log(`re-recording: "${t}"`); }
const todo = [...wanted].filter(([k, t]) => {
  const f = path.join(OUT, `${k}.mp3`);
  if (!fs.existsSync(f)) return true;
  return recheck && badness(t, fs.readFileSync(f)) > 1;
});
const todoChars = todo.reduce((n, [, s]) => n + s.length, 0);
console.log(`${segments.length} lines (${chars} chars). To record: ${todo.length} (${todoChars} chars). Voice ${VOICE}, model ${MODEL}.`);

let done = 0, failed = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const [k, text] = queue.shift();
    try {
      const take = await goodTake(text);
      fs.writeFileSync(path.join(OUT, `${k}.mp3`), take.buf);
      if (take.tries > 1) console.log(`\n  "${text}": ${take.tries} takes${take.fallback ? ' (v2 fallback)' : ''}`);
      done++;
      process.stdout.write(`\r  recorded ${done}/${todo.length}`);
    } catch (e) {
      failed++;
      console.error(`\n  FAILED "${text}": ${e.message.slice(0, 200)}`);
      if (/quota|401|unauthorized/i.test(e.message)) queue.length = 0;
    }
  }
}));

// prune clips that are no longer used, write manifest of what exists
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.mp3') && !wanted.has(f.slice(0, -4))) fs.unlinkSync(path.join(OUT, f));
}
const have = [...wanted.keys()].filter((k) => fs.existsSync(path.join(OUT, `${k}.mp3`)));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ voice: VOICE, model: MODEL, clips: have }));
console.log(`\nDone: ${have.length}/${wanted.size} clips available${failed ? `, ${failed} failed` : ''}.`);
