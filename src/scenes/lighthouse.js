import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mesh, rbox } from '../models.js';
import { makeLighthouse, makeBoat } from '../world/props.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { texture, TILE_COLORS } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { shuffle } from '../util.js';
import { numbersIn, countVerdict } from '../levels/moon.js';
import { lighthousePlan, flashRound, lighthouseChoices } from '../levels/lighthouse.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const HARBOUR = new THREE.Vector3(-4.4, 0.04, 1.7);
const BOAT_START = new THREE.Vector3(5.4, 0.04, 2.15);
const LAMP_Y = 6.5;
const LAMP_BASE = 1.7;
const DOT_R = 0.16;
const DOT_STEP = 0.55;
const DOT_SLOTS = 7;

const numeralMap = (n, bg = '#ffffff', fg = '#1e3a8a') => texture(256, (c, size) => {
  c.clearRect(0, 0, size, size);
  c.fillStyle = bg;
  c.beginPath();
  c.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `700 ${size * 0.58}px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
  c.fillText(String(n), size / 2, size * 0.54);
});

const sailMap = (n) => texture(256, (c, size) => {
  c.clearRect(0, 0, size, size);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.font = `700 ${size * 0.66}px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
  c.lineWidth = 12;
  c.strokeStyle = '#ffffff';
  c.strokeText(String(n), size / 2, size * 0.54);
  c.fillStyle = '#1e3a8a';
  c.fillText(String(n), size / 2, size * 0.54);
});

// Dusk at the lighthouse: the lamp shows, or she makes it show, and a boat comes home.
export class LighthouseMission extends Mission {
  constructor(game) {
    super(game, 'lighthouse');
    this.view = { pos: new THREE.Vector3(0, 9.2, 17), look: new THREE.Vector3(0, 3.4, 0), minWidth: 17 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.phase = 'waiting';
    this.mode = null;
    this.boat = null;
    this.choices = [];
    this.dots = [];
    this.maps = [];
    this.mats = [];
    this.roundMaps = [];
    this.roundMats = [];
  }

  build() {
    this.skyMap = texture(512, (c, size) => {
      const g = c.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#e98a86');
      g.addColorStop(0.42, '#f4ab8f');
      g.addColorStop(0.72, '#ffd0a4');
      g.addColorStop(1, '#ffe8c8');
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      for (const [x, y, rx, ry] of [[90, 120, 64, 22], [175, 145, 44, 16], [360, 85, 74, 24], [440, 115, 42, 15]]) {
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.scene.background = this.skyMap;
    this.maps.push(this.skyMap);

    this.scene.add(new THREE.HemisphereLight('#fff2df', '#5fb5a1', 2.35));
    const sunLight = new THREE.DirectionalLight('#ffe4bd', 2.1);
    sunLight.position.set(-8, 14, 10);
    this.scene.add(sunLight);

    this.seaMap = texture(1024, (c, size) => {
      c.fillStyle = '#3fbfa7';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i++) {
        const y = (i * 131 + 47) % size;
        const x = (i * 293 + 71) % size;
        c.strokeStyle = i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(22,116,118,0.14)';
        c.lineWidth = 2 + i % 3;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 38, y - 7, x + 78 + i % 4 * 12, y);
        c.stroke();
      }
    });
    this.maps.push(this.seaMap);
    const seaMat = new THREE.MeshStandardMaterial({ map: this.seaMap, roughness: 0.45 });
    this.mats.push(seaMat);
    this.scene.add(mesh(new THREE.CircleGeometry(62, 64), seaMat, { rx: -Math.PI / 2, shadow: false }));
    const shallowMat = new THREE.MeshBasicMaterial({ color: '#a2efd9', transparent: true, opacity: 0.28 });
    this.mats.push(shallowMat);
    this.scene.add(mesh(new THREE.RingGeometry(2.2, 7.4, 64), shallowMat, { y: 0.012, rx: -Math.PI / 2, shadow: false }));

    this.sunMap = texture(128, (c) => {
      const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,248,210,1)');
      g.addColorStop(0.4, 'rgba(255,224,150,0.85)');
      g.addColorStop(1, 'rgba(255,200,130,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    this.maps.push(this.sunMap);
    const sunMat = new THREE.SpriteMaterial({ map: this.sunMap, color: '#fff2c8', transparent: true, opacity: 0.9, depthWrite: false });
    this.mats.push(sunMat);
    this.sun = new THREE.Sprite(sunMat);
    this.sun.position.set(3.4, 6.7, -26);
    this.sun.scale.setScalar(9);
    this.sun.raycast = () => {};
    this.scene.add(this.sun);

    const rockMat = new THREE.MeshStandardMaterial({ color: '#8b7f72', roughness: 1 });
    this.mats.push(rockMat);
    this.rock = mesh(new THREE.DodecahedronGeometry(3.2, 1), rockMat, { x: -6, y: 0, z: -2.1, s: [1.25, 0.42, 1.05], shadow: false });
    this.rock.rotation.y = 0.4;
    this.scene.add(this.rock);

    this.lighthouse = makeLighthouse();
    this.lighthouse.scale.setScalar(0.95);
    this.lighthouse.position.set(-6, 1.1, -2.6);
    this.scene.add(this.lighthouse);
    this.lantern = this.lighthouse.children.find((o) => o.isMesh && o.material?.emissive && o.material.emissiveIntensity > 2);
    this.lantern.material = this.lantern.material.clone();
    this.lantern.material.color.set('#fff6c7');
    this.lantern.material.emissiveIntensity = LAMP_BASE;
    this.lantern.scale.setScalar(1.5);
    this.mats.push(this.lantern.material);
    const oldBeam = this.lighthouse.children.find((o) => o.userData.tick);
    if (oldBeam) oldBeam.visible = false;

    this.glowMap = texture(128, (c) => {
      const g = c.createRadialGradient(64, 64, 1, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,225,1)');
      g.addColorStop(0.35, 'rgba(255,242,150,0.95)');
      g.addColorStop(1, 'rgba(255,220,90,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    this.maps.push(this.glowMap);
    this.glowMat = new THREE.SpriteMaterial({ map: this.glowMap, color: '#fff3a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mats.push(this.glowMat);
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.setScalar(4.4);
    this.glow.visible = false;
    this.glow.raycast = () => {};
    this.lantern.add(this.glow);

    const beamGeo = new THREE.CylinderGeometry(2.4, 0.08, 16, 16, 1, true);
    beamGeo.translate(0, 8, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.mats.push(this.beamMat);
    this.beam = mesh(beamGeo, this.beamMat, { rz: -Math.PI / 2, shadow: false });
    this.beam.visible = false;
    const beamPivot = new THREE.Group();
    beamPivot.position.set(0, LAMP_Y, 0);
    beamPivot.rotation.y = -0.25;
    beamPivot.add(this.beam);
    this.lighthouse.add(beamPivot);

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.mats.push(hitMat);
    this.lamp = mesh(new THREE.SphereGeometry(1.05, 12, 8), hitMat, { shadow: false });
    this.lamp.userData.choice = 'lamp';
    this.lamp.userData.tapHeight = 0;
    this.lantern.add(this.lamp);

    this.portrait = portrait();
    const discMat = new THREE.MeshBasicMaterial({ map: this.portrait.texture });
    this.mats.push(discMat);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#f4cf87', roughness: 0.4 });
    this.mats.push(rimMat);
    this.window = new THREE.Group();
    this.window.add(mesh(new THREE.CircleGeometry(0.98, 48), discMat, { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.03, 0.09, 10, 48), rimMat, { shadow: false }));
    this.window.position.set(-3.6, 3, -2.5);
    this.window.scale.setScalar(0.95);
    this.scene.add(this.window);
    this.window.lookAt(this.view.pos);

    const woodMat = new THREE.MeshStandardMaterial({ color: '#a16207', roughness: 0.85 });
    this.mats.push(woodMat);
    this.harbour = new THREE.Group();
    this.harbour.add(mesh(rbox(2.3, 0.18, 1.1, 0.05), woodMat, { y: 0.18, shadow: false }));
    for (const x of [-0.9, 0.9]) for (const z of [-0.38, 0.38]) this.harbour.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 10), woodMat, { x, z, y: 0.08, shadow: false }));
    this.harbour.position.set(-5, 0, 2.75);
    this.scene.add(this.harbour);

    const frameMat = new THREE.MeshStandardMaterial({ color: '#f3e2bf', roughness: 0.7 });
    const boardMat = new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.8 });
    this.mats.push(frameMat, boardMat);
    this.board = new THREE.Group();
    this.board.add(mesh(rbox(4.4, 1, 0.12, 0.08), frameMat, { shadow: false }));
    this.board.add(mesh(rbox(4.14, 0.78, 0.04, 0.06), boardMat, { z: 0.08, shadow: false }));
    this.board.add(mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.5, 10), woodMat, { y: -1.1, z: -0.02, shadow: false }));
    this.board.position.set(0.4, 2.6, -0.2);
    this.board.lookAt(this.view.pos);
    this.scene.add(this.board);

    this.onUpdate((dt, t) => {
      const b = this.boat;
      if (!b || b.userData.sailing) return;
      const extra = b.userData.bobUntil > performance.now() ? Math.sin(t * 16) * 0.1 : 0;
      b.position.y = 0.04 + Math.sin(t * 2.2 + b.userData.seed) * 0.07 + extra;
      b.rotation.z = Math.sin(t * 1.6 + b.userData.seed) * 0.035;
    });
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makeBoat(numeral = null, done = false) {
    const boat = makeBoat('#ef4444');
    boat.scale.setScalar(1.1);
    boat.position.set(9.2, 0.04, 2.15);
    boat.userData.seed = Math.random() * 6;
    boat.userData.tapHeight = 1;
    if (done) boat.userData.choice = 'done';
    this.scene.add(boat);
    this.boat = boat;
    boat.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    this.boatHitMat = new THREE.MeshBasicMaterial({ visible: false });
    boat.add(mesh(new THREE.SphereGeometry(1.35, 12, 8), this.boatHitMat, { y: 0.8, shadow: false }));
    if (numeral != null) {
      const map = sailMap(numeral);
      this.roundMaps.push(map);
      this.sailMat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
      boat.add(mesh(new THREE.PlaneGeometry(1, 1), this.sailMat, { x: 0.5, y: 1.18, z: 0.06, shadow: false }));
      boat.userData.numeral = numeral;
    }
    return boat;
  }

  async enterBoat() {
    const boat = this.boat;
    const from = boat.position.clone(), to = BOAT_START.clone();
    boat.userData.sailing = true;
    await animate(1100, (t) => {
      boat.position.lerpVectors(from, to, t);
      boat.position.y = 0.04 + Math.sin(t * Math.PI) * 0.16;
    }, ease.out);
    boat.userData.sailing = false;
  }

  makeBuoy(num, color) {
    const buoy = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
    this.roundMats.push(bodyMat, whiteMat);
    buoy.add(mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.35, 24), bodyMat, { y: 0.68, shadow: false }));
    buoy.add(mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.26, 24), whiteMat, { y: 0.82, shadow: false }));
    buoy.add(mesh(new THREE.SphereGeometry(0.22, 16, 12), whiteMat, { y: 1.46, shadow: false }));
    const map = numeralMap(num);
    this.roundMaps.push(map);
    const plaqueMat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    this.roundMats.push(plaqueMat);
    const plaque = mesh(new THREE.PlaneGeometry(1.05, 1.05), plaqueMat, { y: 0.95, z: 0.74, shadow: false });
    plaque.rotation.x = -0.35;
    buoy.add(plaque);
    buoy.userData.num = num;
    buoy.userData.tapHeight = 0.7;
    return buoy;
  }

  addDot() {
    if (this.dots.length >= DOT_SLOTS) return;
    const dot = mesh(new THREE.CircleGeometry(DOT_R, 20), new THREE.MeshBasicMaterial({ color: '#fde047' }), {
      x: -DOT_STEP * (DOT_SLOTS - 1) / 2 + this.dots.length * DOT_STEP,
      z: 0.12,
      shadow: false,
    });
    this.board.add(dot);
    this.dots.push(dot);
  }

  clearDots() {
    for (const dot of this.dots) {
      this.board.remove(dot);
      dot.geometry.dispose();
      dot.material.dispose();
    }
    this.dots = [];
  }

  async countDots() {
    for (let i = 0; i < this.dots.length; i++) {
      if (!this.alive) return;
      this.dots[i].material.color.set('#fff1a8');
      await this.say(T.number(i + 1));
    }
    this.dots.forEach((dot) => dot.material.color.set('#fde047'));
  }

  async flashOnce() {
    sfx.ding();
    const material = this.lantern.material;
    this.glow.visible = true;
    await animate(500, (t) => {
      material.emissiveIntensity = LAMP_BASE + t * 6;
      this.glowMat.opacity = 0.9 * Math.min(1, t * 1.6);
      this.glow.scale.setScalar(4.2 + t * 1.4);
    }, ease.out);
    await animate(600, (t) => {
      material.emissiveIntensity = LAMP_BASE + 6 - t * 6;
      this.glowMat.opacity = 0.9 * (1 - t);
      this.glow.scale.setScalar(5.6 - t * 1.4);
    }, ease.in);
    this.glow.visible = false;
    this.glowMat.opacity = 0;
    material.emissiveIntensity = LAMP_BASE;
  }

  async showFlashes(n, { dots = false } = {}) {
    if (!this.alive) return;
    this.flashing = true;
    for (let i = 0; i < n; i++) {
      if (!this.alive) break;
      if (dots) this.addDot();
      await this.flashOnce();
      if (!this.alive) break;
    }
    this.flashing = false;
  }

  async replayFlashes() {
    if (this.flashing || !this.target) return;
    await this.showFlashes(this.target);
  }

  bobBoat() {
    if (this.boat) this.boat.userData.bobUntil = performance.now() + 950;
  }

  async arriveBoat() {
    const boat = this.boat;
    if (!boat) return;
    boat.userData.sailing = true;
    this.beam.visible = true;
    this.beamMat.opacity = 0;
    animate(350, (t) => { this.beamMat.opacity = 0.36 * t; }, ease.out);
    const from = boat.position.clone(), to = HARBOUR.clone();
    await animate(1500, (t) => {
      boat.position.lerpVectors(from, to, t);
      boat.position.y = 0.04 + Math.sin(t * Math.PI) * 0.22;
      boat.rotation.z = Math.sin(t * Math.PI) * 0.05;
    }, ease.inOut);
    boat.position.copy(to);
    boat.rotation.z = 0;
    boat.userData.sailing = false;
    sfx.toot();
    await wait(350);
    if (!this.alive) return;
    animate(700, (t) => { this.beamMat.opacity = 0.36 * (1 - t); }, ease.in).then(() => { this.beam.visible = false; });
  }

  async choose(n) {
    this.phase = 'choosing';
    this.last = n;
    const max = Math.max(this.L.numbers[1] + 1, n + 1);
    const nums = lighthouseChoices(n, max, this.L.choices);
    const colors = shuffle(TILE_COLORS);
    this.choices = nums.map((num, i) => {
      const buoy = this.makeBuoy(num, colors[i]);
      buoy.position.set((i - (nums.length - 1) / 2) * 3.3, 0, 3.5);
      this.scene.add(buoy);
      return buoy;
    });
    for (const buoy of this.choices) this.tappable(buoy, () => this.tapChoice(buoy));
    const right = this.choices.find((b) => b.userData.num === n);
    this.question('quantity', n, {
      short: T.lighthouseHowMany,
      hint: async () => {
        if (this.dots.length) await this.countDots();
        else await this.showFlashes(n);
        if (this.alive) await this.say(T.lighthouseHowMany());
      },
      simplify: () => this.removeOption(this.lastWrong?.parent ? this.lastWrong : this.choices.find((b) => b !== right && b.parent)),
      reveal: () => this.hint(right, () => this.phase !== 'choosing'),
    }, { options: this.choices.length });
    ui.bubble({ big: '?', pic: '💡', onTap: () => this.replay(), passthrough: true });
    this.ask(T.lighthouseHowMany());
    await new Promise((resolve) => { this.resolveRound = resolve; });
  }

  async tapChoice(buoy) {
    if (this.phase !== 'choosing') return;
    this.poke();
    this.lookAt(buoy);
    const num = buoy.userData.num;
    if (num !== this.last) {
      this.lastWrong = buoy;
      this.bobBoat();
      this.wrong(num, { obj: buoy });
      return;
    }
    this.phase = 'solved';
    this.correct(num);
    this.stopIdle();
    this.choices.forEach((b) => this.untap(b));
    this.choices.filter((b) => b !== buoy).forEach((b) => { b.visible = false; });
    sfx.good();
    const talk = this.say(T.lighthouseHome());
    await Promise.all([this.arriveBoat(), talk]);
    if (!this.alive) return;
    this.success(this.boat.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
    await this.say(this.praise());
    this.resolveRound?.();
    this.resolveRound = null;
  }

  beginMaking(n, mode) {
    this.target = n;
    this.count = 0;
    this.last = n;
    this.mode = mode;
    this.phase = 'making';
    this.lamp.userData.choice = 'lamp';
    this.onLamp = () => this.tapLamp();
    this.onDone = () => this.tapBoat();
    this.tappable(this.lamp, this.onLamp);
    this.tappable(this.boat, this.onDone);
    this.question(mode === 'more' ? 'sequence' : 'counting', n, {
      short: () => (mode === 'more' ? T.lighthouseMore() : T.lighthouseMake(n)),
      hint: () => {
        this.hint(this.lamp, () => this.phase !== 'making');
        return T.lighthouseCountHelp();
      },
      reveal: async () => {
        this.phase = 'helping';
        this.clearDots();
        this.count = 0;
        this.last = n;
        await this.showFlashes(n);
        if (!this.alive) return;
        this.phase = 'making';
        await this.say(mode === 'more' ? T.lighthouseMore() : T.lighthouseMake(n));
      },
    }, { options: 1 });
    ui.bubble({ big: mode === 'more' ? '?' : String(n), dots: mode === 'more' ? 0 : n, pic: '💡', onTap: () => this.replay(), passthrough: true });
    this.ask([...(mode === 'more' ? T.lighthouseMore() : T.lighthouseMake(n)), ...T.lighthouseDoneTap()]);
  }

  async tapLamp() {
    if (this.phase !== 'making' || this.flashing) return;
    this.poke();
    this.flashing = true;
    this.count++;
    this.addDot();
    await this.flashOnce();
    this.flashing = false;
    if (!this.alive) return;
    this.last = this.count >= this.target ? 'done' : this.target;
    if (this.count >= this.target) delete this.lamp.userData.choice;
  }

  async tapBoat() {
    if (this.phase !== 'making') return;
    this.poke();
    const verdict = countVerdict(this.count, this.target);
    if (verdict !== 'right') {
      this.bobBoat();
      this.wrong(this.count, { obj: this.boat, feedback: false });
      await this.say(verdict === 'few' ? T.lighthouseTooFew() : T.lighthouseTooMany());
      if (!this.alive) return;
      this.clearDots();
      this.count = 0;
      this.last = this.target;
      this.lamp.userData.choice = 'lamp';
      this.phase = 'helping';
      await this.showFlashes(this.target);
      if (!this.alive) return;
      this.phase = 'making';
      this.ask([...(this.mode === 'more' ? T.lighthouseMore() : T.lighthouseMake(this.target)), ...T.lighthouseDoneTap()]);
      return;
    }
    this.phase = 'solved';
    this.correct(this.target);
    this.stopIdle();
    this.untap(this.lamp);
    this.untap(this.boat);
    this.onLamp = this.onDone = null;
    sfx.good();
    const talk = this.say(T.lighthouseHome());
    await Promise.all([this.arriveBoat(), talk]);
    if (!this.alive) return;
    await this.countDots();
    if (!this.alive) return;
    this.success(this.boat.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
    await this.say(this.praise());
    this.resolveRound?.();
    this.resolveRound = null;
  }

  async round(r) {
    if (r === 0) {
      await this.say([...T.lighthouseStart(), ...T.lighthouseWhy()]);
    } else if (r === 1) {
      await this.say(T.lighthouseEach());
    }
    if (!this.alive) return;
    this.clearRound();
    this.plan ||= lighthousePlan(this.L.mode, this.rounds);
    this.mode = this.plan[r] ?? this.L.mode;
    const n = this.pick(this.mode === 'more' ? 'sequence' : this.mode === 'make' ? 'counting' : 'quantity', numbersIn(this.L.numbers));
    const task = flashRound(this.mode, n);
    this.target = task.target;
    this.last = task.target;
    this.makeBoat(this.mode === 'make' ? n : null, this.mode === 'make' || this.mode === 'more');
    await this.enterBoat();
    if (!this.alive) return;
    if (this.mode === 'marks') {
      await this.showFlashes(task.flashes, { dots: true });
      if (!this.alive) return;
      await this.choose(n);
    } else if (this.mode === 'flashes') {
      await this.showFlashes(task.flashes);
      if (!this.alive) return;
      await this.choose(n);
    } else if (this.mode === 'make') {
      this.beginMaking(task.target, 'make');
      await new Promise((resolve) => { this.resolveRound = resolve; });
    } else {
      await this.showFlashes(task.flashes);
      if (!this.alive) return;
      this.beginMaking(task.target, 'more');
      await new Promise((resolve) => { this.resolveRound = resolve; });
    }
    if (!this.alive) return;
    this.phase = 'clearing';
    this.clearRound();
  }

  replay() {
    const flashes = this.mode === 'flashes' && this.phase === 'choosing';
    super.replay();
    if (flashes) this.replayFlashes();
  }

  doneLine() { return T.lighthouseDone(); }

  success(at) {
    super.success(null);
    if (at) sparkle(this, at, { count: 8 });
  }

  clearRound() {
    this.onLamp = this.onDone = null;
    if (this.lamp) this.untap(this.lamp);
    if (this.boat) this.untap(this.boat);
    for (const buoy of this.choices) this.untap(buoy);
    for (const buoy of this.choices) this.disposeObject(buoy);
    this.choices = [];
    if (this.boat) {
      this.disposeObject(this.boat, false);
      this.boat = null;
    }
    this.sailMat?.dispose();
    this.sailMat = null;
    this.boatHitMat?.dispose();
    this.boatHitMat = null;
    this.clearDots();
    this.roundMaps.forEach((map) => map.dispose());
    this.roundMaps = [];
    this.roundMats.forEach((m) => m.dispose());
    this.roundMats = [];
    this.beamMat.opacity = 0;
    this.beam.visible = false;
    this.glowMat.opacity = 0;
    this.glow.visible = false;
    this.lantern.material.emissiveIntensity = LAMP_BASE;
    this.lastWrong = null;
    this.last = null;
    this.count = 0;
    this.phase = 'clearing';
  }

  disposeObject(obj, materials = true) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (materials) for (const m of [o.material].flat()) if (m) m.dispose();
    });
    obj.removeFromParent();
  }

  exit() {
    super.exit();
    this.clearRound();
    this.maps.forEach((map) => map.dispose());
    this.maps = [];
    this.mats.forEach((m) => m.dispose());
    this.mats = [];
    for (const root of [this.lighthouse, this.rock, this.harbour, this.board, this.window]) {
      root?.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.portrait?.dispose();
  }
}
