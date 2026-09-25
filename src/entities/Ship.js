import * as THREE from 'three';
import { glowTexture } from '../world/Textures.js';

// 程序化低多边形飞船：机身 + 机翼 + 引擎辉光 + 尾焰粒子
export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc8d4e8, roughness: 0.4, metalness: 0.7, flatShading: true });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.6, metalness: 0.5, flatShading: true });
    const neonMat = new THREE.MeshStandardMaterial({ color: 0x3fd0ff, emissive: 0x3fd0ff, emissiveIntensity: 1.6 });

    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 5), bodyMat);
    hull.rotation.set(-Math.PI / 2, 0, 0); // 机头朝 -Z（Three.js 前方约定）
    this.group.add(hull);

    const belly = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4), trimMat);
    belly.position.y = -0.5;
    this.group.add(belly);

    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 1.8), bodyMat);
      wing.position.set(s * 2.4, -0.2, 1.2);
      wing.rotation.z = s * 0.28;
      wing.rotation.y = s * -0.18;
      this.group.add(wing);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.4), neonMat);
      tip.position.set(s * 4.0, -0.2, 1.2);
      this.group.add(tip);
    }

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x0a2a3f, emissive: 0x3fd0ff, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.9 })
    );
    cockpit.position.set(0, 0.6, -0.8);
    this.group.add(cockpit);

    // 双引擎喷口
    this.flames = [];
    for (const s of [-1, 1]) {
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.2, 6), trimMat);
      noz.rotation.x = Math.PI / 2;
      noz.position.set(s * 1.1, -0.35, 3.1);
      this.group.add(noz);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0x66d0ff, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
      }));
      flame.position.set(s * 1.1, -0.35, 3.9);
      flame.scale.setScalar(2);
      this.group.add(flame);
      this.flames.push(flame);
    }
    scene.add(this.group);
  }

  setThrottle(t) {
    for (const f of this.flames) {
      f.material.opacity = t * 0.9;
      f.scale.setScalar(1.2 + t * 2.6 + Math.sin(performance.now() * 0.03) * 0.2 * t);
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
  }
}
