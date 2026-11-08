import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { starShape } from '../models.js';

// The shell a sea stop leaves on the harbour's sand (the island itself is home, not a trip).
export const SHELL_KINDS = ['scallop', 'spiral', 'starfish', 'pebble', 'crab'];
export const SHELL_SIZE = 1.75; // nominal world across, about 28 to 40 CSS px at 1180x820

// One fixed spot per stop, as an offset from the harbour anchor: a loose arc across the open
// sand in front of the pier, split by the road. The size evens out their screen size.
export const SHELL_LAYOUT = [
  { place: 'buoy', kind: 'scallop', x: -6.0, z: 8.6, size: 1.58 },
  { place: 'shallows', kind: 'spiral', x: -5.8, z: 5.9, size: 1.8 },
  { place: 'seal', kind: 'starfish', x: 5.4, z: 2.6, size: 1.5 },
  { place: 'lighthouse', kind: 'pebble', x: 7.2, z: 4.4, size: 1.48 },
  { place: 'gulls', kind: 'crab', x: 9.0, z: 6.2, size: 1.44 },
  { place: 'reef', kind: 'scallop', x: 10.8, z: 8.0, size: 1.42 },
  { place: 'port', kind: 'spiral', x: 12.6, z: 9.8, size: 1.32 },
];

const LOOK = {
  scallop: ['#ffd1dc', '#f472b6'],
  spiral: ['#ffe0a3', '#f97316'],
  starfish: ['#ffb066', '#ef4444'],
  pebble: ['#c7d2fe', '#818cf8'],
  crab: ['#fca5a5', '#dc2626'],
};

const NO_MAT = new THREE.MeshBasicMaterial();

/** Which sea stops leave a shell, in the order they stand round the bay. */
export const shellPlaces = (visited = {}) => SHELL_LAYOUT.filter((spot) => visited[spot.place]).map((spot) => spot.place);

/** The kind of shell each visited stop leaves, in the same order. */
export const shellKinds = (visited = {}) => SHELL_LAYOUT.filter((spot) => visited[spot.place]).map((spot) => spot.kind);

function part(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s } = {}) {
  const m = new THREE.Mesh(geometry, NO_MAT);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s);
  return m;
}

function model(kind) {
  const g = new THREE.Group();
  if (kind === 'scallop') {
    g.add(part(new THREE.SphereGeometry(0.5, 12, 8), { y: 0.14, s: [1, 0.3, 0.88] }));
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.38;
      const ridge = part(new THREE.BoxGeometry(0.05, 0.08, 0.72), { x: Math.sin(a) * 0.36, y: 0.29, z: -0.32 + Math.cos(a) * 0.36, ry: a });
      ridge.userData.trim = true;
      g.add(ridge);
    }
  } else if (kind === 'spiral') {
    g.add(part(new THREE.CylinderGeometry(0.05, 0.42, 1, 12), { y: 0.24, z: 0.05, rx: Math.PI / 2 }));
    for (let i = 0; i < 3; i++) {
      const ring = part(new THREE.TorusGeometry(0.32 - i * 0.08, 0.075, 6, 12), { y: 0.26, z: -0.22 + i * 0.28 });
      ring.userData.trim = true;
      g.add(ring);
    }
  } else if (kind === 'starfish') {
    g.add(part(new THREE.ExtrudeGeometry(starShape(0.62, 0.28), { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), { y: 0.1, rx: -Math.PI / 2 }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      const dot = part(new THREE.SphereGeometry(0.07, 6, 4), { x: Math.cos(a) * 0.38, y: 0.28, z: Math.sin(a) * 0.38 });
      dot.userData.trim = true;
      g.add(dot);
    }
  } else if (kind === 'pebble') {
    g.add(part(new THREE.DodecahedronGeometry(0.42), { y: 0.21, s: [1.2, 0.5, 0.9] }));
  } else {
    g.add(part(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: 0.02, s: [1.05, 0.62, 0.95] }));
    for (const side of [-1, 1]) {
      const claw = part(new THREE.SphereGeometry(0.13, 8, 6), { x: side * 0.38, y: 0.1, z: 0.32, s: [1, 0.7, 1.2] });
      claw.userData.trim = true;
      g.add(claw);
      const eye = part(new THREE.SphereGeometry(0.055, 6, 4), { x: side * 0.14, y: 0.3, z: 0.3 });
      eye.userData.trim = true;
      g.add(eye);
    }
  }
  return g;
}

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

function disposeModel(root) {
  root.traverseVisible((o) => {
    if (o.isMesh) o.geometry?.dispose();
    if (o.material && o.material !== NO_MAT) o.material.dispose();
  });
}

/** Every visited sea stop as one merged, vertex-coloured mesh: one draw call however many there are. */
export function makeShells(visited = {}) {
  const places = shellPlaces(visited);
  const group = new THREE.Group();
  group.userData.shells = true;
  group.userData.places = places;
  group.userData.kinds = shellKinds(visited);
  group.userData.positions = [];
  if (!places.length) return group;

  const geos = [];
  const extent = new THREE.Vector3();
  SHELL_LAYOUT.filter((spot) => visited[spot.place]).forEach(({ place, kind, x, z, size: across = SHELL_SIZE }) => {
    const m = model(kind);
    const raw = meshBox(m);
    raw.getSize(extent);
    const centre = raw.getCenter(new THREE.Vector3());
    const fit = across / Math.max(extent.x, extent.z);
    m.scale.setScalar(fit);
    m.position.set(x - centre.x * fit, 0.07 - raw.min.y * fit, z - centre.z * fit);
    m.updateWorldMatrix(true, true);

    const [body, trim] = LOOK[kind];
    m.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      geos.push(paint(o.geometry, o.matrixWorld, o.userData.trim ? trim : body));
    });
    const box = meshBox(m);
    const r = Math.max(box.max.x - x, x - box.min.x, box.max.z - z, z - box.min.z);
    group.userData.positions.push({ place, kind, x, z, radius: r, box });
    disposeModel(m);
  });

  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return group;
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  mesh.castShadow = mesh.receiveShadow = false;
  group.add(mesh);
  return group;
}

/** Put the shells on the sand in front of the harbour's pier, one fixed spot per visited sea stop. */
export function addShells(scene, at, visited = {}) {
  const group = makeShells(visited);
  group.position.set(at[0], 0, at[1]);
  scene.add(group);
  return group;
}
