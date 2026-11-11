import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mesh } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { makeShapePiece, shapeSVG } from '../world/garage-props.js';
import { sparkle } from '../fx/particles.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { plutoRound } from '../levels/pluto.js';
import { portrait } from '../world/portrait.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const PIECE = '#f9a8d4'; // one colour for every piece: colour never gives the answer
const DIM = '#b67f9c', BRIGHT = '#ffd9ec';
const SEEN_MS = 600; // the heart lit, in view, before the next pieces
const GROUND_Y = 0.025, PIECE_Y = 0.72, PIECE_Z = 2.8, GAP = 2.55;
const across = (n) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * GAP);

function glowMap() {
  return texture(128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,225,242,0.95)');
    g.addColorStop(0.45, 'rgba(255,190,225,0.5)');
    g.addColorStop(1, 'rgba(255,190,225,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}

export class PlutoMission extends Mission {
  constructor(game) {
    super(game, 'pluto');
    this.view = { pos: new THREE.Vector3(0, 8.6, 14.5), look: new THREE.Vector3(0, 1.5, -0.4), minWidth: 12 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'landing';
    this.heartLevel = 0;
    this.pieces = [];
    this.maps = [];
  }

  build() {
    this.scene.background = new THREE.Color('#a681dc');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9d1ed', 2.4));
    const sun = new THREE.DirectionalLight('#fff6eb', 2);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);

    const ice = texture(512, (c, size) => {
      c.fillStyle = '#f0ecf7'; c.fillRect(0, 0, size, size);
      for (let i = 0; i < 70; i++) {
        const x = (i * 211 + 73) % size, y = (i * 347 + 151) % size, r = 7 + i % 5 * 4;
        c.fillStyle = i % 2 ? '#e3dcf1' : '#f9f6fd';
        c.beginPath(); c.ellipse(x, y, r, r * 0.7, i * 0.4, 0, Math.PI * 2); c.fill();
      }
    });
    this.maps.push(ice);
    this.scene.add(mesh(new THREE.CircleGeometry(27, 80), new THREE.MeshStandardMaterial({ map: ice, roughness: 1 }), { y: GROUND_Y, rx: -Math.PI / 2, shadow: false }));

    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 90 }, (_, i) => {
      const n = Math.floor(i / 3);
      return i % 3 === 0 ? Math.sin(n * 13) * 13 : i % 3 === 1 ? 2 + (n % 7) * 1.1 : -16 - (n % 5) * 1.5;
    }), 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#f9e6ff', size: 0.07 })));

    this.scene.add(mesh(new THREE.SphereGeometry(3.2, 48, 32), new THREE.MeshStandardMaterial({ color: '#d8c8bb', roughness: 1 }), { x: 0, y: 3.4, z: -8.6, shadow: false }));

    this.heart = makeShapePiece({ shape: 'heart', colour: PIECE });
    this.heart.scale.setScalar(2.1);
    this.heart.position.set(0, 3.4, -5.28);
    this.heartBody = this.heart.userData.body;
    this.heartBody.material = this.heartBody.material.clone();
    this.heartBody.material.color.set(DIM);
    this.heartBody.material.emissive.set('#ff9bc9');
    this.heartBody.material.emissiveIntensity = 0;
    this.heart.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    this.scene.add(this.heart);

    this.heartGlowMap = glowMap();
    this.maps.push(this.heartGlowMap);
    this.heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartGlowMap, color: '#ffe4f2', transparent: true, opacity: 0, depthWrite: false }));
    this.heartGlow.position.set(0, 3.4, -5.38);
    this.heartGlow.scale.set(4.6, 4.6, 1);
    this.scene.add(this.heartGlow);

    this.portrait = portrait();
    this.window = new THREE.Group();
    this.window.position.set(4.8, 4.5, -4.2);
    this.window.add(mesh(new THREE.CircleGeometry(1.15, 64), new THREE.MeshBasicMaterial({ map: this.portrait.texture }), { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.2, 0.11, 8, 64), new THREE.MeshBasicMaterial({ color: '#f4cf87' }), { shadow: false }));
    this.scene.add(this.window);
    this.onUpdate((dt, t) => {
      const k = t < this.cheerUntil ? 1 + Math.sin(t * 6) * 0.04 : 1;
      this.window.scale.setScalar(k);
    });

    this.rocket = makeRocket();
    this.rocket.position.set(-6.2, 7, -3.4);
    this.rocket.userData.flame.visible = true;
    this.scene.add(this.rocket);
    this.landed = animate(1800, (t) => { this.rocket.position.y = 1.4 + (1 - t) * 5.6; }, ease.out).then(() => {
      this.rocket.userData.flame.visible = false;
    });
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makePieces(plan) {
    const xs = across(plan.pieces.length);
    this.pieces = plan.pieces.map((p, i) => {
      const o = makeShapePiece({ ...p, colour: PIECE });
      const y = PIECE_Y * p.size;
      o.userData.home = new THREE.Vector3(xs[i], y, PIECE_Z);
      o.position.copy(o.userData.home);
      o.rotation.x = -0.12;
      o.userData.choice = p.shape;
      o.userData.tapHeight = 0;
      o.userData.body.material = o.userData.body.material.clone();
      o.traverse((m) => { m.castShadow = false; m.receiveShadow = false; });
      this.scene.add(o);
      o.userData.shadow = this.shadowUnder(o, 0.75 * p.size, 0.3);
      this.dropIn(o, y, 250 + i * 130).then(() => sfx.pop());
      return o;
    });
    return this.pieces;
  }

  async round(r) {
    if (r === 0) {
      await this.landed;
      if (!this.alive) return;
      await this.say(T.plutoStart());
    }
    if (!this.alive) return;
    const plan = plutoRound(this.L);
    const objs = this.makePieces(plan);
    await wait(750);
    if (!this.alive) return;
    await this.askHeart(objs);
    if (!this.alive) return;
    this.phase = 'clearing';
    this.clearPieces();
  }

  askHeart(objs) {
    return new Promise((resolve) => {
      const right = objs.find((o) => o.userData.choice === 'heart');
      let solved = false, lastWrong = null;
      this.phase = 'choosing';
      this.last = 'heart';
      const choose = async (o) => {
        if (solved) return;
        this.poke();
        this.lookAt(o);
        if (o === right) {
          solved = true;
          this.correct('heart');
          this.stopIdle();
          objs.forEach((x) => this.untap(x));
          sfx.good();
          await this.floatToHeart(o);
          if (!this.alive) return;
          this.brightenHeart();
          sparkle(this, this.heart.getWorldPosition(new THREE.Vector3()), { count: 12 });
          this.success();
          this.talk = this.say(T.plutoRight());
          await wait(SEEN_MS);
          resolve();
        } else {
          lastWrong = o;
          this.wrong(o.userData.choice, { obj: o, said: T.plutoWrong(o.userData.choice) });
          this.pulseHeart();
        }
      };
      objs.forEach((o) => this.tappable(o, () => choose(o)));
      ui.bubble({ big: shapeSVG('heart', PIECE), pic: '🤍', onTap: () => this.replay() });
      this.question('shape', 'heart', {
        short: T.plutoAsk(),
        hint: () => { this.pulseHeart(); return T.plutoAsk(); },
        simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : objs.find((o) => o !== right && o.parent)),
        reveal: () => this.hint(right, () => solved),
      }, { options: objs.length });
      this.askAfter(this.talk, T.plutoAsk());
    });
  }

  async floatToHeart(o) {
    this.untap(o);
    const from = o.position.clone();
    const to = this.heart.getWorldPosition(new THREE.Vector3());
    const s0 = o.scale.x;
    sfx.whoosh();
    await animate(760, (t) => {
      o.position.lerpVectors(from, to, t);
      o.position.y += Math.sin(t * Math.PI) * 1.1;
      o.scale.setScalar(s0 * (1 - 0.55 * t));
      o.rotation.z = t * 0.7;
    }, ease.inOut);
    this.disposePiece(o);
  }

  brightenHeart() {
    this.heartLevel = Math.min(1, this.heartLevel + 1 / this.rounds);
    const k = this.heartLevel;
    const from = this.heartBody.material.color.clone();
    const to = new THREE.Color(DIM).lerp(new THREE.Color(BRIGHT), k);
    const fromGlow = this.heartBody.material.emissiveIntensity;
    const fromHalo = this.heartGlow.material.opacity;
    animate(800, (t) => {
      this.heartBody.material.color.copy(from).lerp(to, t);
      this.heartBody.material.emissiveIntensity = fromGlow + (k * 1.2 - fromGlow) * t;
      this.heartGlow.material.opacity = fromHalo + (0.12 + k * 0.72 - fromHalo) * t;
    }, ease.out);
  }

  pulseHeart() {
    if (this.heartPulsing) return;
    this.heartPulsing = true;
    const base = this.heartBody.material.emissiveIntensity;
    animate(650, (t) => {
      this.heartBody.material.emissiveIntensity = base + Math.sin(t * Math.PI) * 0.55;
    }, ease.linear).then(() => {
      this.heartPulsing = false;
      this.heartBody.material.emissiveIntensity = base;
    });
  }

  disposePiece(o) {
    if (o.userData.disposed) return;
    o.userData.disposed = true;
    const shadow = o.userData.shadow;
    if (shadow) {
      shadow.removeFromParent();
      shadow.geometry.dispose();
      shadow.material.dispose();
      o.userData.shadow = null;
    }
    o.removeFromParent();
    o.userData.body.geometry.dispose();
    o.userData.body.material.dispose();
  }

  clearPieces() {
    for (const o of this.pieces) {
      this.untap(o);
      this.disposePiece(o);
    }
    this.pieces = [];
  }

  doneLine() { return T.plutoDone(); }

  exit() {
    super.exit();
    this.clearPieces();
    this.maps.forEach((map) => map.dispose());
    this.heart?.userData.body.geometry.dispose();
    this.heart?.userData.body.material.dispose();
    this.window?.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      o.material.dispose();
    });
    this.portrait?.dispose();
  }
}
