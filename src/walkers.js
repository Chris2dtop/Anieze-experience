import * as THREE from 'three';

/**
 * Modular Real-Human Walker Engine for ANIEZE 3D Sets
 * Uses broadcast green-dominance chroma keying + spill suppression on the GPU
 * (immune to sRGB/Linear shifts, works on Chrome + iOS Safari).
 */
export function createChromaKeyMaterial(map, threshold = 0.14, smoothness = 0.10, spillStrength = 0.85) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uThreshold: { value: threshold },
      uSmoothness: { value: smoothness },
      uSpillStrength: { value: spillStrength }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uThreshold;
      uniform float uSmoothness;
      uniform float uSpillStrength;
      varying vec2 vUv;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        vec3 col = tex.rgb;

        // Broadcast green-dominance key: high on studio green screen, <= 0 on skin, black leather, hair & gold
        float maxRB = max(col.r, col.b);
        float greenness = col.g - maxRB;

        // 1.0 = foreground person, 0.0 = green screen background
        float alpha = 1.0 - smoothstep(uThreshold, uThreshold + max(0.01, uSmoothness), greenness);

        // Despill: clamp excess green bounce on hair and glossy black leather
        float despilledG = min(col.g, maxRB + 0.015);
        col.g = mix(col.g, despilledG, uSpillStrength * smoothstep(0.02, uThreshold + uSmoothness, greenness));

        // Soft edge vignette on plane borders to avoid any stray frame edge pixels
        float edgeX = smoothstep(0.0, 0.025, vUv.x) * smoothstep(1.0, 0.975, vUv.x);
        float edgeY = smoothstep(0.0, 0.015, vUv.y) * smoothstep(1.0, 0.985, vUv.y);
        alpha *= tex.a * edgeX * edgeY;

        if (alpha < 0.04) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

export function createWalkerSystem(scene, activeVideos) {
  const walkers = [];
  window.__walkers = walkers;
  const texLoader = new THREE.TextureLoader();

  // Soft grounded floor contact shadow texture
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 128; sCanvas.height = 128;
  const sCtx = sCanvas.getContext('2d');
  const sGrad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  sGrad.addColorStop(0, 'rgba(0,0,0,0.48)');
  sGrad.addColorStop(0.55, 'rgba(0,0,0,0.20)');
  sGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sCanvas);

  function spawnWalker(cfg) {
    const group = new THREE.Group();
    const height = cfg.height || 1.92;
    const width = height * (cfg.aspect || (9 / 16));

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);

    let mat;
    let videoEl = null;
    if (cfg.video) {
      const video = document.createElement('video');
      video.src = cfg.video;
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
      videoEl = video;

      if (!activeVideos.includes(video)) activeVideos.push(video);

      const vTex = new THREE.VideoTexture(video);
      vTex.minFilter = THREE.LinearFilter;
      vTex.magFilter = THREE.LinearFilter;
      vTex.generateMipmaps = false;

      mat = createChromaKeyMaterial(
        vTex,
        cfg.threshold ?? 0.14,
        cfg.smoothness ?? 0.10,
        cfg.spillStrength ?? 0.85
      );

      const tryPlay = () => { video.play().catch(() => {}); };
      video.addEventListener('canplay', tryPlay, { once: true });
      video.addEventListener('loadeddata', tryPlay, { once: true });
      video.load();
      tryPlay();
    } else if (cfg.image) {
      const imgTex = texLoader.load(cfg.image);
      mat = cfg.chromaKey
        ? createChromaKeyMaterial(imgTex, cfg.threshold ?? 0.14, cfg.smoothness ?? 0.10, cfg.spillStrength ?? 0.85)
        : new THREE.MeshBasicMaterial({ map: imgTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide });
    }

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    plane.position.y = height / 2 - 0.10;
    plane.renderOrder = 5;
    plane.frustumCulled = false;
    group.add(plane);

    const startPos = new THREE.Vector3(...(cfg.start || [-0.8, 0.02, 11.5]));
    const endPos = new THREE.Vector3(...(cfg.end || [-0.8, 0.02, -10.0]));
    group.position.copy(startPos);
    scene.add(group);

    walkers.push({
      id: cfg.id,
      group,
      plane,
      videoEl,
      startPos,
      endPos,
      speed: cfg.speed || 0.026,
      phase: cfg.phase || 0,
      billboard: cfg.billboard !== false,
      staticWalk: Boolean(cfg.staticWalk)
    });
  }

  // Load any configured walkers from assets/shoppers/manifest.json
  fetch('./assets/shoppers/manifest.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data || !Array.isArray(data.walkers)) return;
      data.walkers.forEach((w) => {
        const assetUrl = w.video || w.image;
        if (!assetUrl) return;
        fetch(assetUrl, { method: 'HEAD' })
          .then(res => { if (res.ok) spawnWalker(w); })
          .catch(() => {});
      });
    })
    .catch(() => {});

  return {
    update(t, camera) {
      walkers.forEach((w) => {
        if (w.videoEl && w.videoEl.paused && w.videoEl.readyState >= 2) {
          w.videoEl.play().catch(() => {});
        }
        if (!w.staticWalk) {
          const cycle = (t * w.speed + w.phase) % 1;
          // Smooth ping-pong stroll along the runway/aisle
          const p = cycle < 0.5 ? (cycle * 2) : (2 - cycle * 2);
          w.group.position.lerpVectors(w.startPos, w.endPos, p);
          w.plane.position.y = (w.plane.geometry.parameters.height / 2 - 0.10) + Math.abs(Math.sin(t * 5.2 + w.phase * 6)) * 0.014;
        }
        if (w.billboard && camera) {
          // Cylindrical billboard: face camera horizontally while staying upright
          w.group.lookAt(camera.position.x, w.group.position.y, camera.position.z);
        }
      });
    }
  };
}
