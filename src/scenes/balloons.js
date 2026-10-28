import * as THREE from 'three';
import { animate, ease, wait, camera } from '../engine.js';
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

const BOTTOM = 1.3;
// Balloons rise in lanes 2.2 apart, so two side by side never touch, even swaying towards each other while they
// pop up (1.1 × 1.5 wide). Balloons sharing a lane rise at the same speed, GAP apart (a balloon is 1.77 tall).
const LANES = [-4.4, -2.2, 0, 2.2, 4.4], SWAY = 0.25, GAP = 2.1;

/** Where an element sits on screen, ignoring transforms (the bubble pops in with a scale animation). */
function box(el) {
  const o = el.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
  const left = o.left + el.offsetLeft, top = o.top + el.offsetTop;
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight + (el.classList.contains('bubble') ? 18 : 0) }; // (its tail)
}

// "Balloon Hill": pop every balloon with the target letter (and count them!).
//  Levels: other letters, more balloons, faster, lookalike letters.
export class BalloonsMission extends Mission {
  constructor(game) {
    super(game, 'balloons');
    this.view = { pos: new THREE.Vector3(0, 3.8, 13), look: new THREE.Vector3(0, 3.9, 0), minWidth: 14.5 };
    this.post = { tilt: 0.3, focus: 0.5, band: 0.3 };
    this.bubbleAt = 'left'; // the balloons rise in the middle
  }

  /**
   * How high a balloon in the lane at x rises before any of its top would go behind the speech bubble, the top
   * bar or off the screen. There it floats away, and comes back up from the bottom.
   */
  laneTop(x) {
    const keepOut = ['.bubble', '.topbar .home', '.paws', '.topbar .spacer .stars'].map((q) => document.querySelector(q)).filter((e) => e && !e.classList.contains('hidden')).map(box);
    const p = new THREE.Vector3();
    const hidden = (y) => [-1, 0, 1].some((side) => {
      p.set(x + side * (0.75 + SWAY), y + 0.95, 0).project(camera);
      const sx = ((p.x + 1) / 2) * innerWidth, sy = ((1 - p.y) / 2) * innerHeight;
      return sy < 12 || keepOut.some((r) => sx > r.left - 12 && sx < r.right + 12 && sy > r.top - 12 && sy < r.bottom + 12); // (the camera sways a little)
    });
    let y = BOTTOM + GAP / 2;
    while (y < 10.5 && !hidden(y + 0.1)) y += 0.1;
    return y;
  }

  /** Balloons rise; at the top of their lane they shrink away and come back up from the bottom, so nothing is missed. */
  rise(dt, t) {
    for (const b of this.balloons) {
      const d = b.userData;
      b.position.y += d.speed * this.speedK * dt;
      if (b.position.y > d.top) { b.position.y -= d.top - BOTTOM; d.inflate = 0; }
      b.position.x = d.x0 + Math.sin(t * 0.8 + d.phase) * SWAY;
      b.rotation.z = Math.sin(t * 1.1 + d.phase) * 0.08;
      d.inflate = Math.min(1, d.inflate + dt * 1.6);
      b.scale.setScalar(Math.max(0.001, ease.back(d.inflate) * Math.min(1, (d.top - b.position.y) / 0.6)));
    }
  }

  build() {
    this.meadow({ clear: [[0, 0, 7]], groundColor: '#62c254' });
    this.addHeroes(new THREE.Vector3(-4.9, 0, 2.6), 0.55, new THREE.Vector3(4.9, 0, 2.4), -0.55); // (both whole on screen, beside the outer lanes)
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
    this.onUpdate((dt, t) => this.rise(dt, t));
  }

  round() {
    return new Promise((resolve) => {
      const pool = [...this.L.pool];
      const target = this.pick('letterVisual', pool);
      this.last = target;
      const nOthers = this.L.total - this.L.targets;
      const set = distractors(target, pool, Math.min(pool.length - 1, nOthers), this.L.similar);
      const letters = shuffle([
        ...Array(this.L.targets).fill(target),
        ...Array.from({ length: nOthers }, (_, i) => set[i % set.length] || pick(set)),
      ]);
      const n = letters.length;
      const colors = shuffle(TILE_COLORS);
      const [lo, hi] = this.L.speed;
      let popped = 0, done = false, lastWrong = null;
      this.speedK = 1;

      ui.bubble({ big: showLetter(target), onTap: () => this.replay() }); // (left, and just the letter: the lanes need its width)
      // lanes: how high each can go, how many balloons fit in it, one speed each; fill one per lane first
      const tops = LANES.map((x) => this.laneTop(x));
      const fits = tops.map((top) => Math.max(1, Math.floor((top - BOTTOM) / GAP)));
      const order = shuffle(LANES.map((_, i) => i));
      const slots = [0, 1, 2, 3].flatMap((k) => order.filter((i) => fits[i] > k));
      const laneOf = letters.map((_, j) => slots[j % slots.length]);
      const speed = LANES.map(() => lo + Math.random() * (hi - lo)), start = LANES.map(() => Math.random());
      const inLane = LANES.map((_, i) => laneOf.filter((l) => l === i).length), seen = LANES.map(() => 0);

      this.balloons = letters.map((letter, i) => {
        const lane = laneOf[i], top = tops[lane];
        const b = makeBalloon(colors[i % colors.length], labelTexture(showLetter(letter)));
        Object.assign(b.userData, { letter, x0: LANES[lane], top, speed: speed[lane], phase: Math.random() * 6, tapHeight: 0, inflate: 0 });
        // start spread out, evenly up its lane: some already in view, some still coming up
        b.position.set(LANES[lane], BOTTOM + (((start[lane] + seen[lane]++ / inLane[lane]) % 1) * (top - BOTTOM)), 0);
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
          if (popped < this.L.targets) this.question('letterVisual', target, hooks, { options: this.balloons.length }); // next balloon with the same letter
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
      this.question('letterVisual', target, hooks, { options: n }); // one question per balloon to find
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
