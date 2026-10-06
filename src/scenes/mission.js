import * as THREE from 'three';
import { Stage, addSkyAndLights, wait, hop, animate, ease, post } from '../engine.js';
import { mat, mesh } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { groundMat } from '../scenery.js';
import { makeTree, makeCloud, makeHills, makeMeadowDetail, makeButterfly, makeBird, contactShadow } from '../world/nature.js';
import { sparkle, fireworks } from '../fx/particles.js';
import { CONFIG } from '../config.js';
import { T, PRAISE } from '../lang/pl.js';
import { say, sfx, hush } from '../audio.js';
import { settingsFor } from '../levels.js';
import { levelFor, recordMission, recordItem } from '../progress.js';
import { maxLevel } from '../levels/data.js';
import * as ui from '../ui.js';
import { pick } from '../util.js';

/** How much grass the device can take. */
export const detail = () => ({ low: 0.3, medium: 0.6, high: 1 }[post.tier] ?? 0.6);

/**
 * Shared flow: N rounds → progress paws → optional outro → celebration + badge (+ level up).
 * Subclasses call this.miss() on a wrong tap and this.item('L:A') to name what the round was about;
 * the base class works out first-try accuracy for levelling and per-letter/number stats.
 */
export class Mission extends Stage {
  constructor(game, kind) {
    super();
    this.post = { tilt: 0.35, focus: 0.45, band: 0.3 };
    this.game = game;
    this.kind = kind;
    this.level = levelFor(kind);
    this.L = settingsFor(kind);
    this.rounds = CONFIG.roundsPerMission;
    this.cheerUntil = 0;
    this.walking = false;
    this.prompt = '';
    this.firstTry = 0;
  }

  enter() {
    this.build();
    ui.missionHud({ rounds: this.rounds, level: this.level, total: maxLevel(this.kind), onHome: () => { hush(); this.game.hub(); } });
    this.onUpdate((dt, t) => {
      if (this.pup) this.pup.userData.idle(t);
      if (this.girl) {
        if (t < this.cheerUntil) this.girl.userData.cheer(t);
        else if (this.walking) this.girl.userData.walk(t);
        else this.girl.userData.idle(t);
      }
    });
    this.run();
  }

  exit() { clearTimeout(this.idleTimer); }

  async run() {
    await wait(500);
    for (let r = 0; r < this.rounds; r++) {
      if (!this.alive) return;
      this.missed = false;
      this.roundItem = null;
      await this.round(r);
      if (!this.alive) return;
      if (!this.missed) this.firstTry++;
      if (this.roundItem) recordItem(this.roundItem, !this.missed);
      this.stopIdle();
      ui.setProgress(r + 1);
      sfx.pop();
      await wait(450);
    }
    if (!this.alive) return;
    await this.outro();
    if (this.alive) this.finish();
  }

  async outro() {}

  async finish() {
    ui.hideBubble();
    ui.badges.add(this.kind);
    const { level, levelUp } = recordMission(this.kind, this.firstTry, this.rounds);
    sfx.fanfare();
    setTimeout(() => sfx.siren(2), 900);
    this.cheer(6);
    this.pup?.userData.setHappy(8);
    fireworks(this, this.view.look, { bursts: levelUp ? 9 : 6 });
    ui.celebrate({
      kind: this.kind,
      level,
      total: maxLevel(this.kind),
      levelUp,
      onHome: () => { hush(); this.game.hub(); },
      onAgain: () => { hush(); this.game.startMission(this.kind); },
    });
    await say([...T.done(), ...(levelUp ? T.levelUp(level) : [])]);
    while (this.alive) {
      if (this.pup) await hop(this.pup, 0.6, 500);
      if (!this.alive) return;
      await wait(200);
    }
  }

  // ----- helpers for subclasses -----
  miss() { this.missed = true; }
  item(id) { this.roundItem = id; }
  cheer(seconds = 1.5) { this.cheerUntil = performance.now() / 1000 + seconds; }
  praise() { return pick(PRAISE); }

  /** Everyone reacts to a right answer: sparkles, happy faces, a little camera push. */
  success(at, { big = false } = {}) {
    if (at) sparkle(this, at, { count: big ? 26 : 18 });
    this.cheer(big ? 2.2 : 1.5);
    this.girl?.userData.setHappy(2);
    this.pup?.userData.setHappy(2);
    if (this.pup && !this.pupRides) hop(this.pup, 0.55);
    this.push();
  }

  /** Heroes turn to look at something. */
  lookAt(obj) {
    const p = obj.isVector3 ? obj : obj.getWorldPosition(new THREE.Vector3());
    this.girl?.userData.lookAt(p);
    this.pup?.userData.lookAt(p);
  }

  /** Small camera push-in and back, for emphasis. */
  push(amount = 0.06, ms = 900) {
    if (this.pushing) return;
    this.pushing = true;
    const base = this.view.pos.clone(), look = this.view.look;
    animate(ms, (t) => {
      const k = Math.sin(t * Math.PI) * amount;
      this.view.pos.copy(base).lerp(look, k);
    }, ease.inOut).then(() => { this.view.pos.copy(base); this.pushing = false; });
  }

  /** Say the question now, and again whenever she goes quiet. */
  ask(segments) {
    this.prompt = segments;
    say(segments);
    this.poke();
  }
  poke() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.alive && this.prompt) { say(this.prompt); this.poke(); }
    }, CONFIG.idleRepeatSeconds * 1000);
  }
  stopIdle() { clearTimeout(this.idleTimer); this.prompt = ''; }

  // ----- shared world -----
  /**
   * Sky, lights, grassy ground with waving grass + flowers, trees, distant hills, clouds, butterflies.
   * clear: [x, z, r] spots to keep free (where the action happens).
   */
  meadow({ groundColor = '#5dbb4f', trees = true, flowers = true, hills = true, clear = [[0, 0, 7]], treeRing = [11, 20], behindOnly = true, grassRadius = 22 } = {}) {
    addSkyAndLights(this.scene, { shadowSize: 13 });
    this.scene.add(mesh(new THREE.CircleGeometry(160, 48), groundMat(groundColor, 60), { rx: -Math.PI / 2 }));
    const k = detail();
    if (flowers) this.scene.add(makeMeadowDetail({ radius: grassRadius, blades: Math.round(5000 * k), flowers: Math.round(140 * k) + 40, keepOut: clear }));
    if (hills) this.scene.add(makeHills({ radius: 75, count: 12, trees: k > 0.5 }));
    if (trees) {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = behindOnly ? Math.PI * (0.05 + 0.9 * (i / (n - 1))) : (i / n) * Math.PI * 2;
        const r = treeRing[0] + Math.random() * (treeRing[1] - treeRing[0]);
        const x = Math.cos(a) * r, z = -Math.sin(a) * r * 0.75 - 2;
        if (clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + 1.5)) continue;
        const t = makeTree({ scale: 1 + Math.random() * 0.7 });
        t.position.set(x, 0, z);
        this.scene.add(t);
      }
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud({ scale: 2 + Math.random() * 1.5 });
      c.position.set(-60 + i * 24, 22 + Math.random() * 8, -55 - Math.random() * 20);
      c.userData.tick = (dt) => { c.position.x += dt * 0.5; if (c.position.x > 80) c.position.x = -80; };
      c.userData.mergeOK = true;
      this.scene.add(c);
    }
    for (let i = 0; i < 3; i++) this.scene.add(makeButterfly({ center: [(i - 1) * 6, -1 - i], radius: 3 + i, height: 1 + i * 0.4, color: ['#f472b6', '#fbbf24', '#60a5fa'][i] }));
    for (let i = 0; i < 3; i++) this.scene.add(makeBird({ radius: 30 + i * 6, height: 18 + i * 2, seed: i * 2.1 }));
  }

  addHeroes(girlPos, girlRot, pupPos, pupRot) {
    this.girl = makeGirl();
    this.girl.position.copy(girlPos);
    this.girl.rotation.y = girlRot;
    this.pup = makePup();
    this.pup.position.copy(pupPos);
    this.pup.rotation.y = pupRot;
    this.scene.add(this.girl, this.pup);
    this.shadowUnder(this.girl, 0.7);
    this.shadowUnder(this.pup, 0.85);
    this.girl.userData.tapHeight = 1.7;
    this.pup.userData.tapHeight = 1.5;
    this.tappable(this.pup, () => { sfx.bark(); hop(this.pup, 0.5); this.pup.userData.setHappy(1.2); });
    this.tappable(this.girl, () => { sfx.pop(); this.cheer(); hop(this.girl, 0.35); });
  }

  /** Soft contact shadow that follows an object and fades as it jumps. */
  shadowUnder(obj, radius = 0.8, opacity = 0.38) {
    const s = contactShadow(radius, opacity);
    this.scene.add(s);
    const p = new THREE.Vector3();
    const base = obj.scale.x || 1;
    this.onUpdate(() => {
      if (!obj.parent) { s.visible = false; return; }
      obj.getWorldPosition(p);
      s.position.set(p.x, 0.03, p.z);
      const h = Math.max(0, p.y);
      s.scale.setScalar((1 + h * 0.15) * Math.max(obj.scale.x / base, 0.001));
      s.material.opacity = opacity * Math.max(0.15, 1 - h * 0.35) * (obj.visible ? 1 : 0);
    });
    return s;
  }

  /** Pop an object in from above with a bounce. */
  dropIn(obj, y, delay = 0, ms = 750) {
    const y0 = y + 8;
    obj.position.y = y0;
    return wait(delay).then(() => animate(ms, (t) => { obj.position.y = y0 + (y - y0) * t; }, ease.bounce));
  }

  shrinkAway(obj, ms = 350) {
    const s0 = obj.scale.x;
    return animate(ms, (t) => obj.scale.setScalar(Math.max(0.001, s0 * (1 - t))), ease.in).then(() => obj.removeFromParent());
  }

  /** Arc-jump an object to a point. */
  jumpTo(obj, to, { height = 1.2, ms = 450 } = {}) {
    const from = obj.position.clone();
    return animate(ms, (t) => {
      obj.position.lerpVectors(from, to, t);
      obj.position.y += Math.sin(t * Math.PI) * height;
    }, ease.linear);
  }

  /** Pulse an object's scale after repeated misses. */
  hint(obj, isDone, target = obj) {
    if (obj.userData.hinting) return;
    obj.userData.hinting = true;
    const base = target.scale.clone();
    const off = this.onUpdate((dt, t) => {
      if (isDone() || !obj.parent) { off(); obj.userData.hinting = false; if (obj.parent) target.scale.copy(base); return; }
      target.scale.copy(base).multiplyScalar(1 + Math.max(0, Math.sin(t * 7)) * 0.13);
    });
  }
}
