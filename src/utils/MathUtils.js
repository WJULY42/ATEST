export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(t) { return t * t * (3 - 2 * t); }
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

// 坐标 <-> 离散星区键（星图/存档用）
export function coordKey(x, y, z) { return `${x},${y},${z}`; }
export function parseKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

// 格式化数字显示
export function fmt(n, digits = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}
