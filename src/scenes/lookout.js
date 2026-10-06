import * as THREE from 'three';
import { animate, ease, wait, hop } from '../engine.js';
import { mat, mesh, rbox, cyl, sphere } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { makeLookout } from '../world/props.js';
import { sparkle, dust } from '../fx/particles.js';
import { discTexture, TILE_COLORS } from '../textures.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { T } from '../lang/pl.js';
import { Mission } from './mission.js';

const LZ = -2;              // where the Lookout stands
const CAR_Z = LZ + 1.75;    // the glass elevator rides up its front
const Y0 = 3.0, YTOP = 7.45; // car floor at the ground floor / top floor (just under the pod)
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

// "Baza" (the Lookout): ride the glass elevator. Press the floor button; the floors are counted
// aloud on the way up. At the end: to the very top, and down the slide!
//  L1 floors 1–3 (numeral + dots) · L2 floors 1–5 · L3 floors 1–7, "we're on 3 — one floor up/down!"
export class LookoutMission extends Mission {
  constructor(game) {
    super(game, 'lookout');
    this.N = this.L.max;
    this.view = { pos: new THREE.Vector3(2.4, 5.4, 13), look: new THREE.Vector3(2.4, 4.2, CAR_Z), minWidth: 11.5 };
    this.post = { tilt: 0.3, focus: 0.5, band: 0.36 };
    this.drift = 0.06;
    this.floor = 0;
    this.pupRides = true;
    this.follow = 'car';
  }

  floorY(f) { return Y0 + (YTOP - Y0) * (f / this.N); }

  build() {
    this.meadow({ clear: [[0, LZ, 7]] });
    const lk = (this.lookout = makeLookout({ slide: 'mission' }));
    lk.position.set(0, 0, LZ);
    this.scene.add(lk);
    // elevator rails + top housing
    const metal = mat('#94a3b8', { metalness: 0.6, roughness: 0.3 });
    for (const x of [-0.85, 0.85]) this.scene.add(mesh(cyl(0.05, 0.05, 6.1, 8), metal, { x, y: 5.9, z: CAR_Z - 0.5 }));
    this.scene.add(mesh(rbox(1.9, 0.22, 0.5, 0.06), mat('#1f55c9'), { y: 8.95, z: CAR_Z - 0.4 }));
    // a numbered sign on every floor; it lights up when the elevator gets there
    const colors = TILE_COLORS;
    this.signs = range(1, this.N).map((f) => {
      const top = new THREE.MeshStandardMaterial({ map: discTexture(String(f), colors[(f - 1) % colors.length]), roughness: 0.5, emissive: '#000000' });
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32), [mat('#e5e7eb'), top, mat('#e5e7eb')]);
      s.rotation.set(Math.PI / 2, Math.PI / 2, 0); // face the camera, numeral upright
      s.position.set(1.42, this.floorY(f) + 0.72, CAR_Z - 0.35);
      s.userData.top = top;
      this.scene.add(s);
      this.scene.add(mesh(rbox(0.5, 0.06, 0.06, 0.02), metal, { x: 1.1, y: this.floorY(f) + 0.72, z: CAR_Z - 0.4 }));
      return s;
    });

    // the glass elevator car, with Zosia and Chase inside
    const car = (this.car = new THREE.Group());
    car.userData.dynamic = true;
    const blue = mat('#1f55c9', { roughness: 0.35 });
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

    // camera follows the car (or the riders, on the slide)
    const p = new THREE.Vector3();
    this.onUpdate((dt, t) => {
      (this.follow === 'riders' ? this.girl : this.car).getWorldPosition(p);
      const ty = Math.max(3.4, p.y + (this.follow === 'riders' ? 0.6 : 1.1));
      const k = Math.min(1, dt * 3);
      this.view.look.y += (ty - this.view.look.y) * k;
      if (this.follow === 'riders') {
        this.view.look.x += (p.x + 1.2 - this.view.look.x) * k;
        this.view.look.z += (p.z - this.view.look.z) * k;
      }
      this.view.pos.set(this.view.look.x, this.view.look.y + 1.3, this.view.look.z + 11.2);
      this.roofLight.material.emissiveIntensity = this.moving ? (Math.floor(t * 6) % 2 ? 3 : 0.4) : 0.4;
    });
  }

  setDoors(k) { for (const d of this.doors) d.position.x = d.userData.side * (0.36 + 0.62 * k); }
  async doorsTo(open) {
    if (this.doorsOpen === open) return;
    this.doorsOpen = open;
    sfx.doors();
    await animate(380, (t) => this.setDoors(open ? t : 1 - t), ease.inOut);
  }

  /** Ride to a floor. Counting aloud on the way (unless count:false). */
  async ride(to, { count = true } = {}) {
    const dir = Math.sign(to - this.floor);
    if (!dir) return;
    this.moving = true;
    sfx.hum();
    while (this.floor !== to && this.alive) {
      const next = this.floor + dir;
      const y0 = this.car.position.y, y1 = this.floorY(next);
      await animate(count ? 520 : 240, (t) => (this.car.position.y = y0 + (y1 - y0) * t), count ? ease.inOut : ease.linear);
      this.floor = next;
      this.panel?.show(next, dir);
      if (count && next > 0) {
        sfx.pop();
        await say(T.number(next));
      }
    }
    this.moving = false;
    this.panel?.show(this.floor, 0);
  }

  lightSign(f) {
    const s = this.signs[f - 1];
    if (!s) return;
    s.userData.top.emissive.set('#fde047');
    s.userData.top.emissiveIntensity = 0.4;
    animate(400, (t) => s.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.3), ease.linear);
  }

  round(r) {
    if (!this.panel) this.panel = ui.liftPanel({ floors: this.N, onPress: (f) => this.onPress?.(f) });
    const relative = this.L.mode === 'relative' && r > 0;
    return new Promise((resolve) => {
      let target, up = true;
      if (relative) {
        up = this.floor <= 1 ? true : this.floor >= this.N ? false : Math.random() < 0.6;
        target = this.floor + (up ? 1 : -1);
      } else {
        const pool = this.L.mode === 'relative' ? range(2, this.N - 1) : range(1, this.N);
        target = this.pick('numeral', pool);
      }
      this.last = target;
      this.item('N:' + target);
      let busy = false, revealed = false;

      const showTarget = (dots = this.L.bubble === 'both') => ui.bubble({ big: String(target), dots: dots ? target : 0, pic: '🛗', onTap: () => this.replay() });
      if (relative) ui.bubble({ seq: [this.floor, up ? '⬆' : '⬇'], onTap: () => this.replay() });
      else showTarget();
      const from = this.floor;
      const showNumber = () => { revealed = true; showTarget(true); this.prompt = T.liftPress(target); }; // number + dots
      this.question(relative ? 'sequence' : 'numeral', target, { // "one floor up/down" = one more / one less
        short: () => (relative && !revealed ? T.liftRel(from, up) : T.liftPress(target)),
        hint: () => { showNumber(); return T.dots(target); }, // the dots appear: "Trzy kropki!"
        simplify: () => showNumber(),
        reveal: () => this.panel.hint(target),
      });

      this.onPress = async (f) => {
        if (busy) return;
        this.poke();
        this.lookAt(this.signs[f - 1] || this.car);
        if (f === target) {
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
          this.lightSign(target);
          await this.doorsTo(true);
          this.success(this.car.position.clone().add(new THREE.Vector3(0, 1.7, 0.6)));
          await say([this.praise(), ...T.liftArrived(target)]);
          if (!this.alive) return;
          this.panel.clear();
          if (this.L.mode !== 'relative' && r < this.rounds - 1) {
            // back down for the next ride (not after the last one: the finale goes up to the top from here)
            await this.doorsTo(false);
            await this.ride(0, { count: false });
            await this.doorsTo(true);
          }
          this.panel.lock(false);
          resolve();
        } else {
          this.wrong(f, T.thatsNumber(f));
          sfx.oops();
          this.panel.nope(f);
        }
      };

      wait(r === 0 ? 700 : 300).then(() => {
        if (!this.alive) return;
        if (relative) this.ask(T.liftRel(this.floor, up));
        else this.ask(r === 0 ? [...T.liftStart(), ...T.liftGo(target)] : T.liftGo(target));
      });
    });
  }

  async outro() {
    ui.hideBubble();
    this.panel?.lock(true);
    await this.doorsTo(false);
    say(T.liftTop());
    await this.ride(this.N, { count: false });
    if (!this.alive) return;
    sfx.siren(2);
    sfx.ding();
    this.signs.forEach((s, i) => setTimeout(() => this.lightSign(i + 1), i * 90));
    await wait(1800);
    if (!this.alive) return;
    // poof: up into the pod, onto the slide
    const curve = this.lookout.slideCurve;
    const at = (t) => this.lookout.localToWorld(curve.getPointAt(t));
    sparkle(this, this.car.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 20 });
    this.panel?.remove();
    this.panel = null;
    for (const c of [this.girl, this.pup]) { this.car.remove(c); this.scene.add(c); c.scale.setScalar(0.5); }
    this.girl.position.copy(at(0)); this.pup.position.copy(at(0));
    this.follow = 'riders';
    await say(T.slide());
    if (!this.alive) return;
    this.cheer(5);
    this.pup.userData.setHappy(5);
    sfx.whoosh();
    const tan = new THREE.Vector3();
    await animate(4200, (k) => {
      const tg = Math.min(1, k), tp = Math.max(0, k - 0.06);
      this.girl.position.copy(at(tg)).add(new THREE.Vector3(0, 0.22, 0));
      this.pup.position.copy(at(tp)).add(new THREE.Vector3(0, 0.22, 0));
      curve.getTangentAt(Math.min(0.999, tg), tan);
      this.girl.rotation.y = Math.atan2(tan.x, tan.z);
      curve.getTangentAt(Math.min(0.999, tp), tan);
      this.pup.rotation.y = Math.atan2(tan.x, tan.z);
    }, (t) => t * t * (3 - 2 * t));
    if (!this.alive) return;
    // land on the grass, run out a little, celebrate
    const land = at(1).add(new THREE.Vector3(-0.9, 0, 0.6));
    land.y = 0;
    sfx.boing();
    await Promise.all([this.jumpTo(this.girl, land, { height: 0.8, ms: 420 }), this.jumpTo(this.pup, land.clone().add(new THREE.Vector3(1.1, 0, 0.2)), { height: 0.7, ms: 480 })]);
    dust(this, land, { count: 6 });
    this.girl.rotation.y = 0.3;
    this.pup.rotation.y = -0.2;
    this.success(land.clone().add(new THREE.Vector3(0.5, 1.5, 0)), { big: true });
  }
}
