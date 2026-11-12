import * as THREE from 'three';
import { animate, ease, wait } from '../engine.js';
import { makePup } from '../characters.js';
import { makeRocket } from '../world/rocket.js';
import { star } from '../models.js';
import { glyphTexture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { starRounds, numerals, PICTURES } from '../levels/stars.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const STAR = 0.55;
const SCALE = 1.25;
const LABEL = 0.95;                // a numeral tile, big enough to read and to tap
const LABEL_BELOW = [0, -1.05];    // where it hangs from its star unless the picture says otherwise
const CENTER = new THREE.Vector3(1, 4.3, 0); // (right of the view's middle: the speech bubble, now wider, stays off the picture's top star)
const GOLD = '#c2871d';
const LIT = '#fde047';
const GLOW = '#f59e0b';
const UP = new THREE.Vector3(0, 1, 0);

function dotTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// "Star Pictures": big gold stars sit on the corners of a hidden picture, each numbered. Tap them
// 1, 2, 3… and a gold line draws the outline; the finished picture lights up and Chase names it.
export class StarsMission extends Mission {
  constructor(game) {
    super(game, 'stars');
    this.view = { pos: new THREE.Vector3(0, 5.4, 13), look: new THREE.Vector3(0.5, 4.2, 0), minWidth: 12 };
    this.post = { tilt: 0, ao: false };
    this.drift = 0.03;
    this.bubbleAt = 'left';
    this.phase = 'idle';
    this.stars = [];
    this.lines = [];
    this.litNumbers = [];
    this.maps = [];
  }

  build() {
    this.scene.background = new THREE.Color('#a681dc');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9c8f5', 2.4));
    const sun = new THREE.DirectionalLight('#fff6eb', 2);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);

    const positions = [];
    for (let i = 0; i < 120; i++) {
      positions.push((i * 137 % 100) / 100 * 34 - 17, (i * 211 % 100) / 100 * 17 + 1, -8 - (i % 5));
    }
    const dots = new THREE.BufferGeometry();
    dots.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const dotMap = dotTexture();
    this.maps.push(dotMap);
    this.scene.add(new THREE.Points(dots, new THREE.PointsMaterial({ map: dotMap, color: '#ffffff', size: 0.14, transparent: true, opacity: 0.9, depthWrite: false })));

    this.rocket = makeRocket();
    this.rocket.position.set(-5.2, 2.4, -2.8);
    this.rocket.rotation.y = 0.45;
    this.rocket.userData.flame.visible = false;
    this.scene.add(this.rocket);

    this.pup = makePup();
    this.pup.position.set(-4.3, 0.7, 0.3);
    this.pup.userData.tapHeight = 1.5;
    const helmet = new THREE.Group();
    helmet.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 20), new THREE.MeshStandardMaterial({ color: '#d5f6ff', transparent: true, opacity: 0.16, roughness: 0.12, depthWrite: false })));
    helmet.add(new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.055, 8, 32), new THREE.MeshStandardMaterial({ color: '#f3f7ff' })));
    helmet.children[1].position.y = -0.585;
    helmet.children[1].rotation.x = Math.PI / 2;
    this.pup.userData.parts.head.add(helmet);
    this.scene.add(this.pup);
    this.onUpdate((dt, t) => { this.pup.position.y = 0.7 + Math.sin(t * 1.2) * 0.08; });

    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makePicture(count) {
    const picture = (this.picture = PICTURES[count]);
    const group = (this.pictureGroup = new THREE.Group());
    group.position.copy(CENTER);
    this.scene.add(group);
    this.stars = [];
    this.lines = [];
    this.numbers = numerals(this.L.order, count);
    this.litNumbers = [this.numbers[0]];
    this.fill = null;

    const labels = this.L.labels === 'both';
    picture.points.forEach(([x, y], i) => {
      const n = this.numbers[i];
      const s = star(GOLD, STAR, 0.1);
      s.material = s.material.clone();
      s.material.color.set(GOLD);
      s.material.emissive = new THREE.Color('#78350f');
      s.material.emissiveIntensity = 0.12;
      s.position.set(x * SCALE, y * SCALE, 0);
      s.userData.num = n;
      s.userData.step = i;
      s.userData.tapHeight = 0;
      s.castShadow = s.receiveShadow = false;
      group.add(s);
      this.stars.push(s);

      const labelMap = glyphTexture(String(n), { bg: '#6d4bb5', fg: '#ffffff', dots: labels ? n : 0 });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(LABEL, LABEL), new THREE.MeshBasicMaterial({ map: labelMap, transparent: true }));
      const [dx, dy] = picture.label?.[i] ?? LABEL_BELOW;
      label.position.set(x * SCALE + dx, y * SCALE + dy, 0.1); // (in front of the gold lines)
      label.castShadow = label.receiveShadow = false;
      label.userData.tapHeight = 0;
      group.add(label);
      s.userData.label = label;

      this.tappable(s, () => this.tapStar(s));
      this.tappable(label, () => this.tapStar(s));
    });

    const fillPoints = picture.fill || picture.points;
    const shape = new THREE.Shape();
    fillPoints.forEach(([x, y], i) => {
      const px = x * SCALE, py = y * SCALE;
      i ? shape.lineTo(px, py) : shape.moveTo(px, py);
    });
    const fill = (this.fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
      color: picture.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    })));
    fill.position.z = -0.08;
    fill.castShadow = fill.receiveShadow = false;
    group.add(fill);

    this.lightStar(this.stars[0]);
  }

  lightStar(s) {
    this.untap(s);
    this.untap(s.userData.label);
    s.userData.lit = true;
    s.material.color.set(LIT);
    s.material.emissive = new THREE.Color(GLOW);
    s.material.emissiveIntensity = 0.6;
  }

  twinkle(s) {
    animate(600, (t) => {
      s.scale.setScalar(1 + Math.sin(t * Math.PI * 4) * 0.13 * (1 - t));
    }, ease.linear);
  }

  async drawLine(a, b) {
    const from = a.position.clone(), to = b.position.clone();
    const dir = to.clone().sub(from), length = dir.length();
    if (!length) return;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), new THREE.MeshBasicMaterial({ color: LIT }));
    line.castShadow = line.receiveShadow = false;
    line.position.copy(from);
    line.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    line.scale.y = 0.001;
    this.pictureGroup.add(line);
    this.lines.push(line);
    const step = dir.clone().normalize();
    await animate(420, (t) => {
      line.scale.y = Math.max(0.001, length * t);
      line.position.copy(from).addScaledVector(step, length * t / 2);
    }, ease.out);
    line.scale.y = length;
    line.position.copy(from).addScaledVector(step, length / 2);
  }

  tapStar(s) {
    const n = s.userData.num;
    if (this.phase !== 'choosing' || s.userData.lit) return;
    const asked = this.last;
    this.poke();
    if (n !== asked) {
      this.wrong(n, { obj: s });
      this.twinkle(s);
      return;
    }
    this.correct(n);
    this.stopIdle();
    this.litNumbers.push(n);
    this.lightStar(s);
    this.drawLine(this.stars[s.userData.step - 1], s);
    this.stepDone?.({ talk: this.say(T.number(n)) }); // the next star can be tapped while its line draws and its number is said
  }

  /** The numbers so far and a question mark: the last three, so the bubble stays narrow and off the picture. */
  showSoFar(soFar) {
    ui.bubble({ seq: [soFar.slice(-3).join(' ')], onTap: () => this.replay(), passthrough: true });
  }

  /** Ask for the star joined at step i (its numeral is this.numbers[i]); talk: the number before it, still being said. Resolves with { talk }: this star's number. */
  askStep(i, talk) {
    const right = this.stars[i], n = this.numbers[i], order = this.L.order;
    const soFar = this.numbers.slice(0, i);
    this.last = n;
    this.phase = 'choosing';
    const soFarAlong = (said = []) => {
      this.say([...said, ...T.starsAsk(soFar, order)]);
      return this.pointAlong(this.stars.slice(0, i), (s) => this.twinkle(s), 450);
    };
    this.question('sequence', n, {
      short: () => T.starsAsk(soFar, order),
      hint: soFarAlong,
      simplify: soFarAlong,
      reveal: () => { this.hint(right, () => this.last !== n || this.phase !== 'choosing'); return T.starsHelp(n); },
    }, { options: this.stars.filter((s) => !s.userData.lit).length });
    this.showSoFar(soFar);
    this.askAfter(talk, [...(i === 1 && order !== 'up' ? T.starsRule(order) : []), ...T.starsAsk(soFar, order)]);
    return new Promise((resolve) => { this.stepDone = resolve; });
  }

  async finishPicture(talk) {
    this.phase = 'celebrating';
    ui.hideBubble();
    this.stars.forEach((s) => { this.untap(s); this.untap(s.userData.label); });
    await talk;
    if (!this.alive) return;
    if (this.picture.closed) await this.drawLine(this.stars.at(-1), this.stars[0]);
    if (this.fill) await animate(650, (t) => { this.fill.material.opacity = t * 0.34; }, ease.out);
    this.stars.forEach((s) => this.lightStar(s));
    this.success(this.pictureGroup.getWorldPosition(new THREE.Vector3()));
    sfx.good();
    await this.say(T.starsPicture(this.picture.id));
    if (this.alive) await wait(700);
  }

  clearPicture() {
    this.stars.forEach((s) => { this.untap(s); this.untap(s.userData.label); });
    if (this.pictureGroup) {
      this.pictureGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [o.material].flat().forEach((m) => m.dispose());
      });
      this.pictureGroup.removeFromParent();
    }
    this.stars = [];
    this.lines = [];
    this.fill = null;
    this.pictureGroup = null;
    this.phase = 'idle';
  }

  async round(r) {
    this.plan ||= starRounds(this.L);
    if (r === 0) {
      await this.say(T.starsStart());
      if (!this.alive) return;
    }
    const count = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    this.makePicture(count);
    let talk = null;
    for (let i = 1; i < count; i++) {
      if (!this.alive) return;
      ({ talk } = await this.askStep(i, talk));
    }
    if (!this.alive) return;
    await this.finishPicture(talk);
    if (!this.alive) return;
    this.clearPicture();
  }

  doneLine() { return T.starsDone(); }

  exit() {
    super.exit();
    this.maps.forEach((map) => map.dispose());
  }
}
