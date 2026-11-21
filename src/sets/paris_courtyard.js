import * as THREE from 'three';
import { loadCoutureBusts } from './materials.js';

function createGoldenHourSkyDome() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#2a3954'); // deep Parisian dusk zenith
  grad.addColorStop(0.32, '#5a6680'); // soft twilight slate
  grad.addColorStop(0.55, '#ba886b'); // warm rose-amber mid-sky
  grad.addColorStop(0.72, '#eab384'); // golden-hour horizon glow
  grad.addColorStop(1.00, '#46352b'); // grounded warm earth bounce
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.SphereGeometry(95, 32, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false })
  );
}

export function buildParisCourtyard(scene, { isMobile, mats, gltfLoader, sculpturalForms }) {
  scene.background = new THREE.Color('#c89874');
  scene.fog = new THREE.FogExp2('#c29472', 0.0115);
  scene.environmentIntensity = 0.55;

  scene.add(createGoldenHourSkyDome());

  const matWater = new THREE.MeshStandardMaterial({
    color: '#1f282e',
    roughness: 0.06,
    metalness: 0.85
  });
  const matFoliage = new THREE.MeshStandardMaterial({
    color: '#2e3a28',
    roughness: 0.78,
    metalness: 0.02
  });
  const matWindowGlow = new THREE.MeshStandardMaterial({
    color: '#ffdfad',
    emissive: '#f5a962',
    emissiveIntensity: 1.6,
    roughness: 0.2
  });
  const matSlateRunway = new THREE.MeshStandardMaterial({
    color: '#1b1817',
    roughness: 0.22,
    metalness: 0.28
  });

  function addBox(w, h, d, mat, x, y, z, cast = true, recv = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = recv;
    scene.add(m);
    return m;
  }

  // Expansive limestone cobblestone courtyard plaza
  addBox(42, 0.2, 76, mats.matCobble, 0, -0.1, -6, false, true);

  // Raised dark slate fashion catwalk running the length of the courtyard
  addBox(3.8, 0.16, 50, matSlateRunway, 0, 0.08, -4.5, true, true);
  addBox(0.06, 0.03, 50, mats.matCaramelGlow, -1.92, 0.16, -4.5, false, false);
  addBox(0.06, 0.03, 50, mats.matCaramelGlow, 1.92, 0.16, -4.5, false, false);

  // Sleek flanking architectural reflecting pools along the Promenade
  for (const side of [-1, 1]) {
    addBox(1.85, 0.14, 24, mats.matLimestone, side * 3.25, 0.07, -14.0, true, true);
    addBox(1.6, 0.04, 23.6, matWater, side * 3.25, 0.15, -14.0, false, true);
  }

  // Haussmann Limestone Arcade Colonnades flanking left & right (x = ±7.8)
  for (const side of [-1, 1]) {
    const wallX = side * 8.6;
    // Main limestone facade wall
    addBox(0.8, 10.5, 62, mats.matLimestone, wallX, 5.25, -5, true, true);
    // Classic Parisian cornice moldings
    addBox(1.3, 0.35, 62, mats.matLimestone, wallX - side * 0.25, 5.4, -5, true, true);
    addBox(1.5, 0.45, 62, mats.matLimestone, wallX - side * 0.35, 10.4, -5, true, true);

    // Colonnade pilasters & warm glowing arched French windows
    for (let z = 19; z >= -27; z -= 5.2) {
      addBox(0.75, 10.2, 0.75, mats.matLimestone, side * 7.75, 5.1, z, true, true);
      // Bronze-framed upper gallery window with warm golden interior glow
      addBox(0.18, 3.0, 2.2, mats.matBronze, side * 8.15, 7.6, z - 2.6, false, false);
      addBox(0.14, 2.75, 1.95, matWindowGlow, side * 8.12, 7.6, z - 2.6, false, false);
      // Lower arcade shadow recess
      addBox(0.22, 4.1, 2.8, mats.matDarkWall, side * 8.18, 2.1, z - 2.6, false, true);
    }
  }

  // Grand Parisian Courtyard Rear Wall (z = -31.5) with Architectural Branding + Massive Wide Video Wall
  addBox(18.4, 11.4, 0.9, mats.matLimestone, 0, 5.7, -31.5, true, true);
  addBox(19.0, 0.5, 1.5, mats.matLimestone, 0, 11.3, -31.3, true, true);

  // 1. Upper Wall Architectural Branding: Official ANIEZE Logo + "DESIGNED IN PARIS"
  const brandCanvas = document.createElement('canvas');
  brandCanvas.width = 2048;
  brandCanvas.height = 512;
  const bCtx = brandCanvas.getContext('2d');
  const brandTex = new THREE.CanvasTexture(brandCanvas);
  brandTex.colorSpace = THREE.SRGBColorSpace;
  brandTex.anisotropy = 8;

  function drawWallBranding(logoImg = null) {
    bCtx.clearRect(0, 0, 2048, 512);
    if (logoImg) {
      const targetH = 195;
      const targetW = targetH * (logoImg.width / Math.max(1, logoImg.height));
      bCtx.drawImage(logoImg, (2048 - targetW) / 2, 72, targetW, targetH);
    } else {
      bCtx.fillStyle = '#14100e';
      bCtx.font = '700 160px "Host Grotesk", "Helvetica Neue", Arial, sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText('ANIEZE', 1024, 175);
    }
    bCtx.fillStyle = '#8b5a34';
    bCtx.fillRect(1024 - 160, 305, 320, 4);
    bCtx.fillStyle = '#1f1814';
    bCtx.font = '600 54px "Host Grotesk", "Helvetica Neue", Arial, sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText('D E S I G N E D   I N   P A R I S', 1024, 378);
    brandTex.needsUpdate = true;
  }
  drawWallBranding();

  const logoLoaderImg = new Image();
  logoLoaderImg.crossOrigin = 'anonymous';
  logoLoaderImg.onload = () => drawWallBranding(logoLoaderImg);
  logoLoaderImg.src = './assets/brand/logo-black.svg';

  const brandSign = new THREE.Mesh(
    new THREE.PlaneGeometry(11.6, 2.9),
    new THREE.MeshBasicMaterial({ map: brandTex, transparent: true, depthWrite: false })
  );
  brandSign.position.set(0, 9.15, -30.96);
  scene.add(brandSign);

  // 2. Massive Wide Horizontal Cinema Video Wall spanning below the branding all the way down
  const wallW = 15.2;
  const wallH = 6.35;
  const wallY = 3.55;
  addBox(wallW + 0.36, wallH + 0.36, 0.32, mats.matBronze, 0, wallY, -30.98, false, true);
  addBox(wallW + 0.44, 0.08, 0.38, mats.matCaramelGlow, 0, wallY + wallH / 2 + 0.20, -30.94, false, false);
  addBox(wallW + 0.44, 0.08, 0.38, mats.matCaramelGlow, 0, wallY - wallH / 2 - 0.20, -30.94, false, false);

  const wideScreenMat = new THREE.MeshStandardMaterial({
    color: '#14100e',
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.72,
    roughness: 0.28,
    metalness: 0.05
  });
  const wideScreen = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), wideScreenMat);
  wideScreen.position.set(0, wallY, -30.79);
  scene.add(wideScreen);

  const wallVideo = document.createElement('video');
  wallVideo.src = './assets/videos/courtyard_wall_wide.mp4';
  wallVideo.loop = true;
  wallVideo.muted = true;
  wallVideo.defaultMuted = true;
  wallVideo.autoplay = true;
  wallVideo.playsInline = true;
  wallVideo.setAttribute('playsinline', '');
  wallVideo.setAttribute('webkit-playsinline', '');
  wallVideo.setAttribute('muted', '');
  wallVideo.crossOrigin = 'anonymous';
  wallVideo.preload = 'auto';
  wallVideo.addEventListener('canplay', () => {
    wallVideo.play().catch(() => {});
    const vTex = new THREE.VideoTexture(wallVideo);
    vTex.colorSpace = THREE.SRGBColorSpace;
    vTex.minFilter = THREE.LinearFilter;
    vTex.magFilter = THREE.LinearFilter;
    wideScreenMat.map = vTex;
    wideScreenMat.emissiveMap = vTex;
    wideScreenMat.color.set('#ffffff');
    wideScreenMat.needsUpdate = true;
  }, { once: true });
  wallVideo.load();
  window.addEventListener('touchstart', () => { if (wallVideo.paused) wallVideo.play().catch(() => {}); }, { passive: true });
  window.addEventListener('pointerdown', () => { if (wallVideo.paused) wallVideo.play().catch(() => {}); }, { passive: true });

  // Sculptural Mediterranean Olive/Cypress Planter Urns lining the courtyard
  function addPlanter(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.34, 0.85, 16), mats.matLimestone);
    urn.position.y = 0.425;
    urn.castShadow = true;
    urn.receiveShadow = true;
    g.add(urn);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.48, 0.08, 16), mats.matBronze);
    rim.position.y = 0.87;
    g.add(rim);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.15, 8), mats.matWarmRib);
    trunk.position.y = 1.4;
    g.add(trunk);
    const puffs = [
      [0, 2.25, 0, 0.62],
      [-0.28, 2.05, 0.18, 0.44],
      [0.30, 2.10, -0.15, 0.46],
      [0.05, 2.68, 0.05, 0.42]
    ];
    puffs.forEach(([px, py, pz, r]) => {
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), matFoliage);
      leaf.position.set(px, py, pz);
      leaf.castShadow = true;
      g.add(leaf);
    });
    scene.add(g);
  }

  for (const z of [16.5, 6.0, -5.5, -17.5]) {
    addPlanter(-6.2, z);
    addPlanter(6.2, z);
  }

  // Blender-sculpted ANIEZE Couture Busts flanking entrance & golden-hour finale
  loadCoutureBusts(scene, gltfLoader, [
    { x: -4.7, z: 15.2, rotY: 0.45, dark: false },
    { x: 4.7,  z: 15.2, rotY: -0.45, dark: false },
    { x: -4.3, z: -21.8, rotY: 0.5, dark: true },
    { x: 4.3,  z: -21.8, rotY: -0.5, dark: true }
  ], mats, sculpturalForms);

  // Golden-hour outdoor lighting
  scene.add(new THREE.HemisphereLight('#ffe0bc', '#564336', 0.82));
  const shadowRes = isMobile ? 1024 : 2048;

  const goldenSun = new THREE.DirectionalLight('#ffbe7d', 2.9);
  goldenSun.position.set(16, 18, 12);
  goldenSun.castShadow = true;
  goldenSun.shadow.mapSize.set(shadowRes, shadowRes);
  goldenSun.shadow.camera.left = -18;
  goldenSun.shadow.camera.right = 18;
  goldenSun.shadow.camera.top = 28;
  goldenSun.shadow.camera.bottom = -32;
  goldenSun.shadow.camera.near = 2;
  goldenSun.shadow.camera.far = 65;
  goldenSun.shadow.bias = -0.0005;
  scene.add(goldenSun);

  const heroLight = new THREE.SpotLight('#fff0d8', 95, 28, Math.PI / 5.5, 0.55, 1.2);
  heroLight.position.set(0, 8.2, -19.5);
  heroLight.target.position.set(0, 1.7, -24.0);
  scene.add(heroLight, heroLight.target);

  // Drifting golden-hour sunlit motes
  const moteCount = isMobile ? 120 : 240;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 14.0;
    motePos[i * 3 + 1] = 0.6 + Math.random() * 8.0;
    motePos[i * 3 + 2] = 19 - Math.random() * 50;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ color: '#ffe5bd', size: 0.055, transparent: true, opacity: 0.48 })
  );
  scene.add(motes);

  return {
    id: 'courtyard',
    name: 'Paris Courtyard',
    zoneLabels: ['01 · Limestone Forecourt', '02 · Arcade Promenade', '03 · Golden-Hour Runway'],
    introTitle: 'Enter the Paris Courtyard',
    productOverrides: {
      'elara-trench': { position: [4.2, 0, -20.5], rotationY: -0.52 }
    },
    beatPulse(beatKick, allCollected) {
      mats.matCaramelGlow.emissiveIntensity = 1.8 + beatKick * 1.1;
      mats.matRustGlow.emissiveIntensity = 2.0 + beatKick * 1.2;
      heroLight.intensity = (allCollected ? 125 : 92) + beatKick * 16;
    },
    ambientUpdate(t) {
      motes.position.y = Math.sin(t * 0.3) * 0.16;
      motes.position.x = Math.cos(t * 0.2) * 0.12;
    },
    unlockAllGlow() {
      heroLight.intensity = 135;
    }
  };
}
