"""One-shot migration to the clear yes / clear no reaction (feel-pass, unit 2).

Every wrong-tap call site used to say what she tapped, play sfx.oops and wiggle the object itself.
Now Mission.wrong(chosen, { obj }) owns the whole reaction. Each replacement must match exactly once.
Run from the repo root: python3 tools/codemods/clear-yes-no.py
"""
import re

def edit(path, pairs):
    s = open(path).read()
    for old, new in pairs:
        n = s.count(old)
        assert n == 1, f"{path}: expected 1 match, found {n}: {old[:70]!r}"
        s = s.replace(old, new)
    open(path, 'w').write(s)

def drop_import(path, name):
    s = open(path).read()
    s2 = re.sub(r"(import \{[^}]*?)\b" + name + r", ", r"\1", s, count=1)
    if s2 == s:
        s2 = re.sub(r"(import \{[^}]*?), " + name + r"\b", r"\1", s, count=1)
    assert s2 != s, f"{path}: no import of {name}"
    open(path, 'w').write(s2)

S = 'src/scenes/'

# ---- wrong taps ----
edit(S + 'letters.js', [(
"""            this.wrong(letter, T.thatsLetter(letter));
            sfx.oops();
            wiggle(b);""",
"""            this.wrong(letter, { obj: b, said: this.lookalikeNo(target, letter) });""")])
edit(S + 'balloons.js', [(
"""          this.wrong(b.userData.letter, T.thatsLetter(b.userData.letter));
          sfx.oops();
          animate(450, (t) => { b.userData.body.scale.set(1 + Math.sin(t * Math.PI * 4) * 0.08 * (1 - t), 1.18, 1); }, ease.linear);""",
"""          this.wrong(b.userData.letter, { obj: b.userData.body, said: this.lookalikeNo(target, b.userData.letter) });""")])
edit(S + 'name.js', [(
"""          this.wrong(b.userData.letter, T.thatsLetter(b.userData.letter));
          sfx.oops();
          wiggle(b);""",
"""          this.wrong(b.userData.letter, { obj: b, said: this.lookalikeNo(target, b.userData.letter) });""")])
edit(S + 'cones.js', [(
"""            this.wrong(num, T.thatsNumber(num));
            sfx.oops();
            wiggle(c);""",
"""            this.wrong(num, { obj: c });""")])
edit(S + 'stones.js', [(
"""          this.wrong(s.userData.num, T.thatsNumber(s.userData.num));
          sfx.oops();
          wiggle(s);""",
"""          this.wrong(s.userData.num, { obj: s });"""), (
"""            this.wrong(st.userData.num, T.thatsNumber(st.userData.num));
            sfx.oops();
            this.jumpTo(st, st.userData.home, { height: 0.6, ms: 350 }).then(() => wiggle(st));""",
"""            this.wrong(st.userData.num);
            this.jumpTo(st, st.userData.home, { height: 0.6, ms: 350 }).then(() => shakeNo(st));""")])
edit(S + 'counting.js', [(
"""          this.wrong(count(), [], { feedback: false }); // gave the wrong number of treats: answered below
          sfx.oops();
          wiggle(this.pup);""",
"""          this.wrong(count(), { feedback: false }); // gave the wrong number of treats: answered below"""), (
"""            this.wrong(num, T.thatsNumber(num));
            sfx.oops();
            wiggle(b);""",
"""            this.wrong(num, { obj: b });""")])
edit(S + 'lookout.js', [(
"""          this.wrong(f, T.thatsNumber(f));
          sfx.oops();
          this.panel.nope(f);""",
"""          this.wrong(f);
          this.panel.nope(f);""")])
edit(S + 'delivery.js', [(
"""            this.wrong(l, T.thatsWord(l)); // "To jest banan."
            sfx.oops();
            wiggle(p);""",
"""            this.wrong(l, { obj: p });"""), (
"""          this.wrong(b.userData.letter, T.thatsLetter(b.userData.letter));
          sfx.oops();
          wiggle(b);""",
"""          this.wrong(b.userData.letter, { obj: b });""")])
edit(S + 'picnic.js', [(
"""          this.wrong(item + ':' + counts[i], more ? T.hereMore() : T.hereLess());
          sfx.oops();
          groups[i].forEach((x) => wiggle(x));""",
"""          this.wrong(item + ':' + counts[i], { said: more ? T.noMore() : T.noLess() });
          groups[i].forEach((x) => shakeNo(x));""")])

# ---- right steps: a chime and "Tak!" before what it was ----
edit(S + 'stones.js', [(
"""          await say(T.number(next)); // hear the number she landed on before the next question""",
"""          await say([...this.yes(), ...T.number(next)]); // hear the number she landed on before the next question"""), (
"""        await say(T.number(missing));""",
"""        await say([...this.yes(), ...T.number(missing)]);""")])
edit(S + 'balloons.js', [(
"""            say(T.number(popped));""",
"""            say([...this.yes(), ...T.number(popped)]);"""), (
"""          await say([...T.number(popped), ...T.balloonDone(target)]);""",
"""          await say([...this.yes(), ...T.number(popped), ...T.balloonDone(target)]);""")])
edit(S + 'name.js', [(
"""          if (this.mode !== 'ghost') this.bubbleFor(this.fill[r + 1] ?? -1);
          await say(T.letter(target));""",
"""          if (this.mode !== 'ghost') this.bubbleFor(this.fill[r + 1] ?? -1);
          await say([...this.yes(), ...T.letter(target)]);""")])

# ---- imports: wiggle is gone, two scenes now shake things themselves ----
for f in ['cones.js', 'delivery.js', 'counting.js']:
    drop_import(S + f, 'wiggle')
edit(S + 'picnic.js', [("import { animate, ease, wiggle, wait, hop } from '../engine.js';", "import { animate, ease, shakeNo, wait, hop } from '../engine.js';")])
s = open(S + 'stones.js').read()
m = re.search(r"import \{([^}]*)\} from '../engine.js';", s)
names = [n.strip() for n in m.group(1).split(',') if n.strip() and n.strip() != 'wiggle']
s = s.replace(m.group(0), "import { " + ', '.join(names + ['shakeNo']) + " } from '../engine.js';")
open(S + 'stones.js', 'w').write(s)
for f in ['letters.js', 'name.js']:
    s = open(S + f).read()
    if 'wiggle(' not in s.split('\n', 20)[-1] and s.count('wiggle(') == 0:
        drop_import(S + f, 'wiggle')
print('migrated')
