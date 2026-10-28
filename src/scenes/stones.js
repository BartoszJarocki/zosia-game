import * as THREE from 'three';
import { animate, ease, hop, wait, shakeNo } from '../engine.js';
import { makeStone, mat, mesh } from '../models.js';
import { makeTree, makeRock, makeBush } from '../world/nature.js';
import { makeLilyPad, makeReeds } from '../world/props.js';
import { makeWater } from '../world/water.js';
import { dust, sparkle } from '../fx/particles.js';
import { discTexture, TILE_COLORS } from '../textures.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { Mission } from './mission.js';
import { riverRows, missingFoil, KEEP_CLEAR, START as RIVER_START, LAND } from '../levels/river.js';

const START = new THREE.Vector3(RIVER_START.x, 0, RIVER_START.z);
const FAR = new THREE.Vector3(4.5, 0, -5.9);

// "River": tap the stones 1, 2, 3... so Zosia can hop across to Chase. The stones come up a row at a time, each
// row one hop nearer Chase (levels/river.js), so every hop goes forward and only the number says which stone.
//  numeral: the bubble shows the next number · next: only "3 → ?" (she has to know what comes next)
//  missing: the stones lie in order with one gap (1 → 2 → ? → 4); she puts the right stone in (drag it, or tap
//           it), then Zosia hops across by herself, counting — the crossing is the reward.
export class StonesMission extends Mission {
  constructor(game) {
    super(game, 'stones');
    this.rounds = this.L.rounds;
    this.view = { pos: new THREE.Vector3(0, 12.5, 10.5), look: new THREE.Vector3(0, 0, 0.3), minWidth: 16 };
    this.bubbleAt = 'left'; // the far bank and Chase stay in view
    this.post = { tilt: 0.3, focus: 0.5, band: 0.4 };
  }

  build() {
    this.meadow({ trees: false, flowers: true, clear: [[0, -0.4, 5.5], [-6, -0.4, 5], [6, -0.4, 5]], grassRadius: 18 });
    // river with two layers of flowing ripples
    const water = makeWater({ repeat: 5, flow: [0.06, 0.004], stops: [[0, '#1d8fd6'], [0.2, '#35b8ea'], [0.5, '#4cc9ef'], [0.8, '#35b8ea'], [1, '#1d8fd6']], scale: 0.7 });
    const river = mesh(new THREE.PlaneGeometry(70, 8.4), water.material, { rx: -Math.PI / 2, y: 0.04, z: -0.4, shadow: false });
    river.receiveShadow = true;
    river.userData.tick = water.update;
    this.scene.add(river);
    // muddy/sandy banks
    for (const z of [3.95, -4.75]) this.scene.add(mesh(new THREE.BoxGeometry(70, 0.12, 0.9), mat('#e9cf8b', { roughness: 1 }), { y: 0.05, z }));
    for (let i = 0; i < 9; i++) {
      const lp = makeLilyPad();
      lp.position.set(-14 + Math.random() * 28, 0, -3.5 + Math.random() * 6);
      if (Math.abs(lp.position.x) < 7.5) lp.position.x += Math.sign(lp.position.x || 1) * 7.5;
      lp.rotation.y = Math.random() * 6;
      lp.userData.tick = (dt, t) => (lp.position.y = Math.sin(t * 1.3 + i) * 0.02);
      this.scene.add(lp);
    }
    // reeds and rocks on both banks, but never in front of the first or the last row of stones
    for (const [bank, z, out] of [['near', 3.7, 0.6], ['far', -4.5, -0.6]]) {
      const [lo, hi] = KEEP_CLEAR[bank];
      for (let i = 0; i < 10; i++) {
        const x = -13 + i * 2.8;
        if (x + 0.5 > lo && x - 0.5 < hi) continue;
        const r = makeReeds();
        r.position.set(x, 0, z);
        this.scene.add(r);
        if (i % 3 === 0) { const k = makeRock({ scale: 0.5 + Math.random() * 0.5, seed: i }); k.position.set(x + Math.sign(x), 0, z + out); this.scene.add(k); }
      }
    }
    for (let x = -16; x <= 16; x += 3.2) {
      const t = makeTree({ scale: 1.1 + Math.random() * 0.5 });
      t.position.set(x + Math.random(), 0, -8.2 - Math.random() * 3);
      this.scene.add(t);
      if (Math.random() < 0.5) { const b = makeBush({ seed: Math.round(x * 3) }); b.position.set(x + 1.5, 0, -6.4); this.scene.add(b); }
    }
    // a fish jumps now and then
    this.fish();
    this.addHeroes(START.clone(), Math.PI, FAR.clone(), -0.3);
    this.girl.scale.setScalar(0.85);
  }

  fish() {
    const f = new THREE.Group();
    f.add(mesh(new THREE.SphereGeometry(0.25, 12, 8), mat('#fb923c', { roughness: 0.3 }), { s: [1.4, 0.8, 0.6] }));
    f.add(mesh(new THREE.ConeGeometry(0.2, 0.3, 4), mat('#f97316'), { x: -0.42, rz: Math.PI / 2 }));
    f.visible = false;
    this.scene.add(f);
    let next = 4, t0 = -1, x = 0, z = 0;
    f.userData.tick = (dt, t) => {
      if (t0 < 0 && t > next) { t0 = t; x = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 5); z = -3 + Math.random() * 5; f.visible = true; sfx.splash(); }
      if (t0 >= 0) {
        const k = (t - t0) / 1.1;
        f.position.set(x + k * 2.4, Math.sin(k * Math.PI) * 1.6, z);
        f.rotation.z = Math.cos(k * Math.PI) * 0.9;
        if (k >= 1) { f.visible = false; t0 = -1; next = t + 6 + Math.random() * 6; }
      }
    };
  }

  round(r) {
    if (this.L.bubble === 'missing') return this.missingRound(r);
    return new Promise((resolve) => {
      const n = this.L.n;
      // a row at a time, each one hop nearer Chase: the next number and the others side by side
      const { scale, rows } = riverRows({ n, choices: this.L.choices, foils: this.L.foils });
      const colors = shuffle(TILE_COLORS);
      const path = []; // the stones she has landed on
      let row = [];
      let next = 1, busy = false, revealed = false;
      this.last = next;
      const raise = (k) => {
        row = rows[k].stones.map((at, i) => {
          const s = makeStone(discTexture(String(at.num), colors[(k * 3 + i) % colors.length]));
          s.scale.setScalar(scale);
          s.position.set(at.x, 0.18, at.z);
          s.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.3; // numbers upright from the camera
          s.userData.num = at.num;
          s.userData.tapHeight = 0;
          s.userData.tick = (dt, t) => (s.position.y = 0.18 + Math.sin(t * 1.6 + k + i) * 0.025);
          this.scene.add(s);
          this.dropIn(s, 0.18, 120 + i * 110, 600).then(() => { sfx.splash(); this.collect(s); });
          this.tappable(s, onTap);
          return s;
        });
      };
      const nextMode = this.L.bubble === 'next';
      const seqBubble = () => nextMode && next > 1 && !revealed; // only "what comes next?" on screen
      const showNumber = () => { // help: tell her the number
        revealed = true;
        ui.bubble({ big: String(next), dots: next, onTap: () => this.replay() });
        this.prompt = T.riverNext(next);
      };
      const hooks = {
        short: () => (seqBubble() ? T.riverAfter(next - 1) : next === 1 ? T.whereNumber(1) : T.riverNext(next)), // ("Trzy… i co dalej?")
        hint: () => { if (seqBubble()) { showNumber(); return T.riverNext(next); } return T.dots(next); },
        simplify: () => { // "what comes next" shows the number; otherwise one of the other stones sinks
          if (seqBubble()) return showNumber();
          this.removeOption(row.find((x) => x.userData.num !== next && !x.userData.gone));
        },
        reveal: () => { const right = row.find((x) => x.userData.num === next), want = next; if (right) this.hint(right, () => next !== want); },
      };

      const askNext = () => {
        // "what comes next?" (after the first stone, until help shows it) tests order; otherwise the numeral
        this.question(nextMode && next > 1 ? 'sequence' : 'numeral', next, hooks, { options: this.L.choices });
        if (!seqBubble()) {
          ui.bubble({ big: String(next), dots: next, pic: next === 1 ? '🪨' : '', onTap: () => this.replay() });
          if (next === 1) this.ask(r === 0 ? (nextMode ? T.riverFirstNext() : T.riverFirst()) : T.riverAgain());
          else this.ask(T.riverNext(next));
        } else {
          ui.bubble({ seq: [next - 1], onTap: () => this.replay() });
          this.ask(next === 2 ? T.riverWhatNext() : T.riverOn(next)); // the whole question once a river, then just "A dalej?"
        }
      };

      const onTap = async (s) => {
        if (busy || !row.includes(s) || s.userData.gone) return;
        this.poke();
        this.lookAt(s);
        if (s.userData.num !== next) { this.wrong(s.userData.num, { obj: s }); return; }
        busy = true;
        this.correct(next);
        revealed = false;
        row.forEach((x) => this.untap(x));
        s.userData.top.emissive = new THREE.Color('#fde047');
        s.userData.top.emissiveIntensity = 0.35;
        const to = s.position.clone(); to.y = 0.4;
        this.face(to);
        this.walking = true;
        sfx.boing();
        await this.jumpTo(this.girl, to, { height: 1.4, ms: 480 });
        this.walking = false;
        sfx.splash();
        sparkle(this, to.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 10, size: 0.12, speed: 2 });
        this.girl.userData.setHappy(0.8);
        row.filter((x) => x !== s && x.parent).forEach((x) => this.shrinkAway(x, 300)); // the others sink: the way behind her is just her path
        path.push(s);
        await say([...this.yes(), ...T.number(next)]); // hear the number she landed on before the next question
        if (!this.alive) return;
        next++;
        this.last = next;
        if (next <= n) {
          raise(next - 1);
          busy = false;
          askNext();
          return;
        }
        this.stopIdle();
        await wait(500);
        if (!this.alive) return;
        await this.reachChase(n, path, r);
        resolve();
      };

      raise(0);
      this.question('numeral', 1, hooks, { options: this.L.choices }); // open now: the first stones can be tapped before the question is spoken
      wait(900).then(() => { if (this.alive && next === 1 && !busy) askNext(); }); // (unless she already tapped the 1)
    });
  }

  // ---------- the missing stone ----------
  missingRound(r) {
    return new Promise((resolve) => {
      const n = this.L.n;
      const missing = this.pick('sequence', Array.from({ length: n - 1 }, (_, i) => i + 2)); // any but the first
      this.last = missing;
      this.item('N:' + missing);
      const colors = shuffle(TILE_COLORS);
      // the path: in order from this bank to the far one, gently zigzagging
      const at = (i) => START.clone().lerp(FAR, (i + 1) / (n + 1)).add(new THREE.Vector3(i % 2 ? 0.7 : -0.7, 0.18, 0));
      const stones = [];
      for (let num = 1; num <= n; num++) {
        if (num === missing) continue;
        const s = makeStone(discTexture(String(num), colors[(num - 1) % colors.length]));
        s.position.copy(at(num - 1));
        s.rotation.y = Math.PI / 2;
        s.userData.num = num;
        this.scene.add(s);
        this.dropIn(s, 0.18, 150 + num * 110, 650).then(() => sfx.splash());
        stones[num - 1] = s;
      }
      // where it goes: a soft ring on the water
      const gapAt = at(missing - 1);
      const ring = mesh(new THREE.RingGeometry(0.7, 0.95, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }), { rx: -Math.PI / 2, shadow: false });
      ring.position.set(gapAt.x, 0.12, gapAt.z);
      this.scene.add(ring);
      const offRing = this.onUpdate((dt, t) => { ring.material.opacity = 0.35 + Math.sin(t * 4) * 0.25; ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05); });
      // two stones to choose from on this bank: the missing number and one that could almost fit (levels/river.js)
      const other = missingFoil(missing, n, this.L.foils);
      let solved = false, lastWrong = null;
      const choices = shuffle([missing, other]).map((num, i) => {
        const s = makeStone(discTexture(String(num), colors[(num + 3) % colors.length]));
        const home = new THREE.Vector3(i ? 2.6 : -2.6, 0.18, START.z - 0.2);
        s.position.copy(home);
        s.rotation.y = Math.PI / 2;
        s.userData.num = num;
        s.userData.tapHeight = 0;
        s.userData.home = home;
        this.scene.add(s);
        this.dropIn(s, 0.18, 300 + n * 110 + i * 150, 650).then(() => sfx.splash());
        const tryIt = (st) => {
          if (solved) return;
          this.poke();
          this.lookAt(st);
          if (st.userData.num === missing) place(st);
          else {
            lastWrong = st;
            this.wrong(st.userData.num);
            this.jumpTo(st, st.userData.home, { height: 0.6, ms: 350 }).then(() => shakeNo(st));
          }
        };
        this.draggable(s, {
          height: 0.18,
          onPick: () => { this.poke(); sfx.pop(); },
          onDrop: (st, p) => { if (p.distanceTo(gapAt.clone().setY(0.18)) > 1.8) return false; tryIt(st); return true; },
          onTap: tryIt, // (tap = try this one)
        });
        return s;
      });

      const place = async (st) => {
        solved = true;
        this.correct(missing);
        this.stopIdle();
        choices.forEach((c) => this.untap(c));
        sfx.good();
        await this.jumpTo(st, gapAt, { height: 1.2, ms: 450 });
        sfx.splash();
        offRing();
        ring.removeFromParent();
        stones[missing - 1] = st;
        this.success(gapAt.clone().add(new THREE.Vector3(0, 1, 0)));
        ui.bubble({ word: seq(true), at: cell(missing), done: cell(n + 1), onTap: () => {} });
        await say([...this.yes(), ...T.number(missing)]);
        const rest = choices.filter((c) => c !== st);
        rest.forEach((c) => this.shrinkAway(c, 300));
        if (!this.alive) return;
        // and across she goes, counting
        for (let i = 0; i < n; i++) {
          const to = stones[i].position.clone(); to.y = 0.4;
          this.face(to);
          this.walking = true;
          sfx.boing();
          await this.jumpTo(this.girl, to, { height: 1.2, ms: 420 });
          this.walking = false;
          sfx.splash();
          say(T.number(i + 1));
          if (!this.alive) return;
          await wait(260);
        }
        await this.reachChase(n, stones, r);
        resolve();
      };

      // "1 2 ? 4": the numbers with a gap between them (each character is one cell of the bubble's word)
      const seq = (lit) => Array.from({ length: n }, (_, i) => (i + 1 === missing && !lit ? '?' : String(i + 1))).join(' ');
      const cell = (num) => 2 * (num - 1);
      ui.bubble({ word: seq(false), at: cell(missing), onTap: () => this.replay() });
      const right = () => choices.find((c) => c.userData.num === missing);
      this.question('sequence', missing, {
        short: T.whichFits(),
        hint: () => { ui.bubble({ word: seq(true), at: cell(missing), onTap: () => this.replay() }); return T.whereNumber(missing); }, // the number shows in the gap
        simplify: () => { const w = lastWrong || choices.find((c) => c.userData.num !== missing); if (w) this.removeOption(w); },
        reveal: () => this.hint(right(), () => solved),
      }, { options: 2 });
      wait(900 + n * 110).then(() => { if (this.alive) this.ask(r === 0 ? T.riverMissing() : T.whichFits()); });
    });
  }

  /** The last hop, onto Chase's bank. Then a big leap back for the next river; after the last one she stays with him. */
  async reachChase(n, path, r) {
    const land = new THREE.Vector3(LAND.x, 0, LAND.z);
    this.face(land);
    this.walking = true;
    await this.jumpTo(this.girl, land, { height: 1.6, ms: 560 });
    this.walking = false;
    dust(this, land, { count: 5 });
    this.girl.rotation.y = 0.4;
    sfx.good();
    this.success(land.clone().add(new THREE.Vector3(0, 1.5, 0)), { big: true });
    ui.hideBubble();
    const last = r === this.rounds - 1;
    await say([...(last ? T.riverCounted(n) : T.riverDone(n)), this.praise()]); // (the badge says "Udało się!")
    if (!this.alive || last) return;
    await Promise.all(path.map((x) => this.shrinkAway(x, 300)));
    this.face(START);
    this.walking = true;
    await this.jumpTo(this.girl, START.clone(), { height: 4, ms: 900 });
    this.walking = false;
    dust(this, START, { count: 5 });
    this.girl.rotation.y = Math.PI;
  }

  face(p) {
    const d = p.clone().sub(this.girl.position);
    this.girl.rotation.y = Math.atan2(d.x, d.z);
  }
}
