import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mesh, rbox } from '../models.js';
import { makeRocket } from '../world/rocket.js';
import { sparkle } from '../fx/particles.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { portrait } from '../world/portrait.js';
import { jupiterRounds, stripeRound, biggerRound, patternUnit, JUPITER_COLOURS } from '../levels/jupiter.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const COLOUR_HEX = { white: '#f4ecdd', orange: '#ef8b31', brown: '#8b5a35', red: '#d83a3a' };
const BALL_R = { jupiter: 2.9, sun: 2.9, earth: 0.56 };
const BALL_GAP = 0.95;
const SEEN_MS = 900; // the filled stripe in view before the next round
const BIG_LEFT_X = -2.2, BIG_RIGHT_X = 0.4;
const BAR_W = 5.2, BAR_H = 0.44, STEP = 0.5, ROW_Z = -0.8;
const across = (n, gap) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap);

function texture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function bands(c, w, h, stops) {
  stops.forEach(([at, colour], i) => {
    c.fillStyle = colour;
    c.fillRect(0, at * h, w, ((stops[i + 1]?.[0] ?? 1.02) - at) * h);
  });
}

function ballMaps() {
  return {
    jupiter: texture(512, 256, (c, w, h) => bands(c, w, h, [
      [0, '#e8d2aa'], [0.11, '#c19162'], [0.22, '#f2e2c2'], [0.33, '#a96a42'],
      [0.43, '#f4e6ca'], [0.52, '#dfbd8d'], [0.62, '#b26d44'], [0.72, '#f2dfbd'],
      [0.82, '#c29163'], [0.91, '#e8d2aa'],
    ])),
    earth: texture(256, 256, (c, w, h) => {
      c.fillStyle = '#2f86e8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#55c85b';
      for (const [x, y, rx, ry] of [[40, 68, 32, 44], [80, 154, 22, 46], [142, 72, 42, 28], [176, 148, 24, 40], [218, 198, 18, 16]]) {
        c.beginPath(); c.ellipse(x, y, rx, ry, -0.4, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#f4fbff'; c.fillRect(0, 0, w, 12); c.fillRect(0, h - 12, w, 12);
    }),
    sun: texture(256, 256, (c, w, h) => {
      c.fillStyle = '#ffc93a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 36; i++) {
        c.fillStyle = i % 2 ? 'rgba(255,244,160,0.6)' : 'rgba(255,136,36,0.4)';
        c.beginPath(); c.ellipse((i * 71) % w, (i * 113) % h, 8 + (i % 5) * 5, 7 + (i % 4) * 5, 0, 0, Math.PI * 2); c.fill();
      }
    }),
  };
}

export class JupiterMission extends Mission {
  constructor(game) {
    super(game, 'jupiter');
    this.view = { pos: new THREE.Vector3(0, 4.8, 14), look: new THREE.Vector3(0, 2.4, -1), minWidth: 14 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'landing';
    this.random = Math.random;
    this.roundObjects = [];
    this.maps = [];
  }

  build() {
    this.scene.background = new THREE.Color('#9b77db');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9d1ed', 2.4));
    const sun = new THREE.DirectionalLight('#fff6eb', 2);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);

    this.ballMaps = ballMaps();
    this.maps.push(...Object.values(this.ballMaps));

    this.planet = mesh(new THREE.SphereGeometry(3.3, 48, 32), new THREE.MeshStandardMaterial({ map: this.ballMaps.jupiter, roughness: 0.95 }), { x: -0.4, y: 4.8, z: -7.5, shadow: false });
    this.planet.userData.dynamic = true;
    this.scene.add(this.planet);

    this.redSpot = mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshStandardMaterial({ color: '#c9472f', roughness: 0.8 }), { x: 0.9, y: 3.9, z: -4.25, shadow: false });
    this.redSpot.scale.set(0.001, 0.001, 0.001);
    this.redSpot.userData.dynamic = true;
    this.redSpot.visible = false;
    this.scene.add(this.redSpot);

    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 120 }, (_, i) => {
      const n = Math.floor(i / 3);
      return i % 3 === 0 ? Math.sin(n * 19) * 12 : i % 3 === 1 ? Math.cos(n * 7) * 5 + 3 : -6 - (n % 4);
    }), 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#f9dffc', size: 0.07 })));

    this.rocket = makeRocket();
    this.rocket.position.set(-6.1, 7.2, -4);
    this.rocket.userData.flame.visible = true;
    this.scene.add(this.rocket);
    this.landed = animate(1600, (t) => { this.rocket.position.y = 4.1 + (1 - t) * 3.1; }, ease.out).then(() => {
      this.rocket.userData.flame.visible = false;
      this.chase.visible = true;
    });

    this.portrait = portrait();
    this.chase = mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: this.portrait.texture }), { x: 5.6, y: 4.25, z: -2.6, shadow: false });
    this.chase.userData.dynamic = true;
    this.chase.visible = false;
    this.scene.add(this.chase);
    this.scene.add(mesh(new THREE.TorusGeometry(1.04, 0.1, 8, 64), new THREE.MeshBasicMaterial({ color: '#f4cf87' }), { x: 5.6, y: 4.25, z: -2.6, shadow: false }));
    this.onUpdate((dt, t) => this.chase.scale.setScalar(t < this.cheerUntil ? 1 + Math.sin(t * 5) * 0.04 : 1));

    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  async round(r) {
    this.plan ||= jupiterRounds(this.L, this.random);
    if (r === 0) {
      await this.landed;
      if (!this.alive) return;
      await this.say(T.jupiterStart());
    }
    if (!this.alive) return;
    const task = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    this.task = task;
    await (task === 'stripes' ? this.stripesRound() : this.sizeRound());
    if (!this.alive) return;
    this.phase = 'clearing';
    this.clearRound();
  }

  async stripesRound() {
    this.clearRound();
    const p = stripeRound(this.L.pattern, this.random, { foil: this.L.foil !== false });
    const bars = this.makeRow(p);
    const blank = bars[p.gap];
    const pots = this.makePots(p.choices);
    const right = pots.find((pot) => pot.userData.choice === p.answer);
    let solved = false, lastWrong = null, resolveRound;
    const done = new Promise((resolve) => { resolveRound = resolve; });
    this.last = p.answer;
    this.phase = 'stripes';

    const choose = async (pot) => {
      if (solved || this.phase !== 'stripes') return;
      this.poke();
      this.lookAt(pot);
      if (pot !== right) {
        lastWrong = pot;
        this.wrong(pot.userData.choice, { obj: pot, said: T.jupiterTryAgain() });
        return;
      }
      solved = true;
      this.phase = 'solved';
      this.correct(p.answer);
      this.stopIdle();
      pots.forEach((x) => this.untap(x));
      this.fillStripe(blank, p.answer);
      sfx.good();
      this.success(blank.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0.5)));
      this.talk = this.say([this.praise(), ...T.jupiterRow(patternUnit(p.row))]); // the pattern once, not the whole row
      await wait(SEEN_MS);
      resolveRound();
    };

    for (const pot of pots) {
      this.draggable(pot, {
        height: 0, lift: 0.45,
        onPick: () => { this.poke(); sfx.pop(); },
        onDrop: (obj, at) => {
          if (at.z >= 1.2) return false;
          choose(pot);
          return pot === right; // (a wrong pot floats back to its place)
        },
        onTap: () => choose(pot),
      });
      this.tappable(pot, () => choose(pot));
    }

    const short = p.item === 'gap' ? T.jupiterGap() : T.jupiterWhich();
    ui.bubble({ big: rowSVG(p.row, p.gap), pic: '🎨', onTap: () => this.replay() }); // (not the orange disc of Jupiter's badge: that is a colour in the question)
    this.question('pattern', p.item, {
      short,
      hint: () => T.jupiterHelp(p.row, p.gap),
      simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : pots.find((pot) => pot !== right && pot.parent)),
      reveal: () => this.hint(right, () => solved),
    }, { options: pots.length });
    this.askAfter(this.talk, short);
    await done;
  }

  async sizeRound() {
    this.clearRound();
    this.planet.visible = false;
    this.redSpot.visible = false;
    const p = biggerRound(this.L.bigger, this.random);
    const sep = BALL_R.jupiter + BALL_R.earth + BALL_GAP;
    // The pair shifts left when the big ball is on the right, clear of Chase's window.
    const bigLeft = p.right === 'earth';
    const bigX = bigLeft ? BIG_LEFT_X : BIG_RIGHT_X;
    const xs = bigLeft ? [bigX, bigX + sep] : [bigX - sep, bigX];
    const balls = [p.left, p.right].map((kind, i) => this.makeBall(kind, xs[i]));
    const right = balls.find((ball) => ball.userData.choice === p.answer);
    let solved = false, resolveRound;
    const done = new Promise((resolve) => { resolveRound = resolve; });
    this.last = p.answer;
    this.phase = 'bigger';

    const choose = async (ball) => {
      if (solved || this.phase !== 'bigger') return;
      this.poke();
      this.lookAt(ball);
      if (ball !== right) {
        this.wrong(ball.userData.choice, { obj: ball });
        return;
      }
      solved = true;
      this.phase = 'solved';
      this.correct(p.answer);
      this.stopIdle();
      balls.forEach((x) => this.untap(x));
      sfx.good();
      const bounce = this.bounceBall(ball);
      this.success(ball.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, BALL_R[ball.userData.choice], 0)));
      const fact = p.ask === 'smaller' ? T.jupiterSmall() : T.jupiterBig(p.big);
      this.talk = this.say([this.praise(), ...(this.told?.includes(fact[0]) ? [] : fact)]); // (each fact once a visit)
      (this.told ||= []).push(fact[0]);
      await bounce;
      resolveRound();
    };

    balls.forEach((ball) => this.tappable(ball, () => choose(ball)));
    const short = p.ask === 'smaller' ? T.jupiterSmaller() : T.jupiterBigger();
    ui.bubble({ big: '?', pic: '📏', onTap: () => this.replay() }); // (not the orange disc: it points at Jupiter)
    this.question('comparison', p.ask, {
      short,
      hint: () => T.lookCarefully(), // (two balls: the clue is also the middle step)
      reveal: () => this.hint(right, () => solved),
    }, { options: 2 });
    this.askAfter(this.talk, short);
    await done;
  }

  makeRow(p) {
    const bars = p.row.map((colour, i) => {
      const group = new THREE.Group();
      const outline = mesh(rbox(BAR_W + 0.12, BAR_H + 0.12, 0.1, 0.07), new THREE.MeshBasicMaterial({ color: '#f7c66a' }), { shadow: false });
      const inner = mesh(rbox(BAR_W, BAR_H, 0.2, 0.06), new THREE.MeshStandardMaterial({ color: COLOUR_HEX[colour], roughness: 0.85 }), { shadow: false });
      group.add(outline, inner);
      group.position.set(0, 2.15 + (p.row.length > 8 ? 0.35 : 0) + ((p.row.length - 1) / 2 - i) * STEP, ROW_Z); // (nine stripes sit higher, clear of the pots)
      group.userData.dynamic = true;
      group.userData.inner = inner;
      group.userData.outline = outline;
      if (i === p.gap) {
        group.userData.blank = true;
        inner.material.color.set('#efe2f7');
        inner.material.emissive.set('#f0a63e');
        inner.material.emissiveIntensity = 0.55;
      } else {
        outline.visible = false;
      }
      this.roundObjects.push(group);
      this.scene.add(group);
      return group;
    });
    return bars;
  }

  makePots(choices) {
    const xs = across(choices.length, choices.length > 3 ? 2.05 : 2.6);
    return choices.map((colour, i) => {
      const pot = new THREE.Group();
      pot.position.set(xs[i], 0, 3.2);
      const paint = new THREE.MeshStandardMaterial({ color: COLOUR_HEX[colour], roughness: 0.55 });
      const body = mesh(new THREE.CylinderGeometry(0.56, 0.48, 0.9, 24), paint, { y: 0.45, shadow: false });
      const rim = mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 24), new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.5 }), { y: 0.9, rx: Math.PI / 2, shadow: false });
      const brush = new THREE.Group();
      brush.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 10), new THREE.MeshStandardMaterial({ color: '#b98a58', roughness: 0.7 }), { y: 0.45, shadow: false }));
      brush.add(mesh(new THREE.SphereGeometry(0.21, 16, 12), new THREE.MeshStandardMaterial({ color: COLOUR_HEX[colour], roughness: 0.5 }), { y: 0.02, shadow: false }));
      brush.position.set(0.46, 0.82, 0.12);
      brush.rotation.z = -0.34;
      const halo = mesh(new THREE.CircleGeometry(1.02, 32), new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0, depthWrite: false }), { y: 0.5, z: -0.35, shadow: false });
      pot.add(body, rim, brush, halo);
      pot.userData.choice = colour;
      pot.userData.tapHeight = 0.7;
      pot.userData.body = body;
      pot.userData.halo = halo;
      this.roundObjects.push(pot);
      this.scene.add(pot);
      return pot;
    });
  }

  makeBall(kind, x) {
    const r = BALL_R[kind];
    const ball = mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ map: this.ballMaps[kind], roughness: 0.9 }), { x, y: 1.3, z: 0.5, shadow: false });
    ball.scale.setScalar(r);
    ball.userData.choice = kind;
    ball.userData.tapHeight = 0;
    ball.userData.radius = r;
    ball.userData.home = ball.position.clone();
    const halo = mesh(new THREE.SphereGeometry(1.06, 32, 20), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0, depthWrite: false }), { shadow: false });
    halo.visible = false;
    ball.add(halo);
    ball.userData.halo = halo;
    this.roundObjects.push(ball);
    this.scene.add(ball);
    return ball;
  }

  fillStripe(bar, colour) {
    const { inner, outline } = bar.userData;
    outline.visible = false;
    inner.material.color.set(COLOUR_HEX[colour]);
    inner.material.emissive.set('#000000');
    inner.material.emissiveIntensity = 0;
    const s0 = inner.scale.clone();
    return animate(420, (t) => {
      inner.scale.set(s0.x * (1 + Math.sin(t * Math.PI) * 0.06), s0.y * (1 + Math.sin(t * Math.PI) * 0.14), s0.z);
    }, ease.out);
  }

  bounceBall(ball) {
    const r = ball.userData.radius, y0 = ball.userData.home.y;
    return animate(700, (t) => {
      ball.scale.setScalar(r * (1 + Math.sin(t * Math.PI) * 0.1));
      ball.position.y = y0 + Math.sin(t * Math.PI) * 0.45;
    }, ease.linear).then(() => {
      ball.scale.setScalar(r);
      ball.position.y = y0;
    });
  }

  clearRound() {
    for (const obj of this.roundObjects) {
      this.untap(obj);
      obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [o.material].flat().forEach((m) => m.dispose());
      });
      obj.removeFromParent();
    }
    this.roundObjects = [];
    this.planet.visible = true;
  }

  async outro() {
    this.clearRound();
    this.redSpot.visible = true;
    const from = this.redSpot.rotation.z;
    await animate(900, (t) => {
      this.redSpot.scale.set(0.9 * t, 0.5 * t, 0.25 * t);
      this.redSpot.rotation.z = from + t * 0.9;
    }, ease.out);
    if (this.alive) await this.say(T.jupiterSpot());
  }

  success(at, options) {
    super.success(at, options);
    this.cheer(2);
    if (at) sparkle(this, at, { count: 8 });
  }

  doneLine() { return T.jupiterDone(); }

  exit() {
    super.exit();
    this.clearRound();
    this.maps.forEach((map) => map.dispose());
    this.portrait?.dispose();
  }
}

function rowSVG(row, gap) {
  const bars = row.map((colour, i) => (i === gap
    ? `<rect x="0.06" y="${i * 0.9 + 0.06}" width="5.88" height="0.78" rx="0.18" fill="#efe2f7" stroke="#f0a63e" stroke-width="0.1"/>`
    : `<rect x="0.06" y="${i * 0.9 + 0.06}" width="5.88" height="0.78" rx="0.18" fill="${COLOUR_HEX[colour]}"/>`)).join('');
  return `<svg viewBox="0 0 6 ${row.length * 0.9}" height="0.55em" width="${(6 * 0.55) / (row.length * 0.9)}em" aria-hidden="true">${bars}</svg>`;
}

export { COLOUR_HEX, JUPITER_COLOURS };
