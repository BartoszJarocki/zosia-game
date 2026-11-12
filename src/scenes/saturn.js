import * as THREE from 'three';
import { animate, ease, wait, camera } from '../engine.js';
import { mesh } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { saturnPieces, saturnSlots, slotOf, SCALE } from '../levels/saturn.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const RING_Y = 3.4;
const RINGS = { ice: [2.9, 4.05], rock: [4.2, 5.65] };
const SAMPLE_AT = { ice: 0.35, rock: Math.PI - 0.35 }; // a crystal on the ice ring, a stone on the rock ring, clear of the holes
const PIC = { ice: '❄️', rock: '🪨' };
const HOME = new THREE.Vector3(0, 2.5, 6.6);
const SKY = '#9b77db', HOLE = '#7a58c4', GLOW = new THREE.Color('#fff3b0'); // a hole is a little deeper than the sky
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
    this.ray = new THREE.Raycaster();
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
    this.planet = mesh(new THREE.SphereGeometry(2.35, 48, 32), new THREE.MeshStandardMaterial({ map: planetMap, roughness: 0.82 }), { shadow: false });
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
    const tap = new THREE.Mesh(tapGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    tap.position.copy(at);
    tap.userData.choice = slot.key;
    tap.userData.tapHeight = 0;
    this.saturn.add(tap);
    this.tappable(tap, () => this.choose?.(slot.key));
    return { ...slot, radii, gap, tap, need: 0, filled: 0 };
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
        onDrop: (o) => {
          if (this.phase !== 'asking') return false;
          const choice = this.slotAt(o);
          if (!choice) return false;
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

  /** The answer whose ring is drawn under the piece, as she sees it (null over the planet or empty sky). */
  slotAt(obj) {
    const eye = camera.position, at = obj.getWorldPosition(new THREE.Vector3());
    this.ray.set(eye, at.sub(eye).normalize());
    return this.ray.intersectObjects([this.planet, ...this.slots.map((x) => x.tap)], false)[0]?.object.userData.choice ?? null;
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
