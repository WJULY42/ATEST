import { SeedRandom } from './SeedRandom.js';

// 确定性 3D 值噪声 + fbm（用于行星表面位移、小行星变形等）
function val3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 1440662683 + seed * 1274126177) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function noise3(x, y, z, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  const c000 = val3(xi, yi, zi, seed), c100 = val3(xi + 1, yi, zi, seed);
  const c010 = val3(xi, yi + 1, zi, seed), c110 = val3(xi + 1, yi + 1, zi, seed);
  const c001 = val3(xi, yi, zi + 1, seed), c101 = val3(xi + 1, yi, zi + 1, seed);
  const c011 = val3(xi, yi + 1, zi + 1, seed), c111 = val3(xi + 1, yi + 1, zi + 1, seed);
  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w; // [0,1]
}

export function fbm3(x, y, z, octaves = 4, seed = 1) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

// 一维平滑伪随机曲线（地形剖面用）
export function ridgeNoise(t, seed = 7) {
  return fbm3(t, 0.5, 0.5, 4, seed) * 2 - 1;
}
