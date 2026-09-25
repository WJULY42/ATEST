import * as THREE from 'three';
import { stationTexture, glowTexture } from './Textures.js';
import { SeedRandom } from '../utils/SeedRandom.js';

// 空间站：环形主体 + 中心塔 + 霓虹灯带（程序化几何）
export function createStation(seed) {
  const rng = new SeedRandom(seed).fork('station');
  const group = new THREE.Group();
  const tex = stationTexture(seed);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.7 });
  const neonColor = new THREE.Color(rng.pick(['#3fd0ff', '#ff3fd0', '#a5ff3f']));

  const torus = new THREE.Mesh(new THREE.TorusGeometry(420, 70, 10, 36), mat);
  torus.rotation.x = Math.PI / 2;
  group.add(torus);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(90, 90, 520, 12), mat);
  group.add(core);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(110, 10, 8),
    new THREE.MeshStandardMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 1.4 })
  );
  cap.position.y = 280;
  group.add(cap);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(320, 24, 24), mat);
    spoke.position.set(Math.cos(a) * 210, 0, Math.sin(a) * 210);
    spoke.rotation.y = -a;
    group.add(spoke);
  }

  // 导航信标光点
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: neonColor, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  beacon.scale.setScalar(300);
  beacon.position.y = 320;
  group.add(beacon);
  group.userData.beacon = beacon;

  group.userData.neon = neonColor;
  return group;
}

// 太空遗迹 / 坠毁船骸（地表兴趣点）
export function createRuins(seed) {
  const rng = new SeedRandom(seed).fork('ruins');
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a5f6e, roughness: 0.9, metalness: 0.4 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x3fd0ff, emissive: 0x3fd0ff, emissiveIntensity: 1.2,
  });
  for (let i = 0; i < rng.int(4, 7); i++) {
    const h = rng.range(6, 26);
    const b = new THREE.Mesh(new THREE.BoxGeometry(rng.range(3, 9), h, rng.range(3, 9)), mat);
    b.position.set(rng.range(-14, 14), h / 2, rng.range(-14, 14));
    b.rotation.set(rng.range(-0.3, 0.3), rng.range(0, 6.28), rng.range(-0.3, 0.3));
    group.add(b);
  }
  const obelisk = new THREE.Mesh(new THREE.ConeGeometry(2.2, 18, 5), glowMat);
  obelisk.position.set(0, 9, 0);
  group.add(obelisk);
  return group;
}
