import * as THREE from 'three';
import { SeedRandom } from '../utils/SeedRandom.js';

// 程序化低多边形植物 / 矿物采集物 / 生物
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function makeTreeGeometry(rng) {
  const g = new THREE.Group();
  const trunkH = rng.range(4, 9);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.5, trunkH, 5),
    new THREE.MeshStandardMaterial({ color: rng.pick([0x6a4a2a, 0x4a3a5a, 0x7a5a3a]), flatShading: true })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const leafCol = rng.pick([0x3f8f45, 0x7ec850, 0x4ac878, 0xa8c832, 0x2a9ac8]);
  for (let i = 0; i < rng.int(1, 3); i++) {
    const r = rng.range(1.6, 3.2);
    const leaves = new THREE.Mesh(
      rng.chance(0.5) ? new THREE.ConeGeometry(r, r * 2, 6) : new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshStandardMaterial({ color: leafCol, flatShading: true, roughness: 0.9 })
    );
    leaves.position.y = trunkH + i * r * 1.1;
    g.add(leaves);
  }
  return g;
}

// InstancedMesh 植被散布（性能友好）
export function scatterVegetation(scene, planetParams, terrain, count) {
  if (!planetParams.biome.vegetation || planetParams.biome.gasGiant) return null;
  const rng = new SeedRandom(planetParams.seed).fork('veg');
  const geo = new THREE.ConeGeometry(1.6, 6, 5);
  geo.translate(0, 3, 0);
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const colors = [planetParams.biome.palette[2], planetParams.biome.palette[3], planetParams.biome.palette[1]];
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = rng.range(-560, 560), z = rng.range(-560, 560);
    const h = terrain.heightAt(x, z);
    if (h < -3) continue; // 水面下不放
    const s = rng.range(0.5, 1.6);
    _dummy.position.set(x, h, z);
    _dummy.rotation.set(0, rng.range(0, 6.28), 0);
    _dummy.scale.set(s, s * rng.range(0.8, 1.5), s);
    _dummy.updateMatrix();
    mesh.setMatrixAt(n, _dummy.matrix);
    _color.set(rng.pick(colors));
    mesh.setColorAt(n, _color);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

// 矿物采集点：发光晶体，可被扫描/采集
export function scatterResources(scene, planetParams, terrain, count = 26) {
  const rng = new SeedRandom(planetParams.seed).fork('res');
  const list = [];
  const resKeys = Object.keys(planetParams.biome.resources);
  const geo = new THREE.OctahedronGeometry(1.4, 0);
  for (let i = 0; i < count; i++) {
    const x = rng.range(-520, 520), z = rng.range(-520, 520);
    const h = terrain.heightAt(x, z);
    if (h < -2) continue;
    const name = rng.pick(resKeys);
    const glow = new THREE.Color(rng.pick(['#3fd0ff', '#ff3fd0', '#a5ff3f', '#ffb03f']));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: glow, emissive: glow, emissiveIntensity: 1.5, flatShading: true,
    }));
    const s = rng.range(0.8, 2.2);
    m.scale.setScalar(s);
    m.position.set(x, h + s, z);
    m.userData.resource = { name, amount: rng.int(20, 120), mesh: m };
    scene.add(m);
    list.push(m);
  }
  return list;
}

// 程序化生物：胶囊身体 + 腿 + 眼，随机配色与体型
export function createCreature(seed, biome) {
  const rng = new SeedRandom(seed).fork('creature');
  const g = new THREE.Group();
  const bodyCol = new THREE.Color(rng.pick(biome.palette));
  const accent = new THREE.Color(rng.pick(['#3fd0ff', '#ff3fd0', '#ffd83f']));
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyCol, flatShading: true, roughness: 0.85 });
  const size = rng.range(0.8, 2.4);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), bodyMat);
  body.scale.y = rng.range(0.6, 1.1);
  body.position.y = size * 1.4;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(size * 0.8, size * 0.7, size * 0.9), bodyMat);
  head.position.set(0, size * 1.9, size * 0.9);
  g.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.13, 6, 6), eyeMat);
    eye.position.set(side * size * 0.25, size * 2.05, size * 1.32);
    g.add(eye);
  }
  const legs = [];
  const legCount = rng.pick([2, 4]);
  for (let i = 0; i < legCount; i++) {
    const sideSign = legCount === 2 ? 0 : (i % 2 ? 1 : -1);
    const front = i < legCount / 2 ? 1 : -1;
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.12, size * 0.08, size * 1.4, 4),
      bodyMat
    );
    leg.position.set(sideSign * size * 0.45, size * 0.7, front * size * 0.5);
    g.add(leg);
    legs.push(leg);
  }
  g.userData = {
    legs, speed: rng.range(2, 6), wanderPhase: rng.range(0, 6.28),
    name: rng.pick(['咕噜兽', '塔拉飞虫', '泽诺爬行者', '普夫跳者', '克拉岩兽', '伊维浮游体']),
    hostile: biome.hazard > 8 && rng.chance(0.3),
    scanned: false,
  };
  return g;
}
