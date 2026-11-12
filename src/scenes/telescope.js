import * as THREE from 'three';
import { hop, animate, ease } from '../engine.js';
import { sfx } from '../audio.js';
import * as ui from '../ui.js';
import { T, SPACE_FACTS } from '../lang/pl.js';
import { itemsFor, questionFor, roadOf } from '../levels/telescope.js';
import { glyphTexture } from '../textures.js';
import { makeSpacePlace } from './space.js';
import { Mission } from './mission.js';

const POSITIONS = {
  2: [[-3.2, -1.6], [3.2, -1.6]],
  3: [[-3.1, 1.8], [3.1, 1.8], [0, -3]],
  4: [[-3, 2.6], [3, 2.6], [-3, -2.6], [3, -2.6]],
};
const ROAD = { y: 4.5, half: 4.7, size: 0.56, sun: 0.62, below: 0.6 }; // the road from the Sun, along the top of the eyepiece; the choices sit `below` lower
const radius = (kind, ask) => kind === 'comet' || kind === 'blackhole' ? 1.05 : kind === 'jupiter' && ask === 'feature' ? 2 : 1.35;

export class TelescopeMission extends Mission {
  constructor(game) {
    super(game, 'telescope');
    this.at = 'earth';
    this.view = { pos: new THREE.Vector3(0, 0, 22), look: new THREE.Vector3(), minWidth: 16.4 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.models = new Map();
    this.choices = [];
  }

  build() {
    this.scene.background = new THREE.Color('#38224f');
    this.scene.add(new THREE.HemisphereLight('#f1eaff', '#7562a8', 2));
    const light = new THREE.DirectionalLight('#fff1dc', 2.2);
    light.position.set(-10, 30, 28);
    this.scene.add(light);
    const sky = new THREE.Mesh(new THREE.CircleGeometry(8, 128), new THREE.MeshBasicMaterial({ color: '#8260c7' }));
    sky.position.z = -2.5;
    this.scene.add(sky);
    for (const [r, tube, color] of [[8.05, 0.25, '#c59a58'], [7.85, 0.08, '#f7dc9b'], [8.28, 0.08, '#886638']]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 128), new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.25 }));
      rim.position.z = -2.5;
      this.scene.add(rim);
    }
    this.onUpdate((dt, t) => {
      for (const obj of this.choices) {
        if (!obj.userData.hopping) obj.position.y = obj.userData.y + Math.sin(t * 1.2 + obj.userData.phase) * 0.08;
      }
    });
  }

  place(kind, r) {
    if (!this.models.has(kind)) {
      const model = makeSpacePlace(kind, new THREE.Quaternion(), 1);
      model.userData = {};
      this.models.set(kind, model);
    }
    const obj = this.models.get(kind).clone(true);
    obj.traverse((part) => { if (part.userData.decorative) part.raycast = () => {}; });
    obj.scale.setScalar(r);
    obj.userData = { dynamic: true, tapHeight: 0, place: kind };
    this.scene.add(obj);
    return obj;
  }

  /**
   * The road from the Sun with one place empty: small places in order along the top of the eyepiece, and a
   * "?" where the answer goes. Tap a place to hear its name. Returns { walk (the places from the Sun to the "?"),
   * light(place), fill(choice), clear() }.
   */
  drawRoad(target) {
    const kinds = roadOf(this.L), things = [];
    const at = (i) => new THREE.Vector3(-ROAD.half + i * 2 * ROAD.half / (kinds.length - 1), ROAD.y, 0);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROAD.half + 0.9, 1.0), new THREE.MeshBasicMaterial({ color: '#5b3d99', transparent: true, opacity: 0.55, depthWrite: false }));
    track.position.set(0, ROAD.y, -0.4);
    track.userData.decorative = true;
    this.scene.add(track);
    let gap = null;
    kinds.forEach((kind, i) => {
      if (kind === target) {
        const map = glyphTexture('?', { bg: '#f59e0b' });
        gap = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map, transparent: true }));
        gap.position.copy(at(i));
        gap.userData = { tapHeight: 0, road: 'gap' };
        this.scene.add(gap);
        this.tappable(gap, () => this.replay());
        things.push(gap);
        return;
      }
      const obj = this.place(kind, kind === 'sun' ? ROAD.sun : ROAD.size);
      obj.position.copy(at(i));
      obj.userData = { dynamic: true, tapHeight: 0, road: kind };
      this.tappable(obj, () => { hop(obj, 0.3, 400); this.say(SPACE_FACTS[kind].slice(0, 1)); });
      things.push(obj);
    });
    const off = this.onUpdate((dt, t) => gap.scale.setScalar(1 + Math.sin(t * 3) * 0.07));
    const light = (obj) => {
      const base = obj.scale.x;
      obj.scale.setScalar(base * 1.4);
      return () => obj.scale.setScalar(base);
    };
    return {
      walk: things.slice(0, kinds.indexOf(target) + 1),
      light,
      /** The chosen place flies into the gap and settles at the road's size. */
      fill: (obj) => {
        const from = obj.position.clone(), to = gap.position.clone(), size = obj.scale.x;
        gap.visible = false;
        obj.userData.hopping = animate(600, (t) => {
          obj.position.lerpVectors(from, to, t);
          obj.scale.setScalar(size + (ROAD.size - size) * t);
        }, ease.inOut).then(() => { obj.userData.hopping = null; }); // (the choices' floating leaves it alone while it flies)
        return obj.userData.hopping;
      },
      clear: () => {
        off();
        for (const thing of things) { this.untap(thing); thing.removeFromParent(); }
        track.removeFromParent();
        track.geometry.dispose();
        track.material.dispose();
      },
    };
  }

  doneLine() { return T.telescopeDone(); }

  round(r) {
    return new Promise((resolve) => {
      const ask = this.L.ask;
      const skill = ask === 'order' ? 'sequence' : 'space';
      const q = questionFor(this.L, this.pick(skill, itemsFor(this.L)));
      this.last = q.target;
      let solved = false, lastWrong = null;
      const prompt = ask === 'match' ? T.telescopeMatch() : ask === 'feature' ? T.telescopeFeature(q.target)
        : ask === 'order' ? T.telescopeOrder(q.after) : T.telescopeName(q.target);
      const shown = ask === 'match' ? this.place(q.target, 1.6) : null;
      if (shown) shown.position.set(0, q.options.length > 2 ? 4.4 : 3.4, 0);
      const road = ask === 'order' ? this.drawRoad(q.target) : null;
      this.choices = q.options.map((kind, i) => {
        const obj = this.place(kind, radius(kind, ask));
        const [x, row] = POSITIONS[q.options.length][i];
        const y = row - (ask === 'match' && q.options.length > 2 ? 1.1 : 0) - (road ? ROAD.below : 0);
        obj.position.set(x, y, 0);
        Object.assign(obj.userData, { y, phase: i * 2 });
        this.tappable(obj, async () => {
          if (solved || !this.alive) return;
          this.poke();
          if (kind !== q.target) {
            lastWrong = obj;
            this.wrong(kind, { obj });
            return;
          }
          solved = true;
          this.correct(kind);
          this.stopIdle();
          this.choices.forEach((choice) => this.untap(choice));
          sfx.good();
          this.success(obj.position.clone(), { big: true });
          await Promise.all([road ? road.fill(obj) : hop(obj, 0.5, 600), this.say(T.telescopeRight(kind))]);
          if (!this.alive) return;
          this.choices.forEach((choice) => choice.removeFromParent());
          this.choices = [];
          shown?.removeFromParent();
          road?.clear();
          resolve();
        });
        return obj;
      });
      const right = this.choices.find((obj) => obj.userData.place === q.target);
      ui.bubble({ onTap: () => this.replay() });
      this.question(q.skill, q.item, {
        short: prompt,
        hint: (said = []) => {
          if (shown) hop(shown, 0.2, 600);
          if (!road) return prompt;
          this.say([...said, ...prompt]);
          return this.pointAlong(road.walk, road.light, 450); // her eye walks the road from the Sun to the empty place
        },
        simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : this.choices.find((obj) => obj !== right && obj.parent)),
        reveal: () => this.hint(right, () => solved),
      }, { options: q.options.length });
      this.ask(r === 0 ? [...T.telescopeStart(), ...prompt] : prompt);
    });
  }

  exit() {
    super.exit();
    const materials = new Set(), textures = new Set(), geometries = new Set();
    for (const model of this.models.values()) model.traverse((obj) => {
      if (obj.geometry) geometries.add(obj.geometry);
      for (const material of [obj.material].flat().filter(Boolean)) {
        materials.add(material);
        if (material.map?.userData.space && !obj.userData.decorative) textures.add(material.map);
      }
    });
    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
  }
}
