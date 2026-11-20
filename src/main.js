import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ANIEZE_PRODUCTS } from './products.js';

const params = new URLSearchParams(window.location.search);
const IS_RENDER = params.get('render') === '1';
const IS_AUTOPLAY = params.get('autoplay') === '1';
const CLEAN_SHOT = params.get('clean') === '1';
const IS_MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;
if (IS_RENDER || CLEAN_SHOT) document.body.classList.add('render-mode');

// ---------------------------------------------------------------------------
// 1. Renderer, Scene & Warm High-Contrast Parisian Gallery Lighting
// ---------------------------------------------------------------------------
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({
  antialias: !IS_MOBILE_UA,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: IS_RENDER || CLEAN_SHOT
});
const maxDpr = IS_RENDER ? 1 : (IS_MOBILE_UA ? 1.75 : 2);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0f0a08');
scene.fog = new THREE.FogExp2('#130d0a', 0.022);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
scene.environmentIntensity = 0.26;

function getAdaptiveFov() {
  const portrait = window.innerHeight > window.innerWidth;
  if (IS_RENDER && (params.get('vertical') === '1' || portrait)) return 50;
  return portrait ? 56 : 44;
}

const camera = new THREE.PerspectiveCamera(getAdaptiveFov(), window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.set(0, 1.72, 18.0);

// ---------------------------------------------------------------------------
// 2. Procedural Warm Architectural PBR Textures
// ---------------------------------------------------------------------------
function makeStoneTexture(baseHex, grainAmt = 16, streaks = true, seamAlpha = 0.14) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  if (streaks) {
    for (let i = 0; i < 110; i++) {
      const y = Math.random() * 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(235,198,162,0.045)' : 'rgba(18,11,8,0.065)';
      ctx.fillRect(0, y, 512, 1 + Math.random() * 6);
    }
  }
  const img = ctx.getImageData(0, 0, 512, 512);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * grainAmt;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = `rgba(10,6,4,${seamAlpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const warmPlasterTex = makeStoneTexture('#5a493e', 15, true, 0.14);
warmPlasterTex.repeat.set(8, 3);
const warmRibTex = makeStoneTexture('#3e3129', 14, true, 0.16);
warmRibTex.repeat.set(4, 2);
const darkFloorTex = makeStoneTexture('#241c17', 14, true, 0.18);
darkFloorTex.repeat.set(10, 20);
const obsidianTex = makeStoneTexture('#110d0c', 10, false, 0.12);
obsidianTex.repeat.set(4, 12);

const matWarmWall = new THREE.MeshStandardMaterial({ map: warmPlasterTex, roughness: 0.84, metalness: 0.06 });
const matWarmRib = new THREE.MeshStandardMaterial({ map: warmRibTex, roughness: 0.78, metalness: 0.08 });
const matDarkWall = new THREE.MeshStandardMaterial({ map: obsidianTex, color: '#140f0d', roughness: 0.72, metalness: 0.14 });
const matWarmFloor = new THREE.MeshStandardMaterial({ map: darkFloorTex, roughness: 0.24, metalness: 0.18 });
const matRunwayFloor = new THREE.MeshStandardMaterial({ map: obsidianTex, color: '#0e0b0a', roughness: 0.12, metalness: 0.42 });
const matPlinth = new THREE.MeshStandardMaterial({ map: warmRibTex, color: '#332822', roughness: 0.42, metalness: 0.12 });
const matBronze = new THREE.MeshStandardMaterial({ color: '#4a382b', roughness: 0.22, metalness: 0.88 });
const matSculptObsidian = new THREE.MeshStandardMaterial({ color: '#1b1614', roughness: 0.26, metalness: 0.52 });
const matRustGlow = new THREE.MeshStandardMaterial({ color: '#a64a25', emissive: '#b85024', emissiveIntensity: 2.8, roughness: 0.25 });
const matCaramelGlow = new THREE.MeshStandardMaterial({ color: '#cf8c52', emissive: '#e09654', emissiveIntensity: 2.3, roughness: 0.25 });
const matWarmCove = new THREE.MeshStandardMaterial({ color: '#ffdcb4', emissive: '#ffbd75', emissiveIntensity: 1.9, roughness: 0.35 });

// ---------------------------------------------------------------------------
// 3. Build the 3-Zone Warm High-Contrast Parisian Atelier + 3D Sculptural Forms
// ---------------------------------------------------------------------------
function addBox(w, h, d, mat, x, y, z, cast = true, recv = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  scene.add(m);
  return m;
}

addBox(14, 0.2, 32, matWarmFloor, 0, -0.1, 6, false, true);
addBox(0.06, 0.015, 30, matCaramelGlow, -1.9, 0.008, 6, false, false);
addBox(0.06, 0.015, 30, matCaramelGlow, 1.9, 0.008, 6, false, false);

addBox(16, 0.2, 22, matRunwayFloor, 0, -0.1, -21, false, true);
addBox(3.4, 0.22, 18, matRunwayFloor, 0, 0.11, -19.5, true, true);
addBox(0.06, 0.035, 18, matRustGlow, -1.72, 0.22, -19.5, false, false);
addBox(0.06, 0.035, 18, matRustGlow, 1.72, 0.22, -19.5, false, false);

addBox(0.4, 7.2, 32, matWarmWall, -6.8, 3.6, 6, false, true);
addBox(0.4, 7.2, 32, matWarmWall, 6.8, 3.6, 6, false, true);
addBox(14, 0.4, 32, matWarmRib, 0, 7.2, 6, false, true);
addBox(14, 7.2, 0.4, matWarmWall, 0, 3.6, 22, false, true);

addBox(0.5, 8.2, 22, matDarkWall, -7.8, 4.1, -21, false, true);
addBox(0.5, 8.2, 22, matDarkWall, 7.8, 4.1, -21, false, true);
addBox(16, 0.5, 22, matDarkWall, 0, 8.2, -21, false, true);
addBox(16, 8.2, 0.5, matDarkWall, 0, 4.1, -31.8, false, true);

// Ribbed colonnade + suspended bronze linear pendant luminaires
for (let z = 16; z >= -8; z -= 4.8) {
  addBox(0.7, 7.0, 0.7, matWarmRib, -6.2, 3.5, z, true, true);
  addBox(0.7, 7.0, 0.7, matWarmRib, 6.2, 3.5, z, true, true);
  addBox(13.2, 0.55, 0.55, matWarmRib, 0, 6.8, z, true, true);
  addBox(11.4, 0.05, 0.09, matWarmCove, 0, 6.5, z - 0.28, false, false);

  // Suspended bronze linear gallery pendant hanging between beams
  const pGroup = new THREE.Group();
  pGroup.position.set(0, 5.25, z - 2.4);
  const rodL = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.55, 8), matBronze);
  rodL.position.set(-1.35, 0.78, 0);
  const rodR = rodL.clone();
  rodR.position.x = 1.35;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.06, 0.08), matBronze);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.025, 0.045), matWarmCove);
  glow.position.y = -0.035;
  pGroup.add(rodL, rodR, bar, glow);
  scene.add(pGroup);
}

for (let i = 0; i < 4; i++) {
  const z = -12 - i * 4.5;
  addBox(0.55, 7.6, 0.55, matDarkWall, -5.8, 3.8, z, true, true);
  addBox(0.55, 7.6, 0.55, matDarkWall, 5.8, 3.8, z, true, true);
  addBox(12.1, 0.55, 0.55, matDarkWall, 0, 7.6, z, true, true);
  const stripMat = i % 2 === 0 ? matRustGlow : matCaramelGlow;
  addBox(0.08, 7.2, 0.08, stripMat, -5.5, 3.6, z, false, false);
  addBox(0.08, 7.2, 0.08, stripMat, 5.5, 3.6, z, false, false);
  addBox(11.1, 0.08, 0.08, stripMat, 0, 7.3, z, false, false);
}

// Sculptural 3D Couture Mannequin Bust Pedestals (LatheGeometry torso + fluted travertine plinth)
const torsoProfile = [
  new THREE.Vector2(0.01, 0.0),
  new THREE.Vector2(0.16, 0.04),
  new THREE.Vector2(0.19, 0.16),
  new THREE.Vector2(0.145, 0.34),
  new THREE.Vector2(0.22, 0.58),
  new THREE.Vector2(0.245, 0.72),
  new THREE.Vector2(0.13, 0.80),
  new THREE.Vector2(0.075, 0.88),
  new THREE.Vector2(0.068, 0.98),
  new THREE.Vector2(0.01, 1.0)
];
const bustGeo = new THREE.LatheGeometry(torsoProfile, 28);
const sculpturalForms = [];

function addCoutureBustPedestal(x, z, rotY = 0, darkFinish = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.92, 20),
    darkFinish ? matDarkWall : matPlinth
  );
  base.position.y = 0.46;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.014, 10, 32),
    darkFinish ? matRustGlow : matCaramelGlow
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.92;
  g.add(ring);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.34, 14), matBronze);
  stem.position.y = 1.09;
  g.add(stem);

  const bust = new THREE.Mesh(bustGeo, darkFinish ? matBronze : matSculptObsidian);
  bust.position.y = 1.22;
  bust.scale.set(1.12, 1.05, 0.76);
  bust.castShadow = true;
  g.add(bust);

  // Architectural draped Agbada shoulder collar accent
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 12, 28), matBronze);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.18, 0.78, 1.0);
  collar.position.y = 1.94;
  g.add(collar);

  scene.add(g);
  sculpturalForms.push(bust);
}

// Flank the Atrium entrance & Runway Vault catwalk with 4 sculptural 3D couture busts
addCoutureBustPedestal(-4.7, 15.2, 0.45, false);
addCoutureBustPedestal(4.7, 15.2, -0.45, false);
addCoutureBustPedestal(-4.3, -21.8, 0.5, true);
addCoutureBustPedestal(4.3, -21.8, -0.5, true);

function addGarmentRail(x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 12), matBronze);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.68;
  g.add(bar);
  for (const sx of [-1.05, 1.05]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 12), matBronze);
    leg.position.set(sx, 0.85, 0);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.55), matBronze);
    foot.position.set(sx, 0.02, 0);
    g.add(foot);
  }
  scene.add(g);
}
addGarmentRail(-5.4, 5.0, Math.PI / 2);
addGarmentRail(5.4, 2.0, Math.PI / 2);

const hemiLight = new THREE.HemisphereLight('#ffdcb8', '#140c08', 0.24);
scene.add(hemiLight);

const shadowRes = IS_MOBILE_UA ? 1024 : 2048;
const sunSpot = new THREE.SpotLight('#ffd8a8', 95, 34, Math.PI / 4.8, 0.62, 1.4);
sunSpot.position.set(2.8, 6.8, 14.5);
sunSpot.target.position.set(-0.6, 0, 9.2);
sunSpot.castShadow = true;
sunSpot.shadow.mapSize.set(shadowRes, shadowRes);
sunSpot.shadow.bias = -0.0005;
scene.add(sunSpot, sunSpot.target);

const corridorLight = new THREE.PointLight('#ffbd7a', 34, 20, 1.6);
corridorLight.position.set(0, 5.2, -2.8);
scene.add(corridorLight);

const vaultRustLight = new THREE.PointLight('#c45628', 58, 26, 1.45);
vaultRustLight.position.set(0, 5.0, -18.5);
scene.add(vaultRustLight);

const heroSpot = new THREE.SpotLight('#fff0dc', 130, 24, Math.PI / 6.8, 0.5, 1.25);
heroSpot.position.set(0, 7.2, -20.8);
heroSpot.target.position.set(0, 1.65, -24.0);
heroSpot.castShadow = true;
heroSpot.shadow.mapSize.set(shadowRes, shadowRes);
heroSpot.shadow.bias = -0.0004;
scene.add(heroSpot, heroSpot.target);

// ---------------------------------------------------------------------------
// 4. Real ANIEZE Product Monoliths (Living Video Screens + iOS Autoplay Unlock)
// ---------------------------------------------------------------------------
const texLoader = new THREE.TextureLoader();
const interactables = [];
const productNodes = new Map();
const activeVideos = [];
const collectedSet = new Set();

function loadProductTex(url) {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

function unlockAllVideos() {
  activeVideos.forEach(v => {
    if (v.paused) v.play().catch(() => {});
  });
}
window.addEventListener('touchstart', unlockAllVideos, { passive: true });
window.addEventListener('pointerdown', unlockAllVideos, { passive: true });

function attachVideoToMonolith(productId, videoUrl, label = 'Custom Video') {
  const node = productNodes.get(productId);
  if (!node) return;
  const video = document.createElement('video');
  video.src = videoUrl;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  video.addEventListener('canplay', () => {
    video.play().catch(() => {});
    const vTex = new THREE.VideoTexture(video);
    vTex.colorSpace = THREE.SRGBColorSpace;
    vTex.minFilter = THREE.LinearFilter;
    vTex.magFilter = THREE.LinearFilter;

    node.frontMat.map = vTex;
    node.frontMat.emissiveMap = vTex;
    node.frontMat.emissive.set('#ffffff');
    node.frontMat.emissiveIntensity = 0.55;
    node.frontMat.needsUpdate = true;
    node.videoEl = video;
    node.sourceLabel = label;
    if (!activeVideos.includes(video)) activeVideos.push(video);
  }, { once: true });

  video.load();
}

ANIEZE_PRODUCTS.forEach((prod, i) => {
  const group = new THREE.Group();
  group.position.set(prod.position[0], prod.position[1], prod.position[2]);
  group.rotation.y = prod.rotationY;

  const isHero = i === ANIEZE_PRODUCTS.length - 1;
  const plinthW = isHero ? 2.65 : 1.78;
  const plinthH = isHero ? 0.55 : 0.48;
  const plinthD = isHero ? 1.55 : 1.15;

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(plinthW, plinthH, plinthD),
    isHero ? matDarkWall : matPlinth
  );
  plinth.position.y = plinthH / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(plinthW + 0.02, 0.028, plinthD + 0.02),
    isHero ? matCaramelGlow : matRustGlow
  );
  inlay.position.y = plinthH - 0.02;
  group.add(inlay);

  const frameW = isHero ? 1.82 : 1.42;
  const frameH = isHero ? 2.48 : 1.94;
  const frameY = plinthH + 0.14 + frameH / 2;

  const frameGroup = new THREE.Group();
  frameGroup.position.y = frameY;

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(frameW + 0.09, frameH + 0.09, 0.07),
    matBronze
  );
  bezel.castShadow = true;
  frameGroup.add(bezel);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(frameW + 0.24, frameH + 0.24),
    new THREE.MeshBasicMaterial({ color: '#cf8c52', transparent: true, opacity: 0.14, side: THREE.DoubleSide })
  );
  halo.position.z = -0.05;
  frameGroup.add(halo);

  const frontTex = loadProductTex(prod.frontImg);
  const frontMat = new THREE.MeshStandardMaterial({
    map: frontTex,
    emissiveMap: frontTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.42,
    roughness: 0.35,
    metalness: 0.02
  });
  const frontPlane = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), frontMat);
  frontPlane.position.z = 0.039;
  frontPlane.userData = { productId: prod.id };
  frameGroup.add(frontPlane);
  interactables.push(frontPlane);

  const altTex = loadProductTex(prod.altImg);
  const backMat = new THREE.MeshStandardMaterial({
    map: altTex,
    emissiveMap: altTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.02
  });
  const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), backMat);
  backPlane.position.z = -0.039;
  backPlane.rotation.y = Math.PI;
  backPlane.userData = { productId: prod.id };
  frameGroup.add(backPlane);
  interactables.push(backPlane);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: '#cf8c52',
    emissive: '#b85024',
    emissiveIntensity: 2.6,
    roughness: 0.2,
    metalness: 0.3
  });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), beaconMat);
  beacon.position.set(frameW / 2 + 0.24, frameH / 2 - 0.12, 0.1);
  beacon.userData = { productId: prod.id };
  frameGroup.add(beacon);
  interactables.push(beacon);

  group.add(frameGroup);

  if (!isHero) {
    const pLight = new THREE.SpotLight('#ffe2be', 38, 12, Math.PI / 6.2, 0.58, 1.45);
    pLight.position.set(prod.position[0] * 0.7, 5.8, prod.position[2] + 1.5);
    pLight.target = frameGroup;
    scene.add(pLight);
  }

  scene.add(group);
  productNodes.set(prod.id, { group, frameGroup, frontMat, beacon, beaconMat, baseY: frameY, prod, videoEl: null, sourceLabel: 'Real Product Photo' });
});

fetch('./assets/videos/manifest.json')
  .then(r => r.ok ? r.json() : null)
  .then(manifest => {
    if (!manifest || !manifest.screens) return;
    Object.entries(manifest.screens).forEach(([id, cfg]) => {
      if (cfg && cfg.video) {
        fetch(cfg.video, { method: 'HEAD' }).then(res => {
          if (res.ok) attachVideoToMonolith(id, cfg.video, cfg.sourceLabel || 'Video Loop');
        }).catch(() => {});
      }
    });
  })
  .catch(() => {});

const dustCount = IS_MOBILE_UA ? 140 : 280;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 12.5;
  dustPos[i * 3 + 1] = 0.4 + Math.random() * 6.2;
  dustPos[i * 3 + 2] = 18 - Math.random() * 48;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({ color: '#f7cfa0', size: 0.048, transparent: true, opacity: 0.52 });
const dustPoints = new THREE.Points(dustGeo, dustMat);
scene.add(dustPoints);

// ---------------------------------------------------------------------------
// 5. Cinematic Camera Spline (16:9 Widescreen 36s & 9:16 Vertical 68s)
// ---------------------------------------------------------------------------
const TOUR_DURATION = 36.0;
const camPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.0, 1.85, 18.4),
  new THREE.Vector3(-1.1, 1.75, 13.6),
  new THREE.Vector3(1.1, 1.72, 10.6),
  new THREE.Vector3(0.0, 1.68, 4.2),
  new THREE.Vector3(-1.0, 1.66, 0.8),
  new THREE.Vector3(1.0, 1.66, -2.5),
  new THREE.Vector3(0.0, 1.68, -10.5),
  new THREE.Vector3(-1.0, 1.65, -14.2),
  new THREE.Vector3(0.0, 1.82, -19.0),
  new THREE.Vector3(0.0, 1.88, -20.2)
]);

const lookPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.0, 1.65, 9.0),
  new THREE.Vector3(-3.4, 1.55, 10.5),
  new THREE.Vector3(3.4, 1.55, 8.2),
  new THREE.Vector3(0.0, 1.55, -3.0),
  new THREE.Vector3(-3.3, 1.5, -1.5),
  new THREE.Vector3(3.3, 1.5, -4.5),
  new THREE.Vector3(0.0, 1.65, -24.0),
  new THREE.Vector3(-3.3, 1.5, -16.5),
  new THREE.Vector3(0.0, 1.9, -24.0),
  new THREE.Vector3(0.0, 1.92, -24.0)
]);

const IS_VERTICAL = params.get('vertical') === '1' || window.innerHeight > window.innerWidth;
const ACTIVE_DURATION = IS_VERTICAL ? 68.0 : TOUR_DURATION;

function monolithShot(prod, dist) {
  const isHero = prod.id === 'elara-trench';
  const frameY = isHero ? (0.55 + 0.14 + 2.48 / 2) : (0.48 + 0.14 + 1.94 / 2);
  const fwd = new THREE.Vector3(Math.sin(prod.rotationY), 0, Math.cos(prod.rotationY));
  const target = new THREE.Vector3(prod.position[0], frameY - 0.12, prod.position[2]);
  const pos = new THREE.Vector3(prod.position[0], frameY - 0.04, prod.position[2]).addScaledVector(fwd, dist);
  return { pos, look: target };
}

const pShots = ANIEZE_PRODUCTS.map((p, i) => monolithShot(p, i === 5 ? 4.45 : 3.45));
const VERTICAL_KEYFRAMES = [
  { t: 0.0,  pos: new THREE.Vector3(0.0, 1.85, 18.8), look: new THREE.Vector3(0.0, 1.65, 6.0) },
  { t: 4.0,  pos: new THREE.Vector3(0.0, 1.78, 15.2), look: new THREE.Vector3(0.0, 1.60, 6.0) },
  { t: 6.2,  pos: pShots[0].pos, look: pShots[0].look },
  { t: 11.7, pos: pShots[0].pos.clone().add(new THREE.Vector3(0.06, 0.03, -0.08)), look: pShots[0].look },
  { t: 14.0, pos: new THREE.Vector3(0.0, 1.75, 12.6), look: new THREE.Vector3(0.5, 1.60, 5.0) },
  { t: 16.2, pos: pShots[1].pos, look: pShots[1].look },
  { t: 22.0, pos: pShots[1].pos.clone().add(new THREE.Vector3(-0.06, 0.03, -0.08)), look: pShots[1].look },
  { t: 24.5, pos: new THREE.Vector3(0.0, 1.72, 4.8), look: new THREE.Vector3(0.0, 1.58, -5.0) },
  { t: 26.8, pos: pShots[2].pos, look: pShots[2].look },
  { t: 31.6, pos: pShots[2].pos.clone().add(new THREE.Vector3(0.06, 0.02, -0.08)), look: pShots[2].look },
  { t: 34.0, pos: new THREE.Vector3(0.0, 1.72, 0.4), look: new THREE.Vector3(0.4, 1.58, -8.0) },
  { t: 36.2, pos: pShots[3].pos, look: pShots[3].look },
  { t: 41.0, pos: pShots[3].pos.clone().add(new THREE.Vector3(-0.06, 0.02, -0.08)), look: pShots[3].look },
  { t: 43.5, pos: new THREE.Vector3(0.0, 1.74, -10.5), look: new THREE.Vector3(0.0, 1.65, -24.0) },
  { t: 45.8, pos: pShots[4].pos, look: pShots[4].look },
  { t: 50.6, pos: pShots[4].pos.clone().add(new THREE.Vector3(0.06, 0.02, -0.08)), look: pShots[4].look },
  { t: 53.0, pos: new THREE.Vector3(0.0, 1.78, -15.8), look: new THREE.Vector3(0.0, 1.85, -24.0) },
  { t: 56.2, pos: pShots[5].pos, look: pShots[5].look },
  { t: 64.7, pos: pShots[5].pos.clone().add(new THREE.Vector3(0.0, 0.04, -0.45)), look: pShots[5].look },
  { t: 68.0, pos: pShots[5].pos.clone().add(new THREE.Vector3(0.0, 0.04, -0.55)), look: pShots[5].look }
];

function sampleVerticalCamera(t) {
  const kfs = VERTICAL_KEYFRAMES;
  if (t <= kfs[0].t) return { pos: kfs[0].pos.clone(), look: kfs[0].look.clone() };
  if (t >= kfs[kfs.length - 1].t) return { pos: kfs[kfs.length - 1].pos.clone(), look: kfs[kfs.length - 1].look.clone() };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      const raw = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const s = raw * raw * (3 - 2 * raw);
      return {
        pos: a.pos.clone().lerp(b.pos, s),
        look: a.look.clone().lerp(b.look, s)
      };
    }
  }
  return { pos: kfs[0].pos.clone(), look: kfs[0].look.clone() };
}

const CINEMA_BEATS = IS_VERTICAL ? [
  { t0: 0.4,  t1: 3.9,  zone: '01 · The Atrium', eyebrow: 'ANIEZE · Paris', title: 'Enter the 3D Atelier', sub: '6 live screens · Couture & NOMAD Paris Runway' },
  { t0: 5.8,  t1: 12.1, zone: '01 · The Atrium', eyebrow: 'Piece 01 · €320 · 1080p 360° Screen', title: 'Shiny Jagaban Sweater', sub: 'Metallic-fleck knit · Sculpted Agbada shoulders' },
  { t0: 15.8, t1: 22.4, zone: '01 · The Atrium', eyebrow: 'Piece 02 · €680 · 1080p 360° Screen', title: 'Nkisi Layered Trench', sub: 'Wool & lambskin scales · 360° atelier screen' },
  { t0: 26.4, t1: 32.0, zone: '02 · Craft Corridor', eyebrow: 'Piece 03 · NOMAD Paris Runway', title: 'NOMAD Look 15 — Moto & Wrap', sub: 'Structured leather moto · Floor-length draped wrap' },
  { t0: 35.8, t1: 41.4, zone: '02 · Craft Corridor', eyebrow: 'Piece 04 · NOMAD Paris Runway', title: 'NOMAD Look 21 — Painted Art Jacket', sub: 'Hand-painted monochrome print · Wide tailored wool' },
  { t0: 45.4, t1: 51.0, zone: '03 · Runway Vault', eyebrow: 'Piece 05 · NOMAD Paris Runway', title: 'NOMAD Look 23 — Sculpted Knit', sub: 'Agbada shoulder knit · Ribbed sand tailoring' },
  { t0: 55.6, t1: 64.4, zone: '03 · Runway Vault', eyebrow: 'Piece 06 · €790 · Paris Atelier Finale', title: 'Elara Lambskin Trench', sub: 'Full-length burnished lambskin · Live boutique film' }
] : [
  { t0: 0.4,  t1: 4.2,  zone: '01 · The Atrium', eyebrow: 'ANIEZE · Paris', title: 'Enter the 3D Atelier', sub: '6 live screens · Couture & NOMAD Paris Runway — built to explore and collect.' },
  { t0: 4.8,  t1: 8.8,  zone: '01 · The Atrium', eyebrow: 'Piece 01 · €320 · 1080p 360° Screen', title: 'Shiny Jagaban Sweater', sub: 'Metallic-fleck knit · Sculpted Agbada shoulders' },
  { t0: 9.4,  t1: 13.6, zone: '01 · The Atrium', eyebrow: 'Piece 02 · €680 · 1080p 360° Screen', title: 'Nkisi Layered Trench', sub: 'Wool & lambskin scales · 360° atelier screen' },
  { t0: 15.0, t1: 19.2, zone: '02 · Craft Corridor', eyebrow: 'Piece 03 · NOMAD Paris Runway', title: 'NOMAD Look 15 — Moto & Wrap', sub: 'Structured leather moto · Floor-length draped wrap' },
  { t0: 19.8, t1: 23.8, zone: '02 · Craft Corridor', eyebrow: 'Piece 04 · NOMAD Paris Runway', title: 'NOMAD Look 21 — Painted Art Jacket', sub: 'Hand-painted monochrome print · Wide tailored wool' },
  { t0: 25.4, t1: 29.2, zone: '03 · Runway Vault', eyebrow: 'Piece 05 · NOMAD Paris Runway', title: 'NOMAD Look 23 — Sculpted Knit', sub: 'Agbada shoulder knit · Ribbed sand tailoring' },
  { t0: 29.8, t1: 33.0, zone: '03 · Runway Vault', eyebrow: 'Piece 06 · €790 · Paris Atelier Finale', title: 'Elara Lambskin Trench', sub: 'Full-length burnished lambskin · Live boutique film' }
];

// ---------------------------------------------------------------------------
// 6. Interactive Controls, Ambient Audio, Onboarding Hint & Gamification
// ---------------------------------------------------------------------------
let mode = (IS_RENDER || IS_AUTOPLAY) ? 'tour' : 'explore';
if (mode === 'tour') document.body.classList.add('tour-active');
let tourTime = 0;
let yaw = 0, pitch = -0.02;
let lookPointerId = null, lastX = 0, lastY = 0;
let activeProductId = null;
let showingAltImg = false;
let targetCamPos = null, targetLookAt = null;
let currentPieceIdx = -1;
const keys = {};

const joyVec = { x: 0, y: 0 };
let joyPointerId = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const elCinemaOverlay = document.getElementById('cinema-overlay');
const elCinemaZone = document.getElementById('cinema-zone-label');
const elCinemaCard = document.getElementById('cinema-card');
const elCinemaEyebrow = document.getElementById('cinema-eyebrow');
const elCinemaTitle = document.getElementById('cinema-title');
const elCinemaSub = document.getElementById('cinema-sub');
const elCinemaEndcard = document.getElementById('cinema-endcard');

const elDrawer = document.getElementById('product-drawer');
const elDrawerIndex = document.getElementById('drawer-index');
const elDrawerImg = document.getElementById('drawer-img');
const elDrawerTitle = document.getElementById('drawer-title');
const elDrawerPrice = document.getElementById('drawer-price');
const elDrawerMaterial = document.getElementById('drawer-material');
const elDrawerStory = document.getElementById('drawer-story');
const elBtnCollect = document.getElementById('btn-collect');
const elBtnShop = document.getElementById('btn-shop');
const elCollectedCount = document.getElementById('collected-count');
const elProgressFill = document.getElementById('progress-fill');
const elToggleTour = document.getElementById('toggle-tour');

const elModal = document.getElementById('lookbook-modal');
const elModalGrid = document.getElementById('modal-grid');
const elModalTitle = document.getElementById('modal-title');
const elModalEyebrow = document.getElementById('modal-eyebrow');
const elVipBanner = document.getElementById('vip-banner');
const elShareBtn = document.getElementById('btn-share-atelier');

const elOnboard = document.getElementById('onboard-hint');
const elToggleAudio = document.getElementById('toggle-audio');
const elAudioIcon = document.getElementById('audio-icon');

const elJoystick = document.getElementById('mobile-joystick');
const elJoyKnob = document.getElementById('joy-knob');
const elStepPrev = document.getElementById('step-prev');
const elStepNext = document.getElementById('step-next');
const elStepLabel = document.getElementById('step-label');

// Auto-dismiss onboarding hint after 5.5s or first interaction
function dismissOnboard() {
  if (elOnboard && !elOnboard.classList.contains('hidden')) {
    elOnboard.classList.add('hidden');
  }
}
if (elOnboard) {
  setTimeout(dismissOnboard, 5500);
  window.addEventListener('pointerdown', dismissOnboard, { once: true, passive: true });
  window.addEventListener('keydown', dismissOnboard, { once: true, passive: true });
}

// Optional Ambient Soundtrack Toggle
const ambientAudio = new Audio('./assets/audio/tech_house_vibes.mp3');
ambientAudio.loop = true;
ambientAudio.volume = 0.35;
let audioPlaying = false;

if (elToggleAudio) {
  elToggleAudio.addEventListener('click', () => {
    if (audioPlaying) {
      ambientAudio.pause();
      audioPlaying = false;
      elToggleAudio.classList.remove('playing');
      if (elAudioIcon) elAudioIcon.textContent = '🔇';
    } else {
      ambientAudio.play().then(() => {
        audioPlaying = true;
        elToggleAudio.classList.add('playing');
        if (elAudioIcon) elAudioIcon.textContent = '🔊';
      }).catch(() => {});
    }
  });
}

// Share Atelier Link (Web Share API on mobile, Clipboard fallback on desktop)
if (elShareBtn) {
  elShareBtn.addEventListener('click', async () => {
    const shareUrl = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ANIEZE — Interactive 3D Atelier', text: 'Explore the ANIEZE 3D Paris Atelier', url: shareUrl });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      elShareBtn.textContent = 'Link Copied ✓';
      setTimeout(() => { elShareBtn.textContent = 'Share 3D Atelier Link'; }, 2200);
    } catch {
      elShareBtn.textContent = shareUrl;
    }
  });
}

if (elJoystick && elJoyKnob) {
  const maxR = 32;
  const updateJoy = (clientX, clientY) => {
    const rect = elJoystick.querySelector('.joy-ring').getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    elJoyKnob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    joyVec.x = dx / maxR;
    joyVec.y = -dy / maxR;
    if (Math.abs(joyVec.x) > 0.08 || Math.abs(joyVec.y) > 0.08) {
      targetCamPos = null;
      targetLookAt = null;
    }
  };

  elJoystick.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dismissOnboard();
    joyPointerId = e.pointerId;
    elJoystick.setPointerCapture(e.pointerId);
    elJoyKnob.classList.add('active');
    updateJoy(e.clientX, e.clientY);
  });

  elJoystick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return;
    e.stopPropagation();
    updateJoy(e.clientX, e.clientY);
  });

  const resetJoy = (e) => {
    if (e.pointerId !== joyPointerId) return;
    joyPointerId = null;
    joyVec.x = 0;
    joyVec.y = 0;
    elJoyKnob.classList.remove('active');
    elJoyKnob.style.transform = 'translate3d(0, 0, 0)';
  };
  elJoystick.addEventListener('pointerup', resetJoy);
  elJoystick.addEventListener('pointercancel', resetJoy);
}

const swapInput = document.getElementById('swap-video-input');
const swapBtn = document.getElementById('btn-swap-video');
if (swapBtn && swapInput) {
  swapBtn.addEventListener('click', () => swapInput.click());
  swapInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeProductId) return;
    const blobUrl = URL.createObjectURL(file);
    attachVideoToMonolith(activeProductId, blobUrl, file.name);
    swapBtn.textContent = `Playing: ${file.name.slice(0, 22)}`;
  });
}

function updateProgressUI() {
  const count = collectedSet.size;
  elCollectedCount.textContent = String(count);
  elProgressFill.style.width = `${(count / ANIEZE_PRODUCTS.length) * 100}%`;
  if (count === ANIEZE_PRODUCTS.length) {
    vaultRustLight.intensity = 90;
    elModalEyebrow.textContent = 'Atelier Unlocked · 6 / 6 Collected';
    elModalTitle.textContent = 'Your curated ANIEZE drop is ready';
    if (elVipBanner) elVipBanner.classList.add('show');
  }
  renderLookbookGrid();
}

function renderLookbookGrid() {
  elModalGrid.innerHTML = ANIEZE_PRODUCTS.map(p => {
    const unlocked = collectedSet.has(p.id);
    return `
      <a class="mini-card ${unlocked ? '' : 'locked'}" href="${p.url}" target="_blank" rel="noopener">
        <img src="${p.frontImg}" alt="${p.title}" />
        <div class="mini-card-title">${p.title}</div>
        <div class="mini-card-price">${unlocked ? p.price + ' · Shop →' : 'Undiscovered'}</div>
      </a>
    `;
  }).join('');
}
renderLookbookGrid();

function focusPiece(idx, openDrawer = false) {
  const safeIdx = ((idx % ANIEZE_PRODUCTS.length) + ANIEZE_PRODUCTS.length) % ANIEZE_PRODUCTS.length;
  currentPieceIdx = safeIdx;
  const p = ANIEZE_PRODUCTS[safeIdx];
  const node = productNodes.get(p.id);
  if (!node) return;

  if (elStepLabel) elStepLabel.textContent = `${p.index} / 06`;
  const portrait = window.innerHeight > window.innerWidth;
  const dist = p.id === 'elara-trench' ? (portrait ? 4.4 : 3.8) : (portrait ? 3.55 : 3.15);
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY);
  targetCamPos = new THREE.Vector3(p.position[0], 1.72, p.position[2]).addScaledVector(forward, dist);
  targetLookAt = new THREE.Vector3(p.position[0], node.baseY - 0.08, p.position[2]);

  const dir = targetLookAt.clone().sub(targetCamPos).normalize();
  yaw = Math.atan2(-dir.x, -dir.z);
  pitch = Math.asin(Math.max(-0.45, Math.min(0.45, dir.y)));

  const zoneIdx = safeIdx < 2 ? 0 : (safeIdx < 4 ? 1 : 2);
  document.querySelectorAll('.zone-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.zone) === zoneIdx));

  if (openDrawer) openProductDrawer(p.id);
}

if (elStepPrev && elStepNext) {
  elStepPrev.addEventListener('click', () => {
    mode = 'explore';
    document.body.classList.remove('tour-active');
    elDrawer.classList.remove('open');
    focusPiece(currentPieceIdx <= 0 ? ANIEZE_PRODUCTS.length - 1 : currentPieceIdx - 1, false);
  });
  elStepNext.addEventListener('click', () => {
    mode = 'explore';
    document.body.classList.remove('tour-active');
    elDrawer.classList.remove('open');
    focusPiece(currentPieceIdx + 1, false);
  });
}

function openProductDrawer(id) {
  const node = productNodes.get(id);
  if (!node) return;
  activeProductId = id;
  showingAltImg = false;
  const p = node.prod;
  currentPieceIdx = ANIEZE_PRODUCTS.findIndex(item => item.id === id);
  if (elStepLabel && currentPieceIdx >= 0) elStepLabel.textContent = `${p.index} / 06`;

  elDrawerIndex.textContent = `Piece ${p.index} · ${p.zone} · ${node.sourceLabel}`;
  elDrawerImg.src = p.frontImg;
  elDrawerTitle.textContent = p.title;
  elDrawerPrice.textContent = p.price;
  elDrawerMaterial.textContent = p.material;
  elDrawerStory.textContent = p.story;
  elBtnShop.href = p.url;
  if (swapBtn) swapBtn.textContent = 'Swap screen video (.mp4)';

  const isCol = collectedSet.has(id);
  elBtnCollect.textContent = isCol ? 'Collected in your Atelier Bag ✓' : 'Collect piece (+1)';
  elBtnCollect.classList.toggle('collected', isCol);
  elDrawer.classList.add('open');

  const portrait = window.innerHeight > window.innerWidth;
  const dist = p.id === 'elara-trench' ? (portrait ? 4.4 : 3.8) : (portrait ? 3.55 : 3.15);
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY);
  targetCamPos = new THREE.Vector3(p.position[0], 1.75, p.position[2]).addScaledVector(forward, dist);
  targetLookAt = new THREE.Vector3(p.position[0], node.baseY, p.position[2]);
}

document.getElementById('drawer-close').addEventListener('click', () => {
  elDrawer.classList.remove('open');
  activeProductId = null;
  targetCamPos = null;
});

document.getElementById('angle-toggle').addEventListener('click', () => {
  if (!activeProductId) return;
  const p = productNodes.get(activeProductId).prod;
  showingAltImg = !showingAltImg;
  elDrawerImg.src = showingAltImg ? p.altImg : p.frontImg;
});

elBtnCollect.addEventListener('click', () => {
  if (!activeProductId) return;
  collectedSet.add(activeProductId);
  const node = productNodes.get(activeProductId);
  node.beaconMat.color.set('#f4f2f3');
  node.beaconMat.emissive.set('#ffffff');
  node.beaconMat.emissiveIntensity = 1.2;
  elBtnCollect.textContent = 'Collected in your Atelier Bag ✓';
  elBtnCollect.classList.add('collected');
  updateProgressUI();
  if (collectedSet.size === ANIEZE_PRODUCTS.length) {
    setTimeout(() => elModal.classList.add('open'), 450);
  }
});

document.getElementById('open-lookbook').addEventListener('click', () => elModal.classList.add('open'));
document.getElementById('modal-close').addEventListener('click', () => elModal.classList.remove('open'));
elModal.addEventListener('click', (e) => { if (e.target === elModal) elModal.classList.remove('open'); });

const ZONE_VIEWS = [
  { pos: new THREE.Vector3(0, 1.72, 16.5), yaw: 0 },
  { pos: new THREE.Vector3(0, 1.72, 2.5), yaw: 0 },
  { pos: new THREE.Vector3(0, 1.72, -11.5), yaw: 0 }
];
document.querySelectorAll('.zone-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = 'explore';
    document.body.classList.remove('tour-active');
    elToggleTour.textContent = 'Watch Film';
    elCinemaOverlay.classList.remove('visible');
    elCinemaEndcard.classList.remove('show');
    elDrawer.classList.remove('open');
    const idx = Number(btn.dataset.zone);
    document.querySelectorAll('.zone-btn').forEach(b => b.classList.toggle('active', b === btn));
    targetCamPos = ZONE_VIEWS[idx].pos.clone();
    targetLookAt = new THREE.Vector3(0, 1.65, ZONE_VIEWS[idx].pos.z - 8);
    yaw = ZONE_VIEWS[idx].yaw;
    pitch = -0.02;
  });
});

elToggleTour.addEventListener('click', () => {
  if (mode === 'tour') {
    mode = 'explore';
    document.body.classList.remove('tour-active');
    elToggleTour.textContent = 'Watch Film';
    elCinemaOverlay.classList.remove('visible');
    elCinemaEndcard.classList.remove('show');
  } else {
    mode = 'tour';
    tourTime = 0;
    document.body.classList.add('tour-active');
    elDrawer.classList.remove('open');
    elToggleTour.textContent = 'Exit Film';
    elCinemaOverlay.classList.add('visible');
  }
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'explore' || e.pointerId === joyPointerId || lookPointerId !== null) return;
  lookPointerId = e.pointerId;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.dataset.downX = e.clientX;
  renderer.domElement.dataset.downY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookPointerId || mode !== 'explore') return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  targetCamPos = null;
  const sens = IS_MOBILE_UA ? 0.0046 : 0.0032;
  yaw -= dx * sens;
  pitch = Math.max(-0.45, Math.min(0.45, pitch - dy * (sens * 0.78)));
});
const endLook = (e) => {
  if (e.pointerId !== lookPointerId) return;
  lookPointerId = null;
  const moved = Math.hypot(
    e.clientX - Number(renderer.domElement.dataset.downX || 0),
    e.clientY - Number(renderer.domElement.dataset.downY || 0)
  );
  if (moved < 10 && mode === 'explore') {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    if (hits.length > 0 && hits[0].object.userData.productId) {
      openProductDrawer(hits[0].object.userData.productId);
    }
  }
};
window.addEventListener('pointerup', endLook);
window.addEventListener('pointercancel', () => { lookPointerId = null; });

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = getAdaptiveFov();
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// 7. Scene Update & Deterministic Frame-Stepping Hook
// ---------------------------------------------------------------------------
function updateSceneAtTime(t) {
  let idx = 0;
  productNodes.forEach((node) => {
    node.frameGroup.position.y = node.baseY + Math.sin(t * 1.15 + idx * 1.1) * 0.024;
    node.beacon.rotation.y = t * 1.4 + idx;
    node.beacon.rotation.x = Math.sin(t * 0.9 + idx) * 0.35;
    idx++;
  });
  sculpturalForms.forEach((b, bi) => {
    b.rotation.y = Math.sin(t * 0.35 + bi * 1.5) * 0.14;
  });
  dustPoints.position.y = Math.sin(t * 0.35) * 0.12;

  const BPM = 124;
  const beatPhase = (t * (BPM / 60)) % 1;
  const beatKick = Math.pow(1 - beatPhase, 3.2);
  matRustGlow.emissiveIntensity = 2.4 + beatKick * 1.45;
  matCaramelGlow.emissiveIntensity = 1.9 + beatKick * 1.1;
  vaultRustLight.intensity = (collectedSet.size === ANIEZE_PRODUCTS.length ? 85 : 54) + beatKick * 20;

  if (mode === 'tour') {
    let pos, look;
    if (IS_VERTICAL || window.innerHeight > window.innerWidth) {
      const sample = sampleVerticalCamera(t);
      pos = sample.pos;
      look = sample.look;
    } else {
      const u = Math.min(1, Math.max(0, t / TOUR_DURATION));
      pos = camPath.getPointAt(u);
      look = lookPath.getPointAt(u);
    }

    const gaitY = Math.sin(t * 4.2) * 0.012 + beatKick * 0.010;
    const gaitX = Math.cos(t * 2.1) * 0.008;
    camera.position.set(pos.x + gaitX, pos.y + gaitY, pos.z);
    camera.lookAt(look);

    if (!CLEAN_SHOT) {
      elCinemaOverlay.classList.add('visible');
      const activeBeat = CINEMA_BEATS.find(b => t >= b.t0 && t <= b.t1);
      if (activeBeat) {
        elCinemaZone.textContent = activeBeat.zone;
        elCinemaEyebrow.textContent = activeBeat.eyebrow;
        elCinemaTitle.textContent = activeBeat.title;
        elCinemaSub.textContent = activeBeat.sub;
        elCinemaCard.classList.add('show');
      } else {
        elCinemaCard.classList.remove('show');
      }
      elCinemaEndcard.classList.toggle('show', t >= ACTIVE_DURATION - 2.6);
    } else {
      elCinemaOverlay.classList.remove('visible');
      elCinemaEndcard.classList.remove('show');
    }
  }
}

window.__setRenderTime = (t) => {
  mode = 'tour';
  tourTime = t;
  updateSceneAtTime(t);
  renderer.render(scene, camera);
};
window.__atelierReady = true;

const clock = new THREE.Clock();
function animate() {
  if (IS_RENDER && !IS_AUTOPLAY) return;
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.getElapsedTime();

  if (mode === 'tour') {
    tourTime += dt;
    if (IS_AUTOPLAY) {
      if (tourTime > ACTIVE_DURATION) tourTime = ACTIVE_DURATION;
    } else if (tourTime > ACTIVE_DURATION + 0.5) {
      tourTime = 0;
    }
    updateSceneAtTime(tourTime);
  } else {
    updateSceneAtTime(elapsed);
    if (targetCamPos) {
      camera.position.lerp(targetCamPos, 0.08);
      if (targetLookAt) camera.lookAt(targetLookAt);
      if (camera.position.distanceTo(targetCamPos) < 0.05) targetCamPos = null;
    } else {
      const speed = 5.2 * dt;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      if (keys.KeyW || keys.ArrowUp) camera.position.addScaledVector(fwd, speed);
      if (keys.KeyS || keys.ArrowDown) camera.position.addScaledVector(fwd, -speed);
      if (keys.KeyA || keys.ArrowLeft) camera.position.addScaledVector(right, -speed);
      if (keys.KeyD || keys.ArrowRight) camera.position.addScaledVector(right, speed);
      if (Math.abs(joyVec.y) > 0.05) camera.position.addScaledVector(fwd, speed * joyVec.y);
      if (Math.abs(joyVec.x) > 0.05) camera.position.addScaledVector(right, speed * joyVec.x);
      camera.position.x = Math.max(-5.2, Math.min(5.2, camera.position.x));
      camera.position.z = Math.max(-27.5, Math.min(19.5, camera.position.z));
      camera.position.y = 1.72;
      const lookDir = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      );
      camera.lookAt(camera.position.clone().add(lookDir));
    }
  }
  renderer.render(scene, camera);
}

if (IS_RENDER && !IS_AUTOPLAY) {
  updateSceneAtTime(0);
  renderer.render(scene, camera);
} else {
  animate();
}
