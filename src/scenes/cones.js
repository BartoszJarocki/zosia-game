import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { makeTruck, seatRiders, makeCone, rbox, mat, mesh } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { makeTree, makeBush } from '../world/nature.js';
import { makeHouse, makeLamp, makeHydrant } from '../world/props.js';
import { dust } from '../fx/particles.js';
import { glyphTexture, DICE, TILE_COLORS } from '../textures.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { Mission } from './mission.js';

const STEP = 14; // how far the cruiser drives after each round
const LIT = '#fde047'; // a dot being counted

/**
 * Where glyphTexture (textures.js) draws a sign's dots, [x, y, r] on its 512 px canvas, in counting order
 * (dice pips read like a book). Keep in step with glyphTexture.
 */
function dotCenters(dots, layout, withText) {
  const S = 512;
  if (layout === 'dice' && DICE[dots]) {
    const big = !withText, cell = big ? 120 : 62, r = big ? 44 : 24, cy = big ? S / 2 : S * 0.8 - 4;
    return DICE[dots].map((k) => [S / 2 + ((k % 3) - 1) * cell * (big ? 1 : 1.25), cy + (Math.floor(k / 3) - 1) * cell * (big ? 1 : 0.55), r]);
  }
  const rows = Math.ceil(dots / 5);
  return Array.from({ length: dots }, (_, i) => {
    const row = Math.floor(i / 5), col = i % 5, inRow = row === rows - 1 ? dots - row * 5 : Math.min(dots, 5);
    return withText
      ? [S / 2 + (col - (inRow - 1) / 2) * 70, S * 0.8 + (row - (rows - 1) / 2) * 62, 26]
      : [S / 2 + (col - (inRow - 1) / 2) * 86, S / 2 + (row - (rows - 1) / 2) * 96, 34];
  });
}

/** A cone's sign with its first `lit` dots glowing yellow (counting them one by one). */
function litSign(text, { bg, dots, layout, lit }) {
  const base = glyphTexture(text, { bg, dots, layout });
  if (!lit) return base;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.drawImage(base.image, 0, 0);
  for (const [x, y, r] of dotCenters(dots, layout, !!text).slice(0, lit)) {
    c.beginPath(); c.arc(x, y, r + 7, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
    c.beginPath(); c.arc(x, y, r + 3, 0, Math.PI * 2); c.fillStyle = LIT; c.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.lit = true;
  return tex;
}

// "Cone Road": numbered cones block the road; tap the right number to clear the way. GAME.md has the levels:
// first numeral + dots everywhere (match), then only the numeral in the bubble, then "which cone has four dots?",
// then only dots in the bubble (count them, find the numeral), up to 10 in rows of five.
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
    const len = STEP * (this.rounds + 3);
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
      // dots in the bubble (find the numeral) or "which cone has N dots?" = quantity; otherwise the numeral
      const ask = this.L.bubble;
      const skill = ask === 'dots' || ask === 'name' ? 'quantity' : 'numeral';
      const layout = this.L.dots || 'line';
      const target = this.pick(skill, pool);
      this.last = target;
      this.item('N:' + target);
      const n = Math.min(this.L.choices, pool.length);
      const opts = numberChoices(target, this.L.max, n, this.level >= 2);
      const colors = shuffle(TILE_COLORS);
      const cones = [];
      let solved = false, lastWrong = null;
      const zLocal = -this.world.position.z; // cones appear at world z = 0
      const dotsOnSign = this.L.sign !== 'numeral', numOnSign = this.L.sign !== 'dots';

      opts.forEach((num, i) => {
        const c = new THREE.Group();
        c.add(makeCone());
        c.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), mat('#94a3b8', { metalness: 0.5, roughness: 0.3 }), { y: 1.7 }));
        const look = { bg: colors[i], dots: dotsOnSign ? num : 0, layout };
        const face = new THREE.MeshStandardMaterial({ map: litSign(numOnSign ? String(num) : '', { ...look, lit: 0 }), roughness: 0.45 });
        const light = (lit) => {
          const old = face.map;
          face.map = litSign(numOnSign ? String(num) : '', { ...look, lit });
          if (old.userData.lit) old.dispose(); // (the plain sign is glyphTexture's, shared and cached)
        };
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
            if (this.L.count) {
              // count the dots together, each one lighting up as it is said, then how many ("Trzy kropki!")
              await say([this.praise()]);
              for (let k = 1; k <= num; k++) {
                if (!this.alive) return;
                light(k);
                sfx.pop();
                await say(T.number(k));
              }
              if (!this.alive) return;
              await say(T.dots(num));
            } else await say([this.praise(), ...(ask === 'dots' ? T.dots(num) : T.number(num))]); // (later she just knows: "Cztery!")
            if (!this.alive) return;
            // cones jump off the road
            sfx.whoosh();
            await Promise.all(cones.filter((x) => x.parent).map((x) => {
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
            lastWrong = c;
            this.wrong(num, { obj: c });
          }
        });
      });

      // the bubble: numeral and/or dots (dice at higher levels), or nothing but the question ("name")
      const bubble = (big, dots) => ui.bubble({ big, dots, dice: layout === 'dice', pic: '🚧', onTap: () => this.replay() });
      const shown = { both: [String(target), target], numeral: [String(target), 0], dots: ['', target], name: ['', 0] }[ask];
      bubble(...shown);
      const rc = cones.find((x) => x.userData.num === target);
      // the bubble's dots light up one at a time, a pop each, so she can count along (no number said)
      const pointAtDots = async () => {
        for (const dot of document.querySelectorAll('.bubble .dots i')) {
          if (!this.alive || solved) return;
          Object.assign(dot.style, { background: '#f59e0b', transform: 'scale(1.3)', transition: 'transform .2s' });
          sfx.pop();
          await wait(650);
        }
      };
      const simplify = () => this.removeOption(lastWrong?.parent ? lastWrong : cones.find((x) => x !== rc && x.parent));
      // "dots": she counts and finds the numeral, so no help names the number before the reveal
      const hooks = ask === 'dots' ? {
        short: T.conesDots(false),
        hint: (said = []) => this.say([...said, ...T.countDots()]).then(pointAtDots),
        simplify,
        reveal: () => { this.hint(rc, () => solved, rc.userData.sign); return T.dots(target); },
      } : {
        short: ask === 'name' ? T.conesWhich(target, false) : T.whereNumber(target),
        hint: () => { bubble(ask === 'name' ? '' : String(target), target); return T.dots(target); }, // the dots (and numeral) appear
        simplify,
        reveal: () => this.hint(rc, () => solved, rc.userData.sign),
      };
      this.question(skill, target, hooks, { options: n });
      wait(600).then(() => {
        if (!this.alive) return;
        if (ask === 'dots') this.ask(T.conesDots(r === 0));
        else if (ask === 'name') this.ask(T.conesWhich(target, r === 0));
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
