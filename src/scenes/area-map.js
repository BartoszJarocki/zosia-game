import * as THREE from 'three';
import { Stage, animate, ease, camera, renderer } from '../engine.js';
import { star } from '../models.js';
import { say, hush } from '../audio.js';
import { PLACES, placesIn } from '../places.js';
import { getVisited, recordVisit } from '../progress.js';
import { getSession, checkAttention } from '../session/session.js';

export const MOVES = {
  launch: ['waiting'],
  waiting: ['flying', 'returning'],
  flying: ['visiting', 'returning'],
  visiting: ['waiting', 'returning'],
  returning: [],
};

export function nextState(state, next) {
  if (!MOVES[state]?.includes(next)) throw new Error(`Invalid space move: ${state} to ${next}`);
  return next;
}

export function flightStops(from, to) {
  const out = [];
  const direction = Math.sign(to - from);
  if (!direction) return out;
  for (let i = direction > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
    direction > 0 ? i <= to : i >= to; i += direction) out.push(i);
  return out;
}

const copyView = (view) => ({ pos: view.pos.clone(), look: view.look.clone(), minWidth: view.minWidth });

/** Fit a map's world points on screen, with the same margin at every iPad size. */
export function fitView(points, width, height, face, forward, fov = 42) {
  const pts = points.map((p) => p.clone().applyQuaternion(face.clone().invert()));
  const sy = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 0.88, sx = sy * width / height;
  const bounds = (axis, slope) => [Math.min(...pts.map((p) => p[axis] - slope * p.z)), Math.max(...pts.map((p) => p[axis] + slope * p.z))];
  const [left, right] = bounds('x', sx), [bottom, top] = bounds('y', sy);
  // These perspective bounds include depth, so the nearer bottom row gets the same screen margin.
  const distance = Math.max((right - left) / (2 * sx), (top - bottom) / (2 * sy));
  const look = new THREE.Vector3((left + right) / 2, (bottom + top) / 2, 0).applyQuaternion(face);
  return { look, pos: look.clone().addScaledVector(forward, distance), minWidth: 0 };
}

export class AreaMap extends Stage {
  get at() { return this.order[Math.round(this.routeIndex)]; }

  constructor(game, config, { launch = false, at = config.home } = {}) {
    super();
    this.game = game;
    this.config = config;
    this.kind = config.kind ?? `${config.area}-map`;
    this.area = config.area;
    this.home = config.home;
    this.order = config.order;
    this.layout = config.layout;
    this.lines = config.lines;
    this.to = config.to;
    this.pass = config.pass;
    this.facts = config.facts;
    this.invite = config.invite;
    this.decide = config.decide;
    this.suggest = config.suggest;
    this.state = launch ? 'launch' : 'waiting';
    this.visiting = null;
    this.revision = 0;
    this.view = launch ? copyView(this.padView()) : this.viewFor(globalThis.innerWidth || 1180, globalThis.innerHeight || 820, this.home, null);
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.routeIndex = this.order.indexOf(this.layout[at] ? at : this.home);
    this.returned = PLACES[at]?.game === true;
    this.bodies = {};
    this.idleAt = null;
    this.inviteAt = null;
    this.suggested = null;
    this.nudgeAt = null;
    this.nudges = 0;
  }

  changeState(next, visiting = null) {
    this.state = nextState(this.state, next);
    this.visiting = next === 'visiting' ? visiting : null;
    this.revision++;
    this.idleAt = null;
    this.nudgeAt = null;
    if (next === 'waiting' && this.logAt) this.logAt = performance.now() + 1500;
  }

  enter() {
    this.addBackdrop();
    const { face, right, up } = this.orient();
    this.face = face;
    this.right = right;
    this.up = up;
    this.map = new THREE.Group();
    this.map.userData.dynamic = true;
    this.scene.add(this.map);
    this.curve = new THREE.CatmullRomCurve3(this.order.map((k) => new THREE.Vector3(...this.layout[k].at)), false, 'catmullrom', 0.35);
    this.road = this.makeRoad(this.curve);
    this.map.add(this.road);
    for (const kind of this.order) this.addStop(kind);
    this.suggestion = star('#ffe066', 0.8, 0.16);
    this.suggestion.userData.dynamic = true;
    this.suggestion.material = new THREE.MeshBasicMaterial({ color: '#ffe895' });
    this.map.add(this.suggestion);
    this.suggestion.userData.tapHeight = 0;
    this.tappable(this.suggestion, () => this.tapStop(this.suggested));
    this.makeVehicle();
    this.onVehicleReady();
    this.activity = () => {
      if (this.state === 'visiting') this.idleAt = performance.now() + 20000;
      if (this.nudgeAt) this.nudgeAt = performance.now() + 25000;
    };
    window.addEventListener('pointerdown', this.activity, true);
    this.resize = () => {
      this.mapView = this.viewFor(innerWidth, innerHeight, this.at, this.suggested);
      if (['waiting', 'flying'].includes(this.state) && !this.cameraMove) this.view = copyView(this.mapView);
    };
    window.addEventListener('resize', this.resize);
    if (this.state === 'launch') {
      this.startLaunch();
    } else {
      this.parkVehicle();
      this.showHud();
      this.direct(this.returned ? this.lines.again : this.lines.map);
    }
    this.dullShadows();
    this.startLog();
    this.onUpdate((dt, t) => this.tick(dt, t));
  }

  addStop(kind) {
    const g = this.makeStop(kind);
    g.userData.dynamic = true;
    g.userData.tapHeight = 0;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.dynamic = true;
    g.add(hit);
    g.userData.hit = hit;
    this.bodies[kind] = g;
    this.map.add(g);
    this.tappable(g, () => this.tapStop(kind));
  }

  direct(greeting) {
    const session = getSession();
    const decision = this.decide(session, checkAttention());
    const games = placesIn(this.area).filter((kind) => PLACES[kind].game);
    this.suggested = decision === 'invite' ? this.home : decision === 'suggest'
      ? this.suggest(session, this.order, this.at, getVisited(), games) : null;
    this.suggestion.visible = !!this.suggested && PLACES[this.suggested].stop !== false;
    this.showHud();
    this.updateSuggestion(0);
    this.resize();
    if (decision === 'home') { this.returnHome(this.lines.goodnight); return; }
    this.nudgeLine = decision === 'invite' ? this.lines.inviteHome : this.invite[this.suggested];
    this.nudges = 0;
    this.nudgeAt = this.nudgeLine ? performance.now() + 25000 : null;
    say(greeting === this.lines.again ? [...greeting, ...(decision === 'invite' ? this.nudgeLine : [])] : this.nudgeLine || greeting);
  }

  updateSuggestion(t) {
    if (!this.suggested || PLACES[this.suggested].stop === false) return;
    this.suggestion.position.copy(this.suggestionPosition(this.suggested)).addScaledVector(this.up, Math.sin(t * 3) * 0.2);
    this.suggestion.quaternion.copy(this.face);
    this.suggestion.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
  }

  async tapStop(kind) {
    if (!this.alive || this.cameraMove) return;
    if (this.state === 'visiting') {
      if (kind === this.visiting) this.fact();
      return;
    }
    if (this.state !== 'waiting') return;
    if (kind === this.home) return this.returnHome();
    this.changeState('flying');
    const revision = this.revision;
    this.suggestion.visible = false;
    await this.flyTo(kind, this.to[kind]);
    if (!this.alive || revision !== this.revision) return;
    await this.visit(kind);
  }

  async flyTo(kind, line) {
    const revision = this.revision;
    const target = this.order.indexOf(kind);
    const stops = flightStops(this.routeIndex, target);
    this.startFlight();
    let talk = say(line);
    for (const index of stops) {
      if (!this.alive || revision !== this.revision) return;
      const from = this.routeIndex;
      const far = this.layout[this.order[index]].far && !this.layout[this.order[Math.floor(from)]].far;
      if (far) {
        await talk;
        if (!this.alive || revision !== this.revision) return;
        talk = say(this.lines.far);
      }
      const a = this.curve.getPoint(from / (this.order.length - 1));
      const b = this.curve.getPoint(index / (this.order.length - 1));
      const dir = b.clone().sub(a);
      const angle = Math.atan2(-dir.dot(this.right), dir.dot(this.up));
      await Promise.all([talk, animate(Math.max(1100, a.distanceTo(b) * (far ? 190 : 105)), (t) => {
        if (revision !== this.revision) return;
        this.positionVehicle(from + (index - from) * t);
        this.rotateVehicle(angle);
      }, ease.inOut)]);
      if (!this.alive || revision !== this.revision) return;
      talk = index !== target && this.pass[this.order[index]] ? say(this.pass[this.order[index]]) : Promise.resolve();
    }
    await talk;
    if (this.alive && revision === this.revision) this.parkVehicle();
  }

  async moveView(to, ms = 1100) {
    const revision = this.revision, from = copyView(this.view);
    const moving = animate(ms, (t) => {
      if (revision !== this.revision) return;
      this.view.pos.lerpVectors(from.pos, to.pos, t);
      this.view.look.lerpVectors(from.look, to.look, t);
      this.view.minWidth = from.minWidth + (to.minWidth - from.minWidth) * t;
    });
    this.cameraMove = moving;
    await moving;
    if (this.cameraMove === moving) this.cameraMove = null;
  }

  async visit(kind) {
    this.changeState('visiting', kind);
    recordVisit(kind);
    const session = getSession();
    session.lastActiveAt = Date.now();
    const visited = (session.visited ||= {});
    visited[kind] = (visited[kind] || 0) + 1;
    if (PLACES[kind].game) return this.game.startMission(kind);
    const revision = this.revision;
    this.hideOtherStops(kind);
    await this.moveView(this.visitView(kind));
    if (!this.alive || revision !== this.revision) return;
    const lines = this.facts[kind];
    this.factIndex = lines.length > 2 ? 2 : lines.length > 1 ? 1 : 0;
    this.showHud();
    this.activity();
    say(this.facts[kind].slice(0, 2));
  }

  fact() {
    const lines = this.facts[this.visiting];
    const line = lines[this.factIndex] ?? lines[0];
    this.factIndex = lines.length > 1 && this.factIndex + 1 < lines.length ? this.factIndex + 1 : lines.length > 1 ? 1 : 0;
    this.activity();
    this.react();
    say(this.factLine(this.visiting, line));
  }

  showMap() {
    this.road.visible = true;
    Object.values(this.bodies).forEach((g) => { g.visible = true; });
    this.vehicle.visible = true;
    this.resetVehicleLook();
    this.parkVehicle();
    this.resize();
  }

  async backToMap() {
    if (!this.alive || this.state !== 'visiting' || this.cameraMove) return;
    const revision = this.revision;
    this.idleAt = null;
    this.showMap();
    await this.moveView(this.mapView);
    if (!this.alive || revision !== this.revision) return;
    this.changeState('waiting');
    this.showHud();
    this.direct(this.lines.again);
  }

  async returnHome(line = this.lines.home) {
    if (!this.alive || !MOVES[this.state].includes('returning')) return;
    this.changeState('returning');
    this.suggestion.visible = false;
    this.showMap();
    hush();
    const talk = say(line);
    await this.moveView(this.mapView, 800);
    if (!this.alive) return;
    await talk;
    await this.flyTo(this.home, []);
    if (!this.alive) return;
    await animate(650, (t) => this.shrinkVehicle(t));
    if (this.alive) this.game.hub();
  }

  stopsOnScreen() {
    if (!['waiting', 'visiting'].includes(this.state) || this.cameraMove) return [];
    const rect = renderer.domElement.getBoundingClientRect();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    return Object.entries(this.bodies).filter(([k]) => this.state === 'waiting' || k === this.visiting).map(([kind, g]) => {
      const p = g.getWorldPosition(new THREE.Vector3());
      const c = p.clone().project(camera);
      const edge = p.addScaledVector(right, g.userData.hit.scale.x * g.scale.x).project(camera);
      return { kind, x: rect.left + (c.x + 1) * rect.width / 2, y: rect.top + (1 - c.y) * rect.height / 2,
        r: Math.abs(edge.x - c.x) * rect.width / 2 };
    });
  }

  startLog() {
    const params = new URLSearchParams(location.search);
    if (!params.has('spacelog') && !params.has('maplog')) return;
    this.previousReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    this.logAt = performance.now() + 1500;
    this.onUpdate(() => {
      if (this.logAt && this.state === 'waiting' && performance.now() > this.logAt) {
        console.info(`[${this.area}] renderer.info.render.calls`, renderer.info.render.calls);
        this.logAt = null;
      }
      renderer.info.reset();
    });
  }

  tick(dt, t) {
    const now = performance.now();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const width = renderer.domElement.getBoundingClientRect().width;
    for (const g of Object.values(this.bodies)) {
      const c = g.position.clone().project(camera), edge = g.position.clone().add(right).project(camera);
      const perUnit = Math.abs(edge.x - c.x) * width / 2;
      g.userData.hit.scale.setScalar(Math.max(g.userData.foot, 38 / Math.max(perUnit, 0.01)));
    }
    if (this.state === 'waiting') this.updateSuggestion(t);
    this.animateWorld(dt, t, now);
    if (this.inviteAt && now >= this.inviteAt) { this.inviteAt = null; say(this.lines.startAgain); }
    if (this.idleAt && now >= this.idleAt) this.backToMap();
    if (this.nudgeAt && now >= this.nudgeAt && this.state === 'waiting') {
      say(this.nudgeLine);
      this.nudgeAt = ++this.nudges < 2 ? now + 25000 : null;
    }
  }

  resumed(ms) {
    if (this.idleAt) this.idleAt += ms;
    if (this.inviteAt) this.inviteAt += ms;
    if (this.nudgeAt) this.nudgeAt += ms;
  }

  exit() {
    window.removeEventListener('pointerdown', this.activity, true);
    window.removeEventListener('resize', this.resize);
    this.releaseWorld();
    if (this.previousReset !== undefined) renderer.info.autoReset = this.previousReset;
    hush();
  }

  parkVehicle() {
    this.vehicle.quaternion.copy(this.face);
    this.vehicle.scale.setScalar(this.parkScale());
    this.stopFlight();
    this.vehicle.position.copy(this.parkedPosition(this.at));
  }

  rotateVehicle(angle) {
    this.vehicle.quaternion.copy(this.face).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle));
  }

  dullShadows() {
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  parkScale() { return 1; }

  startFlight() {}

  stopFlight() {}

  resetVehicleLook() {}

  factLine(kind, line) { return line; }

  showHud() {}

  react() {}

  animateWorld() {}

  hideOtherStops() {}

  releaseWorld() {}

  shrinkVehicle(t) { this.vehicle.scale.setScalar(1 - t * 0.5); }
}
