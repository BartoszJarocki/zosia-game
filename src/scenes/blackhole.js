import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mesh, rbox } from '../models.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { sfx, hush } from '../audio.js';
import { T } from '../lang/pl.js';
import { moonRounds, numbersIn, countVerdict } from '../levels/moon.js';
import { leftNumbers, takeAway, awayChoices } from '../levels/blackhole.js';
import { makeBlackHole } from './space.js';
import { portrait } from '../world/portrait.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const MAX = 10, INK = '#ad8dc7', LIT = '#fff2ae';
const FALL_GAP = 400; // ms between pebbles she watches fall
const SEEN_MS = 500; // the pebbles left, lit, in view before the next round
const SPIRAL_MS = 2400, AWAY_MS = 1600; // a pebble she sends; one she watches fall from the shelf
const SHELF_Z = 4.25, SHELF_GAP = 1.9, TILE_Z = 1.4;
const COLORS = ['#d6dce5', '#eed8af', '#d9bdf1', '#d6dce5'];
const FACE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const basic = (color) => new THREE.MeshBasicMaterial({ color });

function texture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  draw(canvas.getContext('2d'));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function beadMap(lit) {
  return texture((c) => {
    c.strokeStyle = '#ffffff'; c.lineWidth = 10;
    c.beginPath(); c.arc(128, 128, 112, 0, Math.PI * 2);
    if (lit) {
      const g = c.createRadialGradient(98, 90, 4, 128, 128, 115);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#fff1b0'); g.addColorStop(1, '#eeb84a');
      c.fillStyle = g; c.fill();
    } else c.stroke();
  });
}

export class BlackHoleMission extends Mission {
  constructor(game) {
    super(game, 'blackhole');
    this.view = { pos: new THREE.Vector3(0, 18, 0.01), look: new THREE.Vector3(), minWidth: 18 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'starting';
    this.beads = [];
    this.lights = [];
    this.blocks = [];
    this.stones = []; // the shelf's pebbles in a taking-away round, and the outlines the fallen ones leave
    this.maps = [];
  }

  build() {
    this.scene.background = new THREE.Color('#a681dc');
    this.hole = makeBlackHole(FACE, 0.65);
    this.hole.position.set(0, -3, -2.5);
    this.hole.userData.dynamic = true;
    this.scene.add(this.hole);
    this.ring = this.hole.userData.ring;
    this.ringColor = this.ring.material.color.clone();
    this.onUpdate((dt) => { this.hole.userData.spinner.rotation.z += dt * 0.09; });
    this.maps.push(this.hole.userData.spinner.material.map);

    this.frame = mesh(new THREE.RingGeometry(0.94, 1.04, 128), basic('#f4cf87'), { rx: -Math.PI / 2, shadow: false });
    this.frame.userData.dynamic = true;
    this.scene.add(this.frame);
    this.resize = () => {
      const aspect = innerWidth / innerHeight, tangent = Math.tan(Math.PI * 21 / 180);
      const distance = Math.max(18, this.view.minWidth / (2 * tangent * aspect));
      this.frame.scale.set(distance * tangent * aspect, distance * tangent, 1);
    };
    this.resize();
    window.addEventListener('resize', this.resize);

    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 90 }, (_, i) => {
      const n = Math.floor(i / 3);
      return i % 3 === 0 ? Math.sin(n * 17) * 11 : i % 3 === 1 ? -5 : Math.cos(n * 11) * 7;
    }), 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#f9dffc', size: 0.06 })));
    this.scene.add(mesh(rbox(15.5, 0.3, 3.1, 0.3), basic('#e9b970'), { y: -0.1, z: 4.25, shadow: false }));
    this.scene.add(mesh(rbox(14.9, 0.12, 2.6, 0.25), basic('#705593'), { y: 0.1, z: 4.25, shadow: false }));

    this.portrait = portrait();
    this.chase = mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: this.portrait.texture }), { x: 7, y: 0.3, z: -4.3, rx: -Math.PI / 2, shadow: false });
    this.chase.userData.dynamic = true;
    this.scene.add(this.chase);
    this.scene.add(mesh(new THREE.TorusGeometry(1.04, 0.1, 8, 64), basic('#f4cf87'), { x: 7, y: 0.3, z: -4.3, rx: -Math.PI / 2, shadow: false }));
    this.onUpdate((dt, t) => this.chase.scale.setScalar(t < this.cheerUntil ? 1 + Math.sin(t * 5) * 0.035 : 1));

    this.litMap = beadMap(true);
    this.outlineMap = beadMap(false);
    this.pebbleMap = texture((c) => {
      const g = c.createRadialGradient(85, 75, 5, 128, 128, 125);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#e0dce6'); g.addColorStop(1, '#aaa0b8');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(176, 52); c.lineTo(182, 74); c.lineTo(202, 80); c.lineTo(182, 86);
      c.lineTo(176, 108); c.lineTo(170, 86); c.lineTo(150, 80); c.lineTo(170, 74); c.closePath(); c.fill();
    });
    this.maps.push(this.litMap, this.outlineMap, this.pebbleMap);
    this.pebbles = COLORS.map((color, i) => this.makePebble(color, i));
    const buttonMap = glyphTexture('✓', { bg: '#f4c869' });
    this.maps.push(buttonMap);
    this.button = mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: buttonMap }), { x: 5.3, y: 0.35, z: 4.25, rx: -Math.PI / 2, shadow: false });
    this.button.userData.done = true;
    this.button.userData.tapHeight = 0;
    this.button.visible = false;
    this.scene.add(this.button);
    this.tappable(this.button, () => this.onButton?.());
  }

  makePebble(color, i) {
    const p = this.pebble(color, -4.7 + i * 2.2);
    p.userData.pebble = true;
    p.userData.tapHeight = 0;
    p.userData.home = p.position.clone();
    this.scene.add(p);
    this.draggable(p, {
      height: 0.35, lift: 0,
      onPick: () => this.poke(),
      onTap: () => this.onPebble?.(p),
      onDrop: (obj, at) => {
        if (at.z > 2.8 || !this.canDrop(obj)) return false;
        this.onPebble(obj);
        return true;
      },
    });
    this.tappable(p, () => this.onPebble?.(p));
    return p;
  }

  pebble(color, x) {
    return mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({ map: this.pebbleMap, color, transparent: true }), { x, y: 0.35, z: SHELF_Z, rx: -Math.PI / 2, shadow: false });
  }

  /**
   * Lines queue, so each number of her count is heard. Her count comes first: a pebble she sends cuts the line being
   * said (praise, a question), and a question (wanted given) is dropped once she has moved on or started dropping.
   */
  say(segments, wanted) { return this.queue(segments, { wanted }); }
  count(n) {
    if (this.chatting) hush();
    return this.queue(T.number(n), { count: true });
  }
  queue(segments, { wanted, count = false }) {
    const speak = () => {
      if (!this.alive || (wanted && (!wanted() || (this.phase === 'drop' && this.beads.length)))) return Promise.resolve();
      this.chatting = !count;
      return super.say(segments).finally(() => { this.chatting = false; });
    };
    const talk = this.speech ? this.speech.then(speak) : speak();
    this.speech = talk;
    talk.then(() => { if (this.speech === talk) this.speech = null; });
    return talk;
  }

  light(i) {
    if (!this.lights[i]) {
      const p = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: this.outlineMap, color: INK, transparent: true, depthWrite: false }), { x: (i - 4.5) * 1.5, y: 0.2, z: 1.5, rx: -Math.PI / 2, shadow: false });
      p.userData.bead = true;
      p.userData.tapHeight = 0;
      this.scene.add(p);
      this.lights[i] = p;
    }
    this.lights[i].visible = true;
    return this.lights[i];
  }

  showSlots(n) { for (let i = 0; i < n; i++) this.light(i); }

  addBead() {
    const bead = this.light(this.beads.length);
    bead.material.map = this.litMap; bead.material.color.set('#ffffff'); bead.material.opacity = 1;
    this.beads.push(bead);
  }

  canDrop(p) { return this.alive && this.phase === 'drop' && p.userData.pebble && this.beads.length < MAX; }

  async release(p, ms = SPIRAL_MS) {
    const from = p.position.clone(), to = this.hole.position;
    const orbit = new THREE.Vector3(to.x - 1.8, to.y + 0.8, to.z);
    await animate(ms, (t) => {
      if (t < 0.5) p.position.lerpVectors(from, orbit, t * 2);
      else {
        const u = (t - 0.5) * 2, a = Math.PI + u * Math.PI * 2;
        const r = 1.8 - u * 1.1;
        p.position.set(to.x + Math.cos(a) * r, to.y + 0.8, to.z + Math.sin(a) * r * 0.5);
      }
      p.scale.setScalar(1 - t * 0.86);
      p.material.opacity = Math.min(1, (1 - t) * 5);
    }, ease.linear);
    if (!this.alive) return;
    sfx.yes();
    this.brighten();
  }

  brighten() {
    return animate(900, (t) => this.ring.material.color.copy(this.ringColor).multiplyScalar(1 + Math.sin(t * Math.PI) * 0.5), ease.linear);
  }

  async round(r) {
    this.plan ||= moonRounds(this.L);
    if (r === 0) await this.say(T.blackholeStart());
    if (!this.alive) return;
    this.task = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    this.pebbles.forEach((p) => { p.visible = true; });
    await (this.task.type === 'drop' ? this.dropRound(this.task.auto) : this.awayRound());
    if (!this.alive) return;
    this.phase = 'clearing';
    this.onPebble = this.onButton = null;
    this.button.visible = false;
    this.lights.forEach((p) => {
      p.visible = false;
      p.material.map = this.outlineMap; p.material.color.set(INK); p.material.opacity = 1;
    });
    for (const o of [...this.blocks, ...this.stones]) {
      this.untap(o); o.removeFromParent(); o.geometry.dispose();
      if (this.blocks.includes(o)) o.material.map.dispose();
      o.material.dispose();
    }
    this.beads = []; this.blocks = []; this.stones = [];
  }

  async dropRound(auto) {
    const n = this.pick('counting', numbersIn(this.L.drop));
    this.last = n;
    this.phase = 'drop';
    let slots = this.L.slots;
    const clue = () => { slots = true; this.showSlots(n); };
    if (slots) clue();
    const flights = [];
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    const finish = () => {
      this.phase = 'solved'; this.correct(n); this.stopIdle(); sfx.good();
      resolve();
    };
    this.onPebble = (p) => {
      if (!this.canDrop(p)) return;
      this.poke();
      this.untap(p); p.userData.pebble = false; delete p.userData.drag;
      this.addBead();
      this.button.visible = !auto; // (the button comes with her first pebble: nothing to check before)
      const count = this.beads.length;
      this.count(count);
      const i = this.pebbles.indexOf(p);
      const flight = Promise.all([
        this.release(p).then(() => { p.removeFromParent(); p.geometry.dispose(); p.material.dispose(); }),
        wait(400).then(() => { if (this.alive) this.pebbles[i] = this.makePebble(p.material.color, i); }),
      ]);
      flights.push(flight);
      if (auto && count === n) finish();
      return flight;
    };
    // a wrong check is a wrong answer on the shared help; too many: every bead goes dark and she sends them again
    this.onButton = () => {
      if (!this.alive || this.phase !== 'drop') return;
      this.poke();
      const verdict = countVerdict(this.beads.length, n);
      if (verdict === 'right') { finish(); return; }
      const count = this.beads.length;
      if (verdict === 'many') {
        this.beads = [];
        this.lights.forEach((p, i) => { p.material.map = this.outlineMap; p.material.color.set(INK); p.visible = slots && i < n; });
      }
      this.wrong(count, { obj: this.button, said: verdict === 'few' ? T.blackholeTooFew() : T.blackholeTooMany() });
    };
    this.question('counting', n, {
      short: () => !auto && this.beads.length ? T.blackholeButton() : T.blackholeDropShort(n),
      hint: () => { clue(); return !auto && this.beads.length >= n ? T.blackholeButton() : T.blackholeHelp(); },
      simplify: clue,
      reveal: () => {
        clue();
        const count = this.beads.length;
        this.hint(!auto && count >= n ? this.button : this.pebbles[0], () => this.phase === 'solved' || this.beads.length !== count);
      },
    }, { scored: !auto });
    ui.bubble({ big: String(n), pic: '✨', onTap: () => this.replay(), passthrough: true });
    this.askAfter(this.talk, [...T.blackholeDrop(n), ...(auto ? T.blackholeHelp() : T.blackholeButton())]);
    await done;
    if (!this.alive) return;
    const counted = this.speech; // her numbers, still being said
    this.success();
    const glow = !this.lampSaid; // (the fact once a visit)
    this.lampSaid = true;
    if (glow) this.brighten();
    this.talk = this.say(glow ? T.blackholeGlow() : [this.praise()]);
    await Promise.all([...flights, counted]); // the next question comes as she is praised
  }

  /**
   * Taking away: the shelf holds `was` pebbles, the last `fell` lift off 0.4 s apart and spiral in, each leaving an
   * outline, then "Ile zostało?". The question is open from the start; she can count the pebbles left by tapping them.
   */
  async awayRound() {
    await this.speech; // (her numbers and the praise first: then she can watch)
    if (!this.alive) return;
    const left = this.pick('quantity', leftNumbers(this.L));
    const { was, fell } = takeAway(this.L, left);
    this.last = left;
    this.phase = 'watching';
    this.pebbles.forEach((p) => { p.visible = false; });
    const shelf = Array.from({ length: was }, (_, i) => {
      const p = this.pebble(COLORS[i % COLORS.length], (i - (was - 1) / 2) * SHELF_GAP);
      this.scene.add(p);
      return p;
    });
    const kept = shelf.slice(0, left);
    this.stones = [...shelf];
    let right = null, lastWrong;
    this.question('quantity', left, {
      short: T.blackholeLeft(),
      hint: () => { this.pointAlong(kept, (p) => { p.scale.setScalar(1.3); return () => p.scale.setScalar(1); }); return T.countTogether(); },
      simplify: () => right && this.removeOption(lastWrong?.parent ? lastWrong : this.blocks.find((b) => b !== right && b.parent)),
      reveal: () => right && this.hint(right, () => this.phase !== 'choosing'),
    }, { options: 3 });
    ui.bubble({ big: '?', pic: '✨', onTap: () => this.replay(), passthrough: true });
    await this.say(T.blackholeDropShort(was));
    if (!this.alive) return;
    await Promise.all(shelf.slice(left).map((p, k) => wait(k * FALL_GAP).then(async () => {
      if (!this.alive) return;
      const outline = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: this.outlineMap, color: INK, transparent: true, opacity: 0.6, depthWrite: false }), { x: p.position.x, y: 0.2, z: SHELF_Z, rx: -Math.PI / 2, shadow: false });
      this.scene.add(outline);
      this.stones.push(outline);
      await this.release(p, AWAY_MS);
      p.visible = false;
    })));
    if (!this.alive) return;
    this.say(T.blackholeFell(fell));
    this.phase = 'choosing';
    let tapped = 0, resolve;
    const done = new Promise((r) => { resolve = r; });
    kept.forEach((p) => this.tappable(p, () => {
      if (this.phase !== 'choosing' || p.userData.counted) return;
      this.poke(); p.userData.counted = true; p.material.color.set(LIT).multiplyScalar(1.8);
      this.count(++tapped);
    }));
    this.blocks = awayChoices({ was, left }).map((num, i) => {
      const map = glyphTexture(String(num), { bg: TILE_COLORS[i], dots: this.L.slots ? num : 0 });
      const b = mesh(rbox(1.75, 1.75, 0.25, 0.16), new THREE.MeshBasicMaterial({ map }), { x: (i - 1) * 2.6, y: 0.35, z: TILE_Z, rx: -Math.PI / 2, shadow: false });
      b.userData.num = num; b.userData.tapHeight = 0;
      this.scene.add(b);
      this.tappable(b, () => {
        if (this.phase !== 'choosing') return;
        this.poke();
        if (num !== left) { lastWrong = b; this.wrong(num, { obj: b }); return; }
        this.phase = 'solved'; this.correct(num); this.stopIdle(); sfx.good(); resolve(b);
      });
      return b;
    });
    right = this.blocks.find((b) => b.userData.num === left);
    this.ask(T.blackholeLeft());
    const chosen = await done;
    if (!this.alive) return;
    [...kept, ...this.blocks].forEach((o) => this.untap(o));
    this.blocks.filter((b) => b !== chosen).forEach((b) => { b.visible = false; });
    this.success();
    kept.forEach((p) => p.material.color.set(LIT).multiplyScalar(1.8));
    this.talk = this.say([...T.yes(), ...T.number(left)]); // "Tak! Dwa!": the number she chose, said once
    await animate(350, (t) => chosen.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.15), ease.linear);
    await wait(SEEN_MS);
  }

  success() { this.cheer(2); }
  doneLine() { return T.blackholeDone(); }

  exit() {
    super.exit();
    window.removeEventListener('resize', this.resize);
    this.maps.forEach((map) => map.dispose());
    this.blocks.forEach((b) => b.material.map.dispose());
    this.portrait?.dispose();
  }
}
