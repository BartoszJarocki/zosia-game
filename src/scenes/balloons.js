import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { makeBalloon, mesh, sphere, mat } from '../models.js';
import { makeBush, makeTree } from '../world/nature.js';
import { makeWindmill, makeFence } from '../world/props.js';
import { sparkle } from '../fx/particles.js';
import { labelTexture, TILE_COLORS } from '../textures.js';
import { letterName, showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle, pick } from '../util.js';
import { T } from '../lang/pl.js';
import { distractors } from '../levels.js';
import { Mission } from './mission.js';

const TOP = 10.5, BOTTOM = 1.3;

// "Balloon Hill": pop every balloon with the target letter (and count them!).
//  Levels: more balloons, faster, lookalike letters at L3.
export class BalloonsMission extends Mission {
  constructor(game) {
    super(game, 'balloons');
    this.view = { pos: new THREE.Vector3(0, 3.8, 13), look: new THREE.Vector3(0, 3.9, 0), minWidth: 14.5 };
    this.post = { tilt: 0.3, focus: 0.5, band: 0.3 };
  }

  build() {
    this.meadow({ clear: [[0, 0, 7]], groundColor: '#62c254' });
    this.addHeroes(new THREE.Vector3(-5.8, 0, 2.4), 0.55, new THREE.Vector3(5.8, 0, 2.2), -0.55);
    const mill = makeWindmill();
    mill.position.set(9, 0, -9);
    mill.rotation.y = -0.5;
    mill.scale.setScalar(1.6);
    this.scene.add(mill);
    const fence = makeFence(8, '#e7d3b0');
    fence.position.set(-8, 0, -5);
    fence.rotation.y = 0.4;
    this.scene.add(fence);
    for (let i = 0; i < 4; i++) { const b = makeBush({ seed: i * 5 + 2 }); b.position.set(-9 + i * 1.8, 0, -3.5 - i * 0.4); this.scene.add(b); }
    this.balloons = [];
    this.speedK = 1; // help slows them down
    this.onUpdate((dt, t) => {
      for (const b of this.balloons) {
        const d = b.userData;
        b.position.y += d.speed * this.speedK * dt;
        b.position.x = d.x0 + Math.sin(t * 0.8 + d.phase) * 0.35;
        b.rotation.z = Math.sin(t * 1.1 + d.phase) * 0.08;
        if (b.position.y > TOP) { b.position.y = BOTTOM; d.inflate = 0; } // float back around so nothing is missed
        if (d.inflate < 1) { d.inflate = Math.min(1, d.inflate + dt * 1.6); b.scale.setScalar(ease.back(d.inflate)); }
      }
    });
  }

  round() {
    return new Promise((resolve) => {
      const pool = [...this.L.pool];
      const target = this.pick('letterVisual', pool);
      this.last = target;
      this.item('L:' + target);
      const nOthers = this.L.total - this.L.targets;
      const set = distractors(target, pool, Math.min(pool.length - 1, nOthers), this.L.similar);
      const letters = shuffle([
        ...Array(this.L.targets).fill(target),
        ...Array.from({ length: nOthers }, (_, i) => set[i % set.length] || pick(set)),
      ]);
      const n = letters.length;
      const lanes = shuffle(letters.map((_, i) => -5.8 + (11.6 * (i + 0.5)) / n));
      const colors = shuffle(TILE_COLORS);
      const [lo, hi] = this.L.speed;
      let popped = 0, done = false, lastWrong = null;
      this.speedK = 1;

      this.balloons = letters.map((letter, i) => {
        const b = makeBalloon(colors[i % colors.length], labelTexture(showLetter(letter)));
        b.userData.letter = letter;
        b.userData.x0 = lanes[i];
        b.userData.speed = lo + Math.random() * (hi - lo);
        b.userData.phase = Math.random() * 6;
        b.userData.tapHeight = 0;
        b.userData.inflate = 0;
        // start spread out: some already in view, some still coming up
        b.position.set(lanes[i], BOTTOM + (i % 3) * 2.4 + Math.random(), -0.6 + Math.random() * 1.2);
        this.scene.add(b);
        this.tappable(b, () => tap(b));
        return b;
      });

      const tap = async (b) => {
        if (done || b.userData.popped) return;
        this.poke();
        this.lookAt(b);
        if (b.userData.letter === target) {
          b.userData.popped = true;
          this.untap(b);
          this.balloons = this.balloons.filter((x) => x !== b);
          this.pop(b);
          popped++;
          this.correct(target);
          if (popped < this.L.targets) this.question('letterVisual', target, hooks); // next balloon with the same letter
          if (popped < this.L.targets) {
            say([...this.yes(), ...T.number(popped)]);
            return;
          }
          done = true;
          this.stopIdle();
          sfx.good();
          this.success(null, { big: true });
          await say([...this.yes(), ...T.number(popped), ...T.balloonDone(target)]);
          if (!this.alive) return;
          // the rest float away
          const rest = this.balloons;
          this.balloons = [];
          rest.forEach((x) => this.untap(x));
          await Promise.all(rest.map((x) => {
            const y0 = x.position.y;
            return animate(900, (t) => { x.position.y = y0 + t * 12; }, ease.in).then(() => x.removeFromParent());
          }));
          resolve();
        } else {
          lastWrong = b;
          this.wrong(b.userData.letter, { obj: b.userData.body, said: this.lookalikeNo(target, b.userData.letter) });
        }
      };

      // a wrong balloon drifts off up into the sky
      const floatAway = (b) => {
        if (!b || b.userData.popped) return;
        b.userData.popped = true;
        this.untap(b);
        this.balloons = this.balloons.filter((x) => x !== b);
        sfx.whoosh();
        const y0 = b.position.y;
        animate(1100, (t) => { b.position.y = y0 + t * 12; }, ease.in).then(() => b.removeFromParent());
      };
      const hooks = {
        short: T.findLetter(target),
        hint: () => { this.speedK = 0.5; return T.letterLike(target); },
        simplify: () => floatAway(lastWrong?.parent ? lastWrong : this.balloons.find((x) => x.userData.letter !== target)),
        reveal: () => this.balloons.filter((x) => x.userData.letter === target).forEach((x) => this.hint(x, () => done || x.userData.popped, x.userData.body)),
      };
      this.question('letterVisual', target, hooks); // one question per balloon to find

      ui.bubble({ big: showLetter(target), pic: '🎈', onTap: () => this.replay(), passthrough: true }); // balloons float up behind it
      wait(500).then(() => {
        if (this.alive) this.ask(T.balloonAsk(target));
      });
    });
  }

  pop(b) {
    sfx.balloonPop();
    const at = b.getWorldPosition(new THREE.Vector3());
    b.removeFromParent();
    sparkle(this, at, { count: 12, size: 0.13 });
    // burst of rubber bits
    const m = mat(b.userData.color, { roughness: 0.3 });
    for (let i = 0; i < 14; i++) {
      const p = mesh(sphere(0.09, 6), m, { shadow: false });
      p.position.copy(at);
      this.scene.add(p);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 1.5);
      animate(550, (t) => {
        p.position.copy(at).addScaledVector(dir, t);
        p.position.y -= t * t * 1.5;
        p.scale.setScalar(Math.max(0.01, 1 - t));
      }, ease.out).then(() => p.removeFromParent());
    }
    this.cheer(0.8);
    this.girl?.userData.setHappy(1);
  }
}
