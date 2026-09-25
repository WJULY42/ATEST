import * as THREE from 'three';
import './style.css';
import { Input } from './core/Input.js';
import { SceneManager } from './core/SceneManager.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { StarMap } from './ui/StarMap.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { Notifications } from './ui/Notifications.js';
import { generateSystem } from './world/GalaxyGenerator.js';
import { createPlanetMesh } from './world/PlanetGenerator.js';
import { createStation } from './world/SpaceStation.js';
import { Terrain } from './world/Terrain.js';
import { scatterVegetation, scatterResources, createCreature } from './world/Vegetation.js';
import { starSkyTexture, sunGlowTexture } from './world/Textures.js';
import { Ship } from './entities/Ship.js';
import { AsteroidField, WarpStars, ScanPulse, ParticleBurst } from './entities/Asteroid.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { SeedRandom, hashString } from './utils/SeedRandom.js';
import { clamp, damp } from './utils/MathUtils.js';

const app = document.getElementById('app');

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

// ---------- 子系统 ----------
const input = new Input(renderer.domElement);
const scenes = new SceneManager(renderer);
const audio = new AudioEngine();
const hud = new HUD(app);
const notices = new Notifications(app);
const quests = new QuestSystem();
const starmap = new StarMap(app, { onSelect: (s) => startWarpTo(s), onClose: () => closeStarmap() });
const inventoryUI = new InventoryUI(app, { onClose: () => closeInventory() });

// ---------- 全局游戏状态 ----------
const G = {
  running: false,
  paused: false,
  mode: 'space',            // space | landing | ground | warp
  seedStr: '',
  seedNum: 1,
  system: null,             // 当前星系数据
  coord: { x: 0, y: 0, z: 0 },
  time: 0,                  // 昼夜时间
  player: {
    health: 100, shield: 100, oxygen: 100, fuel: 100,
    pos: new THREE.Vector3(0, 0, 6000),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0, roll: 0,
    speed: 0,
    onGround: false, jetting: false,
    thirdPerson: true,
    planet: null,           // 地表模式下的星球参数
    localPos: new THREE.Vector3(), // 地表局部坐标
  },
  inventory: {},
  visitedPlanets: new Set(),
  scannedCreatures: new Set(),
};

// ---------- 太空场景搭建 ----------
const space = scenes.space;
const spaceCam = space.camera;
spaceCam.far = 500000;
spaceCam.near = 2;
spaceCam.updateProjectionMatrix();

const ship = new Ship(space.scene);
const sunLight = new THREE.DirectionalLight(0xfff2d0, 2.4);
sunLight.position.set(8000, 4000, -6000);
space.scene.add(sunLight, new THREE.AmbientLight(0x304060, 0.9));

let skyMesh = null, sunSprite = null;
let planetGroups = [];      // { params, group, angle }
let stationGroup = null;
let asteroids = null, warpStars = null, scanPulse = null, particles = null;

function buildSystem(coord) {
  // 清空旧实体
  for (const pg of planetGroups) space.scene.remove(pg.group);
  if (stationGroup) space.scene.remove(stationGroup);
  if (asteroids) { space.scene.remove(asteroids.mesh); asteroids = null; }
  planetGroups = [];

  G.coord = { ...coord };
  G.system = generateSystem(G.seedNum, coord.x, coord.y, coord.z);
  const sys = G.system;

  // 星空穹顶
  if (skyMesh) space.scene.remove(skyMesh);
  const skyTex = starSkyTexture(sys.name + G.seedNum);
  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(300000, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
  );
  space.scene.add(skyMesh);

  // 恒星光晕
  if (sunSprite) space.scene.remove(sunSprite);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunGlowTexture(), color: new THREE.Color(sys.starColor),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sunSprite.scale.setScalar(sys.starSize * 6);
  sunSprite.position.set(-14000, 3000, -22000);
  space.scene.add(sunSprite);
  sunLight.position.copy(sunSprite.position);

  // 行星
  sys.planets.forEach((p) => {
    const g = createPlanetMesh(p, 'low');
    space.scene.add(g);
    planetGroups.push({ params: p, group: g, angle: p.orbitPhase });
  });

  // 空间站
  if (sys.hasStation) {
    stationGroup = createStation(hashString(`${G.seedNum}:${coord.x},${coord.y},${coord.z}:st`));
    space.scene.add(stationGroup);
  }

  // 小行星带
  asteroids = new AsteroidField(space.scene, hashString(sys.name), 240);

  // 目标锁定初始化
  G.target = nearestBody();
}

let warpStarsRef;

// ---------- 特效（常驻） ----------
scanPulse = new ScanPulse(space.scene);
particles = new ParticleBurst(space.scene);
warpStars = new WarpStars(space.scene);

// ---------- 着陆 / 地表 ----------
const ground = scenes.ground;
ground.camera.near = 0.1;
ground.camera.far = 4000;
ground.camera.updateProjectionMatrix();

let terrain = null, vegMesh = null, resourceList = [], creatureList = [];
let groundSun = null, groundAmbient = null, groundSky = null, groundFogColor = null;
let shipLanded = null, ruinsGroup = null;
let groundParticles = null, groundScan = null;

function enterGround(planetParams, spawnLocal) {
  G.mode = 'ground';
  G.player.planet = planetParams;
  const biome = planetParams.biome;

  // 地面场景布置
  const gscene = ground.scene;
  gscene.background = new THREE.Color(biome.sky);
  gscene.fog = new THREE.Fog(new THREE.Color(biome.fog), 60, 900);

  groundSun = new THREE.DirectionalLight(0xffffff, 2.2);
  groundAmbient = new THREE.AmbientLight(new THREE.Color(biome.sky), 0.85);
  gscene.add(groundSun, groundAmbient);

  terrain = new Terrain(gscene, planetParams);
  const rng = new SeedRandom(planetParams.seed).fork('surf');
  vegMesh = scatterVegetation(gscene, planetParams, terrain, Math.floor(900 * biome.vegetation));
  resourceList = scatterResources(gscene, planetParams, terrain, 30);
  creatureList = [];
  const cCount = Math.floor(rng.range(0, 7) * biome.creatureChance);
  for (let i = 0; i < cCount; i++) {
    const c = createCreature(planetParams.seed * 31 + i, biome);
    const x = rng.range(-400, 400), z = rng.range(-400, 400);
    c.position.set(x, terrain.heightAt(x, z), z);
    gscene.add(c);
    creatureList.push(c);
  }
  ruinsGroup = null;
  if (rng.chance(0.6)) {
    import('./world/SpaceStation.js').then(({ createRuins }) => {
      ruinsGroup = createRuins(planetParams.seed);
      const x = rng.range(-300, 300), z = rng.range(-300, 300);
      ruinsGroup.position.set(x, terrain.heightAt(x, z), z);
      gscene.add(ruinsGroup);
    });
  }
  groundParticles = new ParticleBurst(gscene);
  groundScan = new ScanPulse(gscene);

  // 降落的飞船（放在出生点旁）
  const spawnPos = new THREE.Vector3(8, 0, 60);
  spawnPos.y = terrain.heightAt(spawnPos.x, spawnPos.z);
  shipLanded = new THREE.Group();
  const mini = new Ship(shipLanded);
  mini.group.scale.setScalar(0.9);
  shipLanded.position.copy(spawnPos);
  gscene.add(shipLanded);

  const sp = spawnLocal || new THREE.Vector3(0, 0, 60);
  G.player.localPos.set(sp.x, terrain.heightAt(sp.x, sp.z) + 2.4, sp.z);
  G.player.pos.copy(G.player.localPos);
  G.player.vel.set(0, 0, 0);
  G.player.yaw = 0; G.player.pitch = 0;

  // 任务：探索该星球
  quests.make('visit:' + planetParams.seed, `探索 ${planetParams.name}`, 'visit', 1);
  const done = quests.signal('visit', planetParams);
  for (const q of done) onQuestDone(q);
  G.visitedPlanets.add(planetParams.seed);

  scenes.switchTo('ground');
  audio.land();
  notices.push(`已着陆 · ${planetParams.name} · ${biome.name}`, 'ok');
  if (biome.hazard > 0) notices.push(`环境危害：${biome.hazard > 12 ? '致命高温' : biome.hazard > 7 ? '严寒' : '有毒大气'}，注意生命维持`, 'warn');
}

function exitGround() {
  // 清理地面场景
  const gscene = ground.scene;
  while (gscene.children.length) gscene.remove(gscene.children[0]);
  terrain?.dispose?.();
  terrain = null; vegMesh = null; resourceList = []; creatureList = [];
  groundParticles = null; groundScan = null; shipLanded = null; ruinsGroup = null;

  G.mode = 'space';
  G.player.planet = null;
  const p = G.player;
  p.pos.set(0, 0, 6000);
  p.vel.set(0, 0, -60);
  scenes.switchTo('space');
  input.lock();
  notices.push('重新进入轨道 · ' + G.system.name, 'info');
}

// ---------- 跃迁 ----------
let warp = null;
function startWarpTo(system) {
  closeStarmap();
  const dist = Math.abs(system.coord.x - G.coord.x) + Math.abs(system.coord.y - G.coord.y) + Math.abs(system.coord.z - G.coord.z);
  const cost = dist * 4;
  if (G.player.fuel < cost) {
    notices.push(`燃料不足！跃迁需要 ${cost} 单位`, 'bad');
    return;
  }
  G.player.fuel -= cost;
  G.mode = 'warp';
  warp = { t: 0, dur: 2.6, target: system.coord };
  warpStars.setVisible(true);
  audio.warp();
  starmap.close();
}

function finishWarp() {
  warpStars.setVisible(false);
  G.mode = 'space';
  buildSystem(warp.target);
  const p = G.player;
  p.pos.set(0, 0, 6000); p.vel.set(0, 0, 0);
  p.yaw = 0; p.pitch = 0; p.roll = 0;
  warp = null;
  quests.make('warp:any', '完成一次星图跃迁', 'warp', 1);
  for (const q of quests.signal('warp')) onQuestDone(q);
  notices.push(`抵达 ${G.system.name}`, 'ok');
}

// ---------- 目标与扫描 ----------
function nearestBody() {
  const p = G.player.pos;
  let best = null, bd = Infinity;
  for (const pg of planetGroups) {
    const d = pg.group.position.distanceTo(p) - pg.params.radius;
    if (d < bd) { bd = d; best = { name: pg.params.name, dist: d, ref: pg }; }
  }
  if (stationGroup) {
    const d = stationGroup.position.distanceTo(p);
    if (d < bd) { bd = d; best = { name: '贸易空间站', dist: d, ref: { isStation: true } }; }
  }
  return best;
}

function doScan() {
  audio.scanPing();
  hud.scanPulse();
  if (G.mode === 'ground') {
    const cam = ground.camera;
    groundScan.fire(cam.position.clone().addScaledVector(dirFromCam(), 30), dirFromCam());
    let found = 0;
    for (const c of creatureList) {
      if (c.position.distanceTo(cam.position) < 120 && !c.userData.scanned) {
        c.userData.scanned = true;
        G.scannedCreatures.add(c.userData.name);
        found++;
        notices.push(`扫描到生物：${c.userData.name}${c.userData.hostile ? '（危险！）' : ''}`, 'ok');
        quests.make('scan:any', '扫描外星生物', 'scan', 2);
        for (const q of quests.signal('scan')) onQuestDone(q);
      }
    }
    for (const r of resourceList) {
      if (r.visible && r.position.distanceTo(cam.position) < 150) {
        found++;
        r.material = r.material.clone();
        break; // 只高亮一个避免噪音
      }
    }
    if (!found) notices.push('扫描完成 · 未发现新信号', 'info');
  } else {
    const cam = space.camera;
    scanPulse.fire(cam.position.clone().addScaledVector(dirFromCam(), 200), dirFromCam());
    const t = nearestBody();
    notices.push(t ? `探测到：${t.name} · 距离 ${Math.round(t.dist)}u` : '扫描完成 · 无信号', 'info');
  }
}

const _dir = new THREE.Vector3();
function dirFromCam() {
  const cam = scenes.current.camera;
  cam.getWorldDirection(_dir);
  return _dir;
}

function onQuestDone(q) {
  if (q.done && !q.claimed) {
    q.claimed = true;
    audio.quest();
    notices.push(`任务完成：${q.text}`, 'quest');
    G.player.fuel = clamp(G.player.fuel + 15, 0, 100);
    G.inventory['纳米星核碎片'] = (G.inventory['纳米星核碎片'] || 0) + 1;
  }
}

// ---------- UI 开关 ----------
function openStarmap() {
  if (G.mode !== 'space') { notices.push('星图跃迁仅可在太空中使用', 'warn'); return; }
  starmap.open(G.seedNum, G.coord);
  input.unlock();
}
function closeStarmap() { starmap.close(); if (G.running && !G.paused) input.lock(); }
// 点击画面重新锁定鼠标（Esc 解锁或指针锁定被浏览器拒绝后的恢复手段）
renderer.domElement.addEventListener('pointerdown', () => {
  if (G.running && !G.paused && !starmap.visible && !inventoryUI.visible && !input.mouseLocked) input.lock();
});
function openInventory() {
  inventoryUI.open(G.inventory);
  input.unlock();
}
function closeInventory() { inventoryUI.close(); if (G.running && !G.paused) input.lock(); }

// ---------- 采集 ----------
function tryCollect() {
  if (G.mode !== 'ground') return;
  const cam = ground.camera;
  let best = null, bd = 18;
  for (const r of resourceList) {
    if (!r.visible) continue;
    const d = r.position.distanceTo(cam.position);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) { notices.push('附近没有可采集的资源', 'warn'); return; }
  const res = best.userData.resource;
  G.inventory[res.name] = (G.inventory[res.name] || 0) + res.amount;
  audio.collect();
  groundParticles.burst(best.position, best.material.color.getHex());
  notices.push(`+${res.amount} ${res.name}`, 'ok');
  quests.make('collect:any', '采集资源', 'collect', 3);
  for (const q of quests.signal('collect')) onQuestDone(q);
  // 特殊资源恢复
  if (['氧气', '氧'].includes(res.name)) G.player.oxygen = clamp(G.player.oxygen + 25, 0, 100);
  if (['钠', '氦-3', '二氚托姆', '钚'].includes(res.name)) G.player.fuel = clamp(G.player.fuel + 18, 0, 100);
  if (res.name === '食物' || res.name === '水') G.player.health = clamp(G.player.health + 12, 0, 100);
  best.visible = false;
  setTimeout(() => { best.visible = true; }, 45000);
}

// ---------- 菜单 / 存档 ----------
const menu = new Menu(app, {
  hasSave: SaveSystem.hasSave(),
  newGame: (seedStr) => startGame(seedStr || randomSeedName()),
  continue: () => {
    const s = SaveSystem.load();
    if (!s) return;
    startGame(s.seedStr, s);
  },
  resume: () => setPaused(false),
  save: () => { SaveSystem.save(serializeState()); notices.push('进度已保存', 'ok'); audio.uiClick(); },
  quit: () => { location.reload(); },
  respawn: () => {
    const p = G.player;
    p.health = 80; p.shield = 60; p.oxygen = 100; p.fuel = Math.max(p.fuel, 40);
    Object.keys(G.inventory).forEach((k) => { G.inventory[k] = Math.floor(G.inventory[k] * 0.7); });
    if (G.mode === 'ground') {
      p.localPos.set(0, 0, 60);
      p.localPos.y = terrain.heightAt(0, 60) + 2.4;
    } else {
      p.pos.set(0, 0, 6000); p.vel.set(0, 0, 0);
    }
    menu.hideAll();
    setPaused(false);
    notices.push('你在最近的空间站醒来…货物有损耗。', 'warn');
  },
  setSound: (v) => { audio.enabled = v; },
  setQuality: (v) => { qualityHigh = v; renderer.setPixelRatio(v ? Math.min(devicePixelRatio, 1.75) : 1); },
});

function randomSeedName() {
  const words = ['天鹅座', '猎户臂', '织女', '北落', '参宿', '心宿', '轩辕', '天枢'];
  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function serializeState() {
  const p = G.player;
  return {
    seedStr: G.seedStr, coord: G.coord,
    stats: { health: p.health, shield: p.shield, oxygen: p.oxygen, fuel: p.fuel },
    pos: p.pos.toArray(), inv: G.inventory,
    visited: [...G.visitedPlanets],
    quests: quests.serialize(),
  };
}

function startGame(seedStr, saved) {
  G.seedStr = seedStr;
  G.seedNum = hashString(seedStr);
  audio.init(); audio.resume();
  if (saved) {
    const p = G.player;
    Object.assign(p, saved.stats);
    p.pos.fromArray(saved.pos);
    G.inventory = saved.inv || {};
    G.visitedPlanets = new Set(saved.visited || []);
    quests.load(saved.quests);
    buildSystem(saved.coord || { x: 0, y: 0, z: 0 });
  } else {
    G.inventory = {};
    quests.load([]);
    buildSystem({ x: 0, y: 0, z: 0 });
    quests.make('warp:first', '打开星图(M)并跃迁到新星域', 'warp', 1);
    quests.make('visit:first', '登陆并探索一颗星球', 'visit', 1);
    quests.make('scan:first', '扫描一种外星生物', 'scan', 1);
  }
  G.running = true;
  G.paused = false;
  menu.hideAll();
  hud.show(true);
  input.lock();
  notices.push(`宇宙种子：${seedStr}`, 'quest');
  notices.push(`当前位置：${G.system.name}`, 'info');
}

function setPaused(v) {
  if (!G.running) return;
  G.paused = v;
  menu.show(v ? 'pause' : null);
  if (v) input.unlock(); else input.lock();
}

window.addEventListener('blur', () => { if (G.running && !G.paused && G.mode !== 'warp') setPaused(true); });

// ---------- 更新：太空飞行 ----------
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion(), _euler = new THREE.Euler();

function updateSpace(dt) {
  const p = G.player;
  const m = input.consumeMouse();
  if (input.mouseLocked) {
    p.yaw -= m.x * 0.0022;
    p.pitch -= m.y * 0.0022;
    p.pitch = clamp(p.pitch, -1.5, 1.5);
  }
  const boost = input.down('ShiftLeft') || input.down('ShiftRight');
  const throttle = (input.down('KeyW') ? 1 : 0) + (input.down('KeyS') ? -0.5 : 0);
  const strafeX = input.axis('KeyA', 'KeyD');
  // Space 上升 / Ctrl 下降（地表模式同样使用 Space，但那是另一套逻辑）
  const strafeY = (input.down('Space') ? 1 : 0) - (input.down('ControlLeft') || input.down('ControlRight') ? 1 : 0);

  // 姿态
  _euler.set(p.pitch, p.yaw, p.roll, 'YXZ');
  ship.group.quaternion.setFromEuler(_euler);
  // 滚转（Q/E 或 A/D 侧移时自动倾斜）
  const targetRoll = -strafeX * 0.35;
  p.roll = damp(p.roll, targetRoll, 5, dt);

  _fwd.set(0, 0, -1).applyQuaternion(ship.group.quaternion);
  _right.set(1, 0, 0).applyQuaternion(ship.group.quaternion);

  const maxSpeed = boost ? 1400 : 420;
  const accel = boost ? 900 : 420;
  let thrusting = false;
  if (throttle > 0 && p.fuel > 0) {
    p.vel.addScaledVector(_fwd, accel * throttle * dt);
    thrusting = true;
  } else if (throttle < 0) {
    p.vel.addScaledVector(_fwd, accel * throttle * 0.6 * dt);
    thrusting = true;
  }
  p.vel.addScaledVector(_right, strafeX * 160 * dt);
  p.vel.addScaledVector(_up, strafeY * 160 * dt);
  if (boost && p.fuel > 0) p.fuel = clamp(p.fuel - dt * 1.6, 0, 100);
  // 阻尼 & 限速
  p.vel.multiplyScalar(1 - Math.min(0.9, dt * 0.35));
  if (p.vel.length() > maxSpeed) p.vel.setLength(maxSpeed);
  p.pos.addScaledVector(p.vel, dt);
  p.speed = p.vel.length();
  ship.group.position.copy(p.pos);
  ship.setThrottle(thrusting ? (boost ? 1 : 0.6) : 0.08);
  audio.setEngine(thrusting ? (boost ? 1 : 0.5) : 0.05);

  // 相机跟随（追尾视角）
  const camOffset = new THREE.Vector3(0, 3.2, 12).applyQuaternion(ship.group.quaternion);
  spaceCam.position.lerp(p.pos.clone().add(camOffset), 1 - Math.exp(-10 * dt));
  spaceCam.quaternion.slerp(ship.group.quaternion, 1 - Math.exp(-12 * dt));

  // 天体公转 + 位置
  for (const pg of planetGroups) {
    pg.angle += pg.params.orbitSpeed * dt * 0.25;
    const r = pg.params.orbitRadius;
    pg.group.position.set(
      Math.cos(pg.angle) * r - 12000, Math.sin(pg.angle * 0.7) * r * 0.12,
      Math.sin(pg.angle) * r - 16000
    );
    pg.group.userData.mesh.rotation.y += pg.params.rotationSpeed * dt;
  }
  if (stationGroup) {
    const a = G.system.stationAngle + G.time * 0.008;
    stationGroup.position.set(Math.cos(a) * 7000 - 12000, 300, Math.sin(a) * 7000 - 16000);
    stationGroup.rotation.y += dt * 0.1;
    const b = stationGroup.userData.beacon;
    if (b) b.material.opacity = 0.6 + 0.4 * Math.sin(G.time * 4);
  }
  skyMesh.position.copy(spaceCam.position);

  // 小行星相对滚动 + 撞击
  asteroids.update(dt, spaceCam.position, p.speed);
  if (asteroids.checkCollision(p.pos, 8) && p.shield > 0) {
    p.shield = clamp(p.shield - 22, 0, 100);
    p.vel.multiplyScalar(0.4);
    audio.damage();
    particles.burst(p.pos.clone().addScaledVector(_fwd, -6), 0xff6a3f);
    notices.push('护盾受到撞击！', 'bad');
  }

  // 高度 = 距最近天体表面
  G.target = nearestBody();
  p.altitude = G.target ? Math.max(0, G.target.dist) : 0;

  // 着陆条件
  if (input.hit('KeyG')) {
    if (G.target && G.target.dist < 2600 && !G.target.ref.isStation) {
      const params = G.target.ref.params;
      if (params.biome.gasGiant) {
        notices.push('气态巨行星无法着陆！', 'bad');
      } else {
        scenes.switchTo('space'); // noop
        enterGround(params, new THREE.Vector3(0, 0, 60));
      }
    } else {
      notices.push('靠近一颗星球（<2600u）才能着陆', 'warn');
    }
  }

  // 补给站交互
  if (stationGroup && G.target?.ref?.isStation && G.target.dist < 900) {
    G.hint = '按 E 在空间站补给（燃料/氧气/护盾全满）';
    if (input.hit('KeyE')) {
      p.fuel = 100; p.oxygen = 100; p.shield = 100; p.health = clamp(p.health + 30, 0, 100);
      audio.collect();
      notices.push('补给完成！', 'ok');
    }
  } else G.hint = G.target && G.target.dist < 2600 && !G.target.ref.isStation ? '按 G 着陆 · 按 F 扫描' : '按 F 扫描 · 按 M 星图';
}

// ---------- 更新：地表 ----------
function updateGround(dt) {
  const p = G.player;
  const biome = p.planet.biome;
  const cam = ground.camera;
  const m = input.consumeMouse();
  if (input.mouseLocked) {
    p.yaw -= m.x * 0.0022;
    p.pitch = clamp(p.pitch - m.y * 0.0022, -1.45, 1.45);
  }
  const sprint = input.down('ShiftLeft');
  const run = 14 * (sprint ? 1.8 : 1) * Math.sqrt(biome.gravity);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const mvX = input.axis('KeyA', 'KeyD'), mvZ = input.axis('KeyS', 'KeyW');
  const wish = new THREE.Vector3(fx * mvZ + rx * mvX, 0, fz * mvZ + rz * mvX);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(run);
  p.vel.x = damp(p.vel.x, wish.x, 10, dt);
  p.vel.z = damp(p.vel.z, wish.z, 10, dt);

  // 重力 / 跳跃 / 喷射背包
  const g = 24 * biome.gravity;
  const groundH = terrain.heightAt(p.localPos.x, p.localPos.z);
  p.jetting = input.down('Space') && !p.onGround && p.oxygen > 2;
  if (input.hit('Space') && p.onGround) { p.vel.y = 11 * Math.sqrt(biome.gravity); p.onGround = false; }
  if (p.jetting) { p.vel.y = damp(p.vel.y, 16, 3, dt); p.oxygen = clamp(p.oxygen - dt * 3, 0, 100); }
  else p.vel.y -= g * dt;
  p.localPos.x += p.vel.x * dt;
  p.localPos.z += p.vel.z * dt;
  p.localPos.y += p.vel.y * dt;
  const hNow = terrain.heightAt(p.localPos.x, p.localPos.z);
  const eye = 2.2;
  if (p.localPos.y <= hNow + eye) {
    p.localPos.y = hNow + eye;
    if (p.vel.y < -22) {
      const dmg = (-p.vel.y - 22) * 1.6;
      p.health = clamp(p.health - dmg, 0, 100);
      audio.damage();
      notices.push(`坠落伤害 -${Math.round(dmg)}`, 'bad');
    }
    p.vel.y = 0;
    p.onGround = true;
  } else p.onGround = false;

  // 边界
  const B = 580;
  if (Math.abs(p.localPos.x) > B || Math.abs(p.localPos.z) > B) {
    p.localPos.x = clamp(p.localPos.x, -B, B);
    p.localPos.z = clamp(p.localPos.z, -B, B);
    G.hint = '已到本区块边缘 · 继续飞行探索需返回太空';
  }

  // 相机（第一/三人称）
  if (input.hit('KeyC')) p.thirdPerson = !p.thirdPerson;
  cam.rotation.order = 'YXZ';
  cam.rotation.set(p.pitch, p.yaw, 0);
  if (p.thirdPerson) {
    const back = new THREE.Vector3(Math.sin(p.yaw) * 8, 3.2, Math.cos(p.yaw) * 8);
    cam.position.copy(p.localPos).add(back);
    cam.position.y = Math.max(cam.position.y, terrain.heightAt(cam.position.x, cam.position.z) + 1.6);
    cam.lookAt(p.localPos.clone().add(new THREE.Vector3(0, 1.2, 0)));
  } else {
    cam.position.copy(p.localPos);
  }

  // 太阳昼夜
  const dayT = (G.time % 240) / 240;
  const sunA = dayT * Math.PI * 2;
  groundSun.position.set(Math.cos(sunA) * 300, Math.sin(sunA) * 300 + 40, 120);
  const dayness = clamp(Math.sin(sunA) * 1.4 + 0.4, 0.05, 1);
  groundSun.intensity = 2.4 * dayness;
  groundAmbient.intensity = 0.35 + dayness * 0.6;
  const skyCol = new THREE.Color(biome.sky).lerp(new THREE.Color(0x05070f), 1 - dayness);
  ground.scene.background = skyCol;
  ground.scene.fog.color.copy(skyCol);

  // 生存消耗
  p.oxygen = clamp(p.oxygen - dt * (p.jetting ? 3 : 0.9), 0, 100);
  if (p.oxygen <= 0) p.health = clamp(p.health - dt * 8, 0, 100);
  if (biome.hazard > 0) p.health = clamp(p.health - dt * biome.hazard * 0.06, 0, 100);
  p.shield = clamp(p.shield + dt * 1.5, 0, 100);
  if (p.health <= 0) { die(); return; }

  // 生物漫游
  for (const c of creatureList) {
    const ud = c.userData;
    const toPlayer = new THREE.Vector3().subVectors(p.localPos, c.position);
    const dist = toPlayer.length();
    if (dist < 90) {
      toPlayer.y = 0;
      if (ud.hostile) {
        toPlayer.normalize();
        c.position.addScaledVector(toPlayer, -ud.speed * 1.4 * dt); // 敌对：冲向玩家
        c.position.addScaledVector(toPlayer, ud.speed * 2.8 * dt);
        if (dist < 6) { p.health = clamp(p.health - dt * 14, 0, 100); audio.damage(); }
      } else {
        toPlayer.normalize();
        c.position.addScaledVector(toPlayer, -ud.speed * dt); // 逃跑
      }
      c.lookAt(p.localPos.x, c.position.y, p.localPos.z);
    } else {
      ud.wanderPhase += dt * 0.4;
      c.position.x += Math.cos(ud.wanderPhase) * ud.speed * 0.3 * dt;
      c.position.z += Math.sin(ud.wanderPhase * 1.3) * ud.speed * 0.3 * dt;
    }
    c.position.y = damp(c.position.y, terrain.heightAt(c.position.x, c.position.z), 8, dt);
    const walk = Math.sin(G.time * 8 + ud.wanderPhase) * 0.3;
    ud.legs.forEach((leg, i) => leg.rotation.x = (i % 2 ? walk : -walk));
  }

  // 资源旋转动画
  for (const r of resourceList) if (r.visible) r.rotation.y += dt * 1.2;

  // 采集提示
  let nearRes = null;
  for (const r of resourceList) {
    if (r.visible && r.position.distanceTo(cam.position) < 18) { nearRes = r; break; }
  }
  if (nearRes) G.hint = `按 E 采集 ${nearRes.userData.resource.name}`;
  else if (p.localPos.distanceTo(shipLanded?.position || new THREE.Vector3(9999, 0, 0)) < 25) G.hint = '按 G 登船起飞 · 按 F 扫描';
  else G.hint = '按 F 扫描 · 按 Tab 背包';

  if (input.hit('KeyE')) tryCollect();
  if (input.hit('KeyG')) {
    if (p.localPos.distanceTo(shipLanded.position) < 25) exitGround();
    else notices.push('回到降落的飞船旁才能起飞', 'warn');
  }
  if (input.hit('KeyF')) doScan();

  terrain.update(p.localPos);
  groundScan?.update(dt);
  groundParticles?.update(dt);
  p.speed = Math.hypot(p.vel.x, p.vel.z);
  p.altitude = p.localPos.y - terrain.heightAt(p.localPos.x, p.localPos.z);
  audio.setEngine(0);
}

function die() {
  G.paused = true;
  menu.show('death');
  input.unlock();
}

// ---------- 更新：跃迁演出 ----------
function updateWarp(dt) {
  warp.t += dt / warp.dur;
  const k = clamp(warp.t, 0, 1);
  warpStars.update(dt, Math.sin(k * Math.PI));
  spaceCam.fov = 72 + Math.sin(k * Math.PI) * 40;
  spaceCam.updateProjectionMatrix();
  ship.setThrottle(1);
  if (warp.t >= 1) {
    spaceCam.fov = 72;
    spaceCam.updateProjectionMatrix();
    finishWarp();
  }
}

// ---------- 主循环 ----------
let last = performance.now();
let fpsAccum = 0, fpsFrames = 0, qualityHigh = true;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // 性能自适应：低帧率降低像素比
  fpsAccum += dt; fpsFrames++;
  if (fpsAccum > 2) {
    const fps = fpsFrames / fpsAccum;
    if (fps < 30 && renderer.getPixelRatio() > 1) renderer.setPixelRatio(1);
    fpsAccum = 0; fpsFrames = 0;
  }

  if (G.running && !G.paused) {
    G.time += dt;
    if (input.hit('Escape')) setPaused(true);
    if (!starmap.visible && !inventoryUI.visible) {
      if (input.hit('KeyM')) openStarmap();
      if (input.hit('Tab')) openInventory();
    }
    if (input.hit('KeyF') && G.mode === 'space') doScan();

    if (G.mode === 'space') updateSpace(dt);
    else if (G.mode === 'ground') updateGround(dt);
    else if (G.mode === 'warp') updateWarp(dt);

    scanPulse.update(dt);
    particles.update(dt);

    // HUD
    const p = G.player;
    hud.update({
      health: p.health, shield: p.shield, oxygen: p.oxygen, fuel: p.fuel,
      speed: p.speed || 0, altitude: p.altitude || 0,
      coord: G.mode === 'ground'
        ? `${G.system.name} ${Math.round(p.localPos.x)},${Math.round(p.localPos.y)},${Math.round(p.localPos.z)}`
        : `${G.coord.x},${G.coord.y},${G.coord.z} ${G.system.name}`,
      mode: G.mode,
      yaw: (-p.yaw * 180) / Math.PI,
      target: G.mode === 'space' && G.target ? { name: G.target.name, dist: G.target.dist } : null,
      quests: quests.activeList(),
      hint: G.hint || '',
    });
  }

  if (G.running) scenes.render();
  input.endFrame();
}
requestAnimationFrame(loop);

// 初始渲染一帧背景
renderer.render(space.scene, spaceCam);
