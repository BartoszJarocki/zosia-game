import * as THREE from 'three';
import { animate, ease, wait, hop, camera } from '../engine.js';
import { mat, mesh, rbox, cyl, sphere, makeKitten } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { makeLookout } from '../world/props.js';
import { sparkle, dust } from '../fx/particles.js';
import { discTexture, TILE_COLORS, DICE } from '../textures.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { T } from '../lang/pl.js';
import { pick } from '../util.js';
import { Mission, EASY_MIX } from './mission.js';
import { getSession } from '../session/session.js';
import { nextStep } from '../session/director.js';
import { kittenFloors, nextDoor, diceFloors } from '../levels/lookout.js';

const LZ = -2;              // where the Lookout stands
const CAR_Z = LZ + 1.75;    // the glass elevator rides up its front
const Y0 = 3.0, YTOP = 7.45; // car floor at the ground floor / top floor (just under the pod)
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
const SIGN_X = 1.3;         // the floor signs: one column right of the shaft, a number line to ride along
const KITTEN_H = 1.13;      // the kitten model's height (paws to ears) at scale 1
const BEAT = 650;           // count along: at each floor its sign lights, a pause for her to say it, then the voice does
const DIE_Y = 0.46;         // the die rides on a little tray beside the car
const FUR = ['#fb923c', '#9ca3af', '#f5f5f4', '#57534e'];
const SEATS = [[-0.48, 0.34], [0, 0.38], [0.48, 0.34]]; // kittens ride at the front of the car
const GLOW = new THREE.Color('#fde047').multiplyScalar(2.2); // a lit sign's halo (bright enough to bloom)
// Camera: the whole tower (every floor, the car anywhere on it) fills the band of the screen the HUD leaves free.
// Portrait: the speech bubble sits over the car's column, so the band starts lower; the lift panel takes the right.
const FRAME = { land: { x: 0.3, top: 0.13, bottom: 0.96, minWidth: 6.6 }, port: { x: 1.15, top: 0.27, bottom: 0.95, minWidth: 6.6 } };

// "Baza" (the Lookout): ride the glass elevator. Press the floor button; the car stops at every floor on the way,
// its sign lights and its number is said after a beat (count along). Every ride rescues a kitten, and at the end
// everyone goes to the very top and down the slide!
//  pickup: a kitten waits on a floor ("Kotek czeka na piętrze dwa!") · find: only the kitten in the bubble, she reads
//  the sign beside it · relative: after a pickup, "one floor up/down" from where we are · dice: she taps a big die,
//  it says how many floors up, she presses where that lands (counting on); the kitten is a surprise there ·
//  go: one easy kitten, floors 1–3 with numeral + dots (the finale, and the gentler run after a rough one)
//
// Session finale (when the session director says the finale is due — the hub's alarm called her here):
// the alarm is on, ONE easy kitten ride, floors counted, up to the top with the siren and lights, down the slide,
// a big celebration. Not another quiz (~30–45 s).
export class LookoutMission extends Mission {
  constructor(game) {
    super(game, 'lookout');
    this.finale = nextStep(getSession()) === 'finale';
    if (this.finale) {
      this.L = { ...this.L, mode: 'go', bubble: 'both' };
      this.rounds = 1;
      this.easyMix = EASY_MIX;
      this.countsForLevel = false;
      this.bigFinish = true;
      this.doneLine = T.finaleDone;
    }
    this.N = this.L.max;
    this.view = { pos: new THREE.Vector3(1.6, 5.4, 13), look: new THREE.Vector3(1.6, 4.2, CAR_Z), minWidth: 6.6 };
    this.dist = 0;
    this.bubbleAt = 'left'; // the middle of the view is the balconies, where the kittens wait
    this.post = { tilt: 0.3, focus: 0.5, band: 0.36 };
    this.drift = 0.06;
    this.floor = 0;
    this.pupRides = true;
    this.follow = 'car';
    this.kittens = []; // the ones riding with us
    this.waiting = null; // the kitten on a balcony, waiting to be picked up
    this.visited = [];
  }

  floorY(f) { return Y0 + (YTOP - Y0) * (f / this.N); }

  /**
   * A floor's landing, sized to the floor height: its sign and a waiting kitten sit level with each other on the
   * same balcony, so a kitten is always right beside its own number. More floors: smaller, never touching.
   */
  get landing() {
    const gap = (YTOP - Y0) / this.N;
    const r = Math.min(0.42, gap * 0.46);
    const ks = Math.min(0.62, (gap - 0.12) / KITTEN_H); // the kitten fits under the balcony above
    return { r, ks, mid: (KITTEN_H / 2) * ks, kx: SIGN_X + r + 0.28 * ks + 0.02 };
  }

  build() {
    this.meadow({ clear: [[0, LZ, 7]] });
    const lk = (this.lookout = makeLookout({ slide: 'mission' }));
    lk.position.set(0, 0, LZ);
    this.scene.add(lk);
    // elevator rails + top housing
    const metal = mat('#94a3b8', { metalness: 0.6, roughness: 0.3 });
    for (const x of [-0.85, 0.85]) this.scene.add(mesh(cyl(0.05, 0.05, 6.1, 8), metal, { x, y: 5.9, z: CAR_Z - 0.5 }));
    this.scene.add(mesh(rbox(1.9, 0.22, 0.5, 0.06), mat('#1f55c9'), { y: 8.95, z: CAR_Z - 0.4 }));
    // every floor: a balcony with its numbered sign at the front; the sign lights while the car is there
    const { r, mid, kx } = this.landing;
    const blue = mat('#1f55c9', { roughness: 0.4 });
    const x0 = SIGN_X - r - 0.08, x1 = kx + 0.42;
    this.signs = range(1, this.N).map((f) => {
      const y = this.floorY(f), map = discTexture(String(f), TILE_COLORS[(f - 1) % TILE_COLORS.length]);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 32), [mat('#e5e7eb'), new THREE.MeshStandardMaterial({ map, roughness: 0.5 }), mat('#e5e7eb')]);
      s.rotation.set(Math.PI / 2, Math.PI / 2, 0); // face the camera, numeral upright
      s.position.set(SIGN_X, y + mid, CAR_Z + 0.12);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(r * 1.32, 40), new THREE.MeshBasicMaterial({ color: GLOW, toneMapped: false, transparent: true, opacity: 0 }));
      halo.position.set(SIGN_X, y + mid, CAR_Z + 0.065); // (between the sign and the balcony's front edge)
      halo.userData.dynamic = true;
      Object.assign(s.userData, { halo, radius: r, base: 1 });
      this.scene.add(s, halo);
      this.scene.add(mesh(rbox(x1 - x0, 0.1, 0.7, 0.04), blue, { x: (x0 + x1) / 2, y: y - 0.05, z: CAR_Z - 0.3 }));
      return s;
    });

    // the glass elevator car, with Zosia and Chase inside
    const car = (this.car = new THREE.Group());
    car.userData.dynamic = true;
    const glass = new THREE.MeshPhysicalMaterial({ color: '#cfeaff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 });
    car.add(mesh(rbox(1.5, 0.14, 1.05, 0.05), blue, { y: 0.07 }));
    car.add(mesh(rbox(1.5, 0.14, 1.05, 0.05), blue, { y: 1.38 }));
    for (const x of [-0.71, 0.71]) for (const z of [-0.48, 0.48]) car.add(mesh(rbox(0.08, 1.3, 0.08, 0.03), blue, { x, y: 0.72, z }));
    car.add(mesh(rbox(1.4, 1.2, 0.03, 0.01), glass, { y: 0.72, z: -0.48, shadow: false }));
    for (const x of [-0.71, 0.71]) car.add(mesh(rbox(0.03, 1.2, 0.95, 0.01), glass, { x, y: 0.72, shadow: false }));
    this.doors = [-1, 1].map((side) => {
      const d = mesh(rbox(0.7, 1.2, 0.03, 0.01), glass.clone(), { x: side * 0.36, y: 0.72, z: 0.5, shadow: false });
      d.userData.side = side;
      car.add(d);
      return d;
    });
    this.roofLight = mesh(sphere(0.1, 12), new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#fbbf24', emissiveIntensity: 0.4 }), { y: 1.52 });
    car.add(this.roofLight);
    this.girl = makeGirl();
    this.pup = makePup();
    this.girl.scale.setScalar(0.42);
    this.pup.scale.setScalar(0.42);
    this.girl.position.set(-0.33, 0.14, 0.02);
    this.pup.position.set(0.33, 0.14, 0.02);
    car.add(this.girl, this.pup);
    car.position.set(0, Y0, CAR_Z);
    this.scene.add(car);
    this.tappable(this.pup, () => { sfx.bark(); this.pup.userData.setHappy(1.2); });
    this.tappable(this.girl, () => { sfx.pop(); this.cheer(); });
    this.doorsOpen = true;
    this.setDoors(1);
    if (this.L.mode === 'dice') this.die = this.makeDie(this.L.dice);

    // finale: the Lookout's alarm is on (a red beacon on top), Chase is ready for action
    if (this.finale) {
      const red = new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 3, roughness: 0.3 });
      const beacon = mesh(sphere(0.38, 16), red, { y: 13.1, z: LZ, shadow: false });
      beacon.userData.dynamic = true;
      this.scene.add(beacon);
      this.onUpdate((dt, t) => { const on = Math.sin(t * (this.atTop ? 14 : 9)) > 0; red.emissiveIntensity = on ? 4.5 : 0.3; beacon.scale.setScalar(on ? 1.2 : 1); });
      this.roofLight.material.color.set('#ff6b6b');
      this.roofLight.material.emissive.set('#ff2a2a'); // the car's light flashes red too (alarm!)
      setTimeout(() => { if (!this.alive) return; sfx.siren(2); sfx.bark(); hop(this.pup, 0.3); this.pup.userData.setHappy(3); }, 500);
    }

    this.onUpdate((dt, t) => {
      this.frame(dt);
      this.roofLight.material.emissiveIntensity = this.moving || this.finale ? (Math.floor(t * 6) % 2 ? 3 : 0.4) : 0.4;
    });
  }

  /** Camera: holds the whole tower while she rides (a calm number line), then follows the riders down the slide. */
  frame(dt) {
    const k = this.dist ? Math.min(1, dt * 3) : 1;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const look = this.view.look;
    let ty, dist;
    if (this.follow === 'riders') {
      // once on the grass, the heroes and kittens stand between the badge and the buttons of the celebration
      const p = this.girl.getWorldPosition(new THREE.Vector3()), minWidth = 9;
      dist = Math.max(11.2, minWidth / (2 * tan * camera.aspect));
      ty = this.landed ? p.y + 0.15 * 2 * tan * dist : Math.max(3.4, p.y + 0.6);
      look.x += (p.x + (camera.aspect < 1 ? 0.6 : 1.2) - look.x) * k;
      look.z += (p.z - look.z) * k;
      this.view.minWidth = minWidth;
    } else {
      const f = camera.aspect < 1 ? FRAME.port : FRAME.land;
      const lo = Y0 - 0.15, hi = YTOP + 1.6; // the car's floor at the bottom, its roof at the top
      dist = Math.max((hi - lo) / (2 * tan * (f.bottom - f.top)), f.minWidth / (2 * tan * camera.aspect));
      ty = (lo + hi) / 2 + ((f.top + f.bottom) / 2 - 0.5) * 2 * tan * dist; // the tower sits in the free band
      look.x += (f.x - look.x) * k;
      this.view.minWidth = f.minWidth;
    }
    look.y += (ty - look.y) * k;
    this.dist += (dist - this.dist) * k;
    this.view.pos.set(look.x, look.y + this.dist * 0.116, look.z + this.dist);
  }

  /** Glass doors, 0 shut … 1 open. They fold up inside the car's frame (sliding out, they covered the floor's sign). */
  setDoors(k) { for (const d of this.doors) { d.position.x = d.userData.side * (0.36 + 0.26 * k); d.scale.x = 1 - 0.75 * k; } }
  async doorsTo(open) {
    if (this.doorsOpen === open) return;
    this.doorsOpen = open;
    sfx.doors();
    await animate(380, (t) => this.setDoors(open ? t : 1 - t), ease.inOut);
  }

  /** Ride to a floor. Counting along on the way (unless count:false): each floor's sign lights, a beat, its number. */
  async ride(to, { count = true } = {}) {
    const dir = Math.sign(to - this.floor);
    if (!dir) return;
    this.moving = true;
    this.here(0);
    sfx.hum();
    while (this.floor !== to && this.alive) {
      const next = this.floor + dir;
      const y0 = this.car.position.y, y1 = this.floorY(next);
      await animate(count ? 520 : 240, (t) => (this.car.position.y = y0 + (y1 - y0) * t), count ? ease.inOut : ease.linear);
      this.floor = next;
      this.panel?.show(next, dir);
      if (count && next > 0) {
        this.here(next);
        this.pulse(next);
        sfx.pop();
        await wait(BEAT);
        if (!this.alive) return;
        await say(T.number(next));
      }
    }
    this.moving = false;
    this.panel?.show(this.floor, 0);
  }

  /**
   * The sign of the floor the car is at lights up: a bright halo round it, its colours untouched, and it grows a
   * little (at 9 floors a lit sign still clears its neighbours); 0 = none.
   */
  here(f) { this.signs.forEach((s, i) => this.glow(i + 1, i + 1 === f)); }
  glow(f, on) {
    const s = this.signs[f - 1];
    if (!s) return;
    s.userData.halo.material.opacity = on ? 1 : 0;
    s.userData.base = on ? 1.15 : 1;
    this.grow(s, 0);
  }
  grow(s, k) { const v = s.userData.base * (1 + k); s.scale.setScalar(v); s.userData.halo.scale.setScalar(v); }
  pulse(f) {
    const s = this.signs[f - 1];
    if (s) animate(400, (t) => this.grow(s, Math.sin(t * Math.PI) * 0.3), ease.linear);
  }

  /** A lost kitten pops up on floor f's balcony, beside the sign. */
  kittenOn(f) {
    const { ks, kx } = this.landing;
    const k = makeKitten(FUR[this.kittens.length % FUR.length]);
    k.scale.setScalar(ks);
    k.position.set(kx, this.floorY(f), CAR_Z - 0.04); // (nearly in the sign's plane: seen from above, it stays level with it)
    k.rotation.y = -0.35;
    Object.assign(k.userData, { kitten: true, floor: f });
    this.scene.add(k);
    this.onUpdate((dt, t) => k.userData.idle(t));
    this.dropIn(k, this.floorY(f), 0, 600).then(() => {
      sfx.meow();
      sparkle(this, k.position.clone().add(new THREE.Vector3(0, 0.4, 0)), { count: 10, size: 0.1 });
      if (this.waiting === k) this.tappable(k, () => { sfx.meow(); hop(k, 0.25, 350); }); // (once it has landed: a hop mid-drop would leave it in the air)
    });
    return k;
  }
  /** The car is at the kitten's floor with the doors open: in it hops. */
  async kittenHopsIn(k) {
    this.untap(k);
    this.waiting = null;
    const [x, z] = SEATS[this.kittens.length];
    const seat = this.car.localToWorld(new THREE.Vector3(x, 0.14, z));
    sfx.meow();
    const s0 = k.scale.x;
    await Promise.all([this.jumpTo(k, seat, { height: 0.7, ms: 520 }), animate(520, (t) => { k.scale.setScalar(s0 + (0.38 - s0) * t); k.rotation.y = -0.35 * (1 - t); })]);
    this.car.attach(k);
    this.kittens.push(k);
    sfx.boing();
  }

  // ---------- the die (dice rides): it rides on a tray beside the car; a tap rolls it ----------
  /** A big dot die whose faces go round lo…hi (a 1–2 die shows 1, 2, 1, 2…). */
  makeDie([lo, hi]) {
    const die = new THREE.Group();
    die.userData.dynamic = true;
    die.add(mesh(rbox(0.72, 0.72, 0.72, 0.12), mat('#ffffff', { roughness: 0.35 })));
    const pip = mat('#1e4fbf', { roughness: 0.4 });
    // each face: its value, and the die's turn [x, y] that brings it to the front (the camera looks along -z)
    const turns = [[0, 0], [Math.PI / 2, 0], [0, -Math.PI / 2], [0, Math.PI / 2], [-Math.PI / 2, 0], [0, Math.PI]];
    die.userData.faces = turns.map(([rx, ry], i) => {
      const v = lo + (i % (hi - lo + 1));
      const face = new THREE.Group();
      for (const c of DICE[v]) face.add(mesh(sphere(0.075, 12), pip, { x: ((c % 3) - 1) * 0.2, y: (1 - Math.floor(c / 3)) * 0.2, z: 0.355, s: [1, 1, 0.45] }));
      face.rotation.set(-rx, -ry, 0, 'XYZ'); // the inverse of the turn: that turn brings this face round to the front
      die.add(face);
      return { v, turn: [rx, ry] };
    });
    die.position.set(-1.3, DIE_Y, 0.3);
    this.car.add(die, mesh(rbox(0.95, 0.1, 0.9, 0.04), mat('#1f55c9', { roughness: 0.4 }), { x: -1.3, y: 0.05, z: 0.3 }));
    return die;
  }

  /** "Dotknij kostki!": wait for her tap (after a while Chase rolls it), tumble, land showing `value` in front. */
  rollDie(value, first) {
    const die = this.die;
    ui.bubble({ pic: '🎲', onTap: () => this.say(T.diceTap()) });
    this.say(first ? [...T.kittensStart(), ...T.diceTap()] : T.diceTap());
    const turning = this.onUpdate((dt) => { die.rotation.y += dt * 1.2; }); // (no old number showing: it's waiting to be rolled)
    return new Promise((resolve) => {
      let done = false, quiet = 0;
      const roll = async (byChase) => {
        if (done || !this.alive) return;
        done = true;
        turning();
        clearInterval(nudge);
        this.untap(die);
        if (byChase) { sfx.bark(); hop(this.pup, 0.3); }
        sfx.whoosh();
        const [rx, ry] = die.userData.faces.find((fc) => fc.v === value).turn, spin = 4 * Math.PI;
        await animate(900, (t) => {
          die.position.y = DIE_Y + Math.sin(t * Math.PI) * 0.9;
          die.rotation.set(rx + spin * (1 - t), ry + spin * 0.75 * (1 - t), 0, 'YXZ');
        }, ease.out);
        if (!this.alive) return;
        sfx.boing();
        sparkle(this, die.getWorldPosition(new THREE.Vector3()), { count: 12, size: 0.12 });
        await say(T.number(value));
        resolve();
      };
      this.tappable(die, () => roll(false));
      const nudge = setInterval(() => { // a hop now and then; after the third, Chase rolls it himself
        if (!this.alive || done) return clearInterval(nudge);
        if (++quiet >= 3) return roll(true);
        hop(die, 0.25, 400);
        if (quiet === 2) this.say(T.diceTap());
      }, 5000);
    });
  }

  // ---------- one ride ----------
  /**
   * What ride r asks, by mode: { skill, target, kitten ('waits' on its balcony, or a 'surprise' there on arrival),
   * show() (the bubble), ask, short, hint() (optional; by default the number and its dots appear) }.
   * A dice ride waits for the die to be rolled first.
   */
  async plan(r) {
    const mode = this.L.mode;
    if (mode === 'dice') {
      const target = this.pick('sequence', diceFloors(this.floor, this.N, this.rounds - r - 1, this.L.dice)), d = target - this.floor;
      await this.rollDie(d, r === 0);
      return { skill: 'sequence', target, kitten: 'surprise', show: () => ui.bubble({ dots: d, dice: true, pic: '⬆️', onTap: () => this.replay() }),
        ask: T.diceUp(d), short: T.whichFloor(), hint: () => { this.countFloors(this.floor, d); return T.diceCount(); } };
    }
    if (mode === 'relative' && r > 0) {
      const from = this.floor, target = this.pick('sequence', nextDoor(from, this.N)), up = target > from;
      return { skill: 'sequence', target, kitten: 'waits', show: () => ui.bubble({ seq: [from, up ? '⬆' : '⬇'], pic: '🐱', onTap: () => this.replay() }),
        ask: [...T.liftHere(from), ...T.kittenNext(up)], short: T.oneFloor(up) };
    }
    const pool = mode === 'go' ? range(1, Math.min(3, this.N)) : range(1, this.N);
    const target = this.pick('numeral', kittenFloors(pool, this.floor, this.visited));
    if (mode === 'find') {
      return { skill: 'numeral', target, kitten: 'waits', show: () => ui.bubble({ big: '?', pic: '🐱', onTap: () => this.replay() }),
        ask: [...(r === 0 ? T.kittensStart() : []), ...T.kittenWhere()], short: T.whichFloor(),
        hint: () => { this.here(target); this.pulse(target); return T.kittenLook(); } }; // only the sign beside the kitten is lit
    }
    // pickup, go, and the first ride of relative
    const dots = this.L.bubble === 'both' ? target : 0;
    return { skill: 'numeral', target, kitten: 'waits', show: () => ui.bubble({ big: String(target), dots, pic: '🐱', onTap: () => this.replay() }),
      ask: [...(this.finale ? T.finaleStart() : r === 0 ? T.kittensStart() : []), ...T.kittenAt(target)], short: T.liftPress(target) };
  }

  /** The clue on a dice ride: the floors above the car light up one by one, as many as the die says. */
  async countFloors(from, d) {
    for (let f = from + 1; f <= from + d && this.alive; f++) {
      this.glow(f, true);
      this.pulse(f);
      sfx.pop();
      await wait(550);
      this.glow(f, false);
    }
  }

  async round(r) {
    if (!this.panel) this.panel = ui.liftPanel({ floors: this.N, onPress: (f) => this.onPress?.(f) });
    this.panel.lock(true);
    const ride = await this.plan(r);
    if (!this.alive) return;
    this.panel.lock(false);
    const { target } = ride;
    this.visited.push(target);
    this.last = target;
    if (ride.kitten === 'waits') this.waiting = this.kittenOn(target);
    ride.show();
    let busy = false, revealed = false;
    const showNumber = () => { revealed = true; ui.bubble({ big: String(target), dots: target, pic: '🐱', onTap: () => this.replay() }); this.prompt = T.liftPress(target); };
    this.question(ride.skill, target, {
      short: () => (revealed ? T.liftPress(target) : ride.short),
      hint: () => (ride.hint ? ride.hint() : (showNumber(), T.dots(target))), // "Trzy kropki!"
      simplify: () => showNumber(),
      reveal: () => this.panel.hint(target),
    }, { options: this.N });

    return new Promise((resolve) => {
      this.onPress = async (f) => {
        if (busy) return;
        this.poke();
        this.lookAt(this.signs[f - 1] || this.car);
        if (f !== target) { this.wrong(f); this.panel.nope(f); return; }
        busy = true;
        this.correct(f);
        this.stopIdle();
        this.panel.light(f);
        this.panel.lock(true);
        sfx.pop();
        await this.doorsTo(false);
        await this.ride(target);
        if (!this.alive) return;
        sfx.ding();
        this.here(target);
        await this.doorsTo(true);
        this.success(this.car.position.clone().add(new THREE.Vector3(0, 1.7, 0.6)));
        const k = ride.kitten === 'waits' ? this.waiting : this.kittenOn(target); // (dice: a kitten was waiting here all along!)
        await say([this.praise(), ...T.liftArrived(target)]);
        if (!this.alive) return;
        await this.kittenHopsIn(k);
        await say([pick(T.kittenIn())]); // (one of the variants)
        if (!this.alive) return;
        this.panel.clear();
        this.panel.lock(false);
        resolve();
      };
      wait(r === 0 ? 900 : 400).then(() => { if (this.alive) this.ask(ride.ask); });
    });
  }

  async outro() {
    ui.hideBubble();
    this.panel?.lock(true);
    await this.doorsTo(false);
    const atTop = this.floor === this.N, all = this.kittens.length > 1;
    const line = atTop ? (all ? T.kittensAllTop() : T.liftAtTop()) : (all ? T.kittensAll() : T.liftTop());
    await Promise.all([say(line), this.ride(this.N, { count: false })]); // (all of it said before the slide line)
    if (!this.alive) return;
    sfx.siren(2);
    sfx.ding();
    this.atTop = true; // (finale: the beacon flashes faster)
    this.signs.forEach((s, i) => setTimeout(() => { if (this.alive) { this.glow(i + 1, true); this.pulse(i + 1); } }, i * 90));
    if (this.finale) { this.cheer(2); this.pup.userData.setHappy(3); hop(this.pup, 0.3); }
    if (this.die) this.shrinkAway(this.die, 400);
    await wait(1800);
    if (!this.alive) return;
    // poof: up into the pod, onto the slide
    const curve = this.lookout.slideCurve;
    const at = (t) => this.lookout.localToWorld(curve.getPointAt(t));
    sparkle(this, this.car.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 20 });
    this.panel?.remove();
    this.panel = null;
    const riders = [this.girl, this.pup, ...this.kittens];
    for (const c of riders) { this.car.remove(c); this.scene.add(c); c.scale.setScalar(c === this.girl || c === this.pup ? 0.5 : 0.42); c.position.copy(at(0)); }
    this.follow = 'riders';
    await say(T.slide());
    if (!this.alive) return;
    this.cheer(5);
    this.pup.userData.setHappy(5);
    sfx.whoosh();
    const tan = new THREE.Vector3();
    const lag = 0.06, span = 1 + lag * (riders.length - 1); // one after another, a little apart, all the way down
    await animate(4200 + 250 * (riders.length - 2), (k) => {
      riders.forEach((c, i) => {
        const tc = Math.min(1, Math.max(0, k * span - lag * i));
        c.position.copy(at(tc)).add(new THREE.Vector3(0, 0.22, 0));
        curve.getTangentAt(Math.min(0.999, tc), tan);
        c.rotation.y = Math.atan2(tan.x, tan.z);
      });
    }, (t) => t * t * (3 - 2 * t));
    if (!this.alive) return;
    // land on the grass, run out a little, celebrate
    const land = at(1).add(new THREE.Vector3(-0.9, 0, 0.6));
    land.y = 0;
    sfx.boing();
    this.landed = true;
    await Promise.all([this.jumpTo(this.girl, land, { height: 0.8, ms: 420 }), this.jumpTo(this.pup, land.clone().add(new THREE.Vector3(1.1, 0, 0.2)), { height: 0.7, ms: 480 }),
      ...this.kittens.map((c, i) => { c.rotation.y = 0; sfx.meow(); return this.jumpTo(c, land.clone().add(new THREE.Vector3(-0.8 + i * 0.75, 0, 1.2)), { height: 0.6, ms: 420 + i * 90 }); })]);
    dust(this, land, { count: 6 });
    this.girl.rotation.y = 0.3;
    this.pup.rotation.y = -0.2;
    this.success(land.clone().add(new THREE.Vector3(0.5, 1.5, 0)), { big: true });
  }
}
