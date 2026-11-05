import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeSpacePlace } from '../scenes/space.js';

// The space road's places, in the order they stand on the map.
export const KEEPSAKE_KINDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'blackhole', 'comet', 'stars'];
export const KEEPSAKE_RING = 3.7;

const MODEL = 0.2;
const POST = 0.4;
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
  kinds.forEach((kind, i) => {
    const a = (i / kinds.length) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * KEEPSAKE_RING;
    const z = Math.sin(a) * KEEPSAKE_RING;
    group.userData.positions.push({ kind, x, z });

    const post = new THREE.CylinderGeometry(0.045, 0.06, POST, 6);
    geos.push(paint(post, at.makeTranslation(x, POST / 2, z), POST_COLOR));
    post.dispose();

    const [body, trim] = LOOK[kind];
    const model = makeSpacePlace(kind, QUAT, MODEL);
    model.position.set(x, POST + MODEL * 0.9, z);
    model.updateWorldMatrix(true, true);
    model.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      const ring = /RingGeometry|TorusGeometry|ShapeGeometry/.test(o.geometry.type);
      geos.push(paint(o.geometry, o.matrixWorld, ring ? trim : body));
    });
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
