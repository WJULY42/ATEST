import * as THREE from 'three';
import { SeedRandom } from '../utils/SeedRandom.js';
import { fbm3 } from '../utils/Noise.js';

// 所有纹理均由 Canvas / 数学程序化生成，不加载外部图片
const cache = new Map();

function canvasTexture(size, draw, opts = {}) {
  const key = opts.key || null;
  if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (key) cache.set(key, tex);
  return tex;
}

// 柔和光点（星星、粒子、辉光通用）
export function glowTexture() {
  return canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, { key: 'glow' });
}

// 星空穹顶（equirectangular）
export function starSkyTexture(seed, nebulaColorA = '#2a1a5e', nebulaColorB = '#0e3a5e') {
  const rng = new SeedRandom(seed);
  return canvasTexture(2048, (ctx, s) => {
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, s, s);
    // 星云：多层随机软斑 + fbm 噪点
    const h = s / 2;
    for (let i = 0; i < 26; i++) {
      const x = rng.range(0, s), y = rng.range(h * 0.15, h * 1.6);
      const r = rng.range(h * 0.12, h * 0.7);
      const col = rng.chance(0.5) ? nebulaColorA : nebulaColorB;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col + '55');
      g.addColorStop(0.5, col + '22');
      g.addColorStop(1, col + '00');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 星点
    const count = 2600;
    for (let i = 0; i < count; i++) {
      const x = rng.range(0, s), y = rng.range(0, s);
      const b = Math.pow(rng.next(), 2.5);
      const r = b > 0.85 ? rng.range(1.2, 2.2) : rng.range(0.4, 1.0);
      const tint = rng.chance(0.15)
        ? `rgba(${180 + rng.int(60)},${190 + rng.int(50)},255,`
        : 'rgba(255,255,255,';
      ctx.fillStyle = tint + (0.35 + b * 0.65) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { key: `sky-${seed}` });
}

// 行星表面纹理：基于 biome 配色 + fbm 条带/斑块
export function planetTexture(seed, colors, hasWater, atmosphereColor) {
  const rng = new SeedRandom(seed);
  return canvasTexture(1024, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    const d = img.data;
    const pal = colors.map((c) => {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });
    const waterCol = hexToRgb(atmosphereColor || '#3fd0ff');
    const sd = rng.int(1, 9999);
    const banding = rng.range(0, 1); // 气态巨行星条带程度
    for (let y = 0; y < s; y++) {
      const v = y / s;
      for (let x = 0; x < s; x++) {
        const u = x / s;
        // 球面坐标采样 3D fbm，避免接缝
        const theta = u * Math.PI * 2, phi = v * Math.PI;
        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);
        let n = fbm3(px * 3, py * 3, pz * 3, 5, sd);
        n = n * (1 - banding) + (0.5 + 0.5 * Math.sin(py * 14 + fbm3(px * 6, py * 6, pz * 6, 3, sd) * 6)) * banding;
        const idx = (y * s + x) * 4;
        let col;
        if (hasWater && n < 0.42) {
          const t = Math.min(1, (0.42 - n) * 6);
          col = mixRgb(samplePal(pal, n), waterCol, 0.55 + t * 0.35);
        } else {
          col = samplePal(pal, n);
        }
        // 极冠
        const lat = Math.abs(py);
        if (lat > 0.82) {
          const t = Math.min(1, (lat - 0.82) / 0.12);
          col = mixRgb(col, [235, 240, 255], t * 0.9);
        }
        d[idx] = col[0]; d[idx + 1] = col[1]; d[idx + 2] = col[2]; d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, { key: `planet-${seed}` });
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function samplePal(pal, t) {
  t = Math.max(0, Math.min(0.9999, t));
  const f = t * (pal.length - 1);
  const i = Math.floor(f);
  return mixRgb(pal[i], pal[Math.min(i + 1, pal.length - 1)], f - i);
}

// 低多边形地表贴图（第一人称地形）
export function terrainTexture(seed, groundColor, rockColor, grassColor) {
  const rng = new SeedRandom(seed);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = rng.range(0, s), y = rng.range(0, s), r = rng.range(2, 26);
      ctx.fillStyle = (rng.chance(0.5) ? rockColor : grassColor) + '33';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { key: `terrain-${seed}`, wrap: true });
}

// 空间站外壳贴图：金属板 + 霓虹窗带
export function stationTexture(seed) {
  const rng = new SeedRandom(seed);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#39404f';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#454d5f' : '#333a48';
      ctx.fillRect(0, y, s, 30);
      ctx.strokeStyle = '#20242e';
      ctx.strokeRect(-2, y, s + 4, 32);
    }
    const neon = rng.pick(['#3fd0ff', '#ff3fd0', '#a5ff3f']);
    for (let y = 16; y < s; y += 64) {
      ctx.fillStyle = neon;
      ctx.globalAlpha = 0.9;
      for (let x = 8; x < s; x += 24) {
        if (rng.chance(0.7)) ctx.fillRect(x, y, 12, 6);
      }
      ctx.globalAlpha = 1;
    }
  }, { key: `station-${seed}`, wrap: true });
}

// 太阳光晕 sprite
export function sunGlowTexture() {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.15, 'rgba(255,230,160,0.85)');
    g.addColorStop(0.4, 'rgba(255,190,90,0.25)');
    g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, { key: 'sunglow' });
}
