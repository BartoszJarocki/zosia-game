import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mat, mesh } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { sparkle } from '../fx/particles.js';
import { labelTexture, texture } from '../textures.js';
import { showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { cometLetters, cometPlan } from '../levels/comet.js';
import { ALL_LETTERS } from '../levels/data.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

// Comets stay fully in view at every iPad size (the narrowest view is 15 wide): the tail reaches
// 2.8 right of the centre and the body 0.6 left of it, plus the hint pulse.
const X0 = 3.8, X1 = -6.0;
// Five lanes below the speech bubble, clear of the rocket below them. A comet is 1.16 tall,
// so 1.55 apart never touches.
const LANES = [1.65, 3.2, 4.75, 6.3, 7.85];

function tailTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const c = canvas.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#c9f4ff');
  grad.addColorStop(1, 'rgba(190,235,255,0)');
  c.fillStyle = grad;
  c.beginPath();
  c.moveTo(0, 64);
  c.quadraticCurveTo(90, 8, 256, 20);
  c.quadraticCurveTo(150, 64, 256, 108);
  c.quadraticCurveTo(90, 120, 0, 64);
  c.fill();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeComet(letter, tailMap, haloMap) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.58, 24, 18), new THREE.MeshStandardMaterial({
    color: '#eafcff', emissive: '#7dd3fc', emissiveIntensity: 0.45, roughness: 0.25,
  }), { shadow: false });
  const tail = mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({
    map: tailMap, transparent: true, opacity: 0.9, depthWrite: false,
  }), { x: 1.5, shadow: false });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloMap, color: '#bfefff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(2.1);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({
    map: labelTexture(letter, { fg: '#1e4fbf' }), transparent: true, depthWrite: false,
  }));
  label.position.set(0, 0.04, 0.6);
  tail.renderOrder = 1;
  label.renderOrder = 2;
  g.add(tail, halo, body, label);
  g.userData.body = body;
  return g;
}

// "Comet Catch": catch every comet with the asked letter, counting them as they come.
export class CometMission extends Mission {
  constructor(game) {
    super(game, 'comet');
    this.view = { pos: new THREE.Vector3(0, 8, 14), look: new THREE.Vector3(0, 4.6, 0), minWidth: 15 };
    this.post = { tilt: 0, ao: false };
    this.bubbleAt = 'left';
    this.phase = 'starting';
    this.comets = [];
    this.maps = [];
    this.speedK = 1;
  }

  build() {
    this.scene.background = new THREE.Color('#9b77db');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9d1ed', 2.4));
    const sun = new THREE.DirectionalLight('#fff6eb', 2);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);

    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 150 }, (_, i) => {
      const n = Math.floor(i / 3);
      return i % 3 === 0 ? Math.sin(n * 17) * 15 : i % 3 === 1 ? 4.5 + Math.cos(n * 7) * 5.5 : -8 - (n % 4);
    }), 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#fff4ff', size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })));

    this.tailMap = tailTexture();
    this.haloMap = texture(128, (c, size) => {
      const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
    });
    this.maps.push(this.tailMap, this.haloMap);

    this.rocket = makeRocket();
    this.rocket.position.set(-5.9, 0.12, 0.4);
    this.rocket.scale.setScalar(0.5);
    this.rocket.userData.flame.visible = false;
    this.scene.add(this.rocket);
    this.net = new THREE.Group();
    this.net.add(mesh(new THREE.TorusGeometry(0.44, 0.055, 8, 24), mat('#f3f7ff'), { shadow: false }));
    this.net.add(new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({
      color: '#bfe9ff', transparent: true, opacity: 0.22, depthWrite: false,
    })));
    this.net.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), mat('#f3f7ff'), { y: -0.6, shadow: false }));
    this.net.position.set(0.95, 0.45, 0.15);
    this.rocket.add(this.net);
    this.onUpdate((dt, t) => {
      this.rocket.position.y = 0.12 + Math.sin(t * 0.8) * 0.05;
    });

    this.onUpdate((dt, t) => this.glide(dt, t));
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  glide(dt, t) {
    for (const c of this.comets) {
      const d = c.userData;
      if (d.wait > 0) {
        d.wait -= dt;
        if (d.wait <= 0) this.respawn(c);
        continue;
      }
      c.position.x -= d.speed * this.speedK * dt;
      c.position.y = LANES[d.lane] + Math.sin(t * 0.9 + d.phase) * 0.1;
      c.rotation.z = Math.sin(t * 1.1 + d.phase) * 0.05 + Math.sin(t * 18) * 0.2 * d.wobble;
      d.wobble = Math.max(0, d.wobble - dt * 2.5);
      d.inflate = Math.min(1, d.inflate + dt * 3);
      c.scale.setScalar(Math.max(0.001, d.inflate));
      if (c.position.x < X1) this.wrap(c);
    }
  }

  /** Back to the right edge: all `total` comets keep drifting through the view. */
  wrap(c) {
    c.position.set(X0, LANES[c.userData.lane], 0);
    if (this.tapComet && !c.userData.onTap) this.tappable(c, () => this.tapComet(c));
  }

  /** Off the left edge: rest for a moment, then come back from the right in another lane. */
  sendAway(c) {
    if (c.userData.popped || c.userData.wait > 0) return;
    this.untap(c);
    c.visible = false;
    c.userData.wait = 0.7 + Math.random() * 0.9;
    c.userData.inflate = 0;
  }

  respawn(c) {
    if (!this.comets.includes(c) || c.userData.popped) return;
    const d = c.userData;
    const lanes = LANES.map((_, i) => i).filter((i) => i !== d.lane);
    d.lane = lanes[Math.floor(Math.random() * lanes.length)];
    d.phase = Math.random() * 6;
    d.inflate = 0;
    c.position.set(X0, LANES[d.lane], 0);
    c.scale.setScalar(0.001);
    c.visible = true;
    if (this.tapComet) this.tappable(c, () => this.tapComet(c));
  }

  catchComet(c) {
    sfx.pop();
    const to = this.net.getWorldPosition(new THREE.Vector3());
    this.jumpTo(c, to, { height: 0.8, ms: 320 }).then(() => {
      c.removeFromParent();
      sparkle(this, to, { count: 10, size: 0.1 });
      this.net.scale.setScalar(1.35);
      animate(280, (t) => this.net.scale.setScalar(1 + 0.35 * (1 - t)), ease.out);
    });
  }

  async round(r) {
    if (r === 0) {
      await this.say(T.cometStart());
      if (!this.alive) return;
    }
    return new Promise((resolve) => {
      const pool = [...this.L.pool];
      const target = this.pick('letterVisual', pool);
      this.last = target;
      this.phase = 'catch';
      this.speedK = 1;
      let popped = 0, done = false, lastWrong = null, help = 0;

      const letters = cometLetters({ ...this.L, alphabet: ALL_LETTERS }, target, pool);
      const { laneOf, speeds, starts } = cometPlan(this.L);
      const inLane = LANES.map((_, i) => laneOf.filter((l) => l === i).length);
      const seen = LANES.map(() => 0);

      const floatAway = (c) => {
        if (!c || c.userData.popped) return;
        c.userData.popped = true;
        this.untap(c);
        this.comets = this.comets.filter((x) => x !== c);
        animate(400, (t) => {
          c.position.x -= t * 1.5;
          c.scale.setScalar(Math.max(0.001, 1 - t));
        }, ease.in).then(() => c.removeFromParent());
      };

      const tap = async (c) => {
        if (done || c.userData.popped || c.userData.wait > 0) return;
        this.poke();
        if (c.userData.letter !== target) {
          lastWrong = c;
          this.wrong(c.userData.letter, { obj: c.userData.body, said: this.lookalikeNo(target, c.userData.letter) });
          c.userData.wobble = 1;
          const right = this.comets.find((x) => x.userData.letter === target && x.userData.wait <= 0);
          if (right) this.hint(right, () => done || right.userData.popped || right.userData.wait > 0);
          return;
        }
        c.userData.popped = true;
        this.untap(c);
        this.comets = this.comets.filter((x) => x !== c);
        this.catchComet(c);
        popped++;
        this.correct(target);
        if (popped < this.L.targets) {
          this.question('letterVisual', target, hooks, { options: choices() });
          if (help) this.helped(help);
          return say([...this.yes(), ...T.number(popped)]);
        }
        done = true;
        this.phase = 'solved';
        this.stopIdle();
        sfx.good();
        this.success(this.net.getWorldPosition(new THREE.Vector3()), { big: true });
        await say([...this.yes(), ...T.number(popped), ...T.cometRoundDone()]);
        if (!this.alive) return;
        this.comets = [];
        rest.forEach((x) => { this.untap(x); x.removeFromParent(); });
        this.tapComet = null;
        resolve();
      };

      const rest = letters.map((letter, i) => {
        const lane = laneOf[i];
        const step = inLane[lane] ? 1 / inLane[lane] : 0;
        const c = makeComet(letter, this.tailMap, this.haloMap);
        Object.assign(c.userData, {
          letter, lane, speed: speeds[lane], phase: Math.random() * 6, tapHeight: 0,
          inflate: 1, wait: 0, wobble: 0,
        });
        // Each comet starts inside the view. Two in one lane sit half a lane apart, so wrapping
        // never brings them together.
        c.position.set(X1 + ((starts[lane] + seen[lane]++ * step) % 1) * (X0 - X1), LANES[lane], 0);
        this.scene.add(c);
        this.tappable(c, () => tap(c));
        return c;
      });
      this.comets = rest;
      this.tapComet = tap;

      const hooks = {
        short: T.cometAsk(target),
        hint: () => { help = Math.max(help, 2); this.speedK = 0.6; return T.letterLike(target); },
        simplify: () => floatAway(lastWrong?.parent ? lastWrong : this.comets.find((x) => x.userData.letter !== target)),
        reveal: () => {
          help = 3;
          this.comets.filter((x) => x.userData.letter === target).forEach((x) => {
            this.hint(x, () => done || x.userData.popped || x.userData.wait > 0);
          });
        },
      };
      // Several comets can be right at once, so a guess is right more often than 1 in n.
      const choices = () => this.comets.length / (this.L.targets - popped);

      this.question('letterVisual', target, hooks, { options: choices() });
      ui.bubble({ big: showLetter(target), onTap: () => this.replay() });
      wait(500).then(() => {
        if (this.alive && this.phase === 'catch') this.ask(T.cometAsk(target));
      });
    });
  }

  doneLine() { return [...T.cometDone(), ...T.cometFact()]; }

  success(at, options) {
    super.success(null, options);
    if (at) sparkle(this, at, { count: 6 });
  }

  exit() {
    super.exit();
    this.maps.forEach((map) => map.dispose());
  }
}
