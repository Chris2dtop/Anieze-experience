import * as THREE from 'three';
import { loadCoutureBusts } from './materials.js';

export function buildParisAtelier(scene, { isMobile, mats, gltfLoader, sculpturalForms }) {
  scene.background = new THREE.Color('#0f0a08');
  scene.fog = new THREE.FogExp2('#130d0a', 0.022);
  scene.environmentIntensity = 0.26;

  function addBox(w, h, d, mat, x, y, z, cast = true, recv = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = recv;
    scene.add(m);
    return m;
  }

  // Floors & glowing runway guide inlays
  addBox(14, 0.2, 32, mats.matWarmFloor, 0, -0.1, 6, false, true);
  addBox(0.06, 0.015, 30, mats.matCaramelGlow, -1.9, 0.008, 6, false, false);
  addBox(0.06, 0.015, 30, mats.matCaramelGlow, 1.9, 0.008, 6, false, false);

  addBox(16, 0.2, 22, mats.matRunwayFloor, 0, -0.1, -21, false, true);
  addBox(3.4, 0.22, 18, mats.matRunwayFloor, 0, 0.11, -19.5, true, true);
  addBox(0.06, 0.035, 18, mats.matRustGlow, -1.72, 0.22, -19.5, false, false);
  addBox(0.06, 0.035, 18, mats.matRustGlow, 1.72, 0.22, -19.5, false, false);

  // Atrium & Craft Corridor enclosure
  addBox(0.4, 7.2, 32, mats.matWarmWall, -6.8, 3.6, 6, false, true);
  addBox(0.4, 7.2, 32, mats.matWarmWall, 6.8, 3.6, 6, false, true);
  addBox(14, 0.4, 32, mats.matWarmRib, 0, 7.2, 6, false, true);
  addBox(14, 7.2, 0.4, mats.matWarmWall, 0, 3.6, 22, false, true);

  // Runway Vault dark obsidian enclosure
  addBox(0.5, 8.2, 22, mats.matDarkWall, -7.8, 4.1, -21, false, true);
  addBox(0.5, 8.2, 22, mats.matDarkWall, 7.8, 4.1, -21, false, true);
  addBox(16, 0.5, 22, mats.matDarkWall, 0, 8.2, -21, false, true);
  addBox(16, 8.2, 0.5, mats.matDarkWall, 0, 4.1, -31.8, false, true);

  // Ribbed colonnade + suspended bronze linear pendant luminaires
  for (let z = 16; z >= -8; z -= 4.8) {
    addBox(0.7, 7.0, 0.7, mats.matWarmRib, -6.2, 3.5, z, true, true);
    addBox(0.7, 7.0, 0.7, mats.matWarmRib, 6.2, 3.5, z, true, true);
    addBox(13.2, 0.55, 0.55, mats.matWarmRib, 0, 6.8, z, true, true);
    addBox(11.4, 0.05, 0.09, mats.matWarmCove, 0, 6.5, z - 0.28, false, false);

    const pGroup = new THREE.Group();
    pGroup.position.set(0, 5.25, z - 2.4);
    const rodL = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.55, 8), mats.matBronze);
    rodL.position.set(-1.35, 0.78, 0);
    const rodR = rodL.clone();
    rodR.position.x = 1.35;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.06, 0.08), mats.matBronze);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.025, 0.045), mats.matWarmCove);
    glow.position.y = -0.035;
    pGroup.add(rodL, rodR, bar, glow);
    scene.add(pGroup);
  }

  // Runway Vault neon portal arches
  for (let i = 0; i < 4; i++) {
    const z = -12 - i * 4.5;
    addBox(0.55, 7.6, 0.55, mats.matDarkWall, -5.8, 3.8, z, true, true);
    addBox(0.55, 7.6, 0.55, mats.matDarkWall, 5.8, 3.8, z, true, true);
    addBox(12.1, 0.55, 0.55, mats.matDarkWall, 0, 7.6, z, true, true);
    const stripMat = i % 2 === 0 ? mats.matRustGlow : mats.matCaramelGlow;
    addBox(0.08, 7.2, 0.08, stripMat, -5.5, 3.6, z, false, false);
    addBox(0.08, 7.2, 0.08, stripMat, 5.5, 3.6, z, false, false);
    addBox(11.1, 0.08, 0.08, stripMat, 0, 7.3, z, false, false);
  }

  // Blender-sculpted ANIEZE Couture Busts
  loadCoutureBusts(scene, gltfLoader, [
    { x: -4.7, z: 15.2, rotY: 0.45, dark: false },
    { x: 4.7,  z: 15.2, rotY: -0.45, dark: false },
    { x: -4.3, z: -21.8, rotY: 0.5, dark: true },
    { x: 4.3,  z: -21.8, rotY: -0.5, dark: true }
  ], mats, sculpturalForms);

  // Bronze garment rails
  function addGarmentRail(x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 12), mats.matBronze);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.68;
    g.add(bar);
    for (const sx of [-1.05, 1.05]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 12), mats.matBronze);
      leg.position.set(sx, 0.85, 0);
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.55), mats.matBronze);
      foot.position.set(sx, 0.02, 0);
      g.add(foot);
    }
    scene.add(g);
  }
  addGarmentRail(-5.4, 5.0, Math.PI / 2);
  addGarmentRail(5.4, 2.0, Math.PI / 2);

  // Lighting
  scene.add(new THREE.HemisphereLight('#ffdcb8', '#140c08', 0.24));
  const shadowRes = isMobile ? 1024 : 2048;

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

  // Warm floating dust motes
  const dustCount = isMobile ? 140 : 280;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 12.5;
    dustPos[i * 3 + 1] = 0.4 + Math.random() * 6.2;
    dustPos[i * 3 + 2] = 18 - Math.random() * 48;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustPoints = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: '#f7cfa0', size: 0.048, transparent: true, opacity: 0.52 })
  );
  scene.add(dustPoints);

  return {
    id: 'atelier',
    name: 'Paris Atelier',
    zoneLabels: ['01 · The Atrium', '02 · Craft Corridor', '03 · Runway Vault'],
    introTitle: 'Enter the 3D Atelier',
    beatPulse(beatKick, allCollected) {
      mats.matRustGlow.emissiveIntensity = 2.4 + beatKick * 1.45;
      mats.matCaramelGlow.emissiveIntensity = 1.9 + beatKick * 1.1;
      vaultRustLight.intensity = (allCollected ? 85 : 54) + beatKick * 20;
    },
    ambientUpdate(t) {
      dustPoints.position.y = Math.sin(t * 0.35) * 0.12;
    },
    unlockAllGlow() {
      vaultRustLight.intensity = 90;
    }
  };
}
