import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ANIEZE_PRODUCTS } from './products.js';
import { createSharedMaterials } from './sets/materials.js';
import { resolveSet, SET_REGISTRY } from './sets/index.js';
import { createWalkerSystem } from './walkers.js';
import { fetchBrandContext, hydrateSessionFromHash, getAdminSession, trackShowroomEvent } from './supabase-sync.js';
import { initAdminEditor } from './admin-editor.js';

const params = new URLSearchParams(window.location.search);
const BRAND_SLUG = (params.get('brand') || 'anieze').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'anieze';
const DEEP_LINK_LOOK = params.get('look') || null;
const IS_RENDER = params.get('render') === '1';
const IS_AUTOPLAY = params.get('autoplay') === '1';
const CLEAN_SHOT = params.get('clean') === '1';
const IS_EMBED = window.self !== window.top;
const IS_MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;
if (IS_RENDER || CLEAN_SHOT) document.body.classList.add('render-mode');

// Active brand state (overridden live from Supabase `brands` table)
const activeBrand = {
  id: null,
  slug: BRAND_SLUG,
  name: BRAND_SLUG === 'anieze' ? 'ANIEZE' : BRAND_SLUG.toUpperCase(),
  tagline: 'Paris · Interactive 3D Atelier',
  shopUrl: 'https://aniezeshop.com/',
  instagram: '@anieze._',
  logoDark: './assets/brand/logo-black.svg',
  logoLight: './assets/brand/logo-light.svg',
  accent: '#cf8c52'
};

function applyBrandIdentity(brandRow) {
  if (!brandRow) return;
  activeBrand.id = brandRow.id || null;
  activeBrand.slug = brandRow.slug || BRAND_SLUG;
  activeBrand.name = brandRow.name || activeBrand.name;
  activeBrand.tagline = brandRow.tagline || activeBrand.tagline;
  activeBrand.shopUrl = brandRow.shop_url || activeBrand.shopUrl;
  activeBrand.instagram = brandRow.instagram_handle || activeBrand.instagram;
  activeBrand.logoDark = brandRow.logo_dark_url || activeBrand.logoDark;
  activeBrand.logoLight = brandRow.logo_light_url || activeBrand.logoLight;
  if (brandRow.palette?.accent) activeBrand.accent = brandRow.palette.accent;

  document.title = `${activeBrand.name} — ${activeBrand.tagline}`;
  document.documentElement.style.setProperty('--paint-main', activeBrand.accent);
  const cleanHost = activeBrand.shopUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');

  const elLogoTop = document.getElementById('brand-logo-top');
  const elCinemaLogo = document.getElementById('cinema-logo');
  const elEndLogo = document.getElementById('endcard-logo');
  if (elLogoTop) { elLogoTop.src = activeBrand.logoDark; elLogoTop.alt = activeBrand.name; }
  if (elCinemaLogo) { elCinemaLogo.src = activeBrand.logoLight; elCinemaLogo.alt = activeBrand.name; }
  if (elEndLogo) { elEndLogo.src = activeBrand.logoDark; elEndLogo.alt = activeBrand.name; }

  const elShopPill = document.getElementById('shop-pill-link');
  const elModalShop = document.getElementById('modal-shop-link');
  const elEndSub = document.getElementById('endcard-sub');
  const elEndUrl = document.getElementById('endcard-url');
  const elEndIg = document.getElementById('endcard-ig');
  if (elShopPill) { elShopPill.href = activeBrand.shopUrl; elShopPill.textContent = cleanHost; }
  if (elModalShop) { elModalShop.href = activeBrand.shopUrl; elModalShop.textContent = `Shop on ${cleanHost}`; }
  if (elEndSub) elEndSub.textContent = activeBrand.tagline;
  if (elEndUrl) elEndUrl.textContent = cleanHost;
  if (elEndIg) elEndIg.textContent = activeBrand.instagram;
}

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
// 2 & 3. Modular 3D Environment Set Engine (?set=atelier | ?set=courtyard)
// ---------------------------------------------------------------------------
const SET_KEY = params.get('set') || 'atelier';
const mats = createSharedMaterials();
const { matDarkWall, matPlinth, matBronze, matRustGlow, matCaramelGlow } = mats;
const gltfLoader = new GLTFLoader();
const sculpturalForms = [];

const setDef = resolveSet(SET_KEY);
const activeSet = setDef.build(scene, {
  isMobile: IS_MOBILE_UA,
  mats,
  gltfLoader,
  sculpturalForms
});
window.__activeSetId = activeSet.id;

const elBrandTag = document.querySelector('.brand-pill .tag');
if (elBrandTag) elBrandTag.textContent = `Paris · ${activeSet.name.replace(/^Paris\s+/i, '')}`;
const elToggleSet = document.getElementById('toggle-set');
if (elToggleSet) {
  const keys = Object.keys(SET_REGISTRY);
  const nextKey = keys[(keys.indexOf(activeSet.id) + 1) % keys.length];
  elToggleSet.textContent = `Set: ${activeSet.name} ⇄`;
  elToggleSet.addEventListener('click', () => {
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('set', nextKey);
    window.location.search = nextParams.toString();
  });
}
document.querySelectorAll('.zone-btn').forEach((btn) => {
  const zi = Number(btn.dataset.zone);
  if (activeSet.zoneLabels[zi]) {
    const parts = activeSet.zoneLabels[zi].split(' · ');
    btn.textContent = `${parts[0]} ${parts[1]?.split(' ').pop() || ''}`.trim();
  }
});

// ---------------------------------------------------------------------------
// 4. Real Product Display Screens (Living Video Screens + Single Source of Truth)
// ---------------------------------------------------------------------------
const texLoader = new THREE.TextureLoader();
const interactables = [];
const productNodes = new Map();
const activeVideos = [];
const STORAGE_KEY = `atelier_collected_${BRAND_SLUG}`;
const collectedSet = new Set((() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
})());
const walkerSystem = createWalkerSystem(scene, activeVideos);

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
  video.preload = IS_MOBILE_UA ? 'metadata' : 'auto';

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
  const override = activeSet.productOverrides?.[prod.id];
  if (override) {
    prod.position = override.position;
    prod.rotationY = override.rotationY;
  }
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

  const frameW = isHero ? 2.18 : 1.62;
  const frameH = isHero ? 2.94 : 2.20;
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
    color: collectedSet.has(prod.id) ? '#f4f2f3' : '#cf8c52',
    emissive: collectedSet.has(prod.id) ? '#ffffff' : '#b85024',
    emissiveIntensity: collectedSet.has(prod.id) ? 1.2 : 2.6,
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
  productNodes.set(prod.id, { group, frameGroup, frontMat, backMat, beacon, beaconMat, baseY: frameY, prod, videoEl: null, sourceLabel: 'Real Product Photo' });
});

function getVisibleProducts() {
  return ANIEZE_PRODUCTS.filter((p) => {
    const n = productNodes.get(p.id);
    return n && n.group.visible !== false;
  });
}

// ---------------------------------------------------------------------------
// 5. Unified Slow 96s Continuous 3D Walk-Through Choreography (16:9 & 9:16)
// ---------------------------------------------------------------------------
const IS_VERTICAL = params.get('vertical') === '1' || window.innerHeight > window.innerWidth;
const ACTIVE_DURATION = 96.0;
window.__ACTIVE_DURATION = ACTIVE_DURATION;

function monolithShot(prod, dist) {
  const isHero = prod.id === 'elara-trench';
  const frameY = isHero ? (0.55 + 0.14 + 2.48 / 2) : (0.48 + 0.14 + 1.94 / 2);
  const fwd = new THREE.Vector3(Math.sin(prod.rotationY), 0, Math.cos(prod.rotationY));
  const target = new THREE.Vector3(prod.position[0], frameY - 0.10, prod.position[2]);
  const pos = new THREE.Vector3(prod.position[0], frameY - 0.02, prod.position[2]).addScaledVector(fwd, dist);
  return { pos, look: target };
}

const pShots = ANIEZE_PRODUCTS.map((p, i) => {
  const baseDist = IS_VERTICAL ? (i === 5 ? 4.55 : 3.55) : (i === 5 ? 4.10 : 3.20);
  return monolithShot(p, baseDist);
});

const CINEMA_KEYFRAMES = [
  { t: 0.0,  pos: new THREE.Vector3(0.0, 1.88, 19.2), look: new THREE.Vector3(0.0, 1.65, 6.0) },
  { t: 5.5,  pos: new THREE.Vector3(0.0, 1.78, 14.8), look: new THREE.Vector3(-0.6, 1.62, 6.5) },
  { t: 8.5,  pos: pShots[0].pos, look: pShots[0].look },
  { t: 16.5, pos: pShots[0].pos.clone().add(new THREE.Vector3(0.14, 0.04, -0.14)), look: pShots[0].look },
  { t: 20.0, pos: new THREE.Vector3(0.0, 1.75, 11.4), look: new THREE.Vector3(0.9, 1.60, 5.5) },
  { t: 22.2, pos: pShots[1].pos, look: pShots[1].look },
  { t: 29.8, pos: pShots[1].pos.clone().add(new THREE.Vector3(-0.14, 0.04, -0.14)), look: pShots[1].look },
  { t: 33.0, pos: new THREE.Vector3(0.0, 1.72, 4.6), look: new THREE.Vector3(0.0, 1.58, -6.0) },
  { t: 36.0, pos: pShots[2].pos, look: pShots[2].look },
  { t: 44.5, pos: pShots[2].pos.clone().add(new THREE.Vector3(0.14, 0.03, -0.14)), look: pShots[2].look },
  { t: 48.0, pos: new THREE.Vector3(0.0, 1.72, -0.2), look: new THREE.Vector3(0.8, 1.58, -8.5) },
  { t: 50.2, pos: pShots[3].pos, look: pShots[3].look },
  { t: 57.8, pos: pShots[3].pos.clone().add(new THREE.Vector3(-0.14, 0.03, -0.14)), look: pShots[3].look },
  { t: 62.0, pos: new THREE.Vector3(0.0, 1.74, -10.4), look: new THREE.Vector3(0.0, 1.68, -24.0) },
  { t: 65.5, pos: pShots[4].pos, look: pShots[4].look },
  { t: 74.0, pos: pShots[4].pos.clone().add(new THREE.Vector3(0.14, 0.03, -0.14)), look: pShots[4].look },
  { t: 77.5, pos: new THREE.Vector3(0.0, 1.80, -16.8), look: new THREE.Vector3(0.0, 1.88, -24.0) },
  { t: 80.0, pos: pShots[5].pos, look: pShots[5].look },
  { t: 92.5, pos: pShots[5].pos.clone().add(new THREE.Vector3(0.0, 0.06, -0.55)), look: pShots[5].look },
  { t: 96.0, pos: pShots[5].pos.clone().add(new THREE.Vector3(0.0, 0.06, -0.65)), look: pShots[5].look }
];

const VIDEO_SYNC_TRIGGERS = [
  { t: 6.8,  id: 'shiny-jagaban' },
  { t: 20.5, id: 'nkisi-trench' },
  { t: 34.2, id: 'nomad-look-15' },
  { t: 48.5, id: 'nomad-look-21' },
  { t: 63.8, id: 'nomad-look-23' },
  { t: 77.5, id: 'elara-trench' }
];
const triggeredSyncs = new Set();

function sampleCinemaCamera(t) {
  const kfs = CINEMA_KEYFRAMES;
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

const z0 = activeSet.zoneLabels[0] || '01 · The Atrium';
const z1 = activeSet.zoneLabels[1] || '02 · Craft Corridor';
const z2 = activeSet.zoneLabels[2] || '03 · Runway Vault';
const CINEMA_BEATS = [
  { t0: 0.6,  t1: 5.8,  slug: null, zone: z0, eyebrow: `${activeBrand.name} · Paris`, title: activeSet.introTitle || 'Enter the 3D Atelier', sub: 'Live display screens · Couture & Runway' },
  { t0: 8.2,  t1: 16.6, slug: 'shiny-jagaban', zone: z0, eyebrow: 'Piece 01 · €320 · 1080p 360° Screen', title: 'Shiny Jagaban Sweater', sub: 'Metallic-fleck knit · Sculpted Agbada shoulders' },
  { t0: 21.8, t1: 29.8, slug: 'nkisi-trench', zone: z0, eyebrow: 'Piece 02 · €680 · 1080p 360° Screen', title: 'Nkisi Layered Trench', sub: 'Wool & lambskin scales · 360° atelier screen' },
  { t0: 35.6, t1: 44.5, slug: 'nomad-look-15', zone: z1, eyebrow: 'Piece 03 · NOMAD Paris Runway', title: 'NOMAD Look 15 — Moto & Wrap', sub: 'Structured leather moto · Floor-length draped wrap' },
  { t0: 49.8, t1: 57.8, slug: 'nomad-look-21', zone: z1, eyebrow: 'Piece 04 · NOMAD Paris Runway', title: 'NOMAD Look 21 — Painted Art Jacket', sub: 'Hand-painted monochrome print · Wide tailored wool' },
  { t0: 65.0, t1: 74.0, slug: 'nomad-look-23', zone: z2, eyebrow: 'Piece 05 · NOMAD Paris Runway', title: 'NOMAD Look 23 — Sculpted Knit', sub: 'Agbada shoulder knit · Ribbed sand tailoring' },
  { t0: 79.5, t1: 92.2, slug: 'elara-trench', zone: z2, eyebrow: 'Piece 06 · €790 · Paris Atelier Finale', title: 'Elara Lambskin Trench', sub: 'Full-length burnished lambskin · Live boutique film' }
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
const elBtnShareLook = document.getElementById('btn-share-look');
const elCollectedCount = document.getElementById('collected-count');
const elCollectedTotal = document.getElementById('collected-total');
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

function buildDeepLinkUrl(lookSlug = null) {
  const u = new URL(window.location.origin + window.location.pathname);
  if (activeBrand.slug !== 'anieze') u.searchParams.set('brand', activeBrand.slug);
  u.searchParams.set('set', activeSet.id);
  if (lookSlug) u.searchParams.set('look', lookSlug);
  return u.toString();
}

if (elShareBtn) {
  elShareBtn.addEventListener('click', async () => {
    const shareUrl = buildDeepLinkUrl(activeProductId);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${activeBrand.name} — Interactive 3D Showroom`, text: `Explore ${activeBrand.name} in 3D`, url: shareUrl });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      elShareBtn.textContent = 'Link Copied ✓';
      setTimeout(() => { elShareBtn.textContent = 'Share 3D Showroom Link'; }, 2200);
    } catch {
      elShareBtn.textContent = shareUrl;
    }
  });
}

if (elBtnShareLook) {
  elBtnShareLook.addEventListener('click', async () => {
    if (!activeProductId) return;
    const url = buildDeepLinkUrl(activeProductId);
    try {
      await navigator.clipboard.writeText(url);
      elBtnShareLook.textContent = 'Direct Look Link Copied ✓';
      setTimeout(() => { elBtnShareLook.textContent = 'Copy direct link to this look'; }, 2200);
    } catch {
      elBtnShareLook.textContent = url;
    }
  });
}

if (elBtnShop) {
  elBtnShop.addEventListener('click', () => {
    trackShowroomEvent({
      brandId: activeBrand.id,
      setSlug: activeSet.id,
      itemSlug: activeProductId,
      eventType: 'cta_click',
      meta: { href: elBtnShop.href }
    });
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

function updateProgressUI() {
  const visibleProds = getVisibleProducts();
  const total = Math.max(1, visibleProds.length);
  const count = visibleProds.filter(p => collectedSet.has(p.id)).length;
  elCollectedCount.textContent = String(count);
  if (elCollectedTotal) elCollectedTotal.textContent = String(visibleProds.length);
  elProgressFill.style.width = `${(count / total) * 100}%`;
  if (visibleProds.length > 0 && count === visibleProds.length) {
    activeSet.unlockAllGlow();
    elModalEyebrow.textContent = `Showroom Unlocked · ${count} / ${visibleProds.length} Collected`;
    elModalTitle.textContent = `Your curated ${activeBrand.name} drop is ready`;
    if (elVipBanner) elVipBanner.classList.add('show');
  } else {
    elModalEyebrow.textContent = 'Your Atelier Bag';
    elModalTitle.textContent = `Discover all ${visibleProds.length} pieces to unlock the drop`;
    if (elVipBanner) elVipBanner.classList.remove('show');
  }
  renderLookbookGrid();
}

function renderLookbookGrid() {
  const visibleProds = getVisibleProducts();
  elModalGrid.innerHTML = visibleProds.map(p => {
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
updateProgressUI();

function focusPiece(idx, openDrawer = false) {
  const visibleProds = getVisibleProducts();
  if (!visibleProds.length) return;
  const safeIdx = ((idx % visibleProds.length) + visibleProds.length) % visibleProds.length;
  currentPieceIdx = safeIdx;
  const p = visibleProds[safeIdx];
  const node = productNodes.get(p.id);
  if (!node) return;

  if (elStepLabel) elStepLabel.textContent = `${String(safeIdx + 1).padStart(2, '0')} / ${String(visibleProds.length).padStart(2, '0')}`;
  const portrait = window.innerHeight > window.innerWidth;
  const dist = p.id === 'elara-trench' ? (portrait ? 4.4 : 3.8) : (portrait ? 3.55 : 3.15);
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), node.group.rotation.y);
  targetCamPos = new THREE.Vector3(node.group.position.x, 1.72, node.group.position.z).addScaledVector(forward, dist);
  targetLookAt = new THREE.Vector3(node.group.position.x, node.baseY - 0.08, node.group.position.z);

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
    closeProductDrawer();
    const visibleCount = Math.max(1, getVisibleProducts().length);
    focusPiece(currentPieceIdx <= 0 ? visibleCount - 1 : currentPieceIdx - 1, false);
  });
  elStepNext.addEventListener('click', () => {
    mode = 'explore';
    document.body.classList.remove('tour-active');
    closeProductDrawer();
    focusPiece(currentPieceIdx + 1, false);
  });
}

function closeProductDrawer() {
  elDrawer.classList.remove('open');
  elDrawer.setAttribute('aria-hidden', 'true');
  activeProductId = null;
  targetCamPos = null;
}

function openProductDrawer(id) {
  const node = productNodes.get(id);
  if (!node || !node.group.visible) return;
  activeProductId = id;
  showingAltImg = false;
  const p = node.prod;
  const visibleProds = getVisibleProducts();
  currentPieceIdx = visibleProds.findIndex(item => item.id === id);
  if (elStepLabel && currentPieceIdx >= 0) {
    elStepLabel.textContent = `${String(currentPieceIdx + 1).padStart(2, '0')} / ${String(visibleProds.length).padStart(2, '0')}`;
  }

  elDrawerIndex.textContent = `Piece ${p.index} · ${p.zone} · ${node.sourceLabel}`;
  elDrawerImg.src = p.frontImg;
  elDrawerImg.alt = p.title;
  elDrawerTitle.textContent = p.title;
  elDrawerPrice.textContent = p.price;
  elDrawerMaterial.textContent = p.material;
  elDrawerStory.textContent = p.story;
  elBtnShop.href = p.url || activeBrand.shopUrl;
  elBtnShop.textContent = p.ctaLabel || (p.ctaType === 'enquire' ? 'Enquire about this look →' : (p.ctaType === 'edition' ? 'Reserve numbered Edition →' : `Shop on ${activeBrand.name} →`));

  const isCol = collectedSet.has(id);
  elBtnCollect.textContent = isCol ? 'Collected in your Atelier Bag ✓' : 'Collect piece (+1)';
  elBtnCollect.classList.toggle('collected', isCol);
  elDrawer.classList.add('open');
  elDrawer.setAttribute('aria-hidden', 'false');

  trackShowroomEvent({
    brandId: activeBrand.id,
    setSlug: activeSet.id,
    itemSlug: id,
    eventType: 'look_click'
  });

  const portrait = window.innerHeight > window.innerWidth;
  const dist = p.id === 'elara-trench' ? (portrait ? 4.4 : 3.8) : (portrait ? 3.55 : 3.15);
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), node.group.rotation.y);
  targetCamPos = new THREE.Vector3(node.group.position.x, 1.75, node.group.position.z).addScaledVector(forward, dist);
  targetLookAt = new THREE.Vector3(node.group.position.x, node.baseY, node.group.position.z);
}

document.getElementById('drawer-close').addEventListener('click', closeProductDrawer);

document.getElementById('angle-toggle').addEventListener('click', () => {
  if (!activeProductId) return;
  const p = productNodes.get(activeProductId).prod;
  showingAltImg = !showingAltImg;
  elDrawerImg.src = showingAltImg ? p.altImg : p.frontImg;
});

elBtnCollect.addEventListener('click', () => {
  if (!activeProductId) return;
  collectedSet.add(activeProductId);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(collectedSet))); } catch {}
  const node = productNodes.get(activeProductId);
  node.beaconMat.color.set('#f4f2f3');
  node.beaconMat.emissive.set('#ffffff');
  node.beaconMat.emissiveIntensity = 1.2;
  elBtnCollect.textContent = 'Collected in your Atelier Bag ✓';
  elBtnCollect.classList.add('collected');
  updateProgressUI();
  trackShowroomEvent({
    brandId: activeBrand.id,
    setSlug: activeSet.id,
    itemSlug: activeProductId,
    eventType: 'collect'
  });
  if (collectedSet.size === getVisibleProducts().length) {
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
    closeProductDrawer();
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
    closeProductDrawer();
    elToggleTour.textContent = 'Exit Film';
    elCinemaOverlay.classList.add('visible');
    trackShowroomEvent({ brandId: activeBrand.id, setSlug: activeSet.id, eventType: 'film_start' });
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
      const hitNode = productNodes.get(hits[0].object.userData.productId);
      if (hitNode && hitNode.group.visible) {
        openProductDrawer(hits[0].object.userData.productId);
      }
    }
  }
};
window.addEventListener('pointerup', endLook);
window.addEventListener('pointercancel', () => { lookPointerId = null; });

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Escape') {
    closeProductDrawer();
    elModal.classList.remove('open');
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = getAdaptiveFov();
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Live Multi-Tenant Supabase Sync + Admin Editor + Deep-Link Hydration
// ---------------------------------------------------------------------------
let adminController = null;
const hydratedFromHash = hydrateSessionFromHash();
if ((params.get('admin') === '1' || hydratedFromHash || getAdminSession().token) && !IS_RENDER) {
  adminController = initAdminEditor({
    scene,
    camera,
    renderer,
    activeSetId: activeSet.id,
    activeBrand,
    productNodes,
    interactables,
    attachVideoToMonolith,
    onVisibilityChanged: updateProgressUI
  });
}

fetchBrandContext(BRAND_SLUG, activeSet.id).then(({ brand, items, connected }) => {
  window.__supabaseConnected = connected;
  if (brand) applyBrandIdentity(brand);

  if (connected && items.length > 0) {
    const bySlug = new Map(items.filter(r => r.item_type === 'monolith').map(r => [r.slug, r]));
    productNodes.forEach((node, slug) => {
      const row = bySlug.get(slug);
      if (!row || row.is_visible === false) {
        node.group.visible = false;
        return;
      }
      node.group.visible = true;
      node.group.position.set(row.pos_x, row.pos_y, row.pos_z);
      node.group.rotation.y = row.rot_y;
      if (row.scale && row.scale !== 1) node.group.scale.set(row.scale, row.scale, row.scale);
      node.prod.position = [row.pos_x, row.pos_y, row.pos_z];
      node.prod.rotationY = row.rot_y;
      if (row.title) node.prod.title = row.title;
      if (row.price) node.prod.price = row.price;
      if (row.material) node.prod.material = row.material;
      if (row.story) node.prod.story = row.story;
      if (row.cta_type) node.prod.ctaType = row.cta_type;
      if (row.cta_url) node.prod.url = row.cta_url;
      if (row.video_url) attachVideoToMonolith(slug, row.video_url, 'Brand Video');
    });
    updateProgressUI();
  }

  if (adminController && adminController.refreshFromScene) {
    adminController.refreshFromScene(activeBrand);
  }

  if (!IS_RENDER) {
    trackShowroomEvent({
      brandId: activeBrand.id,
      setSlug: activeSet.id,
      itemSlug: DEEP_LINK_LOOK,
      eventType: IS_EMBED ? 'embed_view' : 'view'
    });
  }

  // Deep-link directly to a specific look if ?look=<slug> is present
  if (DEEP_LINK_LOOK && productNodes.has(DEEP_LINK_LOOK) && !IS_RENDER) {
    const targetNode = productNodes.get(DEEP_LINK_LOOK);
    if (targetNode && targetNode.group.visible) {
      openProductDrawer(DEEP_LINK_LOOK);
    }
  }
}).catch(() => {});

fetch('./assets/videos/manifest.json')
  .then(r => r.ok ? r.json() : null)
  .then(manifest => {
    if (!manifest || !manifest.screens || BRAND_SLUG !== 'anieze') return;
    Object.entries(manifest.screens).forEach(([id, cfg]) => {
      if (cfg && cfg.video) {
        fetch(cfg.video, { method: 'HEAD' }).then(res => {
          if (res.ok) attachVideoToMonolith(id, cfg.video, cfg.sourceLabel || 'Video Loop');
        }).catch(() => {});
      }
    });
  })
  .catch(() => {});

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
  activeSet.ambientUpdate(t);
  walkerSystem.update(t, camera);

  const BPM = 124;
  const beatPhase = (t * (BPM / 60)) % 1;
  const beatKick = Math.pow(1 - beatPhase, 3.2);
  activeSet.beatPulse(beatKick, collectedSet.size === getVisibleProducts().length && getVisibleProducts().length > 0);

  if (mode === 'tour') {
    VIDEO_SYNC_TRIGGERS.forEach((tr) => {
      if (t >= tr.t && !triggeredSyncs.has(tr.id)) {
        triggeredSyncs.add(tr.id);
        const node = productNodes.get(tr.id);
        if (node && node.videoEl && node.group.visible) {
          try {
            node.videoEl.currentTime = 0;
            node.videoEl.play().catch(() => {});
          } catch {}
        }
      }
    });

    const sample = sampleCinemaCamera(t);
    const pos = sample.pos;
    const look = sample.look;

    const gaitY = Math.sin(t * 3.2) * 0.011 + beatKick * 0.008;
    const gaitX = Math.cos(t * 1.6) * 0.007;
    camera.position.set(pos.x + gaitX, pos.y + gaitY, pos.z);
    camera.lookAt(look);

    if (!CLEAN_SHOT) {
      elCinemaOverlay.classList.add('visible');
      const activeBeat = CINEMA_BEATS.find(b => t >= b.t0 && t <= b.t1);
      const beatHidden = activeBeat?.slug && productNodes.get(activeBeat.slug)?.group.visible === false;
      if (activeBeat && !beatHidden) {
        elCinemaZone.textContent = activeBeat.zone;
        elCinemaEyebrow.textContent = activeBeat.eyebrow;
        elCinemaTitle.textContent = activeBeat.title;
        elCinemaSub.textContent = activeBeat.sub;
        elCinemaCard.classList.add('show');
      } else {
        elCinemaCard.classList.remove('show');
      }
      elCinemaEndcard.classList.toggle('show', t >= ACTIVE_DURATION - 3.5);
    } else {
      elCinemaOverlay.classList.remove('visible');
      elCinemaEndcard.classList.remove('show');
    }
  }
}

window.__setRenderTime = (t) => {
  mode = 'tour';
  tourTime = t;
  window.__tourTime = tourTime;
  window.__tourDone = tourTime >= ACTIVE_DURATION;
  updateSceneAtTime(t);
  renderer.render(scene, camera);
};
window.__tourTime = 0;
window.__tourDone = false;
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
      if (tourTime >= ACTIVE_DURATION) tourTime = ACTIVE_DURATION;
    } else if (tourTime > ACTIVE_DURATION + 0.5) {
      tourTime = 0;
      triggeredSyncs.clear();
    }
    window.__tourTime = tourTime;
    window.__tourDone = tourTime >= ACTIVE_DURATION;
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
