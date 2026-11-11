// hop-reach.mjs : on the Moon camera, how far a quick tap aimed where Chase stood a moment ago lands from him now,
// for a few hop heights (verification tooling for moon.js TAP_JUMP). A tap that hits nothing still reaches him within
// the missions' stray radius (input/stray.js). The camera, slots and lag are moon.js's and kid.mjs's quick plan.
import * as THREE from 'three';
import { STRAY } from '../../src/input/stray.js';

const W = 1180, H = 820, look = new THREE.Vector3(0, 1.2, 0), pos = new THREE.Vector3(0, 10, 16), minWidth = 16;
const START = -4.9, GAP = 1.05, HOP_MS = 400, TAP_HEIGHT = 1.5, AIM = 0.8, LAG_MS = 280;
const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
const dir = pos.clone().sub(look);
dir.setLength(Math.max(dir.length(), minWidth / (2 * Math.tan(THREE.MathUtils.degToRad(21)) * cam.aspect)));
cam.position.copy(look).add(dir);
cam.lookAt(look);
cam.updateMatrixWorld(true);
const px = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
const chase = (hops, height) => { const n = Math.floor(hops), t = hops - n; return new THREE.Vector3(START + hops * GAP, Math.sin(t * Math.PI) * height, -0.7); };
const reach = STRAY.missions * Math.min(W, H);

for (const height of [1.8, 1.4, 1.2, 1.0]) {
  let worst = 0;
  for (let hops = 0; hops < 3; hops += 0.02) { // she reads where he is, then taps LAG_MS later while he keeps hopping
    const [ax, ay] = px(chase(hops, height).add(new THREE.Vector3(0, AIM, 0)));
    const [x, y] = px(chase(hops + LAG_MS / HOP_MS, height).add(new THREE.Vector3(0, TAP_HEIGHT, 0)));
    worst = Math.max(worst, Math.hypot(x - ax, y - ay));
  }
  console.log(`hop ${height}: a late tap lands up to ${worst.toFixed(0)} px from him; reach ${reach.toFixed(0)} px: ${worst < reach ? 'caught' : 'MISSED'}`);
}
