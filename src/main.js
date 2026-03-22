import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============================================================
// AUDIO SYSTEM
// ============================================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
document.addEventListener('click', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); });

function playNoise(duration, volume, decay, filterFreq) {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(volume, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  if (filterFreq) {
    const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    src.connect(f); f.connect(g);
  } else { src.connect(g); }
  g.connect(audioCtx.destination);
  src.start();
}

function playTone(freq, freqEnd, type, volume, duration) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
  g.gain.setValueAtTime(volume, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + duration + 0.01);
}

function playShotgunSound() { playNoise(0.15, 0.7, 2, null); playTone(100, 30, 'sine', 0.6, 0.15); }
function playRifleSound() { playNoise(0.1, 0.5, 3, null); playTone(150, 30, 'sine', 0.4, 0.1); }
function playSniperSound() { playNoise(0.2, 0.8, 2, null); playTone(80, 20, 'sine', 0.7, 0.25); playTone(2000, 800, 'sine', 0.15, 0.3); }
function playHitSound() { playTone(800, 1200, 'triangle', 0.3, 0.15); }
function playEnemyDeathSound() { playTone(600, 80, 'sawtooth', 0.25, 0.4); }
function playDamageSound() { playTone(80, 40, 'sine', 0.5, 0.25); playTone(400, 200, 'square', 0.15, 0.15); }
function playEnemyShootSound() { playNoise(0.08, 0.2, 5, 600); }
function playHealSound() { playTone(400, 800, 'sine', 0.3, 0.3); playTone(600, 1000, 'sine', 0.2, 0.3); }
function playPickupSound() { playTone(500, 1000, 'triangle', 0.25, 0.15); }
function playReloadSound() {
  [0, 0.15, 0.4].forEach((t, i) => {
    const f = [1200, 800, 1500][i];
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f, audioCtx.currentTime + t);
    g.gain.setValueAtTime(0, audioCtx.currentTime + t);
    g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.08);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.1);
  });
}
function playWeaponSwitch() { playTone(300, 600, 'triangle', 0.15, 0.1); }

// ============================================================
// DAMAGE DIRECTION INDICATOR
// ============================================================
function showDamageDirection(enemyPos) {
  const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
  const toEnemy = new THREE.Vector3().subVectors(enemyPos, camera.position); toEnemy.y = 0; toEnemy.normalize();
  const cross = camDir.x * toEnemy.z - camDir.z * toEnemy.x;
  const dot = camDir.dot(toEnemy);
  const angle = Math.atan2(cross, dot);
  const absAngle = Math.abs(angle);
  const ind = { top: 0, bottom: 0, left: 0, right: 0 };
  if (absAngle < Math.PI * 0.4) ind.top = 1 - absAngle / (Math.PI * 0.4);
  else if (absAngle > Math.PI * 0.6) ind.bottom = (absAngle - Math.PI * 0.6) / (Math.PI * 0.4);
  if (angle > Math.PI * 0.1) ind.right = Math.min(1, (angle - Math.PI * 0.1) / (Math.PI * 0.4));
  else if (angle < -Math.PI * 0.1) ind.left = Math.min(1, (-angle - Math.PI * 0.1) / (Math.PI * 0.4));
  const maxV = Math.max(ind.top, ind.bottom, ind.left, ind.right);
  if (maxV < 0.3) {
    if (absAngle < Math.PI / 2) ind.top = 0.5; else ind.bottom = 0.5;
    if (angle > 0) ind.right = Math.max(ind.right, 0.5); else ind.left = Math.max(ind.left, 0.5);
  }
  for (const [dir, id] of [['top','dmg-top'],['bottom','dmg-bottom'],['left','dmg-left'],['right','dmg-right']]) {
    if (ind[dir] > 0.1) {
      const el = document.getElementById(id);
      el.style.opacity = String(ind[dir]);
      setTimeout(() => { el.style.opacity = '0'; }, 600);
    }
  }
}

// ============================================================
// WEAPON DEFINITIONS
// ============================================================
const WEAPONS = [
  { name: '샷건', damage: 5, pellets: 5, spread: 0.08, maxAmmo: 8, fireRate: 800, range: 15, reloadTime: 2000, sound: playShotgunSound },
  { name: '라이플', damage: 2, pellets: 1, spread: 0.01, maxAmmo: 30, fireRate: 150, range: 100, reloadTime: 1500, sound: playRifleSound },
  { name: '스나이퍼', damage: 10, pellets: 1, spread: 0, maxAmmo: 5, fireRate: 1200, range: 200, reloadTime: 2500, sound: playSniperSound },
];

// ============================================================
// GAME STATE
// ============================================================
const state = {
  hp: 100, maxHp: 100, score: 0,
  currentWeapon: 1,
  ammo: [8, 30, 5],
  reloading: false, switching: false,
  lastFireTime: 0,
  healKits: 0, maxHealKits: 3,
  inBase: false,
  moveForward: false, moveBackward: false, moveLeft: false, moveRight: false,
  canJump: false,
  velocity: new THREE.Vector3(), direction: new THREE.Vector3(),
  wave: 1, enemiesPerWave: 2, enemiesKilled: 0, waveInProgress: false,
};

// ============================================================
// SCENE SETUP
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 3);
sunLight.position.set(50, 80, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5; sunLight.shadow.camera.far = 200;
sunLight.shadow.camera.left = -100; sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100; sunLight.shadow.camera.bottom = -100;
scene.add(sunLight);

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
instructions.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { blocker.style.display = 'none'; });
controls.addEventListener('unlock', () => { blocker.style.display = 'flex'; });

// ============================================================
// ENVIRONMENT
// ============================================================
// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0x3a7d3a })
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

function createBox(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, ...opts });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Buildings
const buildingPositions = [
  { w: 8, h: 10, d: 8, x: 20, z: 20 }, { w: 6, h: 7, d: 10, x: -25, z: 15 },
  { w: 10, h: 5, d: 6, x: 15, z: -20 }, { w: 5, h: 8, d: 12, x: -20, z: -25 },
  { w: 12, h: 4, d: 4, x: 0, z: 30 }, { w: 4, h: 6, d: 8, x: 35, z: -10 },
  { w: 7, h: 9, d: 7, x: -35, z: -5 }, { w: 15, h: 3, d: 3, x: -10, z: -35 },
];
const buildingColors = [0x888888, 0x777766, 0x665555, 0x556677, 0x887766];
buildingPositions.forEach((b, i) => createBox(b.w, b.h, b.d, buildingColors[i % buildingColors.length], b.x, b.h / 2, b.z));

// Crates
for (let i = 0; i < 15; i++) {
  const s = 1 + Math.random() * 2;
  createBox(s, s, s, 0x8B6914, (Math.random() - 0.5) * 80, s / 2, (Math.random() - 0.5) * 80);
}

// ============================================================
// HEALING BASE (아지트)
// ============================================================
const BASE_POS = new THREE.Vector3(0, 0, -8);
const BASE_SIZE = { w: 10, h: 4, d: 10 };
const BASE_RANGE = 5;

// Floor
createBox(BASE_SIZE.w, 0.1, BASE_SIZE.d, 0x004400, BASE_POS.x, 0.05, BASE_POS.z);

// Walls (transparent green)
const wallMat = new THREE.MeshStandardMaterial({ color: 0x00ff44, transparent: true, opacity: 0.15 });
const wallPositions = [
  { w: BASE_SIZE.w, h: BASE_SIZE.h, d: 0.2, x: 0, z: BASE_SIZE.d / 2 },
  { w: BASE_SIZE.w, h: BASE_SIZE.h, d: 0.2, x: 0, z: -BASE_SIZE.d / 2 },
  { w: 0.2, h: BASE_SIZE.h, d: BASE_SIZE.d, x: -BASE_SIZE.w / 2, z: 0 },
  { w: 0.2, h: BASE_SIZE.h, d: BASE_SIZE.d, x: BASE_SIZE.w / 2, z: 0 },
];
wallPositions.forEach(w => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
  mesh.position.set(BASE_POS.x + w.x, w.h / 2, BASE_POS.z + w.z);
  scene.add(mesh);
});

// Cross on top
const crossMat = new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00ff44, emissiveIntensity: 0.5 });
const crossH = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 0.8), crossMat);
crossH.position.set(BASE_POS.x, BASE_SIZE.h + 0.5, BASE_POS.z);
scene.add(crossH);
const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 3), crossMat);
crossV.position.set(BASE_POS.x, BASE_SIZE.h + 0.5, BASE_POS.z);
scene.add(crossV);

// Green point light inside base
const baseLight = new THREE.PointLight(0x00ff44, 3, 15);
baseLight.position.set(BASE_POS.x, 3, BASE_POS.z);
scene.add(baseLight);

function isInBase() {
  const p = camera.position;
  return Math.abs(p.x - BASE_POS.x) < BASE_SIZE.w / 2 &&
         Math.abs(p.z - BASE_POS.z) < BASE_SIZE.d / 2;
}

// ============================================================
// HEAL KITS
// ============================================================
const healKitDrops = [];

function dropHealKit(position) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00ff44, emissiveIntensity: 0.3 })
  );
  box.position.y = 0.5;
  group.add(box);

  // Cross on kit
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.15), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  ch.position.y = 0.5;
  group.add(ch);
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  cv.position.y = 0.5;
  group.add(cv);

  group.position.copy(position);
  group.position.y = 0;
  scene.add(group);
  healKitDrops.push({ mesh: group, time: 0 });
}

function getNearestKit() {
  let nearest = null, minDist = 3;
  for (const kit of healKitDrops) {
    const dist = camera.position.distanceTo(kit.mesh.position);
    if (dist < minDist) { minDist = dist; nearest = kit; }
  }
  return nearest;
}

function pickupKit() {
  if (state.healKits >= state.maxHealKits) return;
  const kit = getNearestKit();
  if (!kit) return;
  state.healKits++;
  scene.remove(kit.mesh);
  healKitDrops.splice(healKitDrops.indexOf(kit), 1);
  playPickupSound();
  updateHUD();
}

function useHealKit() {
  if (state.healKits <= 0 || state.hp >= state.maxHp) return;
  state.healKits--;
  state.hp = Math.min(state.maxHp, state.hp + 30);
  playHealSound();
  updateHUD();
}

// ============================================================
// ENEMIES
// ============================================================
const enemies = [];
const enemySpeed = 3;

function createEnemy(x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xcc3333 }));
  body.position.y = 1.2; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffcc99 }));
  head.position.y = 2.15; head.castShadow = true; group.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const le = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat); le.position.set(-0.12, 2.2, 0.3); group.add(le);
  const re = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat); re.position.set(0.12, 2.2, 0.3); group.add(re);
  group.position.set(x, 0, z);
  const enemy = { mesh: group, hp: 3, alive: true, lastShot: 0, shootInterval: 2000 + Math.random() * 2000 };
  scene.add(group); enemies.push(enemy);
  return enemy;
}

function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 40;
    createEnemy(Math.cos(a) * d, Math.sin(a) * d);
  }
}

// ============================================================
// WAVE SYSTEM
// ============================================================
function startWave() {
  state.waveInProgress = true; state.enemiesKilled = 0;
  const el = document.getElementById('wave-announce');
  el.textContent = `WAVE ${state.wave}`; el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
  document.getElementById('wave-num').textContent = state.wave;
  document.getElementById('enemies-left').textContent = state.enemiesPerWave;
  spawnEnemies(state.enemiesPerWave);
}

function onEnemyKilled() {
  state.enemiesKilled++;
  document.getElementById('enemies-left').textContent = Math.max(0, state.enemiesPerWave - state.enemiesKilled);
  if (state.enemiesKilled >= state.enemiesPerWave) {
    state.waveInProgress = false; state.wave++; state.enemiesPerWave = state.wave + 1;
    state.hp = Math.min(state.maxHp, state.hp + 20); updateHUD();
    const el = document.getElementById('wave-announce');
    el.textContent = 'WAVE CLEAR!'; el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => startWave(), 1000); }, 2000);
  }
}

startWave();

// ============================================================
// WEAPON MODELS
// ============================================================
const weaponModels = [];

function buildShotgun() {
  const g = new THREE.Group();
  // Wide short barrel
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 })), { position: new THREE.Vector3(0, 0, -0.25) }));
  // Second barrel
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 })), { position: new THREE.Vector3(0, 0.07, -0.25) }));
  // Body
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x443322 })), { position: new THREE.Vector3(0, -0.03, 0.05) }));
  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.08), new THREE.MeshStandardMaterial({ color: 0x331100 }));
  grip.position.set(0, -0.14, 0.1); grip.rotation.x = -0.3; g.add(grip);
  // Pump
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.15), new THREE.MeshStandardMaterial({ color: 0x555555 })), { position: new THREE.Vector3(0, -0.05, -0.15) }));
  return g;
}

function buildRifle() {
  const g = new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshStandardMaterial({ color: 0x222222 })), { position: new THREE.Vector3(0, 0, -0.3) }));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333 })), { position: new THREE.Vector3(0, -0.05, 0) }));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), new THREE.MeshStandardMaterial({ color: 0x442200 }));
  grip.position.set(0, -0.15, 0.08); grip.rotation.x = -0.3; g.add(grip);
  // Magazine
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0x444444 })), { position: new THREE.Vector3(0, -0.15, -0.05) }));
  return g;
}

function buildSniper() {
  const g = new THREE.Group();
  // Long barrel
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })), { position: new THREE.Vector3(0, 0, -0.45) }));
  // Scope
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x111111 })), { position: new THREE.Vector3(0, 0.06, -0.1), rotation: new THREE.Euler(0, 0, Math.PI / 2) }));
  // Scope lens
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 8), new THREE.MeshStandardMaterial({ color: 0x4444ff, emissive: 0x2222ff, emissiveIntensity: 0.3 })), { position: new THREE.Vector3(0, 0.06, -0.2), rotation: new THREE.Euler(0, 0, Math.PI / 2) }));
  // Body
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.35), new THREE.MeshStandardMaterial({ color: 0x2a2a2a })), { position: new THREE.Vector3(0, -0.04, 0) }));
  // Stock
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0x442200 })), { position: new THREE.Vector3(0, -0.04, 0.25) }));
  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), new THREE.MeshStandardMaterial({ color: 0x331100 }));
  grip.position.set(0, -0.14, 0.08); grip.rotation.x = -0.3; g.add(grip);
  return g;
}

weaponModels.push(buildShotgun(), buildRifle(), buildSniper());

// Muzzle flash (shared)
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
muzzleFlash.visible = false;

// Attach default weapon
let activeGunGroup = weaponModels[state.currentWeapon];
activeGunGroup.position.set(0.25, -0.25, -0.5);
muzzleFlash.position.set(0, 0, -0.6);
activeGunGroup.add(muzzleFlash);
camera.add(activeGunGroup);
scene.add(camera);

function switchWeapon(index) {
  if (index === state.currentWeapon || state.switching || state.reloading) return;
  state.switching = true;
  playWeaponSwitch();

  // Remove old
  activeGunGroup.remove(muzzleFlash);
  camera.remove(activeGunGroup);

  state.currentWeapon = index;
  activeGunGroup = weaponModels[index];
  activeGunGroup.position.set(0.25, -0.25, -0.5);
  muzzleFlash.position.set(0, 0, -0.6);
  activeGunGroup.add(muzzleFlash);
  camera.add(activeGunGroup);

  // Switch animation
  activeGunGroup.position.y = -0.6;
  const startY = -0.6, endY = -0.25;
  const startTime = performance.now();
  function animSwitch() {
    const t = Math.min(1, (performance.now() - startTime) / 300);
    activeGunGroup.position.y = startY + (endY - startY) * t;
    if (t < 1) requestAnimationFrame(animSwitch);
    else state.switching = false;
  }
  animSwitch();

  updateHUD();
}

// ============================================================
// BULLET TRAILS
// ============================================================
const bulletTrails = [];
function createBulletTrail(from, to) {
  const geom = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
  const line = new THREE.Line(geom, mat);
  scene.add(line); bulletTrails.push({ line, time: 0.1 });
}

// ============================================================
// SHOOTING
// ============================================================
const raycaster = new THREE.Raycaster();

function shoot() {
  const now = performance.now();
  const weapon = WEAPONS[state.currentWeapon];
  if (state.reloading || state.switching) return;
  if (state.ammo[state.currentWeapon] <= 0) return;
  if (now - state.lastFireTime < weapon.fireRate) return;

  state.lastFireTime = now;
  state.ammo[state.currentWeapon]--;
  weapon.sound();

  // Muzzle flash
  muzzleFlash.visible = true;
  setTimeout(() => { muzzleFlash.visible = false; }, 50);

  // Recoil
  activeGunGroup.rotation.x = -0.15;
  setTimeout(() => { activeGunGroup.rotation.x = 0; }, 80);

  // Fire pellets
  for (let p = 0; p < weapon.pellets; p++) {
    const spreadX = (Math.random() - 0.5) * weapon.spread * 2;
    const spreadY = (Math.random() - 0.5) * weapon.spread * 2;
    const shootDir = new THREE.Vector2(spreadX, spreadY);
    raycaster.setFromCamera(shootDir, camera);
    raycaster.far = weapon.range;

    const enemyMeshes = enemies.filter(e => e.alive).flatMap(e => e.mesh.children);
    const hits = raycaster.intersectObjects(enemyMeshes);

    const gunWorldPos = new THREE.Vector3();
    activeGunGroup.getWorldPosition(gunWorldPos);

    if (hits.length > 0) {
      createBulletTrail(gunWorldPos, hits[0].point);
      const hitObj = hits[0].object;
      for (const enemy of enemies) {
        if (!enemy.alive || !enemy.mesh.children.includes(hitObj)) continue;
        enemy.hp -= weapon.damage;
        hitObj.material.emissive = new THREE.Color(0xff0000);
        setTimeout(() => { hitObj.material.emissive = new THREE.Color(0x000000); }, 100);
        playHitSound();
        if (enemy.hp <= 0) {
          enemy.alive = false;
          scene.remove(enemy.mesh);
          state.score += 100;
          playEnemyDeathSound();
          onEnemyKilled();
          // 30% chance to drop heal kit
          if (Math.random() < 0.3) dropHealKit(enemy.mesh.position);
        }
        showHitMarker();
        break;
      }
    } else {
      const dir = raycaster.ray.direction.clone().multiplyScalar(weapon.range).add(raycaster.ray.origin);
      createBulletTrail(gunWorldPos, dir);
    }
  }

  updateHUD();
  if (state.ammo[state.currentWeapon] <= 0) reload();
}

function reload() {
  const weapon = WEAPONS[state.currentWeapon];
  if (state.reloading || state.ammo[state.currentWeapon] === weapon.maxAmmo) return;
  state.reloading = true;
  playReloadSound();
  document.getElementById('ammo').textContent = '재장전 중...';
  setTimeout(() => {
    state.ammo[state.currentWeapon] = weapon.maxAmmo;
    state.reloading = false;
    updateHUD();
  }, weapon.reloadTime);
}

function showHitMarker() {
  const el = document.getElementById('hit-marker');
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 200);
}

// ============================================================
// ENEMY AI
// ============================================================
function updateEnemies(delta) {
  const playerPos = camera.position;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const pos = enemy.mesh.position;
    const dist = pos.distanceTo(playerPos);
    enemy.mesh.lookAt(playerPos.x, 0, playerPos.z);
    if (dist > 8) {
      const dir = new THREE.Vector3().subVectors(playerPos, pos).normalize();
      pos.x += dir.x * enemySpeed * delta;
      pos.z += dir.z * enemySpeed * delta;
    }
    const now = performance.now();
    if (dist < 40 && now - enemy.lastShot > enemy.shootInterval) {
      enemy.lastShot = now;
      playEnemyShootSound();
      takeDamage(5 + Math.floor(Math.random() * 5), pos);
    }
  }
}

function takeDamage(amount, enemyPos) {
  state.hp = Math.max(0, state.hp - amount);
  updateHUD(); playDamageSound();
  if (enemyPos) showDamageDirection(enemyPos);
  document.body.style.boxShadow = 'inset 0 0 100px rgba(255,0,0,0.4)';
  setTimeout(() => { document.body.style.boxShadow = 'none'; }, 200);
  if (state.hp <= 0) gameOver();
}

function gameOver() {
  controls.unlock();
  instructions.innerHTML = `
    <h1>GAME OVER</h1>
    <p>최종 점수: ${state.score}<br>도달 웨이브: ${state.wave}</p>
    <p style="margin-top: 20px;">클릭하여 다시 시작</p>
  `;
  instructions.onclick = () => {
    state.hp = state.maxHp;
    state.ammo = WEAPONS.map(w => w.maxAmmo);
    state.score = 0; state.reloading = false; state.switching = false;
    state.healKits = 0;
    state.wave = 1; state.enemiesPerWave = 2; state.enemiesKilled = 0;
    switchWeapon(1);
    updateHUD();
    enemies.forEach(e => { if (e.alive) scene.remove(e.mesh); });
    enemies.length = 0;
    healKitDrops.forEach(k => scene.remove(k.mesh));
    healKitDrops.length = 0;
    camera.position.set(0, 2, 0);
    controls.lock();
    startWave();
  };
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD() {
  document.getElementById('hp-text').textContent = state.hp;
  const hpPct = state.hp / state.maxHp * 100;
  const hpFill = document.getElementById('hp-bar-fill');
  hpFill.style.width = hpPct + '%';
  hpFill.style.background = state.hp > 60 ? '#4f4' : state.hp > 30 ? '#ff4' : '#f44';

  const weapon = WEAPONS[state.currentWeapon];
  if (!state.reloading) {
    document.getElementById('ammo').textContent = state.ammo[state.currentWeapon] + ' / ' + weapon.maxAmmo;
  }
  document.getElementById('score-value').textContent = state.score;
  document.getElementById('heal-kit-count').textContent = state.healKits;

  // Weapon slots
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById('slot-' + i);
    slot.className = i === state.currentWeapon ? 'weapon-slot active' : 'weapon-slot';
    document.getElementById('slot-ammo-' + i).textContent = state.ammo[i] + '/' + WEAPONS[i].maxAmmo;
  }
}

// ============================================================
// INPUT
// ============================================================
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': state.moveForward = true; break;
    case 'KeyS': state.moveBackward = true; break;
    case 'KeyA': state.moveLeft = true; break;
    case 'KeyD': state.moveRight = true; break;
    case 'Space':
      if (state.canJump) { state.velocity.y = 8; state.canJump = false; }
      break;
    case 'KeyR': reload(); break;
    case 'KeyF': pickupKit(); break;
    case 'KeyQ': useHealKit(); break;
    case 'Digit1': switchWeapon(0); break;
    case 'Digit2': switchWeapon(1); break;
    case 'Digit3': switchWeapon(2); break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': state.moveForward = false; break;
    case 'KeyS': state.moveBackward = false; break;
    case 'KeyA': state.moveLeft = false; break;
    case 'KeyD': state.moveRight = false; break;
  }
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && controls.isLocked) shoot();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// GAME LOOP
// ============================================================
const clock = new THREE.Clock();
let healTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  if (controls.isLocked) {
    // Gravity
    state.velocity.y -= 20 * delta;

    // Movement
    state.direction.z = Number(state.moveForward) - Number(state.moveBackward);
    state.direction.x = Number(state.moveRight) - Number(state.moveLeft);
    state.direction.normalize();

    const speed = 15;
    state.velocity.z = (state.moveForward || state.moveBackward) ? -state.direction.z * speed : 0;
    state.velocity.x = (state.moveLeft || state.moveRight) ? -state.direction.x * speed : 0;

    controls.moveRight(-state.velocity.x * delta);
    controls.moveForward(-state.velocity.z * delta);
    camera.position.y += state.velocity.y * delta;

    if (camera.position.y < 2) { state.velocity.y = 0; camera.position.y = 2; state.canJump = true; }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -140, 140);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -140, 140);

    updateEnemies(delta);

    // Healing base check
    const wasInBase = state.inBase;
    state.inBase = isInBase();
    const baseEl = document.getElementById('base-indicator');
    baseEl.style.opacity = state.inBase ? '1' : '0';

    if (state.inBase && state.hp < state.maxHp) {
      healTimer += delta;
      if (healTimer >= 0.2) { // 5 HP per second = 1 HP per 0.2s
        state.hp = Math.min(state.maxHp, state.hp + 1);
        updateHUD();
        healTimer -= 0.2;
      }
    } else {
      healTimer = 0;
    }

    // Pickup prompt
    const nearKit = getNearestKit();
    document.getElementById('pickup-prompt').style.opacity = nearKit ? '1' : '0';

    // Rotate heal kit drops
    for (const kit of healKitDrops) {
      kit.time += delta;
      kit.mesh.children[0].rotation.y = kit.time * 2;
      kit.mesh.children[0].position.y = 0.5 + Math.sin(kit.time * 3) * 0.15;
    }
  }

  // Update bullet trails
  for (let i = bulletTrails.length - 1; i >= 0; i--) {
    bulletTrails[i].time -= delta;
    if (bulletTrails[i].time <= 0) {
      scene.remove(bulletTrails[i].line);
      bulletTrails[i].line.geometry.dispose();
      bulletTrails[i].line.material.dispose();
      bulletTrails.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

animate();
updateHUD();
