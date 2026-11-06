// Chase's face in a round window, rendered once for space scenes.
import * as THREE from 'three';
import { renderer } from '../engine.js';
import { makePup } from '../characters.js';

export function portrait() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#657dcc');
  scene.add(new THREE.HemisphereLight('#ffffff', '#cad9ff', 2.4));
  const light = new THREE.DirectionalLight('#fff3dd', 2.5);
  light.position.set(-3, 4, 6); scene.add(light);
  const chase = makePup();
  chase.position.set(0, -1.4, 0);
  chase.userData.setHappy(60);
  scene.add(chase);
  scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 5);
  const target = new THREE.WebGLRenderTarget(256, 256);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(previous);
  scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  return target;
}
