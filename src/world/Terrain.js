import * as THREE from 'three';
import { fbm3 } from '../utils/Noise.js';
import { SeedRandom } from '../utils/SeedRandom.js';

// 行星地表：以玩家为中心的网格 + 3D fbm 高度场（切平面局部坐标）
// height(x,z) = fbm3(worldDir) —— 确定性，跨区块无缝
export class Terrain {
  constructor(scene, planetParams) {
    this.scene = scene;
    this.params = planetParams;
    this.size = 1200;      // 地块边长
    this.segments = 96;    // 网格细分
    this.heightScale = planetParams.biome.gasGiant ? 0 : 42;
    this.seed = planetParams.seed & 0xffff;

    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    this.basePos = Float32Array.from(geo.attributes.position.array);
    this.geo = geo;

    const { groundColor, rockColor, grassColor } = pickTerrainColors(planetParams);
    import('../world/Textures.js').then(({ terrainTexture }) => {
      const tex = terrainTexture(this.seed, groundColor, rockColor, grassColor);
      tex.repeat.set(8, 8);
      this.mesh.material.map = tex;
      this.mesh.material.needsUpdate = true;
    });

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(groundColor), roughness: 1, metalness: 0, flatShading: true,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    // 水面
    if (planetParams.biome.water) {
      const waterMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(planetParams.biome.atmosphere).multiplyScalar(0.5),
        transparent: true, opacity: 0.75, roughness: 0.25, metalness: 0.35,
      });
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(this.size * 2, this.size * 2), waterMat);
      this.water.rotation.x = -Math.PI / 2;
      this.water.position.y = -6;
      scene.add(this.water);
    }
    this._offset = new THREE.Vector3();
  }

  // 局部切平面坐标 -> 高度
  heightAt(x, z) {
    const p = this.params;
    const R = 1; // 归一化采样
    const n = fbm3(
      x * 0.004 + p.index * 13.7,
      0.5,
      z * 0.004 + p.index * 7.3,
      5, this.seed
    );
    let h = (n - 0.45) * 2 * this.heightScale;
    const ridge = fbm3(x * 0.0012, 2.5, z * 0.0012, 3, this.seed + 55);
    h += Math.pow(Math.abs(ridge * 2 - 1), 0.7) * this.heightScale * 0.9;
    return h;
  }

  update(playerLocalPos) {
    // 区块跟随：网格中心对齐到玩家位置（取整到格），重算顶点高度
    const step = this.size / this.segments;
    const ox = Math.round(playerLocalPos.x / step) * step;
    const oz = Math.round(playerLocalPos.z / step) * step;
    const pos = this.geo.attributes.position;
    const arr = pos.array;
    if (ox !== this._offset.x || oz !== this._offset.z || !this._built) {
      this._offset.set(ox, 0, oz);
      for (let i = 0; i < arr.length; i += 3) {
        const bx = this.basePos[i] + ox;
        const bz = this.basePos[i + 2] + oz;
        arr[i] = bx;
        arr[i + 1] = this.heightAt(bx, bz);
        arr[i + 2] = bz;
      }
      pos.needsUpdate = true;
      this.geo.computeVertexNormals();
      this._built = true;
    }
    this.mesh.position.set(0, 0, 0);
    if (this.water) this.water.position.set(ox, -6, oz);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geo.dispose();
    if (this.water) this.scene.remove(this.water);
  }
}

function pickTerrainColors(p) {
  const pal = p.biome.palette;
  return { groundColor: pal[1], rockColor: pal[0], grassColor: pal[2] };
}
