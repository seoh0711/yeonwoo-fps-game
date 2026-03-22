import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- Game State ---
const state = {
  hp: 100,
  maxHp: 100,
  ammo: 30,
  maxAmmo: 30,
  score: 0,
  reloading: false,
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  canJump: false,
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
};

// --- Scene Setup ---
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

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 3);
sunLight.position.set(50, 80, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 200;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
scene.add(sunLight);

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { blocker.style.display = 'none'; });
controls.addEventListener('unlock', () => { blocker.style.display = 'flex'; });

// --- Ground ---
const groundGeom = new THREE.PlaneGeometry(300, 300);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a7d3a });
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- Walls / Buildings ---
function createBox(w, h, d, color, x, y, z) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const obstacles = [];

// Buildings / cover
const buildingPositions = [
  { w: 8, h: 10, d: 8, x: 20, z: 20 },
  { w: 6, h: 7, d: 10, x: -25, z: 15 },
  { w: 10, h: 5, d: 6, x: 15, z: -20 },
  { w: 5, h: 8, d: 12, x: -20, z: -25 },
  { w: 12, h: 4, d: 4, x: 0, z: 30 },
  { w: 4, h: 6, d: 8, x: 35, z: -10 },
  { w: 7, h: 9, d: 7, x: -35, z: -5 },
  { w: 15, h: 3, d: 3, x: -10, z: -35 },
];

const buildingColors = [0x888888, 0x777766, 0x665555, 0x556677, 0x887766];
buildingPositions.forEach((b, i) => {
  const color = buildingColors[i % buildingColors.length];
  const box = createBox(b.w, b.h, b.d, color, b.x, b.h / 2, b.z);
  obstacles.push(box);
});

// Crates for cover
for (let i = 0; i < 15; i++) {
  const size = 1 + Math.random() * 2;
  const x = (Math.random() - 0.5) * 80;
  const z = (Math.random() - 0.5) * 80;
  const crate = createBox(size, size, size, 0x8B6914, x, size / 2, z);
  obstacles.push(crate);
}

// --- Enemies ---
const enemies = [];
const enemySpeed = 3;

function createEnemy(x, z) {
  const group = new THREE.Group();

  // Body
  const bodyGeom = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeom = new THREE.SphereGeometry(0.35, 8, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 2.15;
  head.castShadow = true;
  group.add(head);

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.06, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.position.set(-0.12, 2.2, 0.3);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
  rightEye.position.set(0.12, 2.2, 0.3);
  group.add(rightEye);

  group.position.set(x, 0, z);

  const enemy = {
    mesh: group,
    hp: 3,
    alive: true,
    lastShot: 0,
    shootInterval: 2000 + Math.random() * 2000,
  };

  scene.add(group);
  enemies.push(enemy);
  return enemy;
}

function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 40;
    createEnemy(Math.cos(angle) * dist, Math.sin(angle) * dist);
  }
}

spawnEnemies(8);

// --- Weapon (gun model) ---
const gunGroup = new THREE.Group();

const barrelGeom = new THREE.BoxGeometry(0.05, 0.05, 0.6);
const barrelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const barrel = new THREE.Mesh(barrelGeom, barrelMat);
barrel.position.z = -0.3;
gunGroup.add(barrel);

const bodyGeom = new THREE.BoxGeometry(0.08, 0.15, 0.3);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const gunBody = new THREE.Mesh(bodyGeom, bodyMat);
gunBody.position.set(0, -0.05, 0);
gunGroup.add(gunBody);

const gripGeom = new THREE.BoxGeometry(0.06, 0.15, 0.08);
const gripMat = new THREE.MeshStandardMaterial({ color: 0x442200 });
const grip = new THREE.Mesh(gripGeom, gripMat);
grip.position.set(0, -0.15, 0.08);
grip.rotation.x = -0.3;
gunGroup.add(grip);

gunGroup.position.set(0.25, -0.25, -0.5);
camera.add(gunGroup);
scene.add(camera);

// --- Muzzle flash ---
const flashGeom = new THREE.SphereGeometry(0.05, 6, 6);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const muzzleFlash = new THREE.Mesh(flashGeom, flashMat);
muzzleFlash.position.set(0, 0, -0.6);
muzzleFlash.visible = false;
gunGroup.add(muzzleFlash);

// --- Bullet trails ---
const bulletTrails = [];

function createBulletTrail(from, to) {
  const points = [from, to];
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
  const line = new THREE.Line(geom, mat);
  scene.add(line);
  bulletTrails.push({ line, time: 0.1 });
}

// --- Shooting ---
const raycaster = new THREE.Raycaster();

function shoot() {
  if (state.reloading || state.ammo <= 0) return;

  state.ammo--;
  updateHUD();

  // Muzzle flash
  muzzleFlash.visible = true;
  setTimeout(() => { muzzleFlash.visible = false; }, 50);

  // Gun recoil
  gunGroup.rotation.x = -0.15;
  setTimeout(() => { gunGroup.rotation.x = 0; }, 80);

  // Raycast from camera center
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  // Check enemy hits
  const enemyMeshes = enemies.filter(e => e.alive).flatMap(e => e.mesh.children);
  const hits = raycaster.intersectObjects(enemyMeshes);

  if (hits.length > 0) {
    const hitPoint = hits[0].point;

    // Bullet trail
    const gunWorldPos = new THREE.Vector3();
    barrel.getWorldPosition(gunWorldPos);
    createBulletTrail(gunWorldPos, hitPoint);

    // Find which enemy was hit
    const hitObj = hits[0].object;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.mesh.children.includes(hitObj)) {
        enemy.hp--;
        // Flash red
        hitObj.material.emissive = new THREE.Color(0xff0000);
        setTimeout(() => { hitObj.material.emissive = new THREE.Color(0x000000); }, 100);

        if (enemy.hp <= 0) {
          enemy.alive = false;
          scene.remove(enemy.mesh);
          state.score += 100;
          updateHUD();

          // Respawn after delay
          setTimeout(() => {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            createEnemy(Math.cos(angle) * dist, Math.sin(angle) * dist);
          }, 3000);
        }

        // Hit marker
        showHitMarker();
        break;
      }
    }
  } else {
    // Bullet trail into distance
    const gunWorldPos = new THREE.Vector3();
    barrel.getWorldPosition(gunWorldPos);
    const dir = new THREE.Vector3();
    raycaster.ray.direction.normalize();
    dir.copy(raycaster.ray.direction).multiplyScalar(100).add(raycaster.ray.origin);
    createBulletTrail(gunWorldPos, dir);
  }

  if (state.ammo <= 0) reload();
}

function reload() {
  if (state.reloading || state.ammo === state.maxAmmo) return;
  state.reloading = true;
  document.getElementById('ammo').textContent = '재장전 중...';
  setTimeout(() => {
    state.ammo = state.maxAmmo;
    state.reloading = false;
    updateHUD();
  }, 1500);
}

function showHitMarker() {
  const el = document.getElementById('hit-marker');
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 200);
}

// --- Enemy AI ---
function updateEnemies(delta) {
  const playerPos = camera.position;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const pos = enemy.mesh.position;
    const distToPlayer = pos.distanceTo(playerPos);

    // Look at player
    enemy.mesh.lookAt(playerPos.x, 0, playerPos.z);

    // Move toward player if far
    if (distToPlayer > 8) {
      const dir = new THREE.Vector3().subVectors(playerPos, pos).normalize();
      pos.x += dir.x * enemySpeed * delta;
      pos.z += dir.z * enemySpeed * delta;
    }

    // Shoot at player
    const now = performance.now();
    if (distToPlayer < 40 && now - enemy.lastShot > enemy.shootInterval) {
      enemy.lastShot = now;
      takeDamage(5 + Math.floor(Math.random() * 5));
    }
  }
}

function takeDamage(amount) {
  state.hp = Math.max(0, state.hp - amount);
  updateHUD();

  // Red flash on damage
  document.body.style.boxShadow = 'inset 0 0 100px rgba(255,0,0,0.4)';
  setTimeout(() => { document.body.style.boxShadow = 'none'; }, 200);

  if (state.hp <= 0) {
    gameOver();
  }
}

function gameOver() {
  controls.unlock();
  instructions.innerHTML = `
    <h1>GAME OVER</h1>
    <p>최종 점수: ${state.score}</p>
    <p style="margin-top: 20px;">클릭하여 다시 시작</p>
  `;
  instructions.onclick = () => {
    state.hp = state.maxHp;
    state.ammo = state.maxAmmo;
    state.score = 0;
    state.reloading = false;
    updateHUD();

    // Remove old enemies and respawn
    enemies.forEach(e => { if (e.alive) scene.remove(e.mesh); });
    enemies.length = 0;
    spawnEnemies(8);

    camera.position.set(0, 2, 0);
    controls.lock();
  };
}

// --- HUD Update ---
function updateHUD() {
  document.getElementById('hp-text').textContent = state.hp;
  document.getElementById('hp-bar-fill').style.width = (state.hp / state.maxHp * 100) + '%';

  if (state.hp > 60) {
    document.getElementById('hp-bar-fill').style.background = '#4f4';
  } else if (state.hp > 30) {
    document.getElementById('hp-bar-fill').style.background = '#ff4';
  } else {
    document.getElementById('hp-bar-fill').style.background = '#f44';
  }

  if (!state.reloading) {
    document.getElementById('ammo').textContent = state.ammo + ' / ' + state.maxAmmo;
  }
  document.getElementById('score-value').textContent = state.score;
}

// --- Input ---
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': state.moveForward = true; break;
    case 'KeyS': state.moveBackward = true; break;
    case 'KeyA': state.moveLeft = true; break;
    case 'KeyD': state.moveRight = true; break;
    case 'Space':
      if (state.canJump) {
        state.velocity.y = 8;
        state.canJump = false;
      }
      break;
    case 'KeyR': reload(); break;
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

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game Loop ---
const clock = new THREE.Clock();

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
    if (state.moveForward || state.moveBackward) {
      state.velocity.z = -state.direction.z * speed;
    } else {
      state.velocity.z = 0;
    }
    if (state.moveLeft || state.moveRight) {
      state.velocity.x = -state.direction.x * speed;
    } else {
      state.velocity.x = 0;
    }

    controls.moveRight(-state.velocity.x * delta);
    controls.moveForward(-state.velocity.z * delta);

    camera.position.y += state.velocity.y * delta;

    // Floor collision
    if (camera.position.y < 2) {
      state.velocity.y = 0;
      camera.position.y = 2;
      state.canJump = true;
    }

    // Keep in bounds
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -140, 140);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -140, 140);

    // Update enemies
    updateEnemies(delta);
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
