import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mesh } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { saturnPieces } from '../levels/saturn.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const RING_Y = 3.4;
const INNER = [2.9, 4.05];
const OUTER = [4.2, 5.65];
const GAPS = { ice: 0.95, rock: 1.05 };
const HOME = new THREE.Vector3(0, 2.5, 6.6);
const SKY = '#9b77db';
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
    this.filled = { ice: 0, rock: 0 };
    this.maps = [];
    this.spin = false;
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
    const planet = mesh(new THREE.SphereGeometry(2.35, 48, 32), new THREE.MeshStandardMaterial({ map: planetMap, roughness: 0.82 }), { shadow: false });
    this.saturn.add(planet);
    this.rings = {
      ice: this.makeRing('ice', INNER, GAPS.ice),
      rock: this.makeRing('rock', OUTER, GAPS.rock, rockMap),
    };
    this.addSample('ice', Math.PI / 2 + 0.65, mid(INNER));
    this.addSample('rock', Math.PI / 2 - 0.65, mid(OUTER));

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

  makeRing(kind, radii, gap, map = null) {
    const material = kind === 'ice'
      ? new THREE.MeshStandardMaterial({ color: '#c9efff', emissive: '#7fd4ff', emissiveIntensity: 0, transparent: true, opacity: 0.84, roughness: 0.14, metalness: 0.12 })
      : new THREE.MeshStandardMaterial({ map, color: '#d8b08a', emissive: '#d4a14a', emissiveIntensity: 0, roughness: 0.95 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radii[0], radii[1], 96), material);
    ring.rotation.x = -Math.PI / 2;
    this.saturn.add(ring);

    const missing = new THREE.Mesh(this.gapGeometry(radii[0], radii[1], gap), new THREE.MeshBasicMaterial({
      color: SKY, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    missing.position.y = 0.02;
    this.saturn.add(missing);

    const tapGeo = new THREE.RingGeometry(radii[0], radii[1], 64);
    tapGeo.rotateX(-Math.PI / 2);
    tapGeo.translate(0, 0, -mid(radii));
    const tap = new THREE.Mesh(tapGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    tap.position.set(0, 0, mid(radii));
    tap.userData.choice = kind;
    tap.userData.tapHeight = 0;
    this.saturn.add(tap);
    this.tappable(tap, () => this.choose?.(kind));
    return { mesh: ring, gap: missing, tap, radii, total: gap, need: 0, filled: 0 };
  }

  gapGeometry(inner, outer, gap) {
    const geo = new THREE.RingGeometry(inner, outer, 48, 1, -Math.PI / 2 - gap / 2, gap);
    geo.rotateX(-Math.PI / 2);
    return geo;
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
    obj.scale.setScalar(piece.size === 'small' ? 0.66 : 1);
    obj.position.copy(HOME);
    obj.userData.home = HOME.clone();
    obj.userData.piece = piece.kind;
    obj.userData.size = piece.size;
    this.scene.add(obj);
    return obj;
  }

  setNeeds() {
    for (const kind of ['ice', 'rock']) this.rings[kind].need = this.plan.filter((p) => p.kind === kind).length;
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
      const prompt = this.L.named ? T.saturnNamed(piece.kind) : T.saturnWhich();
      let solved = false;

      const choose = async (kind) => {
        if (solved || this.phase !== 'asking') return;
        this.poke();
        if (kind !== piece.kind) {
          this.wrong(kind, { obj: this.rings[kind].tap });
          await this.jumpTo(obj, home, { height: 0.5, ms: 420 });
          return;
        }
        solved = true;
        this.phase = 'solved';
        this.correct(piece.kind);
        this.stopIdle();
        this.untap(obj);
        const from = obj.position.clone();
        const to = new THREE.Vector3(0, RING_Y + 0.35, mid(piece.kind === 'ice' ? INNER : OUTER));
        const scale = obj.scale.x;
        sfx.whoosh();
        await animate(520, (t) => {
          obj.position.lerpVectors(from, to, t);
          obj.position.y += Math.sin(t * Math.PI) * 0.9;
          obj.scale.setScalar(scale * (1 - t * 0.82));
        }, ease.inOut);
        if (!this.alive) return;
        obj.visible = false;
        this.fillGap(piece.kind);
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
        onDrop: (o, at) => {
          if (this.phase !== 'asking') return false;
          const kind = this.ringAt(at);
          if (!kind) return false;
          choose(kind);
          return true;
        },
        onTap: () => { this.poke(); this.jumpTo(obj, home, { height: 0.3, ms: 260 }); },
      });

      this.arrive(obj, index).then(() => {
        if (!this.alive) return;
        this.phase = 'asking';
        this.last = piece.kind;
        this.question('sorting', piece.kind, {
          short: prompt,
          hint: () => (this.L.named ? T.saturnRight(piece.kind) : T.saturnHint(piece.kind)), // (two rings: also the middle step)
          reveal: () => this.hint(this.rings[piece.kind].mesh, () => solved),
        }, { options: 2 });
        this.ask(prompt);
        ui.bubble({ big: piece.kind === 'ice' ? '❄️' : '🪨', pic: '🪐', onTap: () => this.replay() });
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

  ringAt(at) {
    const radius = Math.hypot(at.x, at.z - this.saturn.position.z);
    if (radius < INNER[0] - 0.4 || radius > OUTER[1] + 0.6) return null;
    return Math.abs(radius - mid(INNER)) <= Math.abs(radius - mid(OUTER)) ? 'ice' : 'rock';
  }

  fillGap(kind) {
    const ring = this.rings[kind];
    ring.filled++;
    this.filled[kind] = ring.filled;
    const left = ring.total * Math.max(0, 1 - ring.filled / Math.max(1, ring.need));
    ring.gap.geometry.dispose();
    if (left < 0.015) {
      ring.gap.visible = false;
      return;
    }
    ring.gap.geometry = this.gapGeometry(ring.radii[0], ring.radii[1], left);
  }

  success(at) {
    super.success(at);
    this.cheer(1.6);
  }

  async outro() {
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
