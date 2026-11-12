import * as THREE from 'three';
import { animate, ease, wait, hop } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { makeBoat } from '../world/props.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { labelTexture, texture } from '../textures.js';
import { showLetter } from '../config.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { countVerdict } from '../levels/moon.js';
import { BOATS, boatFor, countOf, namesIn, whichBoats } from '../levels/port.js';
import { shuffle } from '../util.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const TOOT_BACK = 300; // ms between the boat's toots back
const BLOCK_W = 0.98, BLOCK_STEP = 1.1;
const BOARD_W = 3 * BLOCK_STEP + 0.3; // every board fits three pieces, so its width never tells how many a name has
const BOAT_COLORS = ['#ef4444', '#2563eb', '#0ea5e9', '#f59e0b', '#14b8a6'];
const colorFor = (word) => BOAT_COLORS[[...word].reduce((n, c) => n + c.charCodeAt(0), 0) % BOAT_COLORS.length];

function syllableTexture(syllable) {
  const shown = [...syllable].map(showLetter).join('');
  return texture(256, (c, size) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, size, size);
    c.strokeStyle = '#c7d2fe';
    c.lineWidth = 10;
    c.strokeRect(5, 5, size - 10, size - 10);
    c.fillStyle = '#1e3a8a';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 ${Math.round(size * Math.min(0.56, 1.7 / Math.max(1, syllable.length)))}px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif`;
    c.fillText(shown, size / 2, size * 0.55);
  });
}

/** A gull for MEWA's board: there is no gull among the emoji. */
function drawGull(c, cx, cy, r) {
  c.fillStyle = '#f8fafc';
  c.strokeStyle = '#64748b';
  c.lineWidth = r * 0.06;
  c.beginPath(); c.ellipse(cx, cy + r * 0.15, r * 0.62, r * 0.36, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(cx + r * 0.5, cy - r * 0.22, r * 0.26, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#94a3b8';
  c.beginPath(); c.moveTo(cx - r * 0.5, cy + r * 0.05); c.quadraticCurveTo(cx - r * 0.1, cy - r * 0.75, cx + r * 0.25, cy + r * 0.02); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f59e0b';
  c.beginPath(); c.moveTo(cx + r * 0.72, cy - r * 0.26); c.lineTo(cx + r * 1.02, cy - r * 0.16); c.lineTo(cx + r * 0.72, cy - r * 0.1); c.closePath(); c.fill();
  c.fillStyle = '#1f2937';
  c.beginPath(); c.arc(cx + r * 0.56, cy - r * 0.28, r * 0.06, 0, Math.PI * 2); c.fill();
}

/** What each boat's board shows: its animal, so she knows its name without reading it. */
export const BOAT_PICTURES = { KOT: '🐱', SŁOŃ: '🐘', MEWA: drawGull, FOKA: '🦭', RYBKA: '🐟', KACZKA: '🦆', ŻYRAFA: '🦒', MOTYLEK: '🦋', BIEDRONKA: '🐞' };

/** The board's face: the animal on white, on a canvas as wide as the board, so the picture stays sharp. */
function pictureTexture(word, aspect) {
  const picture = BOAT_PICTURES[word];
  const h = 300, w = Math.round(h * aspect);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#c7d2fe';
  c.lineWidth = 8;
  c.strokeRect(4, 4, w - 8, h - 8);
  if (typeof picture === 'function') picture(c, w / 2, h * 0.52, h * 0.42);
  else {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `${Math.round(h * 0.8)}px "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    c.fillText(picture, w / 2, h * 0.56);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PortMission extends Mission {
  constructor(game) {
    super(game, 'port');
    this.view = { pos: new THREE.Vector3(0, 8.4, 16.5), look: new THREE.Vector3(0, 1.4, -0.2), minWidth: 18 };
    this.post = { tilt: 0.12, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'waiting';
    this.mode = null;
    this.word = null;
    this.asked = null;
    this.count = 0;
    this.target = null;
    this.boats = [];
    this.tickButtons = [];
    this.naming = 0; // which run of the boats' names is going on (a tap of hers stops it)
    this.moored = [];
    this.used = [];
    this.puffs = new Set();
    this.maps = [];
    this.mats = [];
    this.roundMaps = [];
    this.roundMats = [];
  }

  build() {
    this.skyMap = texture(512, (c, size) => {
      const g = c.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#7dd3fc');
      g.addColorStop(0.55, '#bae6fd');
      g.addColorStop(1, '#fef3c7');
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [x, y, rx, ry] of [[95, 105, 58, 19], [340, 140, 76, 23], [215, 70, 42, 15]]) {
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.scene.background = this.skyMap;
    this.maps.push(this.skyMap);

    this.scene.add(new THREE.HemisphereLight('#f7ffff', '#77cbb8', 2.4));
    const sunLight = new THREE.DirectionalLight('#fff4cf', 2.1);
    sunLight.position.set(-8, 16, 12);
    this.scene.add(sunLight);

    this.seaMap = texture(1024, (c, size) => {
      c.fillStyle = '#48c9b0';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i++) {
        const y = (i * 131 + 47) % size;
        const x = (i * 293 + 71) % size;
        c.strokeStyle = i % 2 ? 'rgba(255,255,255,0.24)' : 'rgba(22,116,118,0.14)';
        c.lineWidth = 2 + i % 3;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 38, y - 7, x + 78 + i % 4 * 12, y);
        c.stroke();
      }
    });
    this.maps.push(this.seaMap);
    const seaMat = new THREE.MeshStandardMaterial({ map: this.seaMap, roughness: 0.45 });
    this.mats.push(seaMat);
    this.scene.add(mesh(new THREE.CircleGeometry(64, 64), seaMat, { rx: -Math.PI / 2, shadow: false }));

    const woodMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.85 });
    const darkWood = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.7 });
    this.mats.push(woodMat, darkWood, wallMat, roofMat);
    this.dotOn = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
    this.mats.push(this.dotOn);

    // Kept low and near, so it never cuts the ticks in front of the boats.
    this.quay = new THREE.Group();
    this.quay.add(mesh(rbox(18, 0.34, 2.6, 0.08), woodMat, { y: 0.35, z: 5.6, shadow: false }));
    for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) this.quay.add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.9, 8), darkWood, { x, y: 0.02, z: 6.7, shadow: false }));
    this.scene.add(this.quay);

    this.harbour = new THREE.Group();
    this.harbour.add(mesh(rbox(3.0, 4.0, 1.6, 0.1), wallMat, { y: 2.0, shadow: false }));
    this.harbour.add(mesh(new THREE.ConeGeometry(2.4, 1.2, 4), roofMat, { y: 4.6, ry: Math.PI / 4, shadow: false }));
    this.harbour.add(mesh(rbox(0.8, 1.5, 0.08, 0.04), darkWood, { y: 0.75, z: 0.81, shadow: false }));
    this.harbour.position.set(6.2, 0, -5.6);
    this.scene.add(this.harbour);

    this.portrait = portrait();
    const portraitMat = new THREE.MeshBasicMaterial({ map: this.portrait.texture });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#f4cf87', roughness: 0.4 });
    this.mats.push(portraitMat, rimMat);
    this.window = new THREE.Group();
    this.window.add(mesh(new THREE.CircleGeometry(0.98, 48), portraitMat, { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.03, 0.09, 10, 48), rimMat, { shadow: false }));
    this.window.position.set(6.2, 3.0, -4.75);
    this.window.lookAt(this.view.pos);
    this.scene.add(this.window);

    this.horn = new THREE.Group();
    this.horn.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 32), mat('#7c3aed', { roughness: 0.5 }), { rx: Math.PI / 2, shadow: false }));
    this.horn.add(mesh(new THREE.TorusGeometry(1.26, 0.1, 10, 32), mat('#fbbf24', { metalness: 0.2, roughness: 0.4 }), { z: 0.16, shadow: false }));
    const hornMat = new THREE.MeshBasicMaterial({ map: labelTexture('📯', { fg: '#ffffff', stroke: 'rgba(0,0,0,0.2)' }), transparent: true, depthWrite: false });
    this.mats.push(hornMat);
    this.horn.add(mesh(new THREE.PlaneGeometry(1.8, 1.8), hornMat, { z: 0.22, shadow: false }));
    this.horn.add(mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 10), mat('#8b5a2b'), { y: -0.9, z: -0.1, shadow: false }));
    this.horn.position.set(5.1, 1.55, 3.1);
    this.horn.userData.choice = 'horn';
    this.horn.userData.tapHeight = 1.2;
    this.scene.add(this.horn);

    this.moored = shuffle(BOATS).slice(0, 5).map((b, i) => this.makeBoatFor(b.word, { x: -9.4 + i * 2.8, z: -7, scale: 0.5 })); // (far back, above the boats that come forward)
    this.onUpdate((dt, t) => {
      this.moored.forEach((b, i) => {
        b.position.y = b.userData.baseY + Math.sin(t * 2 + i) * 0.05;
        b.rotation.z = Math.sin(t * 1.5 + i) * 0.035;
      });
      this.boats.forEach((b) => {
        if (b.userData.sailing || b.userData.hopping) return;
        b.position.y = b.userData.baseY + Math.sin(t * 2.2 + b.userData.seed) * 0.07;
        b.rotation.z = Math.sin(t * 1.7 + b.userData.seed) * 0.04;
      });
    });
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  makeBoard(word, round = false) {
    const { syllables } = boatFor(word);
    const width = BOARD_W;
    const board = new THREE.Group();
    const bgMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    (round ? this.roundMats : this.mats).push(bgMat);
    board.add(mesh(rbox(width, 1.2, 0.12, 0.08), bgMat, { shadow: false }));
    const map = pictureTexture(word, (width - 0.12) / 1.02);
    const wholeMat = new THREE.MeshBasicMaterial({ map }); // (unlit: the animal keeps its colours in the sun)
    (round ? this.roundMaps : this.maps).push(map);
    (round ? this.roundMats : this.mats).push(wholeMat);
    const whole = mesh(rbox(width - 0.12, 1.02, 0.08, 0.06), wholeMat, { z: 0.09, shadow: false });
    board.add(whole);
    const start = -((syllables.length - 1) / 2) * BLOCK_STEP;
    const blocks = syllables.map((syllable, i) => {
      const blockMap = syllableTexture(syllable);
      const blockMat = new THREE.MeshStandardMaterial({ map: blockMap, roughness: 0.45, emissive: '#f59e0b', emissiveIntensity: 0 });
      (round ? this.roundMaps : this.maps).push(blockMap);
      (round ? this.roundMats : this.mats).push(blockMat);
      const block = mesh(rbox(BLOCK_W, 0.92, 0.08, 0.06), blockMat, { x: start + i * BLOCK_STEP, z: 0.09, shadow: false });
      block.visible = false;
      board.add(block);
      return block;
    });
    board.userData.blocks = blocks;
    board.userData.whole = whole;
    board.userData.split = false;
    return board;
  }

  makeDots() {
    const dots = new THREE.Group();
    dots.visible = false;
    return dots;
  }

  /** The tally starts empty: one lit dot per toot, centred as the row grows, six at most. */
  addDot(board) {
    const dots = board?.userData.dots;
    if (!dots || dots.children.length >= 6) return;
    dots.add(mesh(new THREE.CircleGeometry(0.13, 16), this.dotOn, { z: 0.02, shadow: false }));
    const n = dots.children.length;
    dots.children.forEach((dot, i) => { dot.position.x = (i - (n - 1) / 2) * 0.42; });
  }

  resetDots(board) {
    const dots = board?.userData.dots;
    if (!dots) return;
    for (const dot of [...dots.children]) {
      dot.removeFromParent();
      dot.geometry.dispose();
    }
  }

  splitBoard(board) {
    if (!board) return;
    board.userData.split = true;
    board.userData.whole.visible = false;
    for (const block of board.userData.blocks) block.visible = true;
  }

  mergeBoard(board) {
    if (!board) return;
    board.userData.split = false;
    board.userData.whole.visible = true;
    for (const block of board.userData.blocks) block.visible = false;
  }

  makeBoatFor(word, { x, z, scale, round = false }) {
    const boat = makeBoat(colorFor(word));
    boat.scale.setScalar(scale);
    boat.position.set(x, 0.04, z);
    boat.userData.seed = Math.random() * 6;
    boat.userData.baseY = 0.04;
    boat.userData.boatName = word;
    boat.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    const sail = boat.children.find((o) => o.isMesh && o.geometry?.type === 'ShapeGeometry');
    if (sail) sail.visible = false;
    const board = this.makeBoard(word, round);
    board.position.set(0, 1.95, 0.55);
    boat.add(board);
    const dots = this.makeDots();
    dots.position.set(0, 1.13, 0.64);
    boat.add(dots);
    board.userData.dots = dots;
    boat.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8), mat('#8b5a2b'), { y: 1.35, z: 0.35, shadow: false }));
    boat.userData.board = board;
    this.scene.add(boat);
    return boat;
  }

  makeTick(num) {
    const tick = new THREE.Group();
    const discMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.5, emissive: '#16a34a', emissiveIntensity: 0.2 });
    const checkMat = new THREE.MeshBasicMaterial({ map: labelTexture('✓', { fg: '#ffffff', stroke: 'rgba(255,255,255,0)' }), transparent: true, depthWrite: false });
    this.roundMats.push(discMat, checkMat);
    tick.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 28), discMat, { rx: Math.PI / 2, shadow: false }));
    tick.add(mesh(new THREE.PlaneGeometry(0.9, 0.9), checkMat, { z: 0.12, shadow: false }));
    tick.userData.num = num;
    tick.userData.tapHeight = 0;
    return tick;
  }

  async round(r) {
    if (r === 0) {
      await this.say(T.portStart());
      if (!this.alive) return;
    }
    this.mode = this.L.mode;
    if (this.mode === 'which') await this.whichRound();
    else await this.hornRound();
    if (!this.alive) return;
    this.clearRound();
  }

  async hornRound() {
    const pool = namesIn(this.L.syllables);
    let fresh = pool.filter((w) => !this.used.includes(w));
    if (!fresh.length) { this.used = []; fresh = pool; }
    this.word = this.pick('syllables', fresh);
    this.used.push(this.word);
    this.target = countOf(this.word);
    this.last = this.target;
    this.count = 0;
    this.phase = 'arriving';
    const boat = this.makeBoatFor(this.word, { x: 8.5, z: 1.2, scale: 1.05, round: true });
    this.boats = [boat];
    await this.enterBoat(boat, -1);
    if (!this.alive) return;
    if (this.mode !== 'together') boat.userData.board.userData.dots.visible = true;
    const prompt = [...T.portToot(), ...T.portDone()];
    this.beginHorn();
    // the name once before: Chase claps it ("Kacz! Ka!", she may toot along), or the voice says it whole
    if (this.mode === 'together') {
      const q = this.learn.current;
      const clapped = Promise.resolve(this.talk).then(async () => {
        if (!this.alive || this.learn.current !== q) return;
        await this.clapSyllables(this.word);
        this.boats[0]?.userData.board.userData.blocks.slice(0, this.count).forEach((b) => this.light(b)); // (her toots during the clap)
      });
      this.askAfter(clapped, prompt);
    } else this.askAfter(this.talk, [...T.portName(this.word), ...prompt]);
    await new Promise((resolve) => { this.resolveRound = resolve; });
  }

  beginHorn() {
    this.phase = 'asking';
    this.count = 0;
    this.last = this.target;
    this.horn.visible = true;
    this.horn.userData.choice = 'horn';
    this.boats[0].userData.choice = 'done';
    this.tappable(this.horn, () => this.toot());
    this.tappable(this.boats[0], () => this.checkBoat());
    this.question('syllables', this.word, {
      short: () => [...T.portName(this.word), ...T.portToot()],
      hint: () => { // the horn to toot, once a piece; the pieces themselves only when the answer is shown
        this.pulseUntil(this.horn, () => this.phase !== 'asking' || this.count > 0);
        return T.portHelp();
      },
      reveal: async (said = []) => { // Chase claps the name slowly ("Fo! Ka!"); she toots it herself
        this.phase = 'helping';
        this.resetHorn();
        if (said.length) await this.say(said);
        if (this.alive) await this.clapSyllables(this.word, { merge: this.mode !== 'together' });
        if (!this.alive) return;
        this.phase = 'asking';
        this.ask(T.portToot());
      },
    }, { options: 1 });
    ui.bubble({ big: '?', pic: '📯', onTap: () => this.replay(), passthrough: true });
  }

  toot() {
    if (this.phase !== 'asking') return;
    this.poke();
    this.count++;
    sfx.toot();
    this.puff();
    const board = this.boats[0]?.userData.board;
    if (this.mode === 'together') this.light(board?.userData.blocks[this.count - 1]);
    else this.addDot(board);
    this.last = this.count >= this.target ? 'done' : this.target;
  }

  async checkBoat() {
    if (this.phase !== 'asking') return;
    this.poke();
    const made = this.count, verdict = countVerdict(made, this.target);
    if (verdict === 'right') { await this.solveHorn(); return; }
    this.resetHorn();
    this.wrong(made, { obj: this.boats[0], said: verdict === 'few' ? T.portTooFew() : T.portTooMany() }); // "Za mało! Posłuchaj jeszcze raz." and the name again
  }

  /** She toots it again from the start: no toots, no lit pieces. */
  resetHorn() {
    this.count = 0;
    this.last = this.target;
    this.unlight(this.boats[0]);
    this.resetDots(this.boats[0].userData.board);
  }

  async solveHorn() {
    const boat = this.boats[0];
    this.phase = 'solved';
    this.correct(this.word);
    this.stopIdle();
    this.untap(this.horn);
    this.untap(boat);
    delete this.horn.userData.choice;
    delete boat.userData.choice;
    sfx.good();
    await this.tootBack(this.word, boat);
    if (!this.alive) return;
    this.success(boat.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    this.talk = this.say([...T.spellWord(this.word), ...T.portSuccess()]); // the name once after
    await this.sailOut(boat);
    this.resolveRound?.();
    this.resolveRound = null;
  }

  async whichRound() {
    this.horn.visible = false;
    const counts = Array.from({ length: this.L.syllables[1] - this.L.syllables[0] + 1 }, (_, i) => this.L.syllables[0] + i);
    this.asked = this.pick('syllables', counts);
    this.target = this.asked;
    this.last = this.asked;
    this.count = 0;
    this.phase = 'arriving';
    const xs = [-4.6, 0, 4.6];
    const picks = whichBoats(this.asked, this.L.syllables);
    this.boats = picks.map((b, i) => this.makeBoatFor(b.word, { x: 10.5 + i * 2, z: 1.15, scale: 1, round: true }));
    this.boats.forEach((boat) => { boat.userData.pieces = countOf(boat.userData.boatName); });
    await Promise.all(this.boats.map((boat, i) => this.enterBoat(boat, xs[i])));
    if (!this.alive) return;
    this.phase = 'choosing';
    for (const boat of this.boats) {
      const tick = this.makeTick(boat.userData.pieces);
      tick.position.set(0, 0.62, 0.72);
      boat.add(tick);
      this.tickButtons.push(tick);
      this.tappable(tick, () => this.pickBoat(boat));
      this.tappable(boat, () => { // (a tap on the tick answers: it is nearer the finger; the rest of the boat says its name)
        if (this.phase !== 'choosing') return;
        this.poke();
        this.naming++; // (her own question first: the names stop, and the asked one follows if it was not said yet)
        const q = this.learn.current;
        this.sayName(boat).then(() => { if (!this.prompt && this.learn.current === q) this.ask(T.portWhich(this.asked)); });
      });
    }
    this.question('syllables', this.asked, {
      short: () => T.portWhich(this.asked),
      hint: (said = []) => this.say(said).then(() => this.nameBoats()).then((all) => { if (all) this.ask(T.portWhich(this.asked)); }), // the names again: who is who, not how many pieces
      simplify: () => {
        const wrongs = this.boats.filter((b) => b.userData.pieces !== this.asked && !b.userData.gone);
        const boat = wrongs.includes(this.lastWrong) ? this.lastWrong : wrongs[0];
        if (!boat) return;
        boat.traverse((o) => this.untap(o));
        this.removeOption(boat);
      },
      reveal: () => {
        const right = this.boats.find((b) => b.userData.pieces === this.asked);
        if (right) this.hint(right.userData.board, () => this.phase !== 'choosing');
        return T.portWhich(this.asked);
      },
    }, { options: 3 });
    ui.bubble({ big: '?', pic: '📯', onTap: () => this.replay(), passthrough: true });
    Promise.resolve(this.talk).then(() => this.nameBoats()).then((all) => { if (all) this.ask(T.portWhich(this.asked)); }); // the three names, then the question
    await new Promise((resolve) => { this.resolveRound = resolve; });
  }

  /** Each boat says its name as it hops, left to right. Resolves true when all were said; any tap of hers stops it. */
  async nameBoats() {
    const run = ++this.naming, q = this.learn.current, still = () => this.alive && this.learn.current === q && this.naming === run;
    for (const boat of [...this.boats].sort((a, b) => a.position.x - b.position.x)) {
      if (!still()) return false;
      if (!boat.userData.gone) await this.sayName(boat);
    }
    return still();
  }

  sayName(boat) {
    hop(boat, 0.35);
    return this.say(T.spellWord(boat.userData.boatName));
  }

  async pickBoat(boat) {
    if (this.phase !== 'choosing' || !this.prompt) return; // (before the question is said there is nothing to answer yet)
    this.naming++;
    const num = boat.userData.pieces;
    this.poke();
    this.lookAt(boat);
    if (num !== this.last) {
      this.lastWrong = boat;
      this.wrong(num, { obj: boat, said: T.portHas(num) }); // "Ta łódka ma trzy kawałki." and the question again
      return;
    }
    this.phase = 'solved';
    this.correct(this.last);
    this.stopIdle();
    for (const tick of this.tickButtons) this.untap(tick);
    for (const other of this.boats) this.untap(other);
    sfx.good();
    this.success(boat.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    this.talk = this.say([...T.portRight(num), ...T.spellWord(boat.userData.boatName)]);
    await this.tootBack(boat.userData.boatName, boat);
    if (!this.alive) return;
    await this.sailOut(boat);
    this.resolveRound?.();
    this.resolveRound = null;
  }

  async clapSyllables(word, { merge = false } = {}) {
    const boat = this.boats.find((b) => b.userData.boatName === word);
    const board = boat?.userData.board;
    this.splitBoard(board);
    const blocks = board?.userData.blocks || [];
    for (const [i, syllable] of boatFor(word).syllables.entries()) {
      if (!this.alive) return;
      this.light(blocks[i]);
      sfx.toot();
      await this.say(T.syllable(syllable));
      if (!this.alive) return;
    }
    this.unlight(boat);
    if (merge) this.mergeBoard(board);
    await wait(220);
  }

  /** The boat toots back once per syllable, its blocks lighting one by one. */
  async tootBack(word, boat) {
    this.splitBoard(boat.userData.board);
    const blocks = boat.userData.board.userData.blocks;
    for (const i of boatFor(word).syllables.keys()) {
      if (!this.alive) return;
      this.light(blocks[i]);
      sfx.toot();
      await wait(TOOT_BACK);
    }
  }

  light(block) {
    if (!block) return;
    block.material.emissiveIntensity = 0.9;
    block.material.color.set('#fff3b0');
  }

  unlight(boat) {
    const board = boat?.userData.board;
    const blocks = board?.userData.blocks || [];
    blocks.forEach((block) => {
      block.material.emissiveIntensity = 0;
      block.material.color.set('#ffffff');
    });
  }

  puff() {
    const ring = mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20),
      new THREE.MeshBasicMaterial({ color: '#fef9c3', transparent: true, opacity: 0.9, depthWrite: false }),
      { z: 0.4, shadow: false });
    this.horn.add(ring);
    this.puffs.add(ring);
    animate(620, (t) => {
      ring.scale.setScalar(1 + t * 2.2);
      ring.position.z = 0.4 + t * 0.7;
      ring.material.opacity = 0.9 * (1 - t);
    }, ease.out).then(() => this.disposePuff(ring));
  }

  disposePuff(ring) {
    if (!this.puffs.delete(ring)) return;
    ring.removeFromParent();
    ring.geometry.dispose();
    ring.material.dispose();
  }

  async enterBoat(boat, toX) {
    boat.userData.sailing = true;
    const fromX = boat.position.x;
    await animate(800, (t) => {
      boat.position.x = fromX + (toX - fromX) * t;
      boat.position.y = 0.04 + Math.sin(t * Math.PI) * 0.22;
      boat.rotation.z = Math.sin(t * Math.PI) * 0.06;
    }, ease.out);
    boat.position.set(toX, 0.04, boat.position.z);
    boat.rotation.z = 0;
    boat.userData.sailing = false;
  }

  async sailOut(boat) {
    boat.userData.sailing = true;
    const x0 = boat.position.x, z0 = boat.position.z;
    await animate(1400, (t) => {
      boat.position.x = x0 + t * t * 10;
      boat.position.z = z0 - t * 3;
      boat.position.y = 0.04 + Math.sin(t * Math.PI) * 0.35;
      boat.rotation.z = Math.sin(t * Math.PI * 2) * 0.06;
    }, ease.linear);
  }

  clearRound() {
    if (this.horn) this.untap(this.horn);
    for (const tick of this.tickButtons) this.untap(tick);
    for (const boat of this.boats) this.untap(boat);
    for (const boat of this.boats) {
      boat.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      boat.removeFromParent();
    }
    for (const puff of [...this.puffs]) this.disposePuff(puff);
    this.boats = [];
    this.tickButtons = [];
    this.roundMaps.forEach((map) => map.dispose());
    this.roundMaps = [];
    this.roundMats.forEach((m) => m.dispose());
    this.roundMats = [];
    this.count = 0;
    this.last = null;
    this.target = null;
    this.asked = null;
    this.word = null;
    this.phase = 'waiting';
  }

  doneLine() { return T.portFinished(); }

  success(at, options) {
    super.success(null, options);
    if (at) sparkle(this, at, { count: 8 });
  }

  exit() {
    super.exit();
    this.clearRound();
    this.maps.forEach((map) => map.dispose());
    this.maps = [];
    this.mats.forEach((m) => m.dispose());
    this.mats = [];
    for (const root of [this.horn, this.harbour, this.quay, ...this.moored]) {
      root?.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.portrait?.dispose();
  }
}
