import * as THREE from 'three';
import { animate, ease, wait, hop } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { sparkle } from '../fx/particles.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { numbersIn } from '../levels/moon.js';
import { craterCells, craterChoices, nearFromLevel } from '../levels/mercury.js';
import { shuffle } from '../util.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const TILE = 1.55, TILE_Z = 3.8, TILE_GAP = 2.2;
const BOWL = '#6f6f78', RIM = '#b9b9c2', LIT = '#ffd166', LIT_RIM = '#fff1b8';
const DUST_X = -4.5;

function texture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function chaseWindow() {
  return texture(256, (c) => {
    c.fillStyle = '#6b4f9e';
    c.beginPath(); c.arc(128, 128, 128, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5b3216';
    for (const x of [70, 186]) { c.beginPath(); c.ellipse(x, 84, 30, 42, x < 128 ? -0.5 : 0.5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#cf8a45';
    c.beginPath(); c.arc(128, 142, 78, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5b3216';
    c.beginPath(); c.arc(128, 112, 78, Math.PI, 0); c.fill();
    c.fillStyle = '#f2cf9c';
    c.beginPath(); c.ellipse(128, 170, 40, 28, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3b2412';
    for (const x of [100, 156]) { c.beginPath(); c.arc(x, 140, 9, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.ellipse(128, 158, 10, 7, 0, 0, Math.PI * 2); c.fill();
  });
}

export class MercuryMission extends Mission {
  constructor(game) {
    super(game, 'mercury');
    this.view = { pos: new THREE.Vector3(0, 10, 16), look: new THREE.Vector3(0, 1.2, 0), minWidth: 16 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'landing';
    this.blocks = [];
    this.maps = [];
    this.mats = [];
    this.roundMaps = [];
    this.lastWrong = null;
  }

  build() {
    this.scene.background = new THREE.Color('#9b77db');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9d1ed', 2.4));
    const sunLight = new THREE.DirectionalLight('#fff6eb', 2);
    sunLight.position.set(-6, 14, 10);
    this.scene.add(sunLight);

    const ground = texture(1024, (c, size) => {
      c.fillStyle = '#b9b4bd'; c.fillRect(0, 0, size, size);
      for (let i = 0; i < 120; i++) {
        const x = (i * 277 + 89) % size, y = (i * 433 + 217) % size, r = 6 + i % 6 * 3;
        c.fillStyle = i % 2 ? '#aaa5af' : '#c6c1c9';
        c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); c.fill();
      }
    });
    this.maps.push(ground);
    const groundMat = new THREE.MeshStandardMaterial({ map: ground, roughness: 1 });
    this.mats.push(groundMat);
    this.scene.add(mesh(new THREE.CircleGeometry(5.2, 64), groundMat, { rx: -Math.PI / 2, shadow: false }));

    const sunMap = texture(256, (c) => {
      const g = c.createRadialGradient(128, 128, 10, 128, 128, 128);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(0.35, '#ffe08a'); g.addColorStop(0.7, '#ffb347'); g.addColorStop(1, 'rgba(255,179,71,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    });
    this.maps.push(sunMap);
    const sunMat = new THREE.SpriteMaterial({ map: sunMap, color: '#fff3c4', transparent: true, depthWrite: false });
    this.mats.push(sunMat);
    this.sun = new THREE.Sprite(sunMat);
    this.sun.position.set(-7.5, 7.2, -9);
    this.sun.scale.setScalar(6);
    this.scene.add(this.sun);

    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 90 }, (_, i) => {
      const n = Math.floor(i / 3);
      return i % 3 === 0 ? Math.sin(n * 17) * 14 : i % 3 === 1 ? 2 + (n % 5) : Math.cos(n * 11) * 10;
    }), 3));
    const starMat = new THREE.PointsMaterial({ color: '#f9dffc', size: 0.08 });
    this.mats.push(starMat);
    this.scene.add(new THREE.Points(stars, starMat));

    this.rocket = makeRocket();
    this.rocket.position.set(-6.2, 7, -3.4);
    this.rocket.userData.flame.visible = true;
    this.scene.add(this.rocket);
    this.landed = animate(1800, (t) => { this.rocket.position.y = 1.4 + (1 - t) * 5.6; }, ease.out).then(() => {
      this.rocket.userData.flame.visible = false;
    });

    const windowMap = chaseWindow();
    this.maps.push(windowMap);
    const windowMat = new THREE.MeshBasicMaterial({ map: windowMap });
    this.mats.push(windowMat);
    this.chase = mesh(new THREE.CircleGeometry(1, 48), windowMat, { x: 6.2, y: 0.03, z: -3.8, rx: -Math.PI / 2, shadow: false });
    this.chase.userData.dynamic = true;
    this.scene.add(this.chase);
    this.scene.add(mesh(new THREE.TorusGeometry(1.04, 0.1, 8, 48), mat('#f4cf87'), { x: 6.2, y: 0.04, z: -3.8, rx: -Math.PI / 2, shadow: false }));
    this.onUpdate((dt, t) => this.chase.scale.setScalar(t < this.cheerUntil ? 1 + Math.sin(t * 5) * 0.035 : 1));

    const dustMap = texture(128, (c) => {
      const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, '#fde7ef'); g.addColorStop(0.55, '#f9c6d3'); g.addColorStop(1, 'rgba(249,198,211,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    });
    this.maps.push(dustMap);
    this.dust = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const m = new THREE.SpriteMaterial({ map: dustMap, color: '#f9c6d3', transparent: true, opacity: 0, depthWrite: false });
      this.mats.push(m);
      const s = new THREE.Sprite(m);
      s.position.set((i - 2) * 0.9, 0.75 + (i % 2) * 0.25, (i % 3 - 1) * 0.35);
      s.scale.setScalar(2 + (i % 3) * 0.3);
      this.dust.add(s);
    }
    this.dust.position.set(DUST_X, 0, 0.2);
    this.dust.visible = false;
    this.scene.add(this.dust);

    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makeCraters(n) {
    const group = new THREE.Group();
    for (const k of craterCells(n)) {
      const crater = new THREE.Group();
      const bowl = mesh(new THREE.CircleGeometry(0.4, 28), new THREE.MeshStandardMaterial({ color: BOWL, roughness: 1 }), { rx: -Math.PI / 2, y: 0.02, shadow: false });
      const rim = mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 28), new THREE.MeshStandardMaterial({ color: RIM, roughness: 1 }), { rx: Math.PI / 2, y: 0.06, shadow: false });
      crater.add(bowl, rim);
      crater.position.set(((k % 3) - 1) * 1.3, 0, (Math.floor(k / 3) - 1) * 1.3 + 0.2);
      crater.userData.bowl = bowl;
      crater.userData.rim = rim;
      group.add(crater);
    }
    this.scene.add(group);
    this.craters = group;
    return group;
  }

  makeTiles(n) {
    const nums = craterChoices(n, this.L.craters, this.L.choices, nearFromLevel(this.level));
    const colors = shuffle(TILE_COLORS);
    this.blocks = nums.map((num, i) => {
      const map = glyphTexture(String(num), { bg: colors[i], dots: this.L.labels === 'both' ? num : 0 });
      this.roundMaps.push(map);
      const b = mesh(rbox(TILE, TILE, 0.32, 0.16), new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), {
        x: (i - (nums.length - 1) / 2) * TILE_GAP, y: TILE / 2, z: TILE_Z, shadow: false,
      });
      b.userData.num = num;
      b.userData.tapHeight = 0;
      this.scene.add(b);
      this.dropIn(b, TILE / 2, i * 100).then(() => sfx.pop());
      this.tappable(b, () => this.tapTile(b));
      return b;
    });
    return this.blocks;
  }

  async hideCraters() {
    this.dust.visible = true;
    this.dust.position.x = DUST_X;
    await animate(650, (t) => {
      this.dust.position.x = DUST_X * (1 - t);
      for (const s of this.dust.children) s.material.opacity = 0.94 * t;
    }, ease.out);
    this.craters.visible = false;
  }

  async revealCraters() {
    this.craters.visible = true;
    if (!this.dust?.visible) return;
    const x0 = this.dust.position.x;
    await animate(550, (t) => {
      this.dust.position.x = x0 + 5 * t;
      for (const s of this.dust.children) s.material.opacity = 0.94 * (1 - t);
    }, ease.in);
    this.dust.visible = false;
    this.dust.position.x = DUST_X;
  }

  lightCrater(crater, on) {
    crater.userData.bowl.material.color.set(on ? LIT : BOWL);
    crater.userData.rim.material.color.set(on ? LIT_RIM : RIM);
  }

  async countCraters({ keep = false } = {}) {
    const craters = this.craters?.children || [];
    for (let i = 0; i < craters.length; i++) {
      if (!this.alive) return;
      const crater = craters[i];
      this.lightCrater(crater, true);
      sparkle(this, crater.position.clone().add(new THREE.Vector3(0, 0.25, 0)), { count: 5, size: 0.1, speed: 1.4 });
      await this.say(T.number(i + 1));
    }
    if (!keep) craters.forEach((crater) => this.lightCrater(crater, false));
  }

  async tapTile(b) {
    if (this.phase !== 'choosing' || this.busy) return;
    this.poke();
    this.lookAt(b.position);
    const num = b.userData.num;
    if (num !== this.last) {
      this.busy = true;
      this.lastWrong = b;
      this.wrong(num, { obj: b, feedback: false });
      hop(b, 0.3, 300);
      await this.say(T.mercuryWrong());
      if (!this.alive) return;
      await this.revealCraters();
      if (!this.alive) return;
      await this.countCraters();
      if (!this.alive) return;
      const right = this.blocks.find((x) => x.userData.num === this.last);
      if (right) this.hint(right, () => this.phase !== 'choosing');
      this.busy = false;
      return;
    }
    this.phase = 'solved';
    this.busy = true;
    this.correct(num);
    this.stopIdle();
    this.blocks.forEach((x) => this.untap(x));
    sfx.good();
    await this.revealCraters();
    if (!this.alive) return;
    await this.countCraters({ keep: true });
    if (!this.alive) return;
    this.success(b.position.clone().add(new THREE.Vector3(0, 1, 0)));
    await this.say([...T.mercuryRight(num), this.praise()]);
    if (!this.alive) return;
    this.blocks.filter((x) => x !== b && x.parent).forEach((x) => this.shrinkAway(x, 250));
    this.resolveRound?.();
  }

  async craterRound() {
    const n = this.pick('quantity', numbersIn(this.L.craters));
    this.last = n;
    this.phase = 'looking';
    this.busy = false;
    this.lastWrong = null;
    this.makeCraters(n);
    const flash = this.L.show === 'flash';
    if (flash) {
      await wait(2000);
      if (!this.alive) return;
      await this.hideCraters();
      if (!this.alive) return;
    }
    const done = new Promise((resolve) => { this.resolveRound = resolve; });
    this.makeTiles(n);
    const ask = flash ? T.mercuryFlashAsk() : T.mercuryStayAsk();
    const right = this.blocks.find((b) => b.userData.num === n);
    this.question('quantity', n, {
      short: ask,
      hint: async () => {
        await this.revealCraters();
        if (this.alive) await this.countCraters();
      },
      simplify: () => this.removeOption(this.lastWrong?.parent ? this.lastWrong : this.blocks.find((b) => b !== right && b.parent)),
      reveal: () => this.hint(right, () => this.phase !== 'choosing'),
    }, { options: this.blocks.length });
    ui.bubble({ big: '?', pic: '🌑', onTap: () => this.replay(), passthrough: true });
    this.ask(ask);
    this.phase = 'choosing';
    await done;
    if (!this.alive) return;
    this.clearRound();
  }

  clearRound() {
    const stuff = [...this.blocks, ...(this.craters?.children || [])];
    for (const o of stuff) {
      this.untap(o);
      o.traverse((x) => {
        if (x.geometry) x.geometry.dispose();
        for (const m of [x.material].flat()) if (m) m.dispose();
      });
      o.removeFromParent();
    }
    this.roundMaps.forEach((map) => map.dispose());
    this.roundMaps = [];
    this.blocks = [];
    this.craters = null;
    this.lastWrong = null;
    this.resolveRound = null;
  }

  async round(r) {
    if (r === 0) {
      await this.landed;
      if (!this.alive) return;
      await this.say(T.mercuryStart());
    }
    if (!this.alive) return;
    await this.craterRound();
    if (!this.alive) return;
    this.phase = 'clearing';
  }

  doneLine() { return T.mercuryDone(); }

  success(at) {
    super.success(null);
    this.cheer(2);
    if (at) sparkle(this, at, { count: 8 });
  }

  exit() {
    super.exit();
    this.clearRound();
    this.maps.forEach((map) => map.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}
