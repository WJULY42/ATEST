// 种子随机数：mulberry32，同一 seed 可复现同一宇宙
export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class SeedRandom {
  constructor(seed) {
    if (typeof seed === 'string') seed = hashString(seed);
    this.seed = (seed >>> 0) || 1;
    this.state = this.seed;
  }

  next() {
    // mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.chance(0.5) ? -1 : 1; }

  // 派生子流：不同用途互不干扰
  fork(salt = 0) {
    return new SeedRandom((this.seed ^ (hashString(String(salt)) * 2654435761)) >>> 0);
  }
}
