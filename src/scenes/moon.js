import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { makePup } from '../characters.js';
import { makeRocket } from '../world/rocket.js';
import { sparkle } from '../fx/particles.js';
import { glyphTexture, TILE_COLORS, texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { moonRounds, numbersIn, countVerdict } from '../levels/moon.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const START = -5.8, SPAN = 11.6, STEP_MAX = 1.6, MAX = 10, EXTRA = 3; // the footprints share SPAN: as wide as STEP_MAX where the round allows it
const CHASE = 1.4; // Chase is drawn this much bigger than the other pups
const WATCH_JUMP = { ms: 900, height: 1.8 };  // Chase's own jumps, high and floaty, about one a second to count along
const SEEN_MS = 500; // her count in view, lit, before the next round
const TAP_JUMP = { ms: 400, height: 1.0 };    // a jump she makes: done by her next quick tap, and low enough that a tap
                                              // where he just stood still reaches him (tools/playtest/hop-reach.mjs)
const INK = '#79648e', LIT = '#b88012';
const slot = (i, step) => new THREE.Vector3(START + (i + 1) * step, 0.025, 0.45);

function footprints(outline) {
  return texture(128, (c) => {
    c.fillStyle = c.strokeStyle = '#ffffff';
    c.lineWidth = 7;
    for (const x of [35, 93]) {
      c.beginPath();
      c.ellipse(x, 64, 24, 53, -0.14, 0, Math.PI * 2);
      if (outline) c.stroke();
      else {
        c.fill();
        c.globalCompositeOperation = 'destination-out';
        for (const y of [41, 63, 85]) c.fillRect(x - 18, y, 36, 5);
        c.globalCompositeOperation = 'source-over';
      }
    }
  });
}

export class MoonMission extends Mission {
  constructor(game) {
    super(game, 'moon');
    this.view = { pos: new THREE.Vector3(0, 12.8, 16), look: new THREE.Vector3(0, 4, 0), minWidth: 16 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'landing';
    this.prints = [];
    this.ghosts = [];
    this.blocks = [];
    this.maps = [];
    this.step = STEP_MAX; // the gap between footprints this round
    this.cells = MAX;     // how many footprints this round can leave
  }

  build() {
    this.scene.background = new THREE.Color('#9b77db');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9d1ed', 2.4));
    const sun = new THREE.DirectionalLight('#fff6eb', 2);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);
    const ground = texture(1024, (c, size) => {
      c.fillStyle = '#f6f3f5'; c.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i++) {
        const x = (i * 277 + 89) % size, y = (i * 433 + 217) % size, r = 9 + i % 7 * 4;
        c.fillStyle = '#e5dfec'; c.strokeStyle = '#ffffff'; c.lineWidth = 4;
        c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    });
    this.scene.add(mesh(new THREE.CircleGeometry(27, 80), new THREE.MeshStandardMaterial({ map: ground, roughness: 1 }), { rx: -Math.PI / 2, shadow: false }));
    const earth = texture(512, (c, size) => {
      c.fillStyle = '#328fe8'; c.fillRect(0, 0, size, size);
      c.fillStyle = '#68cf69';
      for (const [x, y, rx, ry] of [[100, 140, 60, 75], [150, 300, 35, 85], [290, 130, 75, 45], [310, 240, 40, 80], [430, 330, 35, 30]]) {
        c.beginPath(); c.ellipse(x, y, rx, ry, -0.4, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#f0fbff'; c.fillRect(0, 0, size, 25); c.fillRect(0, size - 25, size, 25);
    });
    const globe = mesh(new THREE.SphereGeometry(1.6, 40, 28), new THREE.MeshStandardMaterial({ map: earth }), { x: 4.7, y: 6.5, z: -9, shadow: false });
    globe.userData.dynamic = true;
    this.scene.add(globe);
    this.onUpdate((dt) => { globe.rotation.y += dt * 0.035; });
    this.printMap = footprints(false);
    this.ghostMap = footprints(true);
    this.maps.push(ground, earth, this.printMap, this.ghostMap);

    this.rocket = makeRocket();
    this.rocket.position.set(-7.6, 7, -3.4);
    this.rocket.userData.flame.visible = true;
    this.scene.add(this.rocket);
    this.landed = animate(1800, (t) => { this.rocket.position.y = 1.4 + (1 - t) * 5.6; }, ease.out).then(() => {
      this.rocket.userData.flame.visible = false;
      this.chase.visible = true;
    });

    // The base's decorative hops would look like extra, uncounted jumps.
    this.chase = makePup();
    this.chase.position.set(START, 0, -0.7);
    this.chase.scale.setScalar(CHASE);
    this.chase.userData.tapHeight = 1.5;
    this.chase.userData.jumper = true;
    this.chase.visible = false;
    const helmet = new THREE.Group();
    helmet.add(mesh(new THREE.SphereGeometry(0.9, 32, 20), new THREE.MeshStandardMaterial({ color: '#d5f6ff', transparent: true, opacity: 0.16, roughness: 0.12, depthWrite: false }), { shadow: false }));
    helmet.add(mesh(new THREE.TorusGeometry(0.63, 0.055, 8, 32), mat('#f3f7ff'), { y: -0.585, rx: Math.PI / 2, shadow: false }));
    this.chase.userData.parts.head.add(helmet);
    this.scene.add(this.chase);
    this.onUpdate((dt, t) => this.chase.userData.idle(t));
    this.tappable(this.chase, () => this.onJump?.());

    this.flag = new THREE.Group();
    this.flag.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.5, 12), mat('#86739d'), { y: 1.25, shadow: false }));
    const flagMap = glyphTexture('🚀', { bg: '#6366f1' });
    this.maps.push(flagMap);
    this.flag.add(mesh(rbox(1.2, 0.85, 0.08, 0.06), new THREE.MeshBasicMaterial({ map: flagMap }), { x: 0.6, y: 2, shadow: false }));
    this.flag.position.set(6.3, 0, 0.1);
    this.flag.userData.tapHeight = 1.9;
    this.flag.userData.done = true;
    this.flag.visible = false;
    this.scene.add(this.flag);
    this.tappable(this.flag, () => this.onFlag?.());

    const dust = new THREE.BufferGeometry();
    dust.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 30 }, (_, i) => i % 3 === 1 ? 0 : Math.sin(i * 2.4) * 0.4), 3));
    const puff = texture(64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    this.maps.push(puff);
    this.dust = new THREE.Points(dust, new THREE.PointsMaterial({ map: puff, color: '#d8cae6', size: 0.3, transparent: true, opacity: 0, depthWrite: false }));
    this.scene.add(this.dust);
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makePrint(i, ghost = false) {
    const p = mesh(new THREE.PlaneGeometry(0.9 * this.step, 1.05 * this.step), new THREE.MeshBasicMaterial({
      map: ghost ? this.ghostMap : this.printMap, color: INK, transparent: true, opacity: ghost ? 0.45 : 1, depthWrite: false,
    }), { rx: -Math.PI / 2, shadow: false });
    p.position.copy(slot(i, this.step)).setY(ghost ? 0.02 : 0.03);
    p.userData.tapHeight = 0;
    if (!ghost) p.userData.footprint = true;
    this.scene.add(p);
    return p;
  }

  showSlots(n) {
    for (let i = this.ghosts.length; i < n; i++) this.ghosts.push(this.makePrint(i, true));
  }

  async jump({ ms, height } = WATCH_JUMP) {
    const from = this.chase.position.clone(), to = slot(this.prints.length, this.step).setY(0).setZ(-0.7);
    await animate(ms, (t) => {
      this.chase.position.lerpVectors(from, to, t);
      this.chase.position.y = Math.sin(t * Math.PI) * height;
    }, ease.linear);
    if (!this.alive) return;
    this.chase.position.copy(to);
    const i = this.prints.length;
    this.prints.push(this.makePrint(i));
    this.chase.userData.setHappy(0.8);
    this.dust.position.copy(to).setZ(0.1);
    animate(450, (t) => {
      this.dust.scale.setScalar(1 + t * 2);
      this.dust.position.y = 0.06 + t * 0.3;
      this.dust.material.opacity = (1 - t) * 0.55;
    }, ease.out);
  }

  async round(r) {
    this.plan ||= moonRounds(this.L);
    if (r === 0) {
      await this.landed;
      if (!this.alive) return;
      await this.say(T.moonStart());
    }
    if (!this.alive) return;
    this.chase.position.set(START, 0, -0.7);
    const task = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    this.task = task;
    await (task.type === 'jump' ? this.jumpRound(task.auto) : this.howManyRound());
    if (!this.alive) return;
    this.phase = 'clearing';
    this.onJump = this.onFlag = null;
    this.flag.visible = false;
    for (const o of [...this.prints, ...this.ghosts, ...this.blocks]) {
      this.untap(o);
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
    }
    this.prints = []; this.ghosts = []; this.blocks = [];
  }

  /** Spread the round's footprints over SPAN: wide where there are few to leave, narrower for a long row. */
  spread(n, extra) {
    this.cells = Math.min(MAX, n + extra);
    this.step = Math.min(STEP_MAX, SPAN / this.cells);
  }

  /** The flag stands up once she has jumped, so there is something to be finished. */
  raiseFlag() {
    this.flag.visible = true;
    this.flag.scale.setScalar(0.01);
    sfx.pop();
    animate(350, (t) => this.flag.scale.setScalar(Math.max(0.01, t)), ease.out);
  }

  async jumpRound(auto) {
    const n = this.pick('counting', numbersIn(this.L.jump));
    this.last = n;
    this.phase = 'jump';
    this.spread(n, EXTRA);
    this.flag.visible = false;
    if (this.L.slots) this.showSlots(n);
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    const finish = async (talk) => {
      this.phase = 'solved';
      this.correct(n);
      this.stopIdle();
      await talk;
      resolve();
    };
    // her taps jump one after another, every one counted; the flag is judged once he has landed
    this.onJump = () => {
      if (this.phase !== 'jump') return;
      this.poke();
      return this.inTurn(async () => {
        if ((this.phase !== 'jump' && this.phase !== 'checking') || this.prints.length >= this.cells) return;
        await this.jump(TAP_JUMP);
        if (!this.alive) return;
        const count = this.prints.length;
        const first = !auto && count === 1;
        if (first) this.raiseFlag();
        const talk = this.say([...T.number(count), ...(first ? T.moonFlag() : [])]);
        if (auto && count === n) await finish(talk);
      });
    };
    this.onFlag = () => {
      if (this.phase !== 'jump') return;
      this.poke();
      this.phase = 'checking';
      return this.inTurn(() => this.checkJumps(n, finish));
    };
    const toFlag = () => !auto && this.prints.length >= n;
    const hint = () => { this.showSlots(n); return toFlag() ? T.moonFlag() : T.moonHelp(); };
    this.question('counting', n, {
      short: () => (toFlag() ? T.moonFlag() : T.moonJumpShort(n)),
      hint,
      simplify: hint,
      reveal: () => {
        this.showSlots(n);
        const count = this.prints.length;
        this.hint(toFlag() ? this.flag : this.chase, () => this.phase === 'solved' || this.prints.length > count);
      },
    }, { scored: !auto });
    ui.bubble({ big: String(n), pic: '🌙', onTap: () => this.replay(), passthrough: true });
    this.askAfter(this.talk, [...T.moonJump(n), ...T.moonHelp()]);
    await done;
    if (!this.alive) return;
    this.success(this.chase.position.clone().add(new THREE.Vector3(0, 2, 0)));
    sfx.good();
    this.talk = this.say([this.praise()]);
    await wait(SEEN_MS);
  }

  /** The flag: right ends the round; too few, she jumps on; too many, the extra footprints fade. A wrong flag climbs the help ladder. */
  async checkJumps(n, finish) {
    const count = this.prints.length, verdict = countVerdict(count, n);
    if (verdict === 'right') { finish(); return; }
    if (verdict === 'few') {
      this.phase = 'jump';
      this.wrong(count, { obj: this.flag, said: T.moonTooFew() });
      return;
    }
    this.wrong(count, { obj: this.flag, said: T.moonTooMany() });
    const extras = this.prints.splice(n);
    await animate(650, (t) => extras.forEach((p) => { p.material.opacity = 1 - t; }), ease.linear);
    extras.forEach((p) => { p.removeFromParent(); p.geometry.dispose(); p.material.dispose(); });
    if (!this.alive) return;
    this.chase.position.x = slot(n - 1, this.step).x;
    this.phase = 'jump';
  }

  async countPrints() {
    for (let i = 0; i < this.prints.length; i++) {
      this.prints[i].material.color.set(LIT);
      await this.say(T.number(i + 1));
      if (!this.alive) return;
    }
  }

  /** Chase jumps and she counts his footprints: the question starts with "Patrz, jak skacze!". */
  async howManyRound() {
    await this.talk; // (the praise for her last answer first: then she can count)
    if (!this.alive) return;
    const n = this.pick('quantity', numbersIn(this.L.howMany));
    this.last = n;
    this.phase = 'watching';
    this.spread(n, 0);
    if (this.L.slots) this.showSlots(n);
    let right = null, lastWrong;
    this.question('quantity', n, {
      short: T.moonHowMany(),
      hint: () => { this.showSlots(n); return T.countTogether(); },
      simplify: () => right && this.removeOption(lastWrong?.parent ? lastWrong : this.blocks.find((b) => b !== right && b.parent)),
      reveal: () => right && this.hint(right, () => this.phase !== 'choosing'),
    }, { options: 3 });
    ui.bubble({ big: '?', pic: '🌙', onTap: () => this.replay(), passthrough: true });
    this.say(T.moonWatch());
    for (let i = 0; i < n; i++) {
      if (!this.alive) return;
      await this.jump();
      await wait(220);
    }
    if (!this.alive) return;
    this.phase = 'choosing';
    let tapped = 0, resolve;
    const done = new Promise((r) => { resolve = r; });
    this.prints.forEach((p) => this.tappable(p, () => {
      if (this.phase !== 'choosing' || p.userData.counted) return;
      this.poke();
      p.userData.counted = true;
      p.material.color.set(LIT);
      this.say(T.number(++tapped));
    }));
    const max = Math.max(this.L.howMany[1] + 1, n + 1);
    this.blocks = numberChoices(n, max, 3, true).map((num, i) => {
      const map = glyphTexture(String(num), { bg: TILE_COLORS[i], dots: this.L.slots ? num : 0 });
      this.maps.push(map);
      const b = mesh(rbox(1.35, 1.35, 1.35, 0.16), new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), { x: (i - 1) * 2.15, y: 0.675, z: 3.7, shadow: false });
      b.userData.num = num;
      b.userData.tapHeight = 0;
      this.scene.add(b);
      this.tappable(b, () => {
        if (this.phase !== 'choosing') return;
        this.poke();
        if (num !== n) { lastWrong = b; this.wrong(num, { obj: b }); return; }
        this.phase = 'solved';
        this.correct(num);
        this.stopIdle();
        resolve(b);
      });
      return b;
    });
    right = this.blocks.find((b) => b.userData.num === n);
    this.ask(T.moonHowMany());
    const chosen = await done;
    if (!this.alive) return;
    [...this.prints, ...this.blocks].forEach((o) => this.untap(o));
    this.blocks.filter((b) => b !== chosen).forEach((b) => { b.visible = false; });
    this.success(chosen.position.clone());
    sfx.good();
    this.prints.forEach((p) => p.material.color.set(LIT));
    this.talk = this.say([...T.yes(), ...T.number(n)]); // "Tak! Sześć!": the number she chose, said once
    await animate(350, (t) => chosen.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.15), ease.linear);
    await wait(SEEN_MS);
  }

  doneLine() { return T.moonDone(); }

  success(at, options) {
    super.success(null, options);
    this.chase.userData.setHappy(2);
    if (at) sparkle(this, at, { count: 6 });
  }

  exit() {
    super.exit();
    this.maps.forEach((map) => map.dispose());
  }
}
