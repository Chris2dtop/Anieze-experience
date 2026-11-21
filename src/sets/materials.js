import * as THREE from 'three';

export function makeStoneTexture(baseHex, grainAmt = 16, streaks = true, seamAlpha = 0.14) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
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

export function createSharedMaterials() {
  const warmPlasterTex = makeStoneTexture('#5a493e', 15, true, 0.14);
  warmPlasterTex.repeat.set(8, 3);
  const warmRibTex = makeStoneTexture('#3e3129', 14, true, 0.16);
  warmRibTex.repeat.set(4, 2);
  const darkFloorTex = makeStoneTexture('#241c17', 14, true, 0.18);
  darkFloorTex.repeat.set(10, 20);
  const obsidianTex = makeStoneTexture('#110d0c', 10, false, 0.12);
  obsidianTex.repeat.set(4, 12);
  const limestoneTex = makeStoneTexture('#c9bba8', 12, true, 0.10);
  limestoneTex.repeat.set(6, 4);
  const cobbleTex = makeStoneTexture('#7a6e63', 18, false, 0.22);
  cobbleTex.repeat.set(18, 28);

  return {
    matWarmWall: new THREE.MeshStandardMaterial({ map: warmPlasterTex, roughness: 0.84, metalness: 0.06 }),
    matWarmRib: new THREE.MeshStandardMaterial({ map: warmRibTex, roughness: 0.78, metalness: 0.08 }),
    matDarkWall: new THREE.MeshStandardMaterial({ map: obsidianTex, color: '#140f0d', roughness: 0.72, metalness: 0.14 }),
    matWarmFloor: new THREE.MeshStandardMaterial({ map: darkFloorTex, roughness: 0.24, metalness: 0.18 }),
    matRunwayFloor: new THREE.MeshStandardMaterial({ map: obsidianTex, color: '#0e0b0a', roughness: 0.12, metalness: 0.42 }),
    matPlinth: new THREE.MeshStandardMaterial({ map: warmRibTex, color: '#332822', roughness: 0.42, metalness: 0.12 }),
    matLimestone: new THREE.MeshStandardMaterial({ map: limestoneTex, roughness: 0.76, metalness: 0.04 }),
    matCobble: new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.68, metalness: 0.08 }),
    matBronze: new THREE.MeshStandardMaterial({ color: '#4a382b', roughness: 0.22, metalness: 0.88 }),
    matSculptObsidian: new THREE.MeshStandardMaterial({ color: '#1b1614', roughness: 0.26, metalness: 0.52 }),
    matRustGlow: new THREE.MeshStandardMaterial({ color: '#a64a25', emissive: '#b85024', emissiveIntensity: 2.8, roughness: 0.25 }),
    matCaramelGlow: new THREE.MeshStandardMaterial({ color: '#cf8c52', emissive: '#e09654', emissiveIntensity: 2.3, roughness: 0.25 }),
    matWarmCove: new THREE.MeshStandardMaterial({ color: '#ffdcb4', emissive: '#ffbd75', emissiveIntensity: 1.9, roughness: 0.35 })
  };
}

export function loadCoutureBusts(scene, gltfLoader, placements, mats, sculpturalForms) {
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

  function addFallbackBust(cfg) {
    const g = new THREE.Group();
    g.position.set(cfg.x, 0, cfg.z);
    g.rotation.y = cfg.rotY;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.92, 20),
      cfg.dark ? mats.matDarkWall : mats.matPlinth
    );
    base.position.y = 0.46;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);
    const bust = new THREE.Mesh(bustGeo, cfg.dark ? mats.matBronze : mats.matSculptObsidian);
    bust.position.y = 1.22;
    bust.scale.set(1.12, 1.05, 0.76);
    bust.castShadow = true;
    g.add(bust);
    scene.add(g);
    sculpturalForms.push(g);
  }

  gltfLoader.load(
    './assets/models/anieze_couture_bust.glb',
    (gltf) => {
      placements.forEach((cfg) => {
        const inst = gltf.scene.clone(true);
        inst.position.set(cfg.x, 0, cfg.z);
        inst.rotation.y = cfg.rotY;
        inst.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        scene.add(inst);
        sculpturalForms.push(inst);
      });
    },
    undefined,
    () => placements.forEach(addFallbackBust)
  );
}
