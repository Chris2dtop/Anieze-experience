import * as THREE from 'three';
import {
  adminSignIn,
  adminSignUp,
  adminSignOut,
  getAdminSession,
  saveItemTransform,
  fetchBrandAnalytics,
  queueRenderJob,
  fetchRenderJobs
} from './supabase-sync.js';

/**
 * Multi-Tenant Brand Admin 3D Layout, Embed, Analytics & Marketing Export Studio (?admin=1)
 */
export function initAdminEditor({
  scene,
  camera,
  renderer,
  activeSetId,
  activeBrand,
  productNodes,
  attachVideoToMonolith,
  onVisibilityChanged
}) {
  let selectedSlug = null;
  let dragging = false;
  let brandRef = activeBrand || { id: null, slug: 'anieze', name: 'ANIEZE' };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Glowing floor selection ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.32, 40),
    new THREE.MeshBasicMaterial({ color: '#e09654', side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.visible = false;
  scene.add(ring);

  // Floating, draggable, collapsible Admin Panel
  const panel = document.createElement('div');
  panel.id = 'admin-editor-panel';
  panel.style.cssText = [
    'position:fixed', 'top:76px', 'right:16px', 'width:308px', 'max-height:calc(100vh - 130px)',
    'overflow-y:auto', 'z-index:90', 'background:rgba(16,12,10,0.94)', 'color:#f4f2f3',
    'border:1px solid rgba(207,140,82,0.45)', 'border-radius:14px', 'padding:14px',
    'font-family:"Host Grotesk",system-ui,sans-serif', 'font-size:12.5px',
    'backdrop-filter:blur(14px)', 'box-shadow:0 16px 40px rgba(0,0,0,0.45)',
    'transition:transform 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease'
  ].join(';');

  // Right-edge pull-out tab when collapsed
  const edgeTab = document.createElement('button');
  edgeTab.id = 'admin-edge-tab';
  edgeTab.type = 'button';
  edgeTab.textContent = '‹ Admin';
  edgeTab.title = 'Open Brand Admin Studio';
  edgeTab.style.cssText = [
    'position:fixed', 'top:50%', 'right:0', 'transform:translateY(-50%)',
    'z-index:91', 'background:rgba(16,12,10,0.92)', 'color:#cf8c52',
    'border:1px solid rgba(207,140,82,0.5)', 'border-right:none',
    'border-radius:10px 0 0 10px', 'padding:12px 9px', 'cursor:pointer',
    'font-family:"Host Grotesk",system-ui,sans-serif', 'font-size:11.5px',
    'font-weight:700', 'letter-spacing:0.08em', 'text-transform:uppercase',
    'writing-mode:vertical-rl', 'text-orientation:mixed',
    'backdrop-filter:blur(12px)', 'box-shadow:-4px 8px 24px rgba(0,0,0,0.35)',
    'display:none'
  ].join(';');
  document.body.appendChild(edgeTab);

  const itemsHtml = Array.from(productNodes.entries()).map(([id, node]) =>
    `<option value="${id}">${node.prod.index} · ${node.prod.title}</option>`
  ).join('');

  panel.innerHTML = `
    <div id="adm-drag-handle" title="Drag to move panel" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:grab;user-select:none;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <strong id="adm-brand-title" style="letter-spacing:0.06em;font-size:11px;text-transform:uppercase;color:#cf8c52;">⋮⋮ ${brandRef.name} · ${activeSetId}</strong>
      <div style="display:flex;align-items:center;gap:6px;">
        <span id="adm-status" style="font-size:11px;color:#aaa;">Ready</span>
        <button id="adm-hide" type="button" title="Hide to right edge" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.22);color:#f4f2f3;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer;line-height:1.2;">Hide ›</button>
      </div>
    </div>

    <div id="adm-auth-box" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.12);"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;background:rgba(255,255,255,0.05);padding:3px;border-radius:9px;">
      <button class="adm-tab" data-tab="layout" type="button" style="padding:5px 4px;border:none;border-radius:7px;background:#cf8c52;color:#120d0a;font-weight:700;font-size:11px;cursor:pointer;">Layout</button>
      <button class="adm-tab" data-tab="embed" type="button" style="padding:5px 4px;border:none;border-radius:7px;background:transparent;color:#d6cdc6;font-weight:600;font-size:11px;cursor:pointer;">Embed</button>
      <button class="adm-tab" data-tab="export" type="button" style="padding:5px 4px;border:none;border-radius:7px;background:transparent;color:#d6cdc6;font-weight:600;font-size:11px;cursor:pointer;">Export</button>
    </div>

    <!-- TAB 1: LAYOUT -->
    <div id="adm-pane-layout">
      <label style="display:block;font-size:11px;color:#bfb8b2;margin-bottom:4px;">Selected Display Screen</label>
      <select id="adm-select" style="width:100%;padding:7px 8px;border-radius:8px;background:#1e1815;color:#fff;border:1px solid rgba(255,255,255,0.18);margin-bottom:8px;">
        ${itemsHtml}
      </select>
      <button id="adm-visible-toggle" type="button" aria-pressed="true" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:10px;border:1px solid rgba(142,224,156,0.45);border-radius:8px;background:rgba(142,224,156,0.14);color:#e9f9ec;font-weight:600;cursor:pointer;font-size:11.5px;">
        <span id="adm-vis-label">Display Screen: ON (Visible)</span>
        <span id="adm-vis-pill" style="display:inline-flex;align-items:center;width:32px;height:17px;border-radius:999px;background:#52c771;padding:2px;box-sizing:border-box;transition:background 0.2s;">
          <span id="adm-vis-dot" style="width:13px;height:13px;border-radius:50%;background:#fff;transform:translateX(15px);transition:transform 0.2s;"></span>
        </span>
      </button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <label style="font-size:11px;">X <input id="adm-x" type="number" step="0.1" style="width:100%;padding:5px;border-radius:6px;background:#1e1815;color:#fff;border:1px solid #3c322c;box-sizing:border-box;"></label>
        <label style="font-size:11px;">Z <input id="adm-z" type="number" step="0.1" style="width:100%;padding:5px;border-radius:6px;background:#1e1815;color:#fff;border:1px solid #3c322c;box-sizing:border-box;"></label>
        <label style="font-size:11px;">Y (Height) <input id="adm-y" type="number" step="0.05" style="width:100%;padding:5px;border-radius:6px;background:#1e1815;color:#fff;border:1px solid #3c322c;box-sizing:border-box;"></label>
        <label style="font-size:11px;">Rotate Y <input id="adm-rot" type="number" step="0.05" style="width:100%;padding:5px;border-radius:6px;background:#1e1815;color:#fff;border:1px solid #3c322c;box-sizing:border-box;"></label>
      </div>
      <label style="display:block;font-size:11px;margin-bottom:10px;">Scale <span id="adm-scale-val">1.00</span>
        <input id="adm-scale" type="range" min="0.6" max="1.8" step="0.05" value="1" style="width:100%;accent-color:#cf8c52;">
      </label>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="adm-drag-mode" type="button" aria-pressed="false" style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid rgba(207,140,82,0.55);border-radius:8px;background:rgba(207,140,82,0.14);color:#f4e6d8;font-weight:600;cursor:pointer;font-size:11.5px;">
          <span id="adm-drag-label">Drag to Move: OFF</span>
          <span id="adm-drag-pill" style="display:inline-flex;align-items:center;width:30px;height:16px;border-radius:999px;background:rgba(255,255,255,0.22);padding:2px;box-sizing:border-box;transition:background 0.2s;">
            <span id="adm-drag-dot" style="width:12px;height:12px;border-radius:50%;background:#fff;transform:translateX(0);transition:transform 0.2s;"></span>
          </span>
        </button>
        <button id="adm-reset" type="button" style="padding:7px 10px;border:1px solid rgba(255,255,255,0.22);border-radius:8px;background:transparent;color:#e5ddd6;cursor:pointer;font-size:11.5px;" title="Reset screen back to its last saved spot">Reset</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="adm-swap-video" type="button" style="flex:1;padding:7px 8px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(255,255,255,0.06);color:#e5ddd6;cursor:pointer;font-size:11px;">Swap Screen Video (.mp4)</button>
        <input id="adm-swap-video-input" type="file" accept="video/mp4,video/webm" style="display:none;" />
      </div>
      <div style="display:flex;gap:8px;">
        <button id="adm-save" type="button" style="flex:1;padding:9px 10px;border:none;border-radius:9px;background:#cf8c52;color:#120d0a;font-weight:700;cursor:pointer;">Save to Supabase</button>
        <button id="adm-copy" type="button" style="padding:9px 10px;border:1px solid rgba(255,255,255,0.22);border-radius:9px;background:transparent;color:#fff;cursor:pointer;" title="Copy coordinates JSON">Copy</button>
      </div>
    </div>

    <!-- TAB 2: EMBED & LIVE ANALYTICS -->
    <div id="adm-pane-embed" style="display:none;">
      <div style="font-size:11px;color:#cf8c52;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Live Showroom Analytics</div>
      <div id="adm-stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;"><div style="font-size:10px;color:#aaa;">Visits</div><strong id="st-views" style="font-size:16px;">—</strong></div>
        <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;"><div style="font-size:10px;color:#aaa;">Look Clicks</div><strong id="st-clicks" style="font-size:16px;">—</strong></div>
        <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;"><div style="font-size:10px;color:#aaa;">Collected</div><strong id="st-collects" style="font-size:16px;">—</strong></div>
        <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;"><div style="font-size:10px;color:#aaa;">Shop CTAs</div><strong id="st-ctas" style="font-size:16px;">—</strong></div>
      </div>
      <div style="font-size:11px;color:#bfb8b2;margin-bottom:4px;">1-Line Storefront Embed (&lt;iframe&gt;)</div>
      <textarea id="adm-embed-code" readonly rows="3" style="width:100%;padding:7px;border-radius:8px;background:#1e1815;color:#e5ddd6;border:1px solid #3c322c;font-family:monospace;font-size:10.5px;box-sizing:border-box;resize:none;margin-bottom:6px;"></textarea>
      <button id="adm-copy-embed" type="button" style="width:100%;padding:8px;border:none;border-radius:8px;background:#cf8c52;color:#120d0a;font-weight:700;cursor:pointer;margin-bottom:8px;">Copy &lt;iframe&gt; Embed Code</button>
      <a href="./onboarding.html" style="display:block;text-align:center;padding:8px;border:1px solid rgba(207,140,82,0.5);border-radius:8px;color:#f4e6d8;text-decoration:none;font-weight:600;font-size:11.5px;">+ Onboard New Brand Showroom →</a>
    </div>

    <!-- TAB 3: MARKETING VIDEO EXPORT ENGINE -->
    <div id="adm-pane-export" style="display:none;">
      <div style="font-size:11px;color:#cf8c52;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Marketing Export Engine</div>
      <p style="margin:0 0 8px;font-size:11px;color:#bfb8b2;line-height:1.45;">Render cinema-grade 16:9 + 3-part 9:16 TikTok/Reels launch videos directly from this live 3D set.</p>
      <label style="display:block;font-size:11px;color:#bfb8b2;margin-bottom:4px;">Export Bundle</label>
      <select id="adm-export-format" style="width:100%;padding:7px 8px;border-radius:8px;background:#1e1815;color:#fff;border:1px solid rgba(255,255,255,0.18);margin-bottom:8px;">
        <option value="all_formats">All Formats (16:9 + 3-Part 9:16)</option>
        <option value="9x16_3part_bundle">9:16 Vertical 3-Part Reels Series</option>
        <option value="16x9_full">16:9 Widescreen Hero Film (1080p)</option>
      </select>
      <button id="adm-queue-export" type="button" style="width:100%;padding:9px;border:none;border-radius:9px;background:#cf8c52;color:#120d0a;font-weight:700;cursor:pointer;margin-bottom:8px;">Queue Video Export Job</button>
      <div style="font-size:10.5px;color:#aaa;margin-bottom:4px;">Local / Worker CLI Command:</div>
      <code id="adm-export-cli" style="display:block;padding:7px;border-radius:7px;background:#1e1815;color:#f4e6d8;font-size:10.5px;word-break:break-all;margin-bottom:8px;"></code>
      <div id="adm-jobs-list" style="font-size:11px;color:#bfb8b2;"></div>
    </div>
  `;
  document.body.appendChild(panel);

  // Tab switching
  const tabBtns = panel.querySelectorAll('.adm-tab');
  const panes = {
    layout: panel.querySelector('#adm-pane-layout'),
    embed: panel.querySelector('#adm-pane-embed'),
    export: panel.querySelector('#adm-pane-export')
  };
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => {
        const active = b.dataset.tab === target;
        b.style.background = active ? '#cf8c52' : 'transparent';
        b.style.color = active ? '#120d0a' : '#d6cdc6';
      });
      Object.entries(panes).forEach(([k, el]) => { el.style.display = k === target ? 'block' : 'none'; });
      if (target === 'embed') refreshAnalytics();
      if (target === 'export') refreshJobs();
    });
  });

  // Hide / pull-out right-edge toggle
  const btnHide = panel.querySelector('#adm-hide');
  function setCollapsed(hidden) {
    if (hidden) {
      panel.style.transform = 'translateX(calc(100% + 40px))';
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
      panel.style.visibility = 'hidden';
      edgeTab.style.display = 'block';
    } else {
      panel.style.visibility = 'visible';
      panel.style.transform = 'translateX(0)';
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      edgeTab.style.display = 'none';
    }
  }
  btnHide.addEventListener('pointerdown', (e) => e.stopPropagation());
  btnHide.addEventListener('click', (e) => { e.stopPropagation(); setCollapsed(true); });
  edgeTab.addEventListener('click', () => setCollapsed(false));

  // Freely draggable header bar
  const dragHandle = panel.querySelector('#adm-drag-handle');
  let panelDrag = null;
  dragHandle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    panel.style.right = 'auto';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.transition = 'none';
    dragHandle.style.cursor = 'grabbing';
    panelDrag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    dragHandle.setPointerCapture(e.pointerId);
  });
  dragHandle.addEventListener('pointermove', (e) => {
    if (!panelDrag) return;
    const nx = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, e.clientX - panelDrag.dx));
    const ny = Math.max(8, Math.min(window.innerHeight - 60, e.clientY - panelDrag.dy));
    panel.style.left = `${nx}px`;
    panel.style.top = `${ny}px`;
  });
  const stopPanelDrag = () => {
    if (!panelDrag) return;
    panelDrag = null;
    dragHandle.style.cursor = 'grab';
    panel.style.transition = 'transform 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease';
  };
  dragHandle.addEventListener('pointerup', stopPanelDrag);
  dragHandle.addEventListener('pointercancel', stopPanelDrag);

  const elBrandTitle = panel.querySelector('#adm-brand-title');
  const elStatus = panel.querySelector('#adm-status');
  const elAuthBox = panel.querySelector('#adm-auth-box');
  const elSelect = panel.querySelector('#adm-select');
  const elX = panel.querySelector('#adm-x');
  const elY = panel.querySelector('#adm-y');
  const elZ = panel.querySelector('#adm-z');
  const elRot = panel.querySelector('#adm-rot');
  const elScale = panel.querySelector('#adm-scale');
  const elScaleVal = panel.querySelector('#adm-scale-val');
  const elEmbedCode = panel.querySelector('#adm-embed-code');
  const elExportCli = panel.querySelector('#adm-export-cli');
  const elJobsList = panel.querySelector('#adm-jobs-list');

  const btnVisible = panel.querySelector('#adm-visible-toggle');
  const elVisLabel = panel.querySelector('#adm-vis-label');
  const elVisPill = panel.querySelector('#adm-vis-pill');
  const elVisDot = panel.querySelector('#adm-vis-dot');

  function updateEmbedAndCli() {
    const base = `${window.location.origin}${window.location.pathname}`;
    const q = `?brand=${encodeURIComponent(brandRef.slug)}&set=${encodeURIComponent(activeSetId)}`;
    elEmbedCode.value = `<iframe src="${base}${q}" width="100%" height="680" style="border:0;border-radius:12px;" allow="autoplay; fullscreen" loading="lazy"></iframe>`;
    elExportCli.textContent = `node tools/export_brand_videos.mjs --brand=${brandRef.slug} --set=${activeSetId}`;
    elBrandTitle.textContent = `⋮⋮ ${brandRef.name} · ${activeSetId}`;
  }
  updateEmbedAndCli();

  panel.querySelector('#adm-copy-embed').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(elEmbedCode.value);
      elStatus.textContent = 'Embed copied ✓';
    } catch {
      elStatus.textContent = 'Select & copy';
    }
  });

  async function refreshAnalytics() {
    const stats = await fetchBrandAnalytics(brandRef.id);
    if (!stats) return;
    panel.querySelector('#st-views').textContent = String(stats.views);
    panel.querySelector('#st-clicks').textContent = String(stats.lookClicks);
    panel.querySelector('#st-collects').textContent = String(stats.collects);
    panel.querySelector('#st-ctas').textContent = String(stats.ctaClicks);
  }

  async function refreshJobs() {
    const jobs = await fetchRenderJobs(brandRef.id);
    if (!jobs.length) {
      elJobsList.textContent = 'No queued export jobs yet.';
      return;
    }
    elJobsList.innerHTML = jobs.map((j) =>
      `<div style="padding:5px 7px;margin-bottom:4px;border-radius:6px;background:rgba(255,255,255,0.05);display:flex;justify-content:space-between;">
        <span>${j.format}</span><strong style="color:#cf8c52;">${j.status}</strong>
      </div>`
    ).join('');
  }

  panel.querySelector('#adm-queue-export').addEventListener('click', async () => {
    const format = panel.querySelector('#adm-export-format').value;
    elStatus.textContent = 'Queueing...';
    try {
      await queueRenderJob({ brandId: brandRef.id, setSlug: activeSetId, format });
      elStatus.textContent = 'Export queued ✓';
      refreshJobs();
    } catch (err) {
      elStatus.textContent = err.message.slice(0, 32);
    }
  });

  // Merchant-only Swap Screen Video (.mp4)
  const btnSwapVid = panel.querySelector('#adm-swap-video');
  const inpSwapVid = panel.querySelector('#adm-swap-video-input');
  btnSwapVid.addEventListener('click', () => inpSwapVid.click());
  inpSwapVid.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSlug || !attachVideoToMonolith) return;
    const blobUrl = URL.createObjectURL(file);
    attachVideoToMonolith(selectedSlug, blobUrl, file.name);
    elStatus.textContent = `Playing ${file.name.slice(0, 14)}`;
  });

  function updateVisibilityUI(isVisible) {
    btnVisible.setAttribute('aria-pressed', String(isVisible));
    elVisLabel.textContent = isVisible ? 'Display Screen: ON (Visible)' : 'Display Screen: OFF (Hidden)';
    btnVisible.style.background = isVisible ? 'rgba(142,224,156,0.14)' : 'rgba(235,95,85,0.16)';
    btnVisible.style.borderColor = isVisible ? 'rgba(142,224,156,0.45)' : 'rgba(235,95,85,0.55)';
    btnVisible.style.color = isVisible ? '#e9f9ec' : '#ffd6d2';
    elVisPill.style.background = isVisible ? '#52c771' : 'rgba(255,255,255,0.22)';
    elVisDot.style.transform = isVisible ? 'translateX(15px)' : 'translateX(0)';
  }

  function renderAuth() {
    const sess = getAdminSession();
    if (sess.token) {
      elAuthBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:#8ee09c;">● Signed in: ${sess.email}</span>
          <button id="adm-logout" type="button" style="background:none;border:none;color:#cf8c52;cursor:pointer;font-size:11px;">Sign out</button>
        </div>
      `;
      elAuthBox.querySelector('#adm-logout').addEventListener('click', () => {
        adminSignOut();
        renderAuth();
      });
    } else {
      elAuthBox.innerHTML = `
        <div style="font-size:11px;color:#d6cdc6;margin-bottom:6px;">Brand Admin Login (or Create Account):</div>
        <input id="adm-email" type="email" value="aniezechris@gmail.com" placeholder="Admin email" style="width:100%;padding:6px;margin-bottom:5px;border-radius:6px;background:#1e1815;color:#fff;border:1px solid #3c322c;box-sizing:border-box;">
        <input id="adm-pass" type="password" placeholder="Password (6+ chars)" style="width:100%;padding:6px;margin-bottom:6px;border-radius:6px;background:#1e1815;color:#fff;border:1px solid #3c322c;box-sizing:border-box;">
        <div style="display:flex;gap:6px;">
          <button id="adm-login" type="button" style="flex:1;padding:7px;border:1px solid #cf8c52;border-radius:7px;background:rgba(207,140,82,0.22);color:#fff;font-weight:600;cursor:pointer;">Sign In</button>
          <button id="adm-signup" type="button" style="flex:1;padding:7px;border:1px solid rgba(255,255,255,0.25);border-radius:7px;background:transparent;color:#e5ddd6;font-weight:500;cursor:pointer;">Create Account</button>
        </div>
      `;
      elAuthBox.querySelector('#adm-login').addEventListener('click', async () => {
        const email = elAuthBox.querySelector('#adm-email').value.trim();
        const pass = elAuthBox.querySelector('#adm-pass').value;
        elStatus.textContent = 'Signing in...';
        try {
          await adminSignIn(email, pass);
          elStatus.textContent = 'Signed in ✓';
          renderAuth();
        } catch (err) {
          elStatus.textContent = err.message.slice(0, 28);
        }
      });
      elAuthBox.querySelector('#adm-signup').addEventListener('click', async () => {
        const email = elAuthBox.querySelector('#adm-email').value.trim();
        const pass = elAuthBox.querySelector('#adm-pass').value;
        if (pass.length < 6) { elStatus.textContent = 'Use 6+ char password'; return; }
        elStatus.textContent = 'Creating account...';
        try {
          const res = await adminSignUp(email, pass);
          elStatus.textContent = res.needsConfirm ? 'Check email to confirm' : 'Account ready ✓';
          renderAuth();
        } catch (err) {
          elStatus.textContent = err.message.slice(0, 28);
        }
      });
    }
  }
  renderAuth();

  function selectItem(slug) {
    const node = productNodes.get(slug);
    if (!node) return;
    selectedSlug = slug;
    elSelect.value = slug;
    elX.value = node.group.position.x.toFixed(2);
    elY.value = node.group.position.y.toFixed(2);
    elZ.value = node.group.position.z.toFixed(2);
    elRot.value = node.group.rotation.y.toFixed(2);
    elScale.value = node.group.scale.x.toFixed(2);
    elScaleVal.textContent = node.group.scale.x.toFixed(2);
    const isVis = node.group.visible !== false;
    updateVisibilityUI(isVis);
    ring.position.set(node.group.position.x, 0.05, node.group.position.z);
    ring.visible = isVis;
  }

  function applyInputsToScene() {
    const node = productNodes.get(selectedSlug);
    if (!node) return;
    node.group.position.set(Number(elX.value) || 0, Number(elY.value) || 0, Number(elZ.value) || 0);
    node.group.rotation.y = Number(elRot.value) || 0;
    const sc = Number(elScale.value) || 1;
    node.group.scale.set(sc, sc, sc);
    elScaleVal.textContent = sc.toFixed(2);
    ring.position.set(node.group.position.x, 0.05, node.group.position.z);
  }

  elSelect.addEventListener('change', () => selectItem(elSelect.value));
  [elX, elY, elZ, elRot, elScale].forEach(inp => inp.addEventListener('input', applyInputsToScene));

  const baselineTransforms = new Map();
  function captureBaselines() {
    productNodes.forEach((node, slug) => {
      baselineTransforms.set(slug, {
        x: node.group.position.x,
        y: node.group.position.y,
        z: node.group.position.z,
        rotY: node.group.rotation.y,
        scale: node.group.scale.x,
        visible: node.group.visible !== false
      });
    });
  }
  captureBaselines();

  btnVisible.addEventListener('click', (e) => {
    e.stopPropagation();
    const node = productNodes.get(selectedSlug);
    if (!node) return;
    const nextVis = !node.group.visible;
    node.group.visible = nextVis;
    ring.visible = nextVis;
    updateVisibilityUI(nextVis);
    if (onVisibilityChanged) onVisibilityChanged();
    elStatus.textContent = nextVis ? 'Shown · click Save' : 'Hidden · click Save';
  });

  const allProductGroups = [];
  productNodes.forEach((node, slug) => {
    node.group.traverse((child) => {
      if (child.isMesh) child.userData.adminSlug = slug;
    });
    allProductGroups.push(node.group);
  });

  let moveMode = false;
  const btnMoveMode = panel.querySelector('#adm-drag-mode');
  const elDragLabel = panel.querySelector('#adm-drag-label');
  const elDragPill = panel.querySelector('#adm-drag-pill');
  const elDragDot = panel.querySelector('#adm-drag-dot');

  function setMoveMode(on) {
    moveMode = Boolean(on);
    btnMoveMode.setAttribute('aria-pressed', String(moveMode));
    elDragLabel.textContent = moveMode ? 'Drag to Move: ON' : 'Drag to Move: OFF';
    btnMoveMode.style.background = moveMode ? '#cf8c52' : 'rgba(207,140,82,0.14)';
    btnMoveMode.style.color = moveMode ? '#120d0a' : '#f4e6d8';
    elDragPill.style.background = moveMode ? '#1a120d' : 'rgba(255,255,255,0.22)';
    elDragDot.style.transform = moveMode ? 'translateX(14px)' : 'translateX(0)';
    renderer.domElement.style.cursor = moveMode ? 'move' : '';
    elStatus.textContent = moveMode ? 'Drag screen now' : 'Ready';
  }
  btnMoveMode.addEventListener('click', (e) => {
    e.stopPropagation();
    setMoveMode(!moveMode);
  });

  panel.querySelector('#adm-reset').addEventListener('click', () => {
    if (!selectedSlug) return;
    const base = baselineTransforms.get(selectedSlug);
    const node = productNodes.get(selectedSlug);
    if (!base || !node) return;
    elX.value = base.x.toFixed(2);
    elY.value = base.y.toFixed(2);
    elZ.value = base.z.toFixed(2);
    elRot.value = base.rotY.toFixed(2);
    elScale.value = base.scale.toFixed(2);
    node.group.visible = base.visible;
    updateVisibilityUI(base.visible);
    applyInputsToScene();
    ring.visible = base.visible;
    if (onVisibilityChanged) onVisibilityChanged();
    elStatus.textContent = 'Reset ✓';
  });

  let dragStartMouse = null;
  let dragStartPos = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!moveMode && !e.shiftKey && !e.ctrlKey) return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const visibleGroups = allProductGroups.filter(g => g.visible);
    const hits = raycaster.intersectObjects(visibleGroups, true);
    let pid = hits.length > 0 ? (hits[0].object.userData.adminSlug || hits[0].object.userData.productId) : null;
    if (!pid && moveMode && selectedSlug && productNodes.get(selectedSlug)?.group.visible) {
      pid = selectedSlug;
    }
    if (pid && productNodes.has(pid)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      selectItem(pid);
      const node = productNodes.get(pid);
      dragging = true;
      dragStartMouse = { x: e.clientX, y: e.clientY };
      dragStartPos = { x: node.group.position.x, z: node.group.position.z };
    }
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!dragging || !selectedSlug || !dragStartMouse || !dragStartPos) return;
    const dx = e.clientX - dragStartMouse.x;
    const dy = e.clientY - dragStartMouse.y;
    const camFwd = new THREE.Vector3();
    camera.getWorldDirection(camFwd);
    camFwd.y = 0;
    if (camFwd.lengthSq() < 0.0001) camFwd.set(0, 0, -1);
    camFwd.normalize();
    const camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0, 1, 0)).normalize();

    const sens = 0.015;
    const newX = dragStartPos.x + camRight.x * (dx * sens) + camFwd.x * (-dy * sens);
    const newZ = dragStartPos.z + camRight.z * (dx * sens) + camFwd.z * (-dy * sens);
    elX.value = Math.max(-7.2, Math.min(7.2, newX)).toFixed(2);
    elZ.value = Math.max(-28.0, Math.min(18.0, newZ)).toFixed(2);
    applyInputsToScene();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    dragStartMouse = null;
    dragStartPos = null;
  });

  panel.querySelector('#adm-save').addEventListener('click', async () => {
    if (!selectedSlug) return;
    const node = productNodes.get(selectedSlug);
    elStatus.textContent = 'Saving...';
    try {
      const payload = {
        pos_x: Number(elX.value),
        pos_y: Number(elY.value),
        pos_z: Number(elZ.value),
        rot_y: Number(elRot.value),
        scale: Number(elScale.value),
        is_visible: node ? node.group.visible !== false : true
      };
      await saveItemTransform(activeSetId, selectedSlug, payload, brandRef.id);
      baselineTransforms.set(selectedSlug, {
        x: payload.pos_x,
        y: payload.pos_y,
        z: payload.pos_z,
        rotY: payload.rot_y,
        scale: payload.scale,
        visible: payload.is_visible
      });
      elStatus.textContent = 'Saved to Supabase ✓';
    } catch (err) {
      elStatus.textContent = err.message.slice(0, 30);
    }
  });

  panel.querySelector('#adm-copy').addEventListener('click', async () => {
    const node = productNodes.get(selectedSlug);
    const payload = JSON.stringify({
      brand_slug: brandRef.slug,
      set_slug: activeSetId,
      slug: selectedSlug,
      is_visible: node ? node.group.visible !== false : true,
      pos_x: Number(elX.value),
      pos_y: Number(elY.value),
      pos_z: Number(elZ.value),
      rot_y: Number(elRot.value),
      scale: Number(elScale.value)
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      elStatus.textContent = 'JSON copied ✓';
    } catch {
      elStatus.textContent = 'Copy ready';
    }
  });

  const firstKey = productNodes.keys().next().value;
  if (firstKey) selectItem(firstKey);

  return {
    refreshFromScene(updatedBrand) {
      if (updatedBrand) {
        brandRef = updatedBrand;
        updateEmbedAndCli();
      }
      captureBaselines();
      if (selectedSlug) selectItem(selectedSlug);
    }
  };
}
