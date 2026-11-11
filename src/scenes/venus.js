import * as THREE from 'three';
import { animate, ease, hop, wait } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { makePup } from '../characters.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { venusRounds, venusChoices, venusPiece } from '../levels/venus.js';
import { makeShapePiece } from '../world/garage-props.js';
import { bakeInside } from '../fx/optimize.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const PLANET_R = 3.7, PLANET_Y = 1.15, PLANET_Z = -3.7;
const SHAPE_Y = PLANET_Y, SHAPE_Z = 1.55;
const WINDOW_R = 2.1, CLOUD_R = 2.25, CLOUD_Z = 2.25;
const CLOUD_OPEN = 1.9, CLOUD_SHRINK = 0.8;
const SEEN_MS = 1000; // the shape in view after her answer, before the next one
const TILE_Y = -3.65, TILE_Z = 2.55;

function paint(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function venusMap() {
  return paint(512, 256, (c, w, h) => {
    c.fillStyle = '#f4dc97';
    c.fillRect(0, 0, w, h);
    const colours = ['#f8e8b6', '#eccb79', '#fbeecb', '#e8c677'];
    for (let i = 0; i < 70; i++) {
      const x = (i * 137) % w, y = (i * 73) % h;
      c.fillStyle = colours[i % 4];
      c.beginPath();
      c.ellipse(x, y, 34 + (i % 5) * 18, 12 + (i % 4) * 8, (i % 3 - 1) * 0.2, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(255,250,230,0.55)';
    c.lineWidth = 10;
    c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const x = (i * 91) % w, y = 30 + (i * 53) % h;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 40, y - 18, x + 80, y);
      c.stroke();
    }
  });
}

function glowMap() {
  return paint(128, 128, (c, size) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,238,175,0.95)');
    g.addColorStop(0.42, 'rgba(250,204,90,0.42)');
    g.addColorStop(1, 'rgba(250,204,90,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  });
}

/** The leftmost point of the piece as she sees it: a curve of the circle, a corner of a polygon. */
function peekPoint(shape, target) {
  const body = shape.userData.body;
  const attr = body.geometry.attributes.position;
  const v = new THREE.Vector3();
  const point = new THREE.Vector3();
  let min = Infinity;
  for (let i = 0; i < attr.count; i++) {
    v.fromBufferAttribute(attr, i).applyMatrix4(body.matrix).multiplyScalar(shape.scale.x);
    if (v.x < min - 1e-4 || (Math.abs(v.x - min) <= 1e-4 && v.y > point.y)) {
      min = Math.min(min, v.x);
      point.copy(v);
    }
  }
  if (target === 'circle') point.y = 0;
  return point;
}

function halfDisk(side, hole) {
  const s = new THREE.Shape();
  s.absarc(0, 0, CLOUD_R, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? Math.PI * 1.5 : Math.PI / 2, false);
  s.lineTo(0, side < 0 ? CLOUD_R : -CLOUD_R);
  if (hole) {
    const p = new THREE.Path();
    p.absarc(hole.x, hole.y, 0.8, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  return s;
}

/** Keep the peek hole inside the left cloud half, but still over the part she should see. */
function peekHole(point) {
  const length = Math.hypot(point.x, point.y);
  const k = length > 1.4 ? 1.4 / length : 1;
  const x = Math.min(-0.9, point.x * k);
  let y = point.y * k;
  const d = Math.hypot(x, y);
  if (d > 1.45) y *= 1.45 / d;
  return { x, y };
}

export class VenusMission extends Mission {
  constructor(game) {
    super(game, 'venus');
    this.view = { pos: new THREE.Vector3(0, 0, 18), look: new THREE.Vector3(0, 0.1, 0), minWidth: 16.6 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'starting';
    this.plan = null;
    this.tiles = [];
    this.roundGeometries = new Set();
    this.roundMaterials = [];
    this.maps = [];
    this.ownedMaterials = [];
    this.builtGeometries = [];
  }

  build() {
    this.scene.background = new THREE.Color('#9b77db');
    this.scene.add(new THREE.HemisphereLight('#fff8ea', '#bda7e8', 2.3));
    const sun = new THREE.DirectionalLight('#fff6eb', 2.1);
    sun.position.set(-7, 12, 14);
    this.scene.add(sun);
    this.stars();

    const map = venusMap();
    this.maps.push(map);
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
    this.ownedMaterials.push(material);
    this.planet = mesh(new THREE.SphereGeometry(PLANET_R, 64, 48), material, { y: PLANET_Y, z: PLANET_Z, shadow: false });
    this.planet.userData.dynamic = true;
    this.scene.add(this.planet);
    this.builtGeometries.push(this.planet.geometry);
    this.revealWindow = this.makeWindow();

    this.cloudMaterial = mat('#fff6dd', { roughness: 1 });
    this.glowTexture = glowMap();
    this.maps.push(this.glowTexture);
    this.chaseWindow();
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makeWindow() {
    const group = new THREE.Group();
    group.position.set(0, SHAPE_Y, 0.95);
    group.userData.dynamic = true;
    const glow = new THREE.MeshStandardMaterial({ color: '#f7cf72', emissive: '#f0b84a', emissiveIntensity: 0.35, roughness: 0.85 });
    this.ownedMaterials.push(glow);
    const disk = mesh(new THREE.CircleGeometry(WINDOW_R, 64), glow, { shadow: false });
    const rim = mesh(new THREE.TorusGeometry(WINDOW_R, 0.075, 10, 64), mat('#ffe7a8', { metalness: 0.1, roughness: 0.5 }), { z: 0.03, shadow: false });
    group.add(disk, rim);
    this.builtGeometries.push(disk.geometry, rim.geometry);
    this.scene.add(group);
    return group;
  }

  stars() {
    const positions = [];
    for (let i = 0; i < 80; i++) {
      const a = i * 2.399, r = 9 + (i % 7) * 2.4;
      positions.push(Math.cos(a) * r, Math.sin(a) * r * 0.72, -8 - (i % 5) * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff0ff', size: 0.075, transparent: true, opacity: 0.8, depthWrite: false })));
    this.builtGeometries.push(geo);
  }

  chaseWindow() {
    const window = new THREE.Group();
    window.position.set(6, 3, 2.2);
    window.add(mesh(new THREE.TorusGeometry(1.2, 0.13, 12, 48), mat('#ffe4a8', { metalness: 0.15, roughness: 0.45 }), { shadow: false }));
    window.add(mesh(new THREE.CircleGeometry(1.16, 48), mat('#6f4fa8'), { z: -0.03, shadow: false }));
    this.chase = makePup();
    this.chase.scale.setScalar(0.72);
    this.chase.position.set(0, -1.05, 0.12);
    window.add(this.chase);
    this.scene.add(window);
    this.pup = this.chase;
    this.window = window;
    this.onUpdate((dt, t) => this.chase.userData.idle(t));
    this.tappable(window, () => { sfx.bark(); this.chase.userData.setHappy(1.2); hop(this.chase, 0.35); });
  }

  async round(r) {
    this.plan ||= venusRounds(this.rounds);
    if (r === 0) {
      await this.say(T.venusStart());
      if (!this.alive) return;
    }
    const target = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    await this.shapeRound(target);
    if (!this.alive) return;
    this.phase = 'clearing';
    this.clearRound();
  }

  shapeRound(target) {
    return new Promise((resolve) => {
      const piece = venusPiece(target, this.L.turned);
      const choices = venusChoices(target, this.L.choices);
      this.piece = piece;
      this.last = target;
      this.item('V:' + target);

      const root = new THREE.Group();
      root.userData.dynamic = true;
      this.roundRoot = root;
      this.scene.add(root);

      const shape = makeShapePiece({ ...piece, colour: 'yellow' });
      shape.position.set(0, SHAPE_Y, SHAPE_Z);
      shape.scale.setScalar(piece.size * 1.85);
      shape.updateMatrixWorld(true);
      const body = shape.userData.body;
      body.material = body.material.clone();
      body.material.emissive.set('#f59e0b');
      body.material.emissiveIntensity = 0.55;
      this.roundMaterials.push(body.material);
      root.add(shape);
      this.target = shape;

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture, color: '#ffd36a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      glow.position.set(0, SHAPE_Y, SHAPE_Z - 0.15);
      glow.scale.setScalar(3);
      glow.userData.dynamic = true;
      glow.raycast = () => {};
      this.roundMaterials.push(glow.material);
      root.add(glow);

      const xs = choices.length === 2 ? [-1.55, 1.55] : [-2.5, 0, 2.5];
      this.tiles = choices.map((choice, i) => {
        const tile = makeShapePiece({ shape: choice, colour: 'yellow', turn: 0, size: 1, odd: null });
        tile.add(mesh(rbox(1.5, 1.5, 0.16, 0.16), mat('#fff7e6', { roughness: 0.9 }), { z: -0.32, shadow: false }));
        tile.position.set(xs[i], TILE_Y, TILE_Z);
        tile.scale.setScalar(1.35);
        tile.userData.choice = choice;
        tile.userData.tapHeight = 0;
        tile.userData.body.material = tile.userData.body.material.clone();
        this.roundMaterials.push(tile.userData.body.material);
        root.add(tile);
        return tile;
      });
      const right = this.tiles.find((tile) => tile.userData.choice === target);

      const point = peekPoint(shape, target);
      this.clouds = this.makeClouds(this.L.reveal === 'part' ? peekHole(point) : null);
      root.add(this.clouds);

      root.traverse((o) => {
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.geometry) this.roundGeometries.add(o.geometry);
      });

      let solved = false, lastWrong = null;
      const choose = async (tile) => {
        if (!this.alive || solved || this.phase !== 'asking') return;
        this.poke();
        this.lookAt(tile);
        if (tile === right) {
          solved = true;
          this.phase = 'solved';
          this.correct(target);
          this.stopIdle();
          this.tiles.forEach((t) => this.untap(t));
          sfx.good();
          await this.openClouds();
          if (!this.alive) return;
          this.success(new THREE.Vector3(0, SHAPE_Y, SHAPE_Z + 0.4), { big: true });
          this.chase.userData.setHappy(3);
          const told = (this.told ||= new Set()).has(target); // ("Koło jest okrągłe!" once a visit)
          this.told.add(target);
          this.talk = this.say([this.praise(), ...T.venusRight(target), ...(told ? [] : T.shapeClue(target))]);
          await wait(SEEN_MS);
          if (!this.alive) return;
          resolve();
          return;
        }
        lastWrong = tile; // (the right tile can be tapped all along)
        this.wrong(tile.userData.choice, { obj: tile });
        hop(tile, 0.35);
      };
      for (const tile of this.tiles) this.tappable(tile, () => choose(tile));
      const openUp = () => { this.openClouds(); }; // a part level's first help: the whole shape shows ("Chmury się rozsuwają…")

      this.question('shape', target, {
        short: T.venusAsk(),
        hint: () => (this.clouds.userData.open ? T.shapeClue(target) : openUp()),
        simplify: () => (this.clouds.userData.open ? this.removeOption(lastWrong?.parent ? lastWrong : this.tiles.find((tile) => tile !== right && tile.parent)) : openUp()),
        reveal: () => this.hint(right, () => solved),
      }, { options: this.tiles.length });

      ui.bubble({ big: '?', pic: '☁️', onTap: () => this.replay() });
      this.phase = 'opening';
      (async () => {
        if (this.L.reveal === 'full') await this.openClouds(850);
        if (!this.alive) return;
        this.phase = 'asking';
        this.askAfter(this.talk, T.venusAsk());
      })();
    });
  }

  makeClouds(hole) {
    const clouds = new THREE.Group();
    clouds.position.set(0, SHAPE_Y, CLOUD_Z);
    clouds.userData.dynamic = true;
    const puffGeo = new THREE.SphereGeometry(0.5, 14, 10);
    this.roundGeometries.add(puffGeo);
    const left = this.cloudPanel(-1, hole, puffGeo);
    const right = this.cloudPanel(1, null, puffGeo);
    clouds.add(left, right);
    clouds.userData.left = left;
    clouds.userData.right = right;
    clouds.userData.hole = hole;
    return clouds;
  }

  cloudPanel(side, hole, puffGeo) {
    const shape = halfDisk(side, hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 32 });
    geo.translate(0, 0, -0.11);
    this.roundGeometries.add(geo);
    const panel = new THREE.Group();
    panel.userData.dynamic = true;
    panel.add(mesh(geo, this.cloudMaterial, { shadow: false }));
    const addPuff = (x, y, s = 1) => panel.add(mesh(puffGeo, this.cloudMaterial, { x, y, z: 0.12, s: [s, s * 0.9, s * 0.75], shadow: false }));
    for (let i = 0; i < 5; i++) {
      const a = (side < 0 ? Math.PI / 2 : -Math.PI / 2) + i * Math.PI / 4;
      addPuff(Math.cos(a) * CLOUD_R, Math.sin(a) * CLOUD_R, 0.95 + (i % 2) * 0.12);
    }
    for (let i = 0; i < 4; i++) addPuff(side < 0 ? 0.03 : -0.03, -1.65 + i * 1.1, 0.9);
    bakeInside(panel);
    return panel;
  }

  openClouds(ms = 900) {
    const clouds = this.clouds;
    if (!clouds || clouds.userData.open) return Promise.resolve();
    clouds.userData.open = true;
    const { left, right } = clouds.userData;
    const l0 = left.position.x, r0 = right.position.x;
    sfx.whoosh();
    return animate(ms, (t) => {
      left.position.x = l0 + (-CLOUD_OPEN - l0) * t;
      right.position.x = r0 + (CLOUD_OPEN - r0) * t;
      left.scale.setScalar(1 + (CLOUD_SHRINK - 1) * t);
      right.scale.setScalar(1 + (CLOUD_SHRINK - 1) * t);
    }, ease.inOut);
  }

  clearRound() {
    this.tiles.forEach((tile) => this.untap(tile));
    const roots = [this.roundRoot, ...this.tiles].filter(Boolean);
    for (const root of roots) root.traverse((o) => { if (o.geometry) this.roundGeometries.add(o.geometry); });
    this.roundGeometries.forEach((geo) => geo.dispose());
    this.roundGeometries.clear();
    this.roundMaterials.splice(0).forEach((material) => material.dispose());
    this.roundRoot?.removeFromParent();
    this.roundRoot = null;
    this.clouds = null;
    this.tiles = [];
    this.target = null;
    this.piece = null;
  }

  doneLine() { return T.venusDone(); }

  exit() {
    super.exit();
    this.clearRound();
    this.maps.forEach((map) => map.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.builtGeometries.forEach((geo) => geo.dispose());
  }
}
