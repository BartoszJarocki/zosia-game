import * as THREE from 'three';
import { animate, ease, hop } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { makePup } from '../characters.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { venusRounds, venusChoices, venusPiece } from '../levels/venus.js';
import { makeShapePiece } from '../world/garage-props.js';
import { bakeInside } from '../fx/optimize.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const SHAPE_Y = 1.25, SHAPE_Z = 1.35;
const CLOUD_Z = 2.25, TILE_Y = -3.35, TILE_Z = 2.55;
const CLOUD_OPEN = 5.4;

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

function roundedRect(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
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
    this.roundOffs = [];
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
    const venus = mesh(new THREE.SphereGeometry(4.6, 48, 32), material, { y: -0.65, z: -4.1, shadow: false });
    this.scene.add(venus);
    this.builtGeometries.push(venus.geometry);

    this.cloudMaterial = mat('#fff6dd', { roughness: 1 });
    this.glowTexture = glowMap();
    this.maps.push(this.glowTexture);
    this.chaseWindow();
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
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
    window.position.set(5.9, 2.65, 2);
    window.add(mesh(new THREE.TorusGeometry(1.32, 0.14, 12, 48), mat('#ffe4a8', { metalness: 0.15, roughness: 0.45 }), { shadow: false }));
    window.add(mesh(new THREE.CircleGeometry(1.28, 48), mat('#6f4fa8'), { z: -0.03, shadow: false }));
    this.chase = makePup();
    this.chase.scale.setScalar(0.78);
    this.chase.position.set(0, -1.14, 0.12);
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
      shape.scale.setScalar(piece.size * 2.1);
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
      glow.scale.setScalar(3.6);
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
      this.clouds = this.makeClouds(this.L.reveal === 'part'
        ? { x: THREE.MathUtils.clamp(point.x + 0.18, -2.15, -0.9), y: THREE.MathUtils.clamp(point.y, -2.1, 2.1) }
        : null);
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
          await this.say([this.praise(), ...T.venusRight(target), ...T.shapeClue(target)]);
          if (!this.alive) return;
          resolve();
          return;
        }
        lastWrong = tile;
        this.phase = 'checking';
        this.wrong(tile.userData.choice, { obj: tile, feedback: false });
        hop(tile, 0.35);
        await this.openClouds();
        if (!this.alive) return;
        this.glowTile(right, () => solved);
        this.chase.userData.setHappy(1);
        await this.say(T.venusWrong(target));
        if (!this.alive) return;
        this.phase = 'asking';
      };
      for (const tile of this.tiles) this.tappable(tile, () => choose(tile));

      this.question('shape', target, {
        short: T.venusAsk(),
        hint: () => T.shapeClue(target),
        simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : this.tiles.find((tile) => tile !== right && tile.parent)),
        reveal: () => this.hint(right, () => solved),
      }, { options: this.tiles.length });

      ui.bubble({ big: '?', pic: '☁️', onTap: () => this.replay() });
      this.phase = 'opening';
      (async () => {
        if (this.L.reveal === 'full') await this.openClouds(850);
        if (!this.alive) return;
        this.phase = 'asking';
        this.ask(T.venusAsk());
      })();
    });
  }

  makeClouds(hole) {
    const clouds = new THREE.Group();
    clouds.position.set(0, SHAPE_Y, CLOUD_Z);
    clouds.userData.dynamic = true;
    const puffGeo = new THREE.SphereGeometry(0.58, 14, 10);
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
    const x0 = side < 0 ? -3.15 : -0.07;
    const x1 = side < 0 ? 0.07 : 3.15;
    const shape = roundedRect(x0, -3, x1, 3, 0.85);
    if (hole) {
      const p = new THREE.Path();
      p.absarc(hole.x, hole.y, 0.86, 0, Math.PI * 2, true);
      shape.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 24 });
    geo.translate(0, 0, -0.11);
    this.roundGeometries.add(geo);
    const panel = new THREE.Group();
    panel.userData.dynamic = true;
    panel.add(mesh(geo, this.cloudMaterial, { shadow: false }));
    const addPuff = (x, y, s = 1) => panel.add(mesh(puffGeo, this.cloudMaterial, { x, y, z: 0.12, s: [s, s * 0.85, s * 0.7], shadow: false }));
    const xs = side < 0 ? [-2.75, -2, -1.25, -0.5] : [0.5, 1.25, 2, 2.75];
    xs.forEach((x, i) => { addPuff(x, 3, 0.95 + (i % 2) * 0.12); addPuff(x, -3, 0.95 + ((i + 1) % 2) * 0.12); });
    const edge = side < 0 ? -3.1 : 3.1;
    for (let i = 0; i < 4; i++) {
      const y = -2.2 + i * 1.45;
      addPuff(edge, y, 1);
      addPuff(side < 0 ? 0.03 : -0.03, y, 0.92);
    }
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
    }, ease.inOut);
  }

  glowTile(tile, isDone) {
    const material = tile.userData.body.material;
    material.emissive.set('#f59e0b');
    const off = this.onUpdate((dt, t) => {
      if (isDone() || !tile.parent) {
        off();
        material.emissiveIntensity = 0;
        return;
      }
      material.emissiveIntensity = 0.6 + 0.45 * Math.sin(t * 6);
    });
    this.roundOffs.push(off);
  }

  clearRound() {
    this.roundOffs.splice(0).forEach((off) => off());
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
