// attention-sim.mjs: feeds the game's own tiredness module with a fresh child's answers (verification tooling)
import { attention } from '../../src/session/attention.js';
import { createSession, noteEvent, noteReplay } from '../../src/session/director.js';
const run = (name, steps) => {
  const s = createSession(0);
  const out = [];
  for (const st of steps) {
    for (let i = 0; i < (st.replays || 0); i++) noteReplay(s);
    const mission = { kitty: 'letters', treats: 'counting' }[st.label];
    for (let i = 0; i < (st.timeouts || 0); i++) noteEvent(s, { mission, correct: false, errorType: 'timeout' });
    for (let i = 0; i < (st.overTaps || 0); i++) noteEvent(s, { mission, correct: false, errorType: 'overTap' });
    noteEvent(s, { mission, correct: true, latencyMs: st.ms, assistLevel: st.assist || 0 });
    const a = attention(s, { tired: 0.6, finish: 0.35 });
    out.push(`${st.label}:${a.score}${a.state === 'ok' ? '' : ' ' + a.state.toUpperCase()}`);
  }
  console.log(`${name}\n  ${out.join('  ')}`);
};
const quick = (label, n, ms) => Array.from({ length: n }, () => ({ label, ms }));
// 1. a fresh, happy child: Kitty Park (quick taps), then Treat House where every answer is many taps
run('Kitty Park then Treat House, no mistakes at all', [...quick('kitty', 4, 1500), ...quick('treats', 5, 9000)]);
// 2. the same, and she likes tapping the bubble to hear it again
run('same, plus one bubble tap per Treat House round', [...quick('kitty', 4, 1500), ...Array.from({ length: 5 }, () => ({ label: 'treats', ms: 9000, replays: 1 }))]);
// 3. the same, and she looks away once (17 s quiet = one timeout)
run('same, plus she looks away once', [...quick('kitty', 4, 1500), ...Array.from({ length: 5 }, (_, i) => ({ label: 'treats', ms: 9000, timeouts: i === 2 ? 1 : 0, assist: i === 2 ? 2 : 0 }))]);
// 4. excited fast tapping on a hard level (wrong bursts), slow multi-tap answers
run('excited: bursts of taps on two questions, one look away', [...quick('kitty', 4, 1500), ...Array.from({ length: 5 }, (_, i) => ({ label: 'treats', ms: 9000, overTaps: i % 2 ? 2 : 0, timeouts: i === 4 ? 1 : 0, assist: i % 2 ? 2 : 0 }))]);
// 5. distracted: looks away on three questions, needs the clue
run('distracted: looks away three times, gets the clue', [...quick('kitty', 4, 1500), ...Array.from({ length: 5 }, (_, i) => ({ label: 'treats', ms: 9000, timeouts: i < 3 ? 1 : 0, assist: i < 3 ? 3 : 0 }))]);
