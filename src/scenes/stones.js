import * as THREE from 'three';
import { animate, ease, wiggle, hop, wait } from '../engine.js';
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

const START = new THREE.Vector3(0, 0, 5.6);
const FAR = new THREE.Vector3(4.5, 0, -5.9);

// "River": tap the stones 1, 2, 3... so Zosia can hop across to Chase.
//  L1 1–3 · L2 1–5 · L3 1–7 and the bubble only says "3 → ?": she has to know what comes next.
export class StonesMission extends Mission {
  constructor(game) {
    super(game, 'stones');
    this.rounds = this.L.rounds;
    this.view = { pos: new THREE.Vector3(0, 12.5, 10.5), look: new THREE.Vector3(0, 0, 0.3), minWidth: 16 };
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
    for (let i = 0; i < 10; i++) {
      const r = makeReeds();
      const side = i % 2 ? 1 : -1;
      r.position.set(-13 + i * 2.8, 0, side > 0 ? 3.7 : -4.5);
      this.scene.add(r);
      if (i % 3 === 0) { const k = makeRock({ scale: 0.5 + Math.random() * 0.5, seed: i }); k.position.set(r.position.x + 1, 0, r.position.z + (side > 0 ? 0.6 : -0.6)); this.scene.add(k); }
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
    return new Promise((resolve) => {
      const n = this.L.n;
      // random spots on a grid over the river so the order isn't obvious
      const cells = [];
      for (const z of [2.3, -0.4, -3.1]) for (const x of [-6, -3, 0, 3, 6]) {
        if (z < -3 && x === 0) continue; // that spot sits under the speech bubble
        cells.push([x + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.5]);
      }
      const spots = shuffle(cells).slice(0, n);
      const colors = shuffle(TILE_COLORS);
      const stones = spots.map(([x, z], i) => {
        const num = i + 1;
        const s = makeStone(discTexture(String(num), colors[i % colors.length]));
        s.position.set(x, 0.18, z);
        s.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.4; // numbers upright from the camera
        s.userData.num = num;
        s.userData.tapHeight = 0;
        s.userData.tick = (dt, t) => (s.position.y = 0.18 + Math.sin(t * 1.6 + i) * 0.025);
        this.scene.add(s);
        this.dropIn(s, 0.18, 150 + i * 110, 650).then(() => { sfx.splash(); this.collect(s); });
        return s;
      });
      let next = 1, busy = false, revealed = false;
      this.last = next;
      const nextMode = this.L.bubble === 'next';
      const seqBubble = () => nextMode && next > 1 && !revealed; // only "what comes next?" on screen
      const showNumber = () => { // help: tell her the number
        revealed = true;
        ui.bubble({ big: String(next), dots: next, onTap: () => this.replay() });
        this.prompt = T.riverNext(next);
      };
      const hooks = {
        short: () => (seqBubble() ? T.riverWhatNext() : next === 1 ? T.whereNumber(1) : T.riverNext(next)),
        hint: () => { if (seqBubble()) { showNumber(); return T.riverNext(next); } return T.dots(next); },
        simplify: () => { if (seqBubble()) showNumber(); },
        reveal: () => { const right = stones.find((x) => x.userData.num === next), want = next; if (right) this.hint(right, () => next !== want); },
      };
      this.question('numeral', 1, hooks); // open now: stones can be tapped before the question is spoken

      const askNext = () => {
        // "what comes next?" (after the first stone, until help shows it) tests order; otherwise the numeral
        this.question(nextMode && next > 1 ? 'sequence' : 'numeral', next, hooks);
        if (!seqBubble()) {
          ui.bubble({ big: String(next), dots: next, pic: next === 1 ? '🪨' : '', onTap: () => this.replay() });
          if (next === 1) this.ask(r === 0 ? (nextMode ? T.riverFirstNext() : T.riverFirst()) : T.riverAgain());
          else this.ask(T.riverNext(next));
        } else {
          ui.bubble({ seq: [next - 1], onTap: () => this.replay() });
          this.ask(T.riverWhatNext());
        }
      };

      stones.forEach((s) => this.tappable(s, async () => {
        if (busy) return;
        this.poke();
        this.lookAt(s);
        if (s.userData.num === next) {
          busy = true;
          this.correct(s.userData.num);
          revealed = false;
          this.untap(s);
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
          await say(T.number(next)); // hear the number she landed on before the next question
          if (!this.alive) return;
          next++;
          this.last = next;
          if (next > n) {
            this.stopIdle();
            await wait(500);
            if (!this.alive) return;
            // final jump to the far bank
            const land = FAR.clone().add(new THREE.Vector3(-1.2, 0, 0.6));
            this.face(land);
            this.walking = true;
            await this.jumpTo(this.girl, land, { height: 1.6, ms: 560 });
            this.walking = false;
            dust(this, land, { count: 5 });
            this.girl.rotation.y = 0.4;
            sfx.good();
            this.success(land.clone().add(new THREE.Vector3(0, 1.5, 0)), { big: true });
            ui.hideBubble();
            await say([...T.riverDone(n), this.praise()]);
            if (!this.alive) return;
            await Promise.all(stones.map((x) => this.shrinkAway(x, 300)));
            // big leap back for the next river
            this.face(START);
            this.walking = true;
            await this.jumpTo(this.girl, START.clone(), { height: 4, ms: 900 });
            this.walking = false;
            dust(this, START, { count: 5 });
            this.girl.rotation.y = Math.PI;
            resolve();
          } else {
            busy = false;
            askNext();
          }
        } else {
          this.wrong(s.userData.num, T.thatsNumber(s.userData.num));
          sfx.oops();
          wiggle(s);
        }
      }));

      wait(900).then(() => { if (this.alive) askNext(); });
    });
  }

  face(p) {
    const d = p.clone().sub(this.girl.position);
    this.girl.rotation.y = Math.atan2(d.x, d.z);
  }
}
