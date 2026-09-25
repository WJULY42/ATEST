import { SeedRandom } from '../utils/SeedRandom.js';

// 星球生态类型：颜色、重力、资源、生物等参数的来源
export const BIOMES = [
  {
    id: 'verdant', name: '翠绿行星', palette: ['#1d4a2b', '#3f8f45', '#7ec850', '#c9e58a'],
    atmosphere: '#6fe89a', sky: '#8fd8ff', fog: '#a8e0c0', water: true,
    gravity: 1.0, hazard: 0, vegetation: 1.0,
    resources: { 碳: 0.4, 铁氧体: 0.25, 氧气: 0.35, 植物纤维: 0.4 },
    creatureChance: 0.9,
  },
  {
    id: 'molten', name: '熔岩行星', palette: ['#1a0905', '#571507', '#a63a12', '#ff8a3c'],
    atmosphere: '#ff5a2a', sky: '#4a1206', fog: '#661c08', water: false,
    gravity: 1.2, hazard: 14, vegetation: 0.15,
    resources: { 铁: 0.5, 铜: 0.35, 钠: 0.3, 二氚托姆: 0.15 },
    creatureChance: 0.3,
  },
  {
    id: 'frozen', name: '冰封行星', palette: ['#7a96b8', '#a8c4dd', '#d8ecff', '#ffffff'],
    atmosphere: '#9adfff', sky: '#bfe0ff', fog: '#cfe6f5', water: true,
    gravity: 0.8, hazard: 8, vegetation: 0.25,
    resources: { 冰: 0.6, 氧: 0.3, 钴: 0.2, 盐: 0.3 },
    creatureChance: 0.35,
  },
  {
    id: 'toxic', name: '剧毒行星', palette: ['#22330a', '#5a7a12', '#a8c832', '#e8ff5a'],
    atmosphere: '#b8ff3f', sky: '#3a4a12', fog: '#5a6a1a', water: false,
    gravity: 0.95, hazard: 18, vegetation: 0.6,
    resources: { 硫化物: 0.5, 毒囊: 0.3, 碳: 0.3, 金: 0.1 },
    creatureChance: 0.8,
  },
  {
    id: 'lush', name: '丰饶行星', palette: ['#123a52', '#1e7a6a', '#4ac878', '#ffd86a'],
    atmosphere: '#4affd0', sky: '#7adfff', fog: '#8ae8d8', water: true,
    gravity: 1.0, hazard: 0, vegetation: 1.2,
    resources: { 食物: 0.5, 水: 0.5, 碳: 0.3, 纳米星核碎片: 0.08 },
    creatureChance: 1.0,
  },
  {
    id: 'arid', name: '荒漠行星', palette: ['#4a2c12', '#8a5a24', '#c89050', '#f0d0a0'],
    atmosphere: '#ffb060', sky: '#d8a060', fog: '#c89860', water: false,
    gravity: 0.9, hazard: 6, vegetation: 0.1,
    resources: { 铁: 0.35, 硅: 0.45, 盐: 0.3, 钚: 0.05 },
    creatureChance: 0.4,
  },
  {
    id: 'gas', name: '气态巨行星', palette: ['#2a1a4a', '#6a4a9a', '#c890d8', '#ffd8a0'],
    atmosphere: '#c890ff', sky: '#3a2a5a', fog: '#5a4a7a', water: false,
    gravity: 2.2, hazard: 10, vegetation: 0, gasGiant: true,
    resources: { '氦-3': 0.6, 二氚托姆: 0.3 },
    creatureChance: 0,
  },
  {
    id: 'oceanic', name: '海洋行星', palette: ['#062a4a', '#0a5a8a', '#2a9ac8', '#8ae8ff'],
    atmosphere: '#3fd0ff', sky: '#6ac8ff', fog: '#7ad0f0', water: true,
    gravity: 1.0, hazard: 2, vegetation: 0.5,
    resources: { 水: 0.6, 氧: 0.4, 食物: 0.3, 金: 0.1 },
    creatureChance: 0.7,
  },
];

export function biomeName(id) {
  const b = BIOMES.find((x) => x.id === id);
  return b ? b.name : id;
}

// 程序化生成一颗星球的完整参数（确定性）
const PREFIXES = ['泽塔', '科瓦', '乌鲁', '新赫', '泰拉', '奥米', '克西', '瑞亚', '梵天', '尼伯'];
const SUFFIXES = ['Prime', 'IV', '-9', 'Major', 'Minor', 'II', 'VII', '-X', 'Alpha', '贝塔'];

export function generatePlanetParams(seed, index) {
  const rng = new SeedRandom(seed).fork('planet' + index);
  const biome = rng.pick(BIOMES);
  const radius = biome.gasGiant ? rng.range(3200, 5200) : rng.range(900, 2200);
  return {
    index,
    seed: (seed * 2654435761 + index * 9781 + 7) >>> 0,
    name: rng.pick(PREFIXES) + '-' + rng.int(10, 99) + ' ' + rng.pick(SUFFIXES),
    biome,
    radius,
    orbitRadius: 0, // 由星系生成器填充
    orbitSpeed: rng.range(0.004, 0.02),
    orbitPhase: rng.range(0, Math.PI * 2),
    rotationSpeed: rng.range(0.01, 0.05) * rng.sign(),
    axialTilt: rng.range(-0.4, 0.4),
    hasRing: !biome.gasGiant && rng.chance(0.18),
    moons: rng.int(biome.gasGiant ? 1 : 0, biome.gasGiant ? 3 : 1),
    weather: rng.chance(0.5) ? { type: biome.water ? 'rain' : 'storm', intensity: rng.range(0.3, 1) } : null,
    dayLength: rng.range(120, 600),
  };
}
