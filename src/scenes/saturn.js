import * as THREE from 'three';
import { animate, ease, wait, camera } from '../engine.js';
import { mesh } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { saturnPieces, saturnSlots, slotOf, slotAtPoint, SCALE } from '../levels/saturn.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const RING_Y = 3.4;
const PLANET = 2.35;
const RINGS = { ice: [2.9, 4.05], rock: [4.2, 5.65] };
const SAMPLE_AT = { ice: 0.35, rock: Math.PI - 0.35 }; // a crystal on the ice ring, a stone on the rock ring, clear of the holes
const PIC = { ice: '❄️', rock: '🪨' };
const HOME = new THREE.Vector3(0, 2.5, 6.6);
const SKY = '#9b77db', HOLE = '#7a58c4', GLOW = new THREE.Color('#fff3b0'); // a hole is a little deeper than the sky
const LIGHT = '#ffcf6e', LIT = 0.55, FLASH_S = 0.6; // the ring under the piece glows; a drop that landed nowhere glows every ring for a moment
const REACH = 0.03; // a drop this close to a ring (a share of the screen's short side, 25 px on an iPad) still lands on it
const AROUND = 8, STEPS = 6;
/** Where to look for a ring around the piece, in shares of REACH: its own centre, then eight points on each of six rings outward. */
const PROBES = [[0, 0]];
for (let step = 1; step <= STEPS; step++) {
  for (let i = 0; i < AROUND; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / AROUND;
    PROBES.push([(Math.cos(angle) * step) / STEPS, (Math.sin(angle) * step) / STEPS]);
  }
}
const mid = (ring) => (ring[0] + ring[1]) / 2;

export class SaturnMission extends Mission {
  constructor(game) {
    super(game, 'saturn');
    this.rounds = this.L.pieces ?? 4;
    this.view = { pos: new THREE.Vector3(0, 8.4, 17.5), look: new THREE.Vector3(0, 3.2, -0.3), minWidth: 17 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'landing';
    this.plan = null;
    this.maps = [];
    this.spin = false;
    this.spot = new THREE.Vector3();
    this.toRings = new THREE.Matrix4();
    this.eye = new THREE.Vector3();
    this.sight = new THREE.Vector3();
    this.lit = null;
    this.flashUntil = 0;
    this.now = 0;
  }

  build() {
    this.scene.background = new THREE.Color(SKY);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9d1ed', 2.4));
    const sun = new THREE.DirectionalLight('#fff6eb', 2);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);

    const planetMap = texture(512, (c, size) => {
      const bands = [['#f7e4ad', 0], ['#e7c37a', 0.16], ['#f8e6b0', 0.31], ['#dcb062', 0.46], ['#f3dc9e', 0.61], ['#e2bd72', 0.78], ['#f0d79a', 0.9]];
      for (let i = 0; i < bands.length; i++) {
        c.fillStyle = bands[i][0];
        c.fillRect(0, bands[i][1] * size, size, size * (i === bands.length - 1 ? 0.1 : 0.16));
      }
      c.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 26; i++) {
        const x = (i * 197 + 31) % size, y = (i * 313 + 67) % size;
        c.beginPath();
        c.ellipse(x, y, 18 + i % 5 * 7, 5 + i % 3 * 2, 0, 0, Math.PI * 2);
        c.fill();
      }
    });
    const rockMap = texture(256, (c, size) => {
      c.fillStyle = '#94714f';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 80; i++) {
        const x = (i * 71 + 17) % size, y = (i * 113 + 47) % size;
        c.fillStyle = i % 3 ? '#b08a62' : '#7b6048';
        c.beginPath();
        c.arc(x, y, 4 + i % 6 * 2, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.maps.push(planetMap, rockMap);

    this.saturn = new THREE.Group();
    this.saturn.position.set(0, RING_Y, -0.7);
    this.saturn.rotation.z = -0.22;
    this.scene.add(this.saturn);
    this.planet = mesh(new THREE.SphereGeometry(PLANET, 48, 32), new THREE.MeshStandardMaterial({ map: planetMap, roughness: 0.82 }), { shadow: false });
    this.saturn.add(this.planet);
    this.tappable(this.planet, () => {}); // not an answer: a tap on it ticks and bounces, and never falls through to a ring behind
    this.rings = { ice: this.makeRing('ice'), rock: this.makeRing('rock', rockMap) };
    this.slots = saturnSlots(this.L.sort).map((slot) => this.makeSlot(slot));
    for (const kind of ['ice', 'rock']) this.addSample(kind, SAMPLE_AT[kind], mid(RINGS[kind]));

    this.rocket = makeRocket();
    this.rocket.position.set(-7, 8, 3);
    this.rocket.userData.flame.visible = true;
    this.scene.add(this.rocket);
    this.landed = animate(1500, (t) => { this.rocket.position.y = 4.8 + (1 - t) * 3.2; }, ease.out).then(() => {
      this.rocket.userData.flame.visible = false;
    });

    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 90 }, (_, i) => {
      const n = Math.floor(i / 3);
      return i % 3 === 0 ? Math.sin(n * 17) * 11 : i % 3 === 1 ? 5 : Math.cos(n * 11) * 8;
    }), 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#f9dffc', size: 0.06 })));

    this.portrait = portrait();
    this.chase = mesh(new THREE.CircleGeometry(1.05, 64), new THREE.MeshBasicMaterial({ map: this.portrait.texture }), { x: 6.7, y: 5.7, z: -4.6, shadow: false });
    this.chase.userData.dynamic = true;
    this.scene.add(this.chase);
    this.scene.add(mesh(new THREE.TorusGeometry(1.1, 0.09, 10, 64), new THREE.MeshStandardMaterial({ color: '#f4cf87', roughness: 0.5, metalness: 0.3 }), { x: 6.7, y: 5.7, z: -4.6, shadow: false }));
    this.onUpdate((dt, t) => {
      if (this.spin) this.saturn.rotation.y += dt * 0.18;
      this.chase.scale.setScalar(t < this.cheerUntil ? 1 + Math.sin(t * 5) * 0.03 : 1);
      this.now = t;
      const flash = t < this.flashUntil;
      for (const slot of this.slots) {
        slot.glow += ((slot.key === this.lit ? 1 : flash ? 0.5 : 0) - slot.glow) * Math.min(1, dt * 14);
        slot.tap.material.opacity = slot.glow * LIT;
        slot.tap.material.visible = slot.glow > 0.01;
      }
    });
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makeRing(kind, map = null) {
    const material = kind === 'ice'
      ? new THREE.MeshStandardMaterial({ color: '#c9efff', emissive: '#7fd4ff', emissiveIntensity: 0, transparent: true, opacity: 0.84, roughness: 0.14, metalness: 0.12 })
      : new THREE.MeshStandardMaterial({ map, color: '#d8b08a', emissive: '#d4a14a', emissiveIntensity: 0, roughness: 0.95 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(...RINGS[kind], 96), material);
    ring.rotation.x = -Math.PI / 2;
    this.saturn.add(ring);
    return { mesh: ring };
  }

  /** One answer: its hole in the ring, and what takes her tap (the whole ring, or the half ring around the hole). */
  makeSlot(slot) {
    const radii = RINGS[slot.kind];
    const gap = new THREE.Mesh(this.gapGeometry(radii, slot.angle, slot.width), new THREE.MeshBasicMaterial({
      color: HOLE, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    gap.position.y = 0.02;
    gap.add(new THREE.LineLoop(this.rimGeometry(radii, slot.angle, slot.width), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })));
    this.saturn.add(gap);

    const at = new THREE.Vector3(Math.cos(slot.angle) * mid(radii), 0, -Math.sin(slot.angle) * mid(radii)); // the hole's middle
    const tapGeo = new THREE.RingGeometry(...radii, 64, 1, ...slot.tap);
    tapGeo.rotateX(-Math.PI / 2);
    tapGeo.translate(-at.x, 0, -at.z);
    const tap = new THREE.Mesh(tapGeo, new THREE.MeshBasicMaterial({
      color: LIGHT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    tap.position.copy(at);
    tap.userData.choice = slot.key;
    tap.userData.tapHeight = 0;
    this.saturn.add(tap);
    this.tappable(tap, () => this.choose?.(slot.key));
    return { ...slot, radii, arc: slot.tap, gap, tap, need: 0, filled: 0, glow: 0 };
  }

  slot(key) { return this.slots.find((x) => x.key === key); }

  gapGeometry([inner, outer], angle, width) {
    const geo = new THREE.RingGeometry(inner, outer, 48, 1, angle - width / 2, width);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  /** The hole's edge, so it reads as a slot to fill: along the outer edge, then back along the inner one. */
  rimGeometry([inner, outer], angle, width) {
    const arc = (r, from, to) => Array.from({ length: 17 }, (_, i) => {
      const a = from + ((to - from) * i) / 16;
      return new THREE.Vector3(Math.cos(a) * r, 0.01, -Math.sin(a) * r);
    });
    return new THREE.BufferGeometry().setFromPoints([...arc(outer, angle - width / 2, angle + width / 2), ...arc(inner, angle + width / 2, angle - width / 2)]);
  }

  addSample(kind, angle, radius) {
    const obj = kind === 'ice' ? this.makeCrystal() : this.makeStone();
    obj.scale.setScalar(0.42);
    obj.position.set(Math.cos(angle) * radius, 0.35, Math.sin(angle) * radius);
    this.saturn.add(obj);
  }

  makeCrystal() {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), new THREE.MeshStandardMaterial({
      color: '#c8efff', emissive: '#5fb8e8', emissiveIntensity: 0.3, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.1,
    }));
    crystal.scale.set(0.85, 1.25, 0.85);
    group.add(crystal);
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
    glint.position.set(-0.18, 0.25, 0.22);
    group.add(glint);
    return group;
  }

  makeStone() {
    const group = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), new THREE.MeshStandardMaterial({ color: '#9b7653', roughness: 1, flatShading: true }));
    rock.scale.set(1.1, 0.85, 1.02);
    group.add(rock);
    const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), new THREE.MeshStandardMaterial({ color: '#7d6048', roughness: 1, flatShading: true }));
    lump.position.set(0.55, 0.3, 0.25);
    group.add(lump);
    return group;
  }

  makePiece(piece) {
    const obj = piece.kind === 'ice' ? this.makeCrystal() : this.makeStone();
    obj.scale.setScalar(SCALE[piece.size]);
    obj.position.copy(HOME);
    obj.userData.home = HOME.clone();
    obj.userData.piece = piece.kind;
    obj.userData.size = piece.size;
    obj.traverse((o) => { // drawn over the rings and the planet: it flies below the ring plane, where they would hide it from her
      if (!o.isMesh) return;
      Object.assign(o.material, { transparent: true, depthTest: false, depthWrite: false });
      o.renderOrder = 4;
    });
    this.scene.add(obj);
    return obj;
  }

  setNeeds() {
    for (const slot of this.slots) slot.need = this.plan.filter((p) => slotOf(p, this.L.sort) === slot.key).length;
  }

  async round(r) {
    this.plan ||= saturnPieces(this.L);
    if (r === 0) {
      await this.landed;
      if (!this.alive) return;
      this.setNeeds();
      await this.say(T.saturnStart());
    }
    if (!this.alive) return;
    const piece = this.plan[r];
    if (!piece) return;
    this.task = piece;
    this.phase = 'arriving';
    this.setNeeds();
    const obj = this.makePiece(piece);
    this.pieceObj = obj;
    await this.pieceRound(obj, piece, r);
    if (!this.alive) return;
    this.phase = 'clearing';
    this.choose = null;
    this.untap(obj);
    this.pieceOff?.();
    this.pieceOff = null;
    obj.removeFromParent();
    obj.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [o.material].flat().forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.pieceObj = null;
  }

  pieceRound(obj, piece, index) {
    return new Promise((resolve) => {
      const home = obj.userData.home.clone();
      const sort = this.L.sort, target = slotOf(piece, sort), slot = this.slot(target);
      const prompt = this.L.named ? T.saturnNamed(piece.kind) : sort === 'both' ? T.saturnWhichBoth() : T.saturnWhich();
      const clue = () => (sort === 'both' ? T.saturnHintBoth(piece.kind, piece.size) : this.L.named ? T.saturnRight(piece.kind) : T.saturnHint(piece.kind));
      let solved = false;

      const choose = async (choice) => {
        if (solved || this.phase !== 'asking') return;
        this.poke();
        if (choice !== target) {
          this.wrong(choice, { obj: this.slot(choice).tap });
          await this.jumpTo(obj, home, { height: 0.5, ms: 420 });
          return;
        }
        solved = true;
        this.phase = 'solved';
        this.correct(target);
        this.stopIdle();
        this.untap(obj);
        const from = obj.position.clone();
        const to = this.saturn.localToWorld(slot.tap.position.clone().setY(0.35));
        const scale = obj.scale.x;
        sfx.whoosh();
        await animate(520, (t) => {
          obj.position.lerpVectors(from, to, t);
          obj.position.y += Math.sin(t * Math.PI) * 0.9;
          obj.scale.setScalar(scale * (1 - t * 0.82));
        }, ease.inOut);
        if (!this.alive) return;
        obj.visible = false;
        this.fillGap(slot);
        sparkle(this, to, { count: 14 });
        this.success(to);
        sfx.good();
        await this.say(T.saturnRight(piece.kind));
        resolve();
      };
      this.choose = choose;

      this.draggable(obj, {
        height: home.y,
        lift: 0.35,
        onPick: () => { this.poke(); sfx.pop(); },
        onMove: (o) => { if (this.phase === 'asking') this.light(this.slotAt(o)); },
        onDrop: (o) => {
          this.light(null);
          if (this.phase !== 'asking') return false;
          const choice = this.slotAt(o);
          if (!choice) { this.landedNowhere(); return false; }
          choose(choice);
          return true;
        },
        onTap: () => { this.poke(); this.jumpTo(obj, home, { height: 0.3, ms: 260 }); },
      });

      this.arrive(obj, index).then(() => {
        if (!this.alive) return;
        this.phase = 'asking';
        this.last = target;
        this.question('sorting', target, {
          short: prompt,
          hint: clue,
          simplify: clue, // (four holes: the clue again, nothing taken away)
          reveal: () => this.glowHole(slot, () => solved),
        }, { options: this.slots.length });
        this.ask(prompt);
        ui.bubble({ big: this.L.named ? PIC[piece.kind] : '?', pic: '🪐', onTap: () => this.replay() });
      });

      this.pieceOff = this.onUpdate((dt, t) => {
        if (this.phase !== 'asking' || !obj.parent) return;
        if (Math.abs(obj.position.x - home.x) < 0.25 && Math.abs(obj.position.z - home.z) < 0.25) {
          obj.position.y = home.y + Math.sin(t * 1.6 + index) * 0.1;
        }
      });
    });
  }

  arrive(obj, index) {
    const from = new THREE.Vector3(index % 2 ? 9.5 : -9.5, HOME.y + 1.1, HOME.z + 0.3);
    const to = HOME.clone();
    obj.position.copy(from);
    sfx.whoosh();
    return animate(750, (t) => {
      obj.position.lerpVectors(from, to, t);
      obj.position.y += Math.sin(t * Math.PI) * 0.9;
      obj.rotation.y = (1 - t) * (index % 2 ? -1 : 1);
    }, ease.inOut);
  }

  /**
   * The answer she means by where the piece is drawn: the ring under its centre, else the nearest ring within REACH of
   * it, looked for in screen space so it is the same on every screen. The planet hides the ring behind it and is never
   * an answer, so over the planet or empty sky this is null.
   */
  slotAt(obj) {
    const at = obj.getWorldPosition(this.spot).project(camera);
    const reach = REACH * 2 * Math.min(1, camera.aspect); // (in the screen's own units, -1 to 1 up its height)
    this.toRings.copy(this.saturn.matrixWorld).invert();
    const eye = this.eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(this.toRings);
    for (const [x, y] of PROBES) {
      const sight = this.sight.set(at.x + (x * reach) / camera.aspect, at.y + y * reach, 0.5).unproject(camera).applyMatrix4(this.toRings).sub(eye).normalize();
      const choice = this.ringUnder(eye, sight);
      if (choice) return choice;
    }
    return null;
  }

  /** The answer on the ring that a line of sight meets, both in the rings' own frame: none if the planet is in the way. */
  ringUnder(eye, sight) {
    if (eye.y <= 0 || sight.y >= 0) return null;
    const meets = -eye.y / sight.y;
    const closest = -eye.dot(sight), apart = eye.lengthSq() - closest * closest;
    if (closest > 0 && apart < PLANET * PLANET && closest - Math.sqrt(PLANET * PLANET - apart) < meets) return null;
    return slotAtPoint(this.slots, eye.x + sight.x * meets, eye.z + sight.z * meets);
  }

  /** The ring the piece would land in lights while she drags it (null puts the light out). */
  light(key) {
    this.lit = key;
    this.flashUntil = 0;
  }

  /** A drop that landed on no ring: every ring glows for a moment, and a soft tick says it was felt. The piece floats back. */
  landedNowhere() {
    this.poke();
    sfx.tick();
    this.flashUntil = this.now + FLASH_S;
  }

  fillGap(slot) {
    slot.filled++;
    const left = slot.width * Math.max(0, 1 - slot.filled / Math.max(1, slot.need));
    const rim = slot.gap.children[0];
    slot.gap.geometry.dispose(); rim.geometry.dispose();
    if (left < 0.015) {
      slot.gap.visible = false;
      return;
    }
    slot.gap.geometry = this.gapGeometry(slot.radii, slot.angle, left);
    rim.geometry = this.rimGeometry(slot.radii, slot.angle, left);
  }

  /** The answer: the right hole glows until she fills it. */
  glowHole(slot, isDone) {
    this.helped(3);
    const gap = slot.gap;
    if (gap.userData.hinting) return;
    gap.userData.hinting = true;
    const off = this.onUpdate((dt, t) => {
      if (isDone() || !this.alive) { off(); gap.userData.hinting = false; gap.material.color.set(HOLE); return; }
      gap.material.color.set(HOLE).lerp(GLOW, 0.5 + 0.5 * Math.sin(t * 7));
    });
  }

  success(at) {
    super.success(at);
    this.cheer(1.6);
  }

  async outro() {
    this.slots.forEach((slot) => { slot.gap.visible = false; }); // (a run cut short mends the rings too: "naprawione!")
    this.spin = true;
    this.cheer(3);
    sfx.good();
    await wait(700);
  }

  doneLine() { return T.saturnDone(); }

  exit() {
    super.exit();
    this.maps.forEach((map) => map.dispose());
    this.portrait?.dispose();
  }
}
