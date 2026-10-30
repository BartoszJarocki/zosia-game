import * as THREE from 'three';
import { animate, ease, wait, renderer } from '../engine.js';
import { mesh, rbox } from '../models.js';
import { makePup } from '../characters.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { moonRounds, numbersIn, countVerdict } from '../levels/moon.js';
import { makeBlackHole } from './space.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const MAX = 10, INK = '#ad8dc7', LIT = '#fff2ae';
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

function portrait() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#657dcc');
  scene.add(new THREE.HemisphereLight('#ffffff', '#cad9ff', 2.4));
  const light = new THREE.DirectionalLight('#fff3dd', 2.5);
  light.position.set(-3, 4, 6); scene.add(light);
  const chase = makePup();
  chase.position.set(0, -1.4, 0);
  chase.userData.setHappy(60);
  scene.add(chase);
  scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 5);
  const target = new THREE.WebGLRenderTarget(256, 256);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(previous);
  scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  return target;
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
    this.pebbles = ['#d6dce5', '#eed8af', '#d9bdf1', '#d6dce5'].map((color, i) => this.makePebble(color, i));
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
    const p = mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({ map: this.pebbleMap, color, transparent: true }), { x: -4.7 + i * 2.2, y: 0.35, z: 4.25, rx: -Math.PI / 2, shadow: false });
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

  say(segments) {
    const speak = () => this.alive ? super.say(segments) : Promise.resolve();
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

  async release(p) {
    const from = p.position.clone(), to = this.hole.position;
    const orbit = new THREE.Vector3(to.x - 1.8, to.y + 0.8, to.z);
    await animate(2400, (t) => {
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
    await (this.task.type === 'drop' ? this.dropRound(this.task.auto) : this.howManyRound());
    if (!this.alive) return;
    this.phase = 'clearing';
    this.onPebble = this.onButton = null;
    this.button.visible = false;
    this.lights.forEach((p) => {
      this.untap(p); p.visible = false; p.userData.counted = false;
      p.material.map = this.outlineMap; p.material.color.set(INK); p.material.opacity = 1;
    });
    this.blocks.forEach((b) => { this.untap(b); b.removeFromParent(); b.geometry.dispose(); b.material.map.dispose(); b.material.dispose(); });
    this.beads = []; this.blocks = [];
  }

  async dropRound(auto) {
    const n = this.pick('counting', numbersIn(this.L.drop));
    this.last = n;
    this.phase = 'drop';
    this.button.visible = !auto;
    if (this.L.slots) this.showSlots(n);
    const flights = [];
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    const finish = () => {
      this.phase = 'solved'; this.correct(n); this.stopIdle();
      resolve();
    };
    this.onPebble = (p) => {
      if (!this.canDrop(p)) return;
      this.poke();
      this.untap(p); p.userData.pebble = false; delete p.userData.drag;
      this.addBead();
      const count = this.beads.length;
      this.say(T.number(count));
      const i = this.pebbles.indexOf(p);
      const flight = Promise.all([
        this.release(p).then(() => { p.removeFromParent(); p.geometry.dispose(); p.material.dispose(); }),
        wait(400).then(() => { if (this.alive) this.pebbles[i] = this.makePebble(p.material.color, i); }),
      ]);
      flights.push(flight);
      if (auto && count === n) finish();
      return flight;
    };
    this.onButton = async () => {
      if (!this.alive || this.phase !== 'drop') return;
      this.poke();
      const count = this.beads.length, verdict = countVerdict(count, n);
      if (verdict === 'right') { finish(); return; }
      this.wrong(count, { feedback: false, quiet: true });
      if (verdict === 'few') { this.say(T.blackholeTooFew()); return; }
      this.phase = 'checking';
      const extras = this.beads.splice(n);
      await animate(650, (t) => extras.forEach((p) => { p.material.opacity = 1 - t; }), ease.linear);
      if (!this.alive) return;
      extras.forEach((p) => { p.material.map = this.outlineMap; p.material.color.set(INK); p.material.opacity = 0.6; });
      this.phase = 'drop';
      this.say(T.blackholeTooMany());
    };
    this.question('counting', n, {
      short: () => !auto && this.beads.length ? T.blackholeButton() : T.blackholeDropShort(n),
      hint: () => { this.showSlots(n); return T.blackholeHelp(); },
      reveal: () => {
        this.showSlots(n);
        const count = this.beads.length;
        this.hint(!auto && count >= n ? this.button : this.pebbles[0], () => this.phase === 'solved' || this.beads.length !== count);
      },
    }, { scored: !auto });
    ui.bubble({ big: String(n), pic: '✨', onTap: () => this.replay(), passthrough: true });
    this.ask([...T.blackholeDrop(n), ...(auto ? T.blackholeHelp() : T.blackholeButton())]);
    await done;
    await Promise.all([...flights, this.speech]);
    if (!this.alive) return;
    await wait(650);
    if (!this.alive) return;
    this.success(); sfx.good();
    if (!this.lampSaid) {
      this.lampSaid = true;
      this.brighten();
      await this.say(T.blackholeGlow());
    } else await this.say([this.praise()]);
  }

  async howManyRound() {
    const n = this.pick('quantity', numbersIn(this.L.howMany));
    this.last = n;
    this.phase = 'watching';
    ui.hideBubble();
    if (this.L.slots) this.showSlots(n);
    await this.say(T.blackholeWatch());
    for (let i = 0; i < n; i++) {
      if (!this.alive) return;
      const p = this.pebbles[i % this.pebbles.length];
      await this.release(p);
      if (!this.alive) return;
      this.addBead();
      p.position.copy(p.userData.home); p.scale.setScalar(1); p.material.opacity = 1;
      await wait(220);
    }
    if (!this.alive) return;
    this.phase = 'choosing';
    this.pebbles.forEach((p) => { p.visible = false; });
    let tapped = 0, resolve, lastWrong;
    const done = new Promise((r) => { resolve = r; });
    this.beads.forEach((p) => this.tappable(p, () => {
      if (this.phase !== 'choosing' || p.userData.counted) return;
      this.poke(); p.userData.counted = true; p.material.color.set(LIT).multiplyScalar(1.8);
      this.say(T.number(++tapped));
    }));
    const max = Math.max(this.L.howMany[1] + 1, n + 1);
    this.blocks = numberChoices(n, max, 3, true).map((num, i) => {
      const map = glyphTexture(String(num), { bg: TILE_COLORS[i], dots: this.L.slots ? num : 0 });
      const b = mesh(rbox(1.75, 1.75, 0.25, 0.16), new THREE.MeshBasicMaterial({ map }), { x: (i - 1) * 2.6, y: 0.35, z: 4.25, rx: -Math.PI / 2, shadow: false });
      b.userData.num = num; b.userData.tapHeight = 0;
      this.scene.add(b);
      this.tappable(b, () => {
        if (this.phase !== 'choosing') return;
        this.poke();
        if (num !== n) { lastWrong = b; this.wrong(num, { quiet: true }); return; }
        this.phase = 'solved'; this.correct(num); this.stopIdle(); resolve(b);
      });
      return b;
    });
    const right = this.blocks.find((b) => b.userData.num === n);
    this.question('quantity', n, {
      short: T.blackholeHowMany(),
      hint: () => { this.showSlots(n); return T.countTogether(); },
      simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : this.blocks.find((b) => b !== right && b.parent)),
      reveal: () => this.hint(right, () => this.phase !== 'choosing'),
    }, { options: 3 });
    ui.bubble({ big: '?', pic: '✨', onTap: () => this.replay(), passthrough: true });
    this.ask(T.blackholeHowMany());
    const chosen = await done;
    if (!this.alive) return;
    [...this.beads, ...this.blocks].forEach((o) => this.untap(o));
    this.blocks.filter((b) => b !== chosen).forEach((b) => { b.visible = false; });
    this.success(); sfx.good();
    await this.say(T.yes());
    this.beads.forEach((p) => p.material.color.set('#ffffff'));
    for (let i = 0; i < this.beads.length; i++) {
      if (!this.alive) return;
      this.beads[i].material.color.set(LIT).multiplyScalar(1.8);
      await this.say(T.number(i + 1));
    }
    if (this.alive) await animate(350, (t) => chosen.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.15), ease.linear);
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
