import * as THREE from 'three';
import { animate, ease, wiggle, wait } from '../engine.js';
import { makeTruck, seatRiders, makeCone, rbox, mat, mesh } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { makeTree, makeBush } from '../world/nature.js';
import { makeHouse, makeLamp, makeHydrant } from '../world/props.js';
import { dust } from '../fx/particles.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { CONFIG } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { pickTarget } from '../progress.js';
import { Mission } from './mission.js';

const STEP = 14; // how far the cruiser drives after each round

// "Cone Road": numbered cones block the road; tap the right number to clear the way.
//  L1 1–3, numeral + dots everywhere (match) · L2 1–5, bubble shows numeral only
//  L3 1–6, bubble shows only dots (count them!), signs show only numerals, neighbours as wrong answers.
export class ConesMission extends Mission {
  constructor(game) {
    super(game, 'cones');
    this.view = { pos: new THREE.Vector3(0, 7.5, 12.5), look: new THREE.Vector3(0, 2, -1), minWidth: 11 };
    this.post = { tilt: 0.45, focus: 0.45, band: 0.26 };
    this.pupRides = true;
  }

  build() {
    this.meadow({ trees: false, flowers: false, clear: [[0, 0, 3]] });
    // everything that scrolls past lives in `world`
    const world = (this.world = new THREE.Group());
    world.userData.dynamic = true; // scrolls past the truck
    world.userData.bakeInside = true; // …but everything on it is rigid
    this.scene.add(world);
    const len = STEP * (CONFIG.roundsPerMission + 3);
    const road = mesh(new THREE.PlaneGeometry(7, len + 40), mat('#5b6472', { roughness: 0.9 }), { rx: -Math.PI / 2, y: 0.02, z: -len / 2 + 10 });
    road.castShadow = false;
    world.add(road);
    for (const side of [-1, 1]) {
      world.add(mesh(new THREE.BoxGeometry(0.3, 0.22, len + 40), mat('#e5e7eb'), { x: side * 3.65, y: 0.11, z: -len / 2 + 10 }));  // kerb
      world.add(mesh(new THREE.BoxGeometry(2.2, 0.18, len + 40), mat('#d6d3d1', { roughness: 0.95 }), { x: side * 4.9, y: 0.09, z: -len / 2 + 10 })); // pavement
    }
    for (let z = 15; z > -len; z -= 3) {
      world.add(mesh(new THREE.PlaneGeometry(0.25, 1.4), mat('#fde047'), { rx: -Math.PI / 2, y: 0.03, z, shadow: false }));
    }
    for (let z = 10, i = 0; z > -len; z -= 4.5, i++) {
      for (const side of [-1, 1]) {
        const t = makeTree({ type: i % 3 ? 'round' : 'birch', scale: 1.1 + Math.random() * 0.5 });
        t.position.set(side * (7.3 + Math.random() * 2), 0, z + Math.random() * 2);
        world.add(t);
      }
      if (i % 2) { const l = makeLamp(); l.position.set((i % 4 === 1 ? -1 : 1) * 4.2, 0.18, z); world.add(l); }
      if (i % 5 === 2) { const h = makeHydrant(); h.position.set(-4.3, 0.18, z + 1.5); world.add(h); }
      if (i % 3 === 0) { const b = makeBush({ seed: i }); b.position.set((i % 2 ? 1 : -1) * 6.2, 0, z - 1); world.add(b); }
    }
    for (let z = -6, i = 0; z > -len; z -= 12, i++) {
      for (const side of [-1, 1]) {
        const h = makeHouse(['#fde68a', '#bfdbfe', '#fbcfe8', '#bbf7d0', '#fed7aa'][(i * 2 + (side > 0)) % 5], ['#ef4444', '#8b5cf6', '#16a34a', '#2563eb'][(i + (side > 0)) % 4]);
        h.position.set(side * 11, 0, z + (side > 0 ? 5 : 0));
        h.rotation.y = -side * Math.PI / 2;
        h.scale.setScalar(1.3);
        world.add(h);
      }
    }

    // cruiser with riders, facing down the road
    this.truck = makeTruck();
    this.truck.position.set(0, 0, 5.5);
    this.truck.rotation.y = Math.PI;
    this.scene.add(this.truck);
    this.shadowUnder(this.truck, 1.9, 0.35);
    this.girl = makeGirl();
    this.pup = makePup();
    seatRiders(this.truck, this.girl, this.pup);
    this.speed = 0;
    this.onUpdate((dt, t) => this.truck.userData.update(t, this.speed));
  }

  round(r) {
    return new Promise((resolve) => {
      const pool = Array.from({ length: this.L.max }, (_, i) => i + 1);
      const target = pickTarget(pool, 'N:', this.last);
      this.last = target;
      this.item('N:' + target);
      this.question(this.L.bubble === 'dots' ? 'quantity' : 'numeral', target); // dots-only = count, then find the numeral
      const n = Math.min(this.L.choices, pool.length);
      const opts = numberChoices(target, this.L.max, n, this.level >= 2);
      const colors = shuffle(TILE_COLORS);
      const cones = [];
      let wrong = 0, solved = false;
      const zLocal = -this.world.position.z; // cones appear at world z = 0
      const dotsOnSign = this.L.sign === 'both';

      opts.forEach((num, i) => {
        const c = new THREE.Group();
        c.add(makeCone());
        c.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), mat('#94a3b8', { metalness: 0.5, roughness: 0.3 }), { y: 1.7 }));
        const face = new THREE.MeshStandardMaterial({ map: glyphTexture(String(num), { bg: colors[i], dots: dotsOnSign ? num : 0 }), roughness: 0.45 });
        const white = mat('#ffffff');
        const sign = new THREE.Mesh(rbox(1.5, 1.5, 0.14, 0.06), [white, white, white, white, face, white]);
        sign.position.y = 2.7;
        sign.castShadow = true;
        c.add(sign);
        c.userData.sign = sign;
        c.userData.num = num;
        c.userData.tapHeight = 1.8;
        c.position.set((i - (n - 1) / 2) * (n > 3 ? 1.75 : 2.3), 0, zLocal);
        this.world.add(c);
        cones.push(c);
        this.shadowUnder(c, 0.7, 0.3);
        this.dropIn(c, 0, i * 130).then(() => sfx.pop());

        this.tappable(c, async () => {
          if (solved) return;
          this.poke();
          this.lookAt(c);
          if (num === target) {
            solved = true;
            this.correct(num);
            this.stopIdle();
            cones.forEach((x) => this.untap(x));
            sfx.good();
            this.success(sign.getWorldPosition(new THREE.Vector3()));
            await say([this.praise(), ...(this.L.bubble === 'dots' ? T.dots(num) : T.number(num))]);
            // count the dots together
            for (let k = 1; k <= num; k++) {
              if (!this.alive) return;
              animate(300, (t) => sign.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.18), ease.linear);
              sfx.pop();
              await say(T.number(k));
            }
            if (!this.alive) return;
            // cones jump off the road
            sfx.whoosh();
            await Promise.all(cones.map((x) => {
              const x0 = x.position.x, side = x0 === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(x0);
              return animate(600, (t) => {
                x.position.x = x0 + side * t * 6;
                x.position.y = Math.sin(t * Math.PI) * 2;
                x.rotation.z = -side * t * 1.2;
              }, ease.out);
            }));
            cones.forEach((x) => x.removeFromParent());
            await this.drive(r);
            resolve();
          } else {
            wrong++;
            this.wrong(num);
            sfx.oops();
            wiggle(c);
            say([...T.thatsNumber(num), ...T.whereNumber(target)]);
            if (wrong >= 2) { const rc = cones.find((x) => x.userData.num === target); this.hint(rc, () => solved, rc.userData.sign); }
          }
        });
      });

      const b = this.L.bubble;
      ui.bubble({
        big: b === 'dots' ? '' : String(target),
        dots: b === 'numeral' ? 0 : target,
        pic: '🚧',
        onTap: () => this.replay(),
      });
      wait(600).then(() => {
        if (!this.alive) return;
        if (b === 'dots') this.ask(T.conesDots(r === 0));
        else this.ask(r === 0 ? T.conesFirst(target) : T.conesMore(target));
      });
    });
  }

  async drive(r) {
    if (!this.alive) return;
    const last = r === this.rounds - 1;
    this.truck.userData.setFlashing(true);
    sfx.siren(2);
    sfx.engine();
    this.speed = 0.4;
    const z0 = this.world.position.z;
    let puff = 0;
    await animate(1700, (t) => {
      this.world.position.z = z0 + STEP * t;
      if (++puff % 6 === 0 && t < 0.85) dust(this, new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.1, 7), { count: 2, size: 0.3 });
    }, ease.inOut);
    this.speed = 0;
    this.truck.userData.setFlashing(last);
  }
}
