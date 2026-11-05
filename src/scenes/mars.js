import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { makePup } from '../characters.js';
import { makeRocket } from '../world/rocket.js';
import { sparkle, dust } from '../fx/particles.js';
import { glyphTexture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { marsBubble, marsPool, marsSkill } from '../levels/mars.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const START_X = -4.8, ROCK_Z = -0.65, ROCK_BG = '#9f3022';
const slotX = (i, n) => (i - (n - 1) / 2) * (n > 3 ? 1.9 : 2.35);

function texture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// "The Mars Rover": numbered red rocks lie ahead; tap the one the bubble asks for and the rover drives
// there, scans it and sparkles. GAME.md has the levels: numeral + dots at first, then dots to count,
// then only the spoken number. Choices are the neighbouring numbers from level 2.
export class MarsMission extends Mission {
  constructor(game) {
    super(game, 'mars');
    this.view = { pos: new THREE.Vector3(0, 8.6, 14.5), look: new THREE.Vector3(0, 1.5, 0), minWidth: 15 };
    this.post = { tilt: 0, ao: false };
    this.bubbleAt = 'left';
    this.pupRides = true;
    this.maps = [];
    this.speed = 0;
  }

  build() {
    this.scene.background = new THREE.Color('#c487dc');
    this.scene.add(new THREE.HemisphereLight('#fff7ff', '#9c4a32', 2.5));
    const sun = new THREE.DirectionalLight('#fff4e2', 1.9);
    sun.position.set(-7, 15, 9);
    this.scene.add(sun);

    const ground = texture(512, (c, size) => {
      c.fillStyle = '#b84c33'; c.fillRect(0, 0, size, size);
      for (let i = 0; i < 120; i++) {
        const x = (i * 173 + 41) % size, y = (i * 311 + 97) % size, r = 6 + (i % 5) * 4;
        c.fillStyle = i % 3 ? '#a8412c' : '#c65f42';
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      for (let i = 0; i < 34; i++) {
        const x = (i * 229 + 61) % size, y = (i * 157 + 23) % size;
        c.fillStyle = '#93341f';
        c.beginPath(); c.ellipse(x, y, 9 + i % 4 * 3, 4 + i % 3 * 2, 0, 0, Math.PI * 2); c.fill();
      }
    });
    this.maps.push(ground);
    this.scene.add(mesh(new THREE.CircleGeometry(32, 72), new THREE.MeshStandardMaterial({ map: ground, roughness: 1 }), { rx: -Math.PI / 2, shadow: false }));

    for (const [x, z, sx, sy, sz] of [[-9, -16, 1.6, 0.55, 0.9], [9, -18, 1.4, 0.45, 0.8], [0, -22, 2.2, 0.6, 0.9]]) {
      this.scene.add(mesh(new THREE.SphereGeometry(6, 24, 12), mat('#9e3a2a', { roughness: 1 }), { x, y: -1.8, z, s: [sx, sy, sz], shadow: false }));
    }
    for (const [x, y, z, r, color] of [[-4.8, 7.4, -19, 0.42, '#f8d4e8'], [4.3, 6.4, -21, 0.3, '#fde68a']]) {
      this.scene.add(mesh(new THREE.SphereGeometry(r, 16, 12), mat(color), { x, y, z, shadow: false }));
    }

    this.rocket = makeRocket();
    this.rocket.scale.setScalar(1.25);
    this.rocket.position.set(5.8, 7, -6);
    this.rocket.userData.flame.visible = true;
    this.scene.add(this.rocket);
    this.landed = animate(1700, (t) => { this.rocket.position.y = 1.05 + (1 - t) * 5.95; }, ease.out).then(() => {
      this.rocket.userData.flame.visible = false;
    });

    this.rover = this.makeRover();
    this.rover.position.set(START_X, 0, 1);
    this.scene.add(this.rover);
    this.onUpdate((dt, t) => this.rover.userData.update(t, this.speed));
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makeRover() {
    const g = new THREE.Group();
    g.add(mesh(rbox(2, 0.55, 1.2, 0.16), mat('#f1f5f9', { roughness: 0.5 }), { y: 0.78 }));
    g.add(mesh(rbox(1.35, 0.18, 1.22, 0.06), mat('#c2410c', { roughness: 0.5 }), { y: 1.04 }));
    const glass = new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.35, roughness: 0.08 });
    g.add(mesh(rbox(1.05, 0.5, 0.85, 0.12), glass, { y: 1.27, z: -0.08, shadow: false }));
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65, 8), mat('#cbd5e1'), { x: -0.6, y: 1.45 }));
    const dish = mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2e8f0', { side: THREE.DoubleSide }), { x: -0.6, y: 1.82, rx: Math.PI, shadow: false });
    g.add(dish);

    const arm = new THREE.Group();
    arm.position.set(0.85, 0.72, 0.4);
    arm.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), mat('#94a3b8', { metalness: 0.4, roughness: 0.3 }), { y: 0.3 }));
    arm.add(mesh(rbox(0.2, 0.18, 0.3, 0.04), mat('#fbbf24'), { y: 0.62, z: 0.08 }));
    g.add(arm);
    g.userData.arm = arm;

    const wheels = [], tire = mat('#3f3f46');
    for (const x of [-1.05, 1.05]) for (const z of [-0.45, 0, 0.45]) {
      const w = new THREE.Group();
      w.position.set(x, 0.3, z);
      w.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16), tire, { rz: Math.PI / 2 }));
      g.add(w);
      wheels.push(w);
    }

    this.pup = makePup();
    this.pup.position.set(0, 0.98, -0.06);
    this.pup.scale.setScalar(0.52);
    g.add(this.pup);

    g.userData.mergeOK = true;
    g.userData.update = (t, speed = 0) => {
      wheels.forEach((w) => (w.rotation.x += speed));
      dish.rotation.y = Math.sin(t * 0.9) * 0.35;
    };
    return g;
  }

  makeRock(num, showDots) {
    const g = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: ROCK_BG, roughness: 0.95, emissive: '#f59e0b', emissiveIntensity: 0 });
    g.add(mesh(new THREE.DodecahedronGeometry(0.9, 0), rockMat, { y: 0.75, s: [1, 0.9, 0.85], shadow: false }));
    const map = glyphTexture(String(num), { bg: ROCK_BG, fg: '#fff7ed', dots: showDots ? num : 0, border: ROCK_BG });
    const sign = mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map }), { y: 0.82, z: 0.82, shadow: false });
    g.add(sign);
    g.userData.sign = sign;
    g.userData.num = num;
    g.userData.rockMat = rockMat;
    g.userData.tapHeight = 1.1;
    return g;
  }

  rollIn(rock) {
    const x = rock.position.x;
    rock.position.x = x + 7;
    animate(550, (t) => {
      rock.position.x = x + (1 - t) * 7;
      rock.rotation.y = (1 - t) * Math.PI * 2;
    }, ease.out);
  }

  async round(r) {
    if (r === 0) {
      await this.landed;
      if (!this.alive) return;
      await this.say(T.marsStart());
    }
    if (!this.alive) return;
    await this.rocksRound();
  }

  rocksRound() {
    return new Promise((resolve) => {
      const skill = marsSkill(this.L.ask);
      const target = this.pick(skill, marsPool(this.L.max));
      this.last = target;
      const n = Math.min(this.L.choices, this.L.max);
      const opts = numberChoices(target, this.L.max, n, this.level >= 2);
      const rocks = [];
      let solved = false, lastWrong = null;

      const bubble = (big, dots) => ui.bubble({ big, dots, pic: '🚙', onTap: () => this.replay() });
      opts.forEach((num, i) => {
        const rock = this.makeRock(num, this.L.rock === 'both');
        const x = slotX(i, n);
        rock.position.set(x, 0, ROCK_Z);
        rock.userData.x = x;
        this.scene.add(rock);
        rocks.push(rock);
        this.tappable(rock, () => handleTap(rock, num));
        this.rollIn(rock);
      });
      bubble(...marsBubble(this.L.ask, target));
      const rc = rocks.find((x) => x.userData.num === target);

      const pointAtDots = async () => {
        for (const dot of document.querySelectorAll?.('.bubble .dots i') || []) {
          if (!this.alive || solved) return;
          Object.assign(dot.style, { background: '#f59e0b', transform: 'scale(1.3)', transition: 'transform .2s' });
          sfx.pop();
          await wait(650);
        }
      };
      const simplify = () => this.removeOption(lastWrong?.parent ? lastWrong : rocks.find((x) => x !== rc && x.parent));
      const hooks = this.L.ask === 'dots' ? {
        short: T.marsRepeat(target),
        hint: (said = []) => this.say([...said, ...T.countDots()]).then(pointAtDots),
        simplify,
        reveal: () => { this.hint(rc, () => solved, rc.userData.sign); return T.dots(target); },
      } : {
        short: T.marsRepeat(target),
        hint: () => { bubble(this.L.ask === 'name' ? '' : String(target), target); return T.dots(target); },
        simplify,
        reveal: () => this.hint(rc, () => solved, rc.userData.sign),
      };
      this.question(skill, target, hooks, { options: n });
      wait(600).then(() => {
        if (!this.alive) return;
        this.ask(this.L.ask === 'dots' ? T.marsDots() : T.marsAsk(target));
      });

      const handleTap = async (rock, num) => {
        if (solved) return;
        this.poke();
        this.lookAt(rock);
        if (num !== target) {
          lastWrong = rock;
          this.wrong(num, { obj: rock, said: T.marsWrong(target) });
          this.glow(rc);
          return;
        }
        solved = true;
        this.correct(num);
        this.stopIdle();
        rocks.forEach((x) => this.untap(x));
        sfx.good();
        this.success();
        await this.driveTo(rock);
        if (!this.alive) return;
        await this.say(T.marsRight());
        if (!this.alive) return;
        await this.scan(rock);
        if (!this.alive) return;
        await this.clearRocks(rocks);
        if (this.alive) resolve();
      };
    });
  }

  glow(rock) {
    const m = rock?.userData.rockMat;
    if (!m) return;
    animate(900, (t) => { m.emissiveIntensity = Math.sin(t * Math.PI) * 0.7; }, ease.linear);
  }

  async driveTo(rock) {
    const from = this.rover.position.x, to = rock.userData.x - 1.75;
    if (Math.abs(to - from) < 0.01) return;
    sfx.engine();
    this.speed = 0.45;
    let puff = 0;
    await animate(900, (t) => {
      this.rover.position.x = from + (to - from) * t;
      if (++puff % 5 === 0 && t < 0.9) dust(this, new THREE.Vector3(this.rover.position.x, 0.12, 1.3), { count: 2, size: 0.22 });
    }, ease.inOut);
    this.speed = 0;
  }

  async scan(rock) {
    sfx.ding();
    const arm = this.rover.userData.arm, base = arm.rotation.z;
    await animate(800, (t) => { arm.rotation.z = base - Math.sin(t * Math.PI * 2) * 0.55; }, ease.linear);
    arm.rotation.z = base;
    sparkle(this, rock.position.clone().add(new THREE.Vector3(0, 1.1, 0)), { count: 14, colors: ['#fde68a', '#fff7ed', '#fdba74'] });
  }

  async clearRocks(rocks) {
    sfx.whoosh();
    await Promise.all(rocks.map((rock) => {
      const x = rock.userData.x, side = x >= 0 ? 1 : -1;
      return animate(550, (t) => {
        rock.position.x = x + side * t * 6;
        rock.position.y = Math.sin(t * Math.PI) * 0.5;
        rock.rotation.z = side * t * 1.1;
      }, ease.in);
    }));
    rocks.forEach((rock) => this.disposeRock(rock));
  }

  disposeRock(rock) {
    rock.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of [o.material].flat()) {
        m.map?.dispose();
        m.dispose();
      }
    });
    rock.removeFromParent();
  }

  doneLine() { return [...T.marsDone(), ...T.marsFact()]; }

  exit() {
    super.exit();
    this.maps.forEach((map) => map.dispose());
  }
}
