import { SeedRandom, hashString } from '../utils/SeedRandom.js';
import { generatePlanetParams } from './Biome.js';

const GALAXY_NAMES_A = ['因维', '猎户', '仙女', '天鹅', '半人马', '天龙', '飞马', '巨蟹', '南十字', '天琴'];
const GALAXY_NAMES_B = ['旋涡', '星域', '云带', '环带', '深渊', '走廊', '集群', '边疆'];

// 一个"星系区域"(system)：中心恒星 + 若干行星，位于离散坐标 (x,y,z)
export function generateSystem(seed, gx, gy, gz) {
  const key = hashString(`${seed}:${gx},${gy},${gz}`);
  const rng = new SeedRandom(key).fork('sys');
  const planetCount = rng.int(3, 6);
  const planets = [];
  let orbit = rng.range(2600, 4200);
  for (let i = 0; i < planetCount; i++) {
    const p = generatePlanetParams(key, i);
    orbit += rng.range(2600, 5200) * (p.biome.gasGiant ? 1.6 : 1);
    p.orbitRadius = orbit;
    planets.push(p);
  }
  return {
    coord: { x: gx, y: gy, z: gz },
    name: rng.pick(GALAXY_NAMES_A) + rng.pick(GALAXY_NAMES_B) + ' ' + rng.int(1, 999),
    starColor: rng.pick(['#ffd870', '#ffb050', '#fff0c0', '#90c8ff', '#ff9070']),
    starSize: rng.range(700, 1600),
    asteroidBelt: rng.chance(0.5) ? rng.range(9000, 16000) : 0,
    hasStation: rng.chance(0.75),
    stationAngle: rng.range(0, Math.PI * 2),
    planets,
  };
}

// 星图：以 origin 为中心生成一片可跃迁的星区网格
export function generateSector(seed, origin, radius = 2) {
  const systems = [];
  const rng = new SeedRandom(hashString(`${seed}:sector`)).fork('jitter');
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const c = { x: origin.x + x, y: origin.y + y, z: origin.z + z };
        const sys = generateSystem(seed, c.x, c.y, c.z);
        // 星图上加入轻微抖动，避免完美网格
        sys.mapPos = {
          x: c.x + rng.range(-0.3, 0.3),
          y: c.y + rng.range(-0.3, 0.3),
          z: c.z + rng.range(-0.3, 0.3),
        };
        systems.push(sys);
      }
    }
  }
  return systems;
}
