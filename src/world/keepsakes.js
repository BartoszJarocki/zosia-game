import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeSpacePlace } from '../scenes/space.js';
import { star } from '../models.js';

// The space road's places, in the order they stand on the map.
export const KEEPSAKE_KINDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars'];
export const KEEPSAKE_RING = 4.45;
export const KEEPSAKE_SIZE = 2.2; // world across, about 34 CSS px at 1180x820
export const KEEPSAKE_CLEAR = KEEPSAKE_RING + KEEPSAKE_SIZE / 2 + 0.15;

const MODEL = 0.9;
const POST = 0.55;
const POST_COLOR = '#b9a77a';
const QUAT = new THREE.Quaternion();

// Body and trim colour for each tiny model (the map's own textures are too big for a keepsake).
const LOOK = {
  sun: ['#ffd24a', '#ff9c38'],
  mercury: ['#b58a69', '#9a7358'],
  venus: ['#f4d98a', '#e9c46a'],
  earth: ['#2f86e8', '#4cc24a'],
  moon: ['#f1efe9', '#d8d4c8'],
  mars: ['#d95f33', '#a84425'],
  jupiter: ['#e6c79a', '#b06d43'],
  saturn: ['#f0d79a', '#c9a25e'],
  uranus: ['#a5eef0', '#7fd8dc'],
  neptune: ['#3a66e0', '#2a4fc0'],
  pluto: ['#c1a18c', '#fff0df'],
  blackhole: ['#1a0b33', '#ffd27a'],
  comet: ['#e3faff', '#b3efff'],
  stars: ['#fff1a3', '#ded6ff'],
};

/** Which keepsakes the visited places leave behind. */
export const keepsakeKinds = (visited = {}) => KEEPSAKE_KINDS.filter((kind) => visited[kind]);

function paint(geometry, matrix, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  const rgb = new THREE.Color(color);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = rgb.r;
    colors[i * 3 + 1] = rgb.g;
    colors[i * 3 + 2] = rgb.b;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function meshBox(root) {
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(b);
  });
  return box;
}

/** The comet's short tail, so the keepsake still reads as a comet after merging. */
function addCometTail(model) {
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 8), new THREE.MeshBasicMaterial());
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = 0.55;
  tail.userData.trim = true;
  model.add(tail);
}

/** The map's stars stop is a constellation; a single bright star reads better at keepsake size. */
function starKeepsake() {
  const g = new THREE.Group();
  g.add(star('#fff1a3', MODEL, 0.14));
  return g;
}

/** Free the map model's geometry and textures now that its coloured copy is merged. */
function disposeModel(root) {
  root.traverseVisible((o) => {
    if (o.isMesh || o.isLine) o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

/** All visited space places as one merged, vertex-coloured mesh: one draw call however many there are. */
export function makeKeepsakes(visited = {}) {
  const kinds = keepsakeKinds(visited);
  const group = new THREE.Group();
  group.userData.keepsakes = true;
  group.userData.kinds = kinds;
  group.userData.positions = [];
  if (!kinds.length) return group;

  const geos = [];
  const at = new THREE.Matrix4();
  const size = new THREE.Vector3();
  kinds.forEach((kind, i) => {
    const a = (i / kinds.length) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * KEEPSAKE_RING;
    const z = Math.sin(a) * KEEPSAKE_RING;

    const post = new THREE.CylinderGeometry(0.045, 0.06, POST, 6);
    geos.push(paint(post, at.makeTranslation(x, POST / 2, z), POST_COLOR));
    post.dispose();

    const [body, trim] = LOOK[kind];
    const model = kind === 'stars' ? starKeepsake() : makeSpacePlace(kind, QUAT, MODEL);
    if (kind === 'comet') addCometTail(model);
    const raw = meshBox(model);
    raw.getSize(size);
    const centre = raw.getCenter(new THREE.Vector3());
    const fit = KEEPSAKE_SIZE / Math.max(size.x, size.y);
    model.scale.setScalar(fit);
    model.position.set(x - centre.x * fit, POST + 0.06 - raw.min.y * fit, z - centre.z * fit);
    model.updateWorldMatrix(true, true);
    model.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      const ring = o.userData.trim || /RingGeometry|TorusGeometry|ShapeGeometry/.test(o.geometry.type);
      geos.push(paint(o.geometry, o.matrixWorld, ring ? trim : body));
    });
    const box = meshBox(model);
    box.union(new THREE.Box3(new THREE.Vector3(x - 0.06, 0, z - 0.06), new THREE.Vector3(x + 0.06, POST, z + 0.06)));
    const radius = Math.max(box.max.x - x, x - box.min.x, box.max.z - z, z - box.min.z);
    group.userData.positions.push({ kind, x, z, radius, box });
    disposeModel(model);
  });

  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return group;
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  mesh.castShadow = mesh.receiveShadow = false;
  group.add(mesh);
  return group;
}

/** Put the keepsakes in a ring on the launch pad's clear ground (inside its clearing, outside the rocket's tap target). */
export function addKeepsakes(scene, at, visited = {}) {
  const group = makeKeepsakes(visited);
  group.position.set(at[0], 0, at[1]);
  scene.add(group);
  return group;
}
