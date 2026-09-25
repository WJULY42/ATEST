import * as THREE from 'three';
import { glowTexture } from '../world/Textures.js';
import { SeedRandom } from '../utils/SeedRandom.js';

// 小行星带：InstancedMesh + 每帧向相机方向滚动（无尽穿越感）
export class AsteroidField {
  constructor(scene, seed, count = 260) {
    this.scene = scene;
    this.count = count;
    const rng = new SeedRandom(seed).fork('ast');
    const geo = new THREE.IcosahedronGeometry(1, 0);
    // 顶点抖动 -> 不规则岩石
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = 0.7 + rng.next() * 0.6;
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8fa0, roughness: 1, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.data = [];
    for (let i = 0; i < count; i++) {
      this.data.push({
        x: rng.range(-900, 900), y: rng.range(-500, 500), z: rng.range(-4000, 4000),
        scale: rng.range(3, 26), spin: rng.range(-1, 1), rot: rng.range(0, 6.28),
      });
    }
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.active = true;
    scene.add(this.mesh);
  }

  update(dt, camPos, speed) {
    if (!this.active) return;
    const scroll = (20 + speed * 1.2) * dt;
    for (let i = 0; i < this.count; i++) {
      const a = this.data[i];
      a.z -= scroll; // 相对运动：向玩家身后掠去
      a.rot += a.spin * dt;
      if (a.z < -4200) a.z += 8400;
      if (a.z > 4200) a.z -= 8400;
      this._v.set(a.x, a.y, a.z);
      this._q.setFromAxisAngle(new THREE.Vector3(0.4, 0.8, 0.2), a.rot);
      this._s.setScalar(a.scale);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setVisible(v) {
    this.active = v;
    this.mesh.visible = v;
  }

  // 撞击检测：返回命中的小行星（世界坐标近似，太空模式下以相机为中心）
  checkCollision(shipPos, shipRadius = 6) {
    if (!this.active) return null;
    for (const a of this.data) {
      const dx = a.x, dy = a.y, dz = a.z;
      if (Math.abs(dx) < a.scale + shipRadius && Math.abs(dy) < a.scale + shipRadius && Math.abs(dz) < a.scale + shipRadius) {
        // 实例位置即相对偏移（船在原点附近飞行）
        if (dx * dx + dy * dy + dz * dz < (a.scale + shipRadius) ** 2) return a;
      }
    }
    return null;
  }
}

// 跃迁星空拉伸效果：大量线段沿 -Z 铺开，速度越大拉得越长
export class WarpStars {
  constructor(scene) {
    const N = 900;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 6);
    const rng = new SeedRandom(99).fork('warp');
    this.lines = [];
    for (let i = 0; i < N; i++) {
      const x = rng.range(-1600, 1600), y = rng.range(-1600, 1600), z = rng.range(-9000, 9000);
      this.lines.push({ x, y, z, len: 1 });
      positions.set([x, y, z, x, y, z], i * 6);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.9 });
    this.mesh = new THREE.LineSegments(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.geo = geo;
    scene.add(this.mesh);
  }

  update(dt, t01) {
    if (!this.mesh.visible) return;
    const arr = this.geo.attributes.position.array;
    const speed = 2000 + t01 * 26000;
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      l.z -= speed * dt;
      if (l.z < -9000) { l.z += 18000; }
      const len = 4 + t01 * 900;
      arr[i * 6 + 2] = l.z;
      arr[i * 6 + 5] = l.z + len;
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  setVisible(v) { this.mesh.visible = v; }
}

// 扫描波纹：扩散的圆环 shader
export class ScanPulse {
  constructor(scene) {
    const geo = new THREE.RingGeometry(0.92, 1, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3fd0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.t = 1;
    scene.add(this.mesh);
  }
  fire(origin, normal) {
    this.mesh.position.copy(origin);
    this.mesh.lookAt(origin.clone().add(normal));
    this.mesh.visible = true;
    this.t = 0;
  }
  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt * 1.4;
    const s = 4 + this.t * 160;
    this.mesh.scale.setScalar(s);
    this.mesh.material.opacity = Math.max(0, 1 - this.t);
    if (this.t >= 1) this.mesh.visible = false;
  }
}

// 采集粒子反馈
export class ParticleBurst {
  constructor(scene) {
    const N = 120;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6, map: glowTexture(), transparent: true, color: 0xa5ff3f,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.N = N; this.cursor = 0;
    scene.add(this.points);
  }
  burst(at, color = 0xa5ff3f) {
    this.points.material.color.set(color);
    for (let k = 0; k < 24; k++) {
      const i = this.cursor = (this.cursor + 1) % this.N;
      this.pos[i * 3] = at.x; this.pos[i * 3 + 1] = at.y; this.pos[i * 3 + 2] = at.z;
      this.vel[i * 3] = (Math.random() - 0.5) * 14;
      this.vel[i * 3 + 1] = Math.random() * 12;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 14;
      this.life[i] = 1;
    }
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt * 1.2;
      this.vel[i * 3 + 1] -= 18 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    if (any) this.points.geometry.attributes.position.needsUpdate = true;
  }
}
