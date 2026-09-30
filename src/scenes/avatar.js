import * as THREE from 'three';
import { Stage, addSkyAndLights } from '../engine.js';
import { mat, mesh } from '../models.js';
import { makeGirl, makePup } from '../characters.js';

// Debug/preview: close-up of the heroes (open /#avatar).
export class AvatarStage extends Stage {
  constructor() {
    super();
    this.view = { pos: new THREE.Vector3(0, 2.2, 5.5), look: new THREE.Vector3(0, 1.2, 0), minWidth: 4.5 };
  }
  enter() {
    addSkyAndLights(this.scene, { shadowSize: 5 });
    this.scene.add(mesh(new THREE.CircleGeometry(20, 32), mat('#5dbb4f'), { rx: -Math.PI / 2 }));
    const g = makeGirl();
    g.position.x = -0.9;
    g.rotation.y = 0.25;
    const p = makePup();
    p.position.x = 1;
    p.rotation.y = -0.3;
    this.scene.add(g, p);
    this.onUpdate((dt, t) => { g.userData.idle(t); p.userData.idle(t); });
  }
}
