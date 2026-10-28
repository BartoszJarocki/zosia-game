// The Garage's models: the building (in the mission and, smaller, on the island), the cruiser's door with shaped
// holes, the shape pieces, bunting, baskets and blocks. Every shape outline lives in OUTLINES, so a piece, its hole
// and its picture in the speech bubble always match.
import * as THREE from 'three';
import { mat, mesh, rbox, cyl, star, makeTruck } from '../models.js';
import { labelTexture, shade } from '../textures.js';

export const COLOUR_HEX = { red: '#ef4444', blue: '#2563eb', yellow: '#facc15', green: '#16a34a' };
const WICKER = '#c8955a';

/** Corner points (x, y up), about one unit across. A circle is the only curve. */
const OUTLINES = {
  square: [[-0.48, -0.48], [0.48, -0.48], [0.48, 0.48], [-0.48, 0.48]],
  triangle: [[-0.6, -0.52], [0.6, -0.52], [0, 0.52]],
  right: [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.55]],
  flat: [[-0.7, -0.28], [0.7, -0.28], [0.2, 0.36]],
  tall: [[-0.32, -0.62], [0.32, -0.62], [0, 0.62]],
};
const CIRCLE_R = 0.55;
const outline = (shape, odd) => OUTLINES[odd || shape];

/** Draw a shape into a THREE.Shape / Path: centred at (x, y), scaled by s, turned by `turn` radians. */
function trace(path, shape, odd, { x = 0, y = 0, s = 1, turn = 0, hole = false } = {}) {
  if (shape === 'circle') { path.absarc(x, y, CIRCLE_R * s, 0, Math.PI * 2, hole); return path; }
  const c = Math.cos(turn), sn = Math.sin(turn);
  outline(shape, odd).forEach(([px, py], i) => {
    const qx = x + (px * c - py * sn) * s, qy = y + (px * sn + py * c) * s;
    i ? path.lineTo(qx, qy) : path.moveTo(qx, qy);
  });
  path.closePath();
  return path;
}

/** The shape as an SVG for the speech bubble (1em square, so it scales with the bubble's text). */
export function shapeSVG(shape, colour, odd = null) {
  const hex = COLOUR_HEX[colour] || colour;
  const body = shape === 'circle'
    ? `<circle r="${CIRCLE_R}" fill="${hex}"/>`
    : `<polygon points="${outline(shape, odd).map(([x, y]) => `${x},${-y}`).join(' ')}" fill="${hex}"/>`;
  return `<svg viewBox="-0.75 -0.75 1.5 1.5" width="1em" height="1em" aria-hidden="true"><g stroke="#fff" stroke-width="0.07" stroke-linejoin="round" style="filter:drop-shadow(0 .04px 0 rgba(0,0,0,.2))">${body}</g></svg>`;
}

/** A block for the speech bubble: big fills the square, small is half of it. */
export function blockSVG(colour, size) {
  const h = size === 'small' ? 0.3 : 0.6;
  return `<svg viewBox="-0.75 -0.75 1.5 1.5" width="1em" height="1em" aria-hidden="true"><rect x="${-h}" y="${0.66 - 2 * h}" width="${2 * h}" height="${2 * h}" rx="${h * 0.22}" fill="${COLOUR_HEX[colour] || WICKER}" stroke="#fff" stroke-width="0.07"/></svg>`;
}

const PIECE_SCALE = 1.25, HOLE_ROOM = 1.12, PIECE_DEPTH = 0.22;

/** A shape piece standing up, facing the camera. userData.fit(): its rotation/scale once it sits in its hole. */
export function makeShapePiece({ shape, colour, turn = 0, size = 1, odd = null }) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(trace(new THREE.Shape(), shape, odd, { s: PIECE_SCALE }), { depth: PIECE_DEPTH, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 28 });
  geo.translate(0, 0, -PIECE_DEPTH / 2);
  const body = mesh(geo, mat(COLOUR_HEX[colour], { roughness: 0.35 }));
  body.rotation.z = turn;
  g.add(body);
  g.userData.body = body;
  g.scale.setScalar(size);
  return g;
}

const BOARD_W = 6.8, BOARD_H = 2.5, BOARD_DEPTH = 0.2, HOLE_GAP = 2.15;

/**
 * The cruiser's door, propped up on two legs, with a hole for each of `holes` ([{ shape, odd }], left to right).
 * userData.holes[i] = { shape, at: local centre of the hole, plug }: the plug is the dark backing behind the hole
 * (its material is its own, so a clue can light it up).
 */
export function makeDoorBoard(holes) {
  const g = new THREE.Group();
  const outer = new THREE.Shape();
  const w = BOARD_W / 2, h = BOARD_H / 2, r = 0.35;
  outer.moveTo(-w + r, -h); outer.lineTo(w - r, -h); outer.quadraticCurveTo(w, -h, w, -h + r); outer.lineTo(w, h - r);
  outer.quadraticCurveTo(w, h, w - r, h); outer.lineTo(-w + r, h); outer.quadraticCurveTo(-w, h, -w, h - r); outer.lineTo(-w, -h + r);
  outer.quadraticCurveTo(-w, -h, -w + r, -h);
  const xs = holes.map((_, i) => (i - (holes.length - 1) / 2) * HOLE_GAP);
  holes.forEach(({ shape, odd }, i) => outer.holes.push(trace(new THREE.Path(), shape, odd, { x: xs[i], y: -0.05, s: PIECE_SCALE * HOLE_ROOM, hole: true })));
  const geo = new THREE.ExtrudeGeometry(outer, { depth: BOARD_DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 28 });
  geo.translate(0, 0, -BOARD_DEPTH / 2);
  g.add(mesh(geo, mat('#1e4fbf', { roughness: 0.4 })));
  g.add(mesh(rbox(BOARD_W - 0.5, 0.16, 0.06, 0.03), mat('#f8fafc'), { y: h - 0.22, z: BOARD_DEPTH / 2 + 0.04 })); // the white trim
  const badge = star('#fde047', 0.26, 0.05);
  badge.position.set(w - 0.42, h - 0.5, BOARD_DEPTH / 2 + 0.05);
  g.add(badge);
  for (const x of [-w + 0.8, w - 0.8]) g.add(mesh(cyl(0.08, 0.1, 1.6, 10), mat('#94a3b8', { metalness: 0.4, roughness: 0.4 }), { x, y: -h - 0.3, z: -0.15 })); // down to the ground
  g.userData.holes = holes.map(({ shape, odd }, i) => {
    const plug = mesh(new THREE.ShapeGeometry(trace(new THREE.Shape(), shape, odd, { x: xs[i], y: -0.05, s: PIECE_SCALE * HOLE_ROOM * 1.08 }), 28),
      new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.9 }), { z: -BOARD_DEPTH / 2 - 0.08, shadow: false });
    g.add(plug);
    return { shape, odd, at: new THREE.Vector3(xs[i], -0.05, 0), plug };
  });
  g.userData.boardHeight = BOARD_H;
  return g;
}

/** One pennant of the bunting, hanging from its top edge (y = 0). */
export function makePennant(colour) {
  const s = new THREE.Shape();
  s.moveTo(-0.44, 0); s.lineTo(0.44, 0); s.lineTo(0, -1.02); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 1 });
  geo.translate(0, 0, -0.025);
  return mesh(geo, mat(COLOUR_HEX[colour], { roughness: 0.55, side: THREE.DoubleSide }));
}

/** The empty place on the line: a pale pennant with a question mark. */
export function makeGhostPennant() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.44, 0); s.lineTo(0.44, 0); s.lineTo(0, -1.02); s.closePath();
  g.add(mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.9, depthWrite: false }), { s: 1.12, y: 0.05, z: -0.01, shadow: false })); // an orange edge, so it shows on the white wall
  g.add(mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: '#fffbeb', transparent: true, opacity: 0.92, depthWrite: false }), { shadow: false }));
  g.add(mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: labelTexture('?', { fg: '#f59e0b', stroke: 'rgba(255,255,255,0.9)' }), transparent: true, depthWrite: false }), { y: -0.38, z: 0.02, shadow: false }));
  return g;
}

/** A pennant to choose from: on a little stand, so it stands up on the ground. userData.flag: the pennant. */
export function makeFlagStand(colour) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05, 0.05, 1.9, 8), mat('#a16207'), { y: 0.95, z: -0.06 }));
  g.add(mesh(cyl(0.26, 0.3, 0.1, 16), mat('#78716c'), { y: 0.05 }));
  const flag = makePennant(colour);
  flag.position.y = 1.9;
  flag.scale.setScalar(1.15);
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

/**
 * Two posts and a line between them for `n` pennants. userData: hooks (where each pennant hangs, top edge),
 * line (the string, to hang the pennants on), posts.
 */
export function makeBunting(n) {
  const g = new THREE.Group();
  const gap = Math.min(1.2, 8.2 / n), half = (gap * (n + 1)) / 2, top = 3.0;
  const posts = [-half, half].map((x) => {
    const post = new THREE.Group();
    post.position.x = x;
    for (let i = 0; i < 6; i++) post.add(mesh(cyl(0.09, 0.09, top / 6, 10), mat(i % 2 ? '#ffffff' : '#ef4444'), { y: (i + 0.5) * (top / 6) }));
    post.add(mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('#fde047'), { y: top + 0.08 }));
    g.add(post);
    return post;
  });
  const sag = (x) => top - 0.15 - 0.25 * (1 - (x / half) ** 2);
  const pts = Array.from({ length: 21 }, (_, i) => { const x = -half + (i / 20) * 2 * half; return new THREE.Vector3(x, sag(x), 0); });
  const line = new THREE.Group();
  line.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.025, 6), mat('#475569'), { shadow: false }));
  g.add(line);
  g.userData = { line, posts, hooks: Array.from({ length: n }, (_, i) => { const x = -half + gap * (i + 1); return new THREE.Vector3(x, sag(x) + 0.03, 0); }) };
  return g;
}

/** A basket (koszyk): coloured, or wicker when colour is null. Big is the size of the colour baskets. */
export function makeBasket(colour, size = 'big') {
  const g = new THREE.Group();
  const hex = COLOUR_HEX[colour] || WICKER;
  const pts = [[0, 0.02], [0.78, 0.02], [0.9, 0.1], [1.02, 0.78], [1.06, 0.84]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(pts, 36), mat(hex, { roughness: 0.65, side: THREE.DoubleSide })));
  g.add(mesh(new THREE.TorusGeometry(1.06, 0.07, 8, 36), mat(colour ? '#ffffff' : '#8a5a2b', { roughness: 0.5 }), { y: 0.84, rx: Math.PI / 2 }));
  for (const y of [0.3, 0.55]) g.add(mesh(new THREE.TorusGeometry(0.93 + y * 0.12, 0.035, 6, 36), mat(colour ? '#ffffff' : '#8a5a2b', { roughness: 0.6, transparent: !!colour, opacity: colour ? 0.35 : 1 }), { y, rx: Math.PI / 2, shadow: false }));
  g.add(mesh(new THREE.TorusGeometry(0.98, 0.07, 8, 28, Math.PI), mat(colour ? shade(hex, -0.25) : '#8a5a2b', { roughness: 0.5 }), { y: 0.84, rx: -0.35 })); // the handle, leaning back
  g.scale.setScalar(size === 'small' ? 0.6 : 1);
  return g;
}

/** A toy block (klocek): big, small, or (size null, when only its colour matters) in between. */
export function makeBlock(colour, size) {
  const s = { big: 0.95, small: 0.6 }[size] ?? 0.75;
  const b = mesh(rbox(s, s, s, s * 0.12), mat(COLOUR_HEX[colour], { roughness: 0.4 }));
  b.userData.half = s / 2;
  return b;
}

/** The mission's garage: a wide workshop with an open door, Chase's cruiser inside, tyres and a toolbox. */
export function makeGarage() {
  const g = new THREE.Group();
  const wall = mat('#f8fafc', { roughness: 0.8 }), blue = mat('#1e4fbf', { roughness: 0.45 }), dark = mat('#334155', { roughness: 0.95 });
  g.add(mesh(rbox(10.5, 0.1, 4, 0.04), mat('#cbd5e1', { roughness: 0.95 }), { y: 0.05, z: -0.2 })); // floor inside
  g.add(mesh(rbox(10.5, 4.4, 0.3, 0.06), dark, { y: 2.2, z: -2 })); // back wall, in shadow
  for (const x of [-4.1, 4.1]) g.add(mesh(rbox(2.3, 4.4, 4, 0.12), wall, { x, y: 2.2, z: -0.2 }));
  g.add(mesh(rbox(6, 1.1, 4, 0.1), wall, { y: 3.85, z: -0.2 })); // over the door
  g.add(mesh(rbox(11.2, 0.35, 4.6, 0.12), blue, { y: 4.55, z: -0.2 })); // roof
  g.add(mesh(rbox(6.2, 0.26, 0.2, 0.08), mat('#fde047'), { y: 3.32, z: 1.85 })); // door frame stripe
  for (let i = 0; i < 4; i++) g.add(mesh(rbox(5.9, 0.16, 0.12, 0.05), mat('#94a3b8', { metalness: 0.3, roughness: 0.5 }), { y: 3.05 - i * 0.06 - (i ? 0.08 : 0), z: 1.72 - i * 0.002 })); // the rolled-up door
  // the sign on the roof: a circle, a square and a triangle
  g.add(mesh(rbox(3.2, 1.2, 0.18, 0.12), mat('#ffffff'), { y: 5.35, z: 1.2 }));
  g.add(mesh(cyl(0.38, 0.38, 0.12, 28), mat(COLOUR_HEX.red), { x: -1, y: 5.35, z: 1.32, rx: Math.PI / 2 }));
  g.add(mesh(rbox(0.7, 0.7, 0.12, 0.04), mat(COLOUR_HEX.blue), { y: 5.35, z: 1.32 }));
  g.add(mesh(new THREE.ExtrudeGeometry(trace(new THREE.Shape(), 'triangle', null, { s: 0.72 }), { depth: 0.12, bevelEnabled: false }), mat(COLOUR_HEX.yellow), { x: 1, y: 5.32, z: 1.28 }));
  // tyres by the left wall, a red toolbox on the right
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.42, 0.2, 10, 24), mat('#1f2937', { roughness: 0.8 }), { x: -6.1, y: 0.2 + i * 0.4, z: 1.8, rx: Math.PI / 2 }));
  g.add(mesh(rbox(1.3, 1.6, 0.8, 0.08), mat('#dc2626', { roughness: 0.45 }), { x: 6.1, y: 0.8, z: 1.6 }));
  for (let i = 0; i < 3; i++) g.add(mesh(rbox(1.1, 0.06, 0.05, 0.02), mat('#991b1b'), { x: 6.1, y: 0.45 + i * 0.45, z: 2.02 }));
  return g;
}

/** Chase's cruiser, side on, for the garage. */
export function makeGarageCruiser() {
  const t = makeTruck();
  t.scale.setScalar(1.55);
  t.rotation.y = Math.PI / 2;
  return t;
}

/** Small garage for the island: a rolled-up door with a circle, a square and a triangle over it. Kept low, so the
 *  place's level stars float clear of it. */
export function makeGarageLandmark() {
  const g = new THREE.Group();
  g.add(mesh(cyl(2.7, 2.7, 0.12, 48), mat('#cbd5e1', { roughness: 0.95 }), { y: 0.06 }));
  g.add(mesh(rbox(2.8, 1.75, 1.9, 0.1), mat('#f8fafc', { roughness: 0.8 }), { y: 0.88, z: -0.5 }));
  g.add(mesh(rbox(3.1, 0.2, 2.2, 0.08), mat('#1e4fbf', { roughness: 0.45 }), { y: 1.82, z: -0.5 }));
  g.add(mesh(rbox(1.7, 1.0, 0.08, 0.04), mat('#334155', { roughness: 0.95 }), { y: 0.52, z: 0.46 }));
  for (let i = 0; i < 3; i++) g.add(mesh(rbox(1.75, 0.1, 0.1, 0.04), mat('#94a3b8', { metalness: 0.3, roughness: 0.5 }), { y: 0.98 - i * 0.12, z: 0.5 }));
  g.add(mesh(cyl(0.2, 0.2, 0.1, 24), mat(COLOUR_HEX.red), { x: -0.62, y: 1.38, z: 0.48, rx: Math.PI / 2 }));
  g.add(mesh(rbox(0.36, 0.36, 0.1, 0.03), mat(COLOUR_HEX.blue), { y: 1.38, z: 0.48 }));
  g.add(mesh(new THREE.ExtrudeGeometry(trace(new THREE.Shape(), 'triangle', null, { s: 0.38 }), { depth: 0.1, bevelEnabled: false }), mat(COLOUR_HEX.yellow), { x: 0.62, y: 1.38, z: 0.43 }));
  for (let i = 0; i < 2; i++) g.add(mesh(new THREE.TorusGeometry(0.26, 0.12, 8, 18), mat('#1f2937', { roughness: 0.8 }), { x: 1.75, y: 0.12 + i * 0.24, z: 0.6, rx: Math.PI / 2 }));
  return g;
}
