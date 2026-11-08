import * as THREE from 'three';
import { animate, ease } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { shallowsPlan } from '../levels/shallows.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const SURFACE = 1.75;
const BOTTOM = 0.04;
const EDGE = new THREE.Vector3(0, 1.78, 1.05);
const DROP_AT = new THREE.Vector3(0, 0, 3.9);
const SHELF_X = 6;
const SHELF_Z = 1.2;
const SHELF_Y = 1.45;
const SLOTS = [[-1.5, 0.54], [0, 0.54], [1.5, 0.54], [-1.5, 1.34], [0, 1.34], [1.5, 1.34]];

const SAND_SIZE = { kłoda: 3.6, moneta: 2, default: 2.35 };
const SHELF_SIZE = { kłoda: 1.9, moneta: 1.3, default: 1.45 };
const target = (table, id) => table[id] ?? table.default;

function signMap(side) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 192;
  const c = cv.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, 192);
  sky.addColorStop(0, '#e0f2fe');
  sky.addColorStop(0.6, '#bae6fd');
  sky.addColorStop(1, '#fde68a');
  c.fillStyle = sky;
  c.fillRect(0, 0, 512, 192);
  const surface = side === 'float' ? 94 : 44;
  if (side === 'sink') {
    c.fillStyle = '#fde68a';
    c.fillRect(0, 108, 512, 84);
    for (let i = 0; i < 24; i++) {
      c.fillStyle = i % 2 ? '#fcd34d' : '#e7c873';
      c.beginPath();
      c.ellipse((i * 97 + 33) % 512, 118 + (i * 31) % 66, 7, 4, 0.3, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = 'rgba(165, 243, 252, 0.55)';
  c.fillRect(0, surface, 512, 192 - surface);
  c.strokeStyle = '#0ea5e9';
  c.lineWidth = 7;
  c.lineCap = 'round';
  for (const y of [surface + 12, surface + 34, surface + 56]) {
    if (y > 184) continue;
    c.beginPath();
    c.moveTo(12, y);
    c.quadraticCurveTo(70, y - 10, 128, y);
    c.quadraticCurveTo(186, y + 10, 244, y);
    c.quadraticCurveTo(302, y - 10, 360, y);
    c.quadraticCurveTo(418, y + 10, 500, y);
    c.stroke();
  }
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '82px "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  if (side === 'float') c.fillText('🦆', 256, surface - 14);
  else c.fillText('🪨', 256, 152);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringMap() {
  return texture(256, (c, size) => {
    c.fillStyle = '#e5b878';
    c.fillRect(0, 0, size, size);
    c.strokeStyle = '#b1702f';
    c.lineWidth = 6;
    for (const r of [34, 58, 84, 112]) {
      c.beginPath();
      c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      c.stroke();
    }
  });
}

function skyMap() {
  return texture(512, (c, size) => {
    const sky = c.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, '#7dd3fc');
    sky.addColorStop(0.55, '#bae6fd');
    sky.addColorStop(1, '#fef3c7');
    c.fillStyle = sky;
    c.fillRect(0, 0, size, size);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (const [x, y, rx, ry] of [[90, 105, 54, 18], [350, 140, 70, 22], [220, 70, 40, 14]]) {
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function bottomMap() {
  return texture(512, (c, size) => {
    c.fillStyle = '#fde68a';
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = (i * 173 + 41) % size, y = (i * 311 + 97) % size, r = 3 + i % 5;
      c.fillStyle = i % 3 ? '#fcd34d' : '#e7c873';
      c.beginPath();
      c.ellipse(x, y, r * 1.6, r, i, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#a5f3fc';
    for (let i = 0; i < 8; i++) {
      const x = 40 + (i * 197) % (size - 80), y = 60 + (i * 283) % (size - 120);
      c.beginPath();
      c.ellipse(x, y, 22, 7, 0.3, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function makeShelf(side) {
  const g = new THREE.Group();
  const wood = mat('#b45309', { roughness: 0.85 });
  const board = mat('#d97706', { roughness: 0.8 });
  g.add(mesh(rbox(4.8, 2.5, 0.18, 0.09), wood, { y: 1.25, z: -0.18, shadow: false }));
  for (const x of [-2.25, 2.25]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.5, 8), wood, { x, y: 1.25, z: -0.14, shadow: false }));
  for (const y of [0.45, 1.25]) g.add(mesh(rbox(4.6, 0.13, 0.62, 0.05), board, { y, z: 0.24, shadow: false }));
  return g;
}

export function makeThing(id, hitMat) {
  const g = new THREE.Group();
  const add = (geo, material, opts) => g.add(mesh(geo, material, { shadow: false, ...opts }));

  if (id === 'jabłko') {
    add(new THREE.SphereGeometry(0.5, 20, 16), mat('#ef4444', { roughness: 0.45 }), { y: 0.5 });
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), mat('#7c4a1e'), { y: 1.02 });
    add(new THREE.SphereGeometry(0.17, 12, 8), mat('#22c55e'), { x: 0.14, y: 0.96, z: 0, s: [1.3, 0.35, 0.8], rz: -0.35 });
  } else if (id === 'piłka') {
    add(new THREE.SphereGeometry(0.48, 20, 16), mat('#f8fafc', { roughness: 0.35 }), { y: 0.48 });
    add(new THREE.TorusGeometry(0.47, 0.085, 8, 28), mat('#ef4444'), { y: 0.48, rx: Math.PI / 2 });
    add(new THREE.TorusGeometry(0.47, 0.085, 8, 28), mat('#2563eb'), { y: 0.48, ry: Math.PI / 2 });
  } else if (id === 'kaczka') {
    add(new THREE.SphereGeometry(0.5, 20, 16), mat('#fde047', { roughness: 0.5 }), { y: 0.36, s: [1.2, 0.72, 0.86] });
    add(new THREE.SphereGeometry(0.27, 16, 12), mat('#fde047', { roughness: 0.5 }), { x: 0.36, y: 0.82 });
    add(new THREE.ConeGeometry(0.11, 0.24, 10), mat('#f97316'), { x: 0.65, y: 0.8, rz: -Math.PI / 2 });
    add(new THREE.SphereGeometry(0.035, 8, 6), mat('#1f2937'), { x: 0.43, y: 0.9, z: 0.2 });
    add(new THREE.SphereGeometry(0.035, 8, 6), mat('#1f2937'), { x: 0.43, y: 0.9, z: -0.2 });
  } else if (id === 'liść') {
    add(new THREE.SphereGeometry(0.55, 16, 12), mat('#4ade80', { roughness: 0.6 }), { y: 0.55, s: [1, 0.95, 0.14], rz: 0.4 });
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6), mat('#166534'), { x: -0.04, y: 0.08, rz: Math.PI / 2 });
  } else if (id === 'klocek') {
    add(rbox(0.85, 0.85, 0.85, 0.08), mat('#b45309', { roughness: 0.75 }), { y: 0.425 });
    add(rbox(0.87, 0.08, 0.87, 0.04), mat('#d97706', { roughness: 0.7 }), { y: 0.85 });
  } else if (id === 'kłoda') {
    const log = new THREE.Group();
    const bark = mat('#8b4a20', { roughness: 0.95 });
    log.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.6, 20), bark, { y: 0.62, rz: Math.PI / 2, shadow: false }));
    const cut = new THREE.MeshStandardMaterial({ map: ringMap(), roughness: 0.85 });
    log.add(mesh(new THREE.CircleGeometry(0.6, 26), cut, { x: 1.32, y: 0.62, ry: Math.PI / 2, shadow: false }));
    log.add(mesh(new THREE.TorusGeometry(0.6, 0.045, 8, 26), mat('#6b3410'), { x: 1.33, y: 0.62, ry: Math.PI / 2, shadow: false }));
    log.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 8), mat('#6b3410'), { x: -0.4, y: 1.18, z: 0.28, rz: -0.55, rx: 0.25, shadow: false }));
    log.rotation.y = -0.55;
    g.add(log);
  } else if (id === 'kamień') {
    add(new THREE.DodecahedronGeometry(0.55, 0), mat('#94a3b8', { roughness: 1 }), { y: 0.5, s: [1.1, 1.05, 1], ry: 0.4 });
  } else if (id === 'klucz') {
    add(new THREE.TorusGeometry(0.19, 0.065, 8, 20), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: -0.2, y: 0.55 });
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 8), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: 0.18, y: 0.55, rz: Math.PI / 2 });
    add(rbox(0.13, 0.16, 0.07, 0.02), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: 0.42, y: 0.47 });
    add(rbox(0.13, 0.13, 0.07, 0.02), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: 0.3, y: 0.47 });
  } else if (id === 'moneta') {
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), mat('#fbbf24', { metalness: 0.55, roughness: 0.25, emissive: '#f59e0b', emissiveIntensity: 0.18 }), { y: 0.42, rx: Math.PI / 2 });
    add(new THREE.TorusGeometry(0.35, 0.03, 8, 24), mat('#fde68a', { metalness: 0.4, roughness: 0.3 }), { y: 0.42, z: 0.06 });
  } else {
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), mat('#cbd5e1', { metalness: 0.45, roughness: 0.3 }), { x: 0.25, y: 0.55, rz: 1 });
    add(new THREE.SphereGeometry(0.28, 16, 10), mat('#cbd5e1', { metalness: 0.45, roughness: 0.3 }), { x: -0.28, y: 0.28, s: [1, 0.65, 0.7], rz: 0.5 });
  }

  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  g.userData.shelfScale = target(SHELF_SIZE, id) / span;
  g.userData.half = size.y * target(SAND_SIZE, id) / span;
  g.scale.setScalar(target(SAND_SIZE, id) / span);

  // The hit zone moves with the thing, so the tap target is the drawn object's own group.
  const hit = mesh(new THREE.SphereGeometry(Math.max(size.x, size.y) * 0.55, 10, 8), hitMat, { y: size.y * 0.5, shadow: false });
  hit.userData.zone = true;
  g.add(hit);
  return g;
}

function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    if (o.userData.zone) return;
    for (const m of [o.material].flat()) {
      if (!m) continue;
      m.map?.dispose();
      m.dispose();
    }
  });
}

export class ShallowsMission extends Mission {
  constructor(game) {
    super(game, 'shallows');
    this.view = { pos: new THREE.Vector3(0, 6.8, 15), look: new THREE.Vector3(0, 2, 0.5), minWidth: 18 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'waiting';
    this.mode = 'watch';
    this.plan = null;
    this.thing = null;
    this.shelves = {};
    this.signs = {};
    this.shelfCount = { float: 0, sink: 0 };
    this.maps = [];
    this.mats = [];
    this.bobbing = new Set();
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
  }

  build() {
    this.sky = skyMap();
    this.maps.push(this.sky);
    this.scene.background = this.sky;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#fde68a', 2.45));
    const sun = new THREE.DirectionalLight('#fff6e0', 2.05);
    sun.position.set(-7, 14, 10);
    this.scene.add(sun);

    const ground = texture(1024, (c, size) => {
      c.fillStyle = '#fde68a';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 80; i++) {
        const x = (i * 271 + 59) % size, y = (i * 419 + 149) % size, r = 3 + i % 6;
        c.fillStyle = i % 2 ? '#fcd34d' : '#e7c873';
        c.beginPath();
        c.ellipse(x, y, r * 1.8, r, 0.2, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.maps.push(ground);
    const sandMat = new THREE.MeshStandardMaterial({ map: ground, roughness: 1 });
    this.mats.push(sandMat);
    this.scene.add(mesh(new THREE.CircleGeometry(24, 48), sandMat, { rx: -Math.PI / 2, shadow: false }));
    // The bank rises to the waterline, so the side view shows sand, water and the bottom together.
    this.scene.add(mesh(rbox(19, 1.75, 6, 0.3), sandMat, { y: 0.875, z: -1.4, shadow: false }));

    this.bottom = bottomMap();
    this.maps.push(this.bottom);
    const bottomMat = new THREE.MeshStandardMaterial({ map: this.bottom, roughness: 1 });
    this.mats.push(bottomMat);
    this.scene.add(mesh(new THREE.PlaneGeometry(18, 7), bottomMat, { y: BOTTOM, z: 4.9, rx: -Math.PI / 2, shadow: false }));

    const waterMat = new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.38, depthWrite: false });
    this.mats.push(waterMat);
    this.surface = mesh(new THREE.PlaneGeometry(18, 7), waterMat, { y: SURFACE, z: 4.9, rx: -Math.PI / 2, shadow: false });
    this.surface.renderOrder = 1;
    this.scene.add(this.surface);

    const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
    this.mats.push(foamMat);
    this.scene.add(mesh(rbox(18, 0.05, 0.2, 0.04), foamMat, { y: SURFACE + 0.04, z: 1.5, shadow: false }));
    const rippleMat = new THREE.MeshBasicMaterial({ color: '#ecfeff', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.mats.push(rippleMat);
    for (const [x, z, r] of [[-3.4, 5.6, 0.55], [2.6, 6.4, 0.7], [5.4, 3.4, 0.45]]) {
      this.scene.add(mesh(new THREE.RingGeometry(r * 0.7, r, 28), rippleMat, { x, y: SURFACE + 0.01, z, rx: -Math.PI / 2, shadow: false }));
    }

    this.shelves.float = this.addShelf('float', -SHELF_X);
    this.shelves.sink = this.addShelf('sink', SHELF_X);

    this.portrait = portrait();
    const discMat = new THREE.MeshBasicMaterial({ map: this.portrait.texture });
    this.mats.push(discMat);
    this.window = new THREE.Group();
    this.window.add(mesh(new THREE.CircleGeometry(1.3, 48), discMat, { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.36, 0.12, 10, 48), mat('#fbbf24'), { shadow: false }));
    this.window.position.set(0, 5, -5.5);
    this.window.lookAt(this.view.pos);
    this.scene.add(this.window);

    this.onUpdate((dt, t) => {
      for (const thing of this.bobbing) {
        if (thing.parent) thing.position.y = thing.userData.restY + Math.sin(t * 2.1) * 0.05;
      }
    });

    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  addShelf(side, x) {
    const shelf = makeShelf(side);
    const map = signMap(side);
    this.maps.push(map);
    const signMat = new THREE.MeshBasicMaterial({ map });
    this.mats.push(signMat);
    const sign = mesh(new THREE.PlaneGeometry(4.2, 1.2), signMat, { y: 2.05, z: 0.02, shadow: false });
    shelf.add(sign);
    this.signs[side] = sign;
    shelf.position.set(x, SHELF_Y, SHELF_Z);
    shelf.userData.choice = side;
    shelf.userData.tapHeight = 1.35;
    this.scene.add(shelf);
    return shelf;
  }

  bubble(big = '?') {
    ui.bubble({ big, pic: '🦆', onTap: () => this.replay(), passthrough: true });
  }

  openQuestion(task, step) {
    const item = `${task.side}:${task.id}`;
    const short = step === 'drop' ? T.shallowsDrop : step === 'place' ? T.shallowsWhere : T.shallowsAsk;
    const answer = () => (step === 'guess' ? T.shallowsThing(task) : [...T.shallowsThing(task), ...T.shallowsWhere()]);
    const pulse = () => {
      if (step === 'drop') this.hint(this.thing, () => this.phase !== 'dropping');
      else this.hint(this.shelves[task.side], () => this.phase === 'solved' || this.phase === 'clearing');
    };
    this.question('sorting', item, {
      short,
      hint: () => {
        pulse();
        return step === 'drop' ? T.shallowsDrop() : answer();
      },
      simplify: () => {
        if (step !== 'drop') pulse();
        return step === 'drop' ? T.shallowsDrop() : answer();
      },
      reveal: pulse,
    }, { options: 2 });
  }

  tapShelves(on = true) {
    for (const side of ['float', 'sink']) {
      if (on) this.tappable(this.shelves[side], () => this.tapShelf(side));
      else this.untap(this.shelves[side]);
    }
  }

  untapShelves() {
    for (const side of ['float', 'sink']) this.untap(this.shelves[side]);
  }

  tapShelf(side) {
    if (this.phase !== 'guessing' && this.phase !== 'placing') return;
    this.poke();
    if (this.phase === 'guessing') this.phase = 'guessed';
    this.shelfResolve?.(side);
    this.shelfResolve = null;
  }

  tapDrop() {
    if (this.phase !== 'dropping') return;
    this.poke();
    this.phase = 'dropped';
    this.untap(this.thing);
    delete this.thing.userData.choice;
    this.dropResolve?.();
    this.dropResolve = null;
  }

  waitForShelf() {
    return new Promise((resolve) => { this.shelfResolve = resolve; });
  }

  splash() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, depthWrite: false });
    const geometry = new THREE.SphereGeometry(0.07, 6, 4);
    const drops = [];
    for (let i = 0; i < 10; i++) {
      const drop = new THREE.Mesh(geometry, material);
      drop.position.set(DROP_AT.x, SURFACE, DROP_AT.z);
      drop.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.3, 1.4 + Math.random() * 1.5, (Math.random() - 0.5) * 1.3);
      group.add(drop);
      drops.push(drop);
    }
    this.scene.add(group);
    animate(650, (t) => {
      const s = t * 0.65;
      for (const drop of drops) {
        drop.position.set(DROP_AT.x + drop.userData.v.x * s, SURFACE + drop.userData.v.y * s - 4.9 * s * s, DROP_AT.z + drop.userData.v.z * s);
      }
      material.opacity = 0.92 * (1 - t);
    }, ease.linear).then(() => {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    });
  }

  async dropThing(task) {
    const to = DROP_AT.clone();
    const height = this.thing.userData.half ?? 0.5;
    to.y = task.side === 'float' ? Math.max(0.35, SURFACE - height * 0.55) : BOTTOM + 0.02;
    const from = this.thing.position.clone();
    sfx.bubble();
    this.splash();
    await animate(950, (t) => {
      this.thing.position.lerpVectors(from, to, t);
      this.thing.position.y += Math.sin(t * Math.PI) * 0.35;
    }, task.side === 'float' ? ease.out : ease.in);
    if (!this.alive) return;
    this.thing.position.copy(to);
    if (task.side === 'float') {
      this.thing.userData.restY = to.y;
      this.bobbing.add(this.thing);
    }
  }

  async placeOnShelf(task) {
    const shelf = this.shelves[task.side];
    const i = this.shelfCount[task.side]++;
    const [x, y] = SLOTS[Math.min(i, SLOTS.length - 1)];
    const to = shelf.localToWorld(new THREE.Vector3(x, y, 0.35));
    const from = this.thing.position.clone();
    this.bobbing.delete(this.thing);
    await animate(650, (t) => {
      this.thing.position.lerpVectors(from, to, t);
      this.thing.position.y += Math.sin(t * Math.PI) * 1.1;
    }, ease.inOut);
    if (!this.alive) return;
    shelf.attach(this.thing);
    this.thing.position.set(x, y, 0.35);
    this.thing.rotation.set(0, 0, 0);
    this.thing.scale.setScalar(this.thing.userData.shelfScale);
    this.thing.userData.placed = true;
    sfx.pop();
  }

  async watchRound(task) {
    this.phase = 'dropping';
    this.last = 'drop';
    this.thing.userData.choice = 'drop';
    this.tappable(this.thing, () => this.tapDrop());
    this.openQuestion(task, 'drop');
    this.bubble('💧');
    this.ask(T.shallowsDrop());
    await new Promise((done) => { this.dropResolve = done; });
    if (!this.alive) return;
    const talk = this.say(T.shallowsThing(task));
    await this.dropThing(task);
    await talk;
    if (!this.alive) return;

    this.phase = 'placing';
    this.last = task.side;
    this.openQuestion(task, 'place');
    this.bubble();
    this.tapShelves();
    this.ask(T.shallowsWhere());
    let side;
    for (;;) {
      side = await this.waitForShelf();
      if (!this.alive) return;
      if (side === task.side) break;
      this.wrong(side, { obj: this.shelves[side], feedback: false });
      await this.say([...T.shallowsThing(task), ...T.shallowsWhere()]);
    }
    this.untapShelves();
    this.phase = 'solved';
    this.correct(side);
    this.stopIdle();
    await this.placeOnShelf(task);
    if (!this.alive) return;
    this.success(this.shelves[task.side].position.clone().add(new THREE.Vector3(0, 1.8, 0)));
    sfx.good();
    await this.say(this.praise());
  }

  async guessRound(task) {
    this.phase = 'guessing';
    this.last = task.side;
    this.openQuestion(task, 'guess');
    this.bubble();
    this.tapShelves();
    this.ask(T.shallowsAsk());
    const guess = await this.waitForShelf();
    if (!this.alive) return;
    this.untapShelves();
    this.phase = 'revealed';
    const right = guess === task.side;
    if (right) {
      this.correct(guess);
      this.stopIdle();
    } else {
      this.wrong(guess, { obj: this.shelves[guess], feedback: false });
      this.stopIdle();
    }
    const talk = this.say(right ? [...T.shallowsThing(task), ...T.shallowsSurprise(task)] : [...T.shallowsLook(task), ...T.shallowsSurprise(task)]);
    await this.dropThing(task);
    await talk;
    if (!this.alive) return;
    await this.placeOnShelf(task);
    if (!this.alive || !right) return;
    this.success(this.shelves[task.side].position.clone().add(new THREE.Vector3(0, 1.8, 0)));
    sfx.good();
    await this.say(this.praise());
  }

  async round(r) {
    this.plan ||= shallowsPlan(this.L);
    if (r === 0) {
      await this.say(T.shallowsStart());
      if (!this.alive) return;
    }
    const task = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    this.task = task;
    this.phase = 'entering';
    this.lastWrong = null;
    this.thing = makeThing(task.id, this.hitMat);
    this.thing.position.copy(EDGE);
    this.scene.add(this.thing);
    if (this.L.mode === 'watch') await this.watchRound(task);
    else await this.guessRound(task);
    if (!this.alive) return;
    this.phase = 'clearing';
    if (this.thing) this.untap(this.thing);
    this.untapShelves();
    this.bobbing.clear();
    this.thing = null;
    this.shelfResolve = null;
    this.dropResolve = null;
    this.last = null;
  }

  doneLine() { return T.shallowsDone(); }

  success(at) {
    super.success(null);
    if (at) sparkle(this, at, { count: 8 });
  }

  exit() {
    super.exit();
    if (this.thing) this.untap(this.thing);
    this.untapShelves();
    this.bobbing.clear();
    this.maps.forEach((map) => map.dispose());
    this.maps = [];
    this.mats.forEach((m) => m.dispose());
    this.mats = [];
    this.hitMat.dispose();
    this.portrait?.dispose();
    const roots = Object.values(this.shelves);
    if (this.thing && !this.thing.parent?.userData?.choice) roots.push(this.thing);
    for (const root of roots) if (root) disposeTree(root);
  }
}
