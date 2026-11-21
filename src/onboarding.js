import {
  adminSignIn,
  adminSignUp,
  adminSignOut,
  getAdminSession,
  hydrateSessionFromHash,
  createBrandWorkspace
} from './supabase-sync.js';

hydrateSessionFromHash();

let selectedSet = 'courtyard';
let looks = [
  { title: 'Look 01 — Sculpted Coat', price: '€580', cta_type: 'shopify', cta_url: '' },
  { title: 'Look 02 — Tailored Moto', price: '€490', cta_type: 'shopify', cta_url: '' },
  { title: 'Look 03 — Runway Finale', price: 'Runway Edition', cta_type: 'enquire', cta_url: '' }
];

const elAuthArea = document.getElementById('ob-auth-area');
const elName = document.getElementById('ob-name');
const elSlug = document.getElementById('ob-slug');
const elTagline = document.getElementById('ob-tagline');
const elShop = document.getElementById('ob-shop');
const elIg = document.getElementById('ob-ig');
const elAccent = document.getElementById('ob-accent');
const elLogo = document.getElementById('ob-logo');
const elLooksList = document.getElementById('ob-looks-list');
const elStatus = document.getElementById('ob-status');
const elLaunchBox = document.getElementById('ob-launch-box');

function slugify(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function normalizeUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.indexOf('://') !== -1 || s.startsWith('./') || s.startsWith('/')) return s;
  return ['https:', '', s].join('/');
}

elName.addEventListener('input', () => {
  if (!elSlug.dataset.manual) elSlug.value = slugify(elName.value);
});
elSlug.addEventListener('input', () => { elSlug.dataset.manual = '1'; });

function renderAuth() {
  const sess = getAdminSession();
  if (sess.token) {
    elAuthArea.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <span style="color:#8ee09c;font-weight:600;">● Signed in as ${sess.email}</span>
        <button type="button" class="btn secondary" id="ob-logout" style="padding:7px 14px;font-size:12px;">Sign out</button>
      </div>
    `;
    elAuthArea.querySelector('#ob-logout').addEventListener('click', () => {
      adminSignOut();
      renderAuth();
    });
  } else {
    elAuthArea.innerHTML = `
      <div class="grid-2" style="margin-bottom:10px;">
        <div><label>Work Email</label><input id="ob-email" type="email" placeholder="Work email" /></div>
        <div><label>Password (6+ chars)</label><input id="ob-pass" type="password" placeholder="Password" /></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button type="button" class="btn" id="ob-signin">Sign In</button>
        <button type="button" class="btn secondary" id="ob-signup">Create Brand Account</button>
        <span id="ob-auth-msg" class="status" style="margin-top:0;"></span>
      </div>
    `;
    const elMsg = elAuthArea.querySelector('#ob-auth-msg');
    elAuthArea.querySelector('#ob-signin').addEventListener('click', async () => {
      const email = elAuthArea.querySelector('#ob-email').value.trim();
      const pass = elAuthArea.querySelector('#ob-pass').value;
      elMsg.textContent = 'Signing in...';
      elMsg.className = 'status';
      try {
        await adminSignIn(email, pass);
        renderAuth();
      } catch (err) {
        elMsg.textContent = err.message;
        elMsg.className = 'status err';
      }
    });
    elAuthArea.querySelector('#ob-signup').addEventListener('click', async () => {
      const email = elAuthArea.querySelector('#ob-email').value.trim();
      const pass = elAuthArea.querySelector('#ob-pass').value;
      if (pass.length < 6) { elMsg.textContent = 'Password must be at least 6 characters.'; elMsg.className = 'status err'; return; }
      elMsg.textContent = 'Creating account...';
      elMsg.className = 'status';
      try {
        const res = await adminSignUp(email, pass);
        elMsg.textContent = res.needsConfirm ? 'Confirmation email sent — click the link then return here.' : 'Account created ✓';
        renderAuth();
      } catch (err) {
        elMsg.textContent = err.message;
        elMsg.className = 'status err';
      }
    });
  }
}
renderAuth();

document.querySelectorAll('.set-card').forEach((card) => {
  card.addEventListener('click', () => {
    selectedSet = card.dataset.set;
    document.querySelectorAll('.set-card').forEach(c => c.classList.toggle('active', c === card));
  });
});

function renderLooks() {
  elLooksList.innerHTML = looks.map((item, idx) => `
    <div class="look-row" data-idx="${idx}">
      <div><label>Look ${idx + 1} Title</label><input data-f="title" value="${item.title.replace(/"/g, '&quot;')}" /></div>
      <div><label>Price</label><input data-f="price" value="${item.price.replace(/"/g, '&quot;')}" /></div>
      <div>
        <label>CTA Type</label>
        <select data-f="cta_type">
          <option value="shopify" ${item.cta_type === 'shopify' ? 'selected' : ''}>Shopify Size</option>
          <option value="edition" ${item.cta_type === 'edition' ? 'selected' : ''}>Edition Drop</option>
          <option value="enquire" ${item.cta_type === 'enquire' ? 'selected' : ''}>Runway Enquire</option>
        </select>
      </div>
      <div><label>Product / Checkout Path</label><input data-f="cta_url" placeholder="Store product link" value="${(item.cta_url || '').replace(/"/g, '&quot;')}" /></div>
      <button type="button" class="btn secondary ob-del" data-idx="${idx}" style="padding:10px 12px;">✕</button>
    </div>
  `).join('');

  elLooksList.querySelectorAll('.look-row').forEach((row) => {
    const idx = Number(row.dataset.idx);
    row.querySelectorAll('input, select').forEach((inp) => {
      inp.addEventListener('input', () => { looks[idx][inp.dataset.f] = inp.value; });
      inp.addEventListener('change', () => { looks[idx][inp.dataset.f] = inp.value; });
    });
  });
  elLooksList.querySelectorAll('.ob-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (looks.length <= 1) return;
      looks.splice(Number(btn.dataset.idx), 1);
      renderLooks();
    });
  });
}
renderLooks();

document.getElementById('ob-add-look').addEventListener('click', () => {
  if (looks.length >= 6) return;
  looks.push({ title: `Look 0${looks.length + 1} — New Piece`, price: '€420', cta_type: 'shopify', cta_url: elShop.value.trim() });
  renderLooks();
});

document.getElementById('ob-load-sample').addEventListener('click', () => {
  if (!elName.value.trim()) {
    elName.value = 'Maison Solaire';
    elSlug.value = 'maison-solaire';
  }
  if (!elShop.value.trim()) elShop.value = 'maisonsolaire.com';
  if (!elIg.value.trim()) elIg.value = '@maisonsolaire';
  looks = [
    { title: 'Solaire Double-Breasted Trench', price: '€640', cta_type: 'shopify', cta_url: '' },
    { title: 'Atelier Sculpted Knit Sweater', price: '€340', cta_type: 'shopify', cta_url: '' },
    { title: 'Edition 01 — Numbered Leather Set', price: '€585', cta_type: 'edition', cta_url: '' },
    { title: 'Paris Runway Look 04', price: 'Runway Edition', cta_type: 'enquire', cta_url: '' }
  ];
  renderLooks();
});

document.getElementById('ob-publish').addEventListener('click', async () => {
  const name = elName.value.trim();
  const slug = slugify(elSlug.value || name);
  if (!name || !slug) {
    elStatus.textContent = 'Enter a Brand Name and URL Slug first.';
    elStatus.className = 'status err';
    return;
  }
  const shopUrl = normalizeUrl(elShop.value);
  elStatus.textContent = 'Creating multi-tenant brand workspace in Supabase...';
  elStatus.className = 'status';
  try {
    const res = await createBrandWorkspace({
      slug,
      name,
      tagline: elTagline.value.trim(),
      shopUrl,
      instagram: elIg.value.trim(),
      accent: elAccent.value,
      defaultSet: selectedSet,
      logoUrl: normalizeUrl(elLogo.value),
      items: looks.map((l, i) => ({
        slug: slugify(l.title) || `look-0${i + 1}`,
        title: l.title,
        price: l.price,
        cta_type: l.cta_type,
        cta_url: normalizeUrl(l.cta_url) || shopUrl
      }))
    });

    const base = new URL('./index.html', window.location.href).toString();
    const liveUrl = `${base}?brand=${encodeURIComponent(res.slug)}&set=${encodeURIComponent(res.default_set)}`;
    const adminUrl = `${liveUrl}&admin=1`;

    document.getElementById('ob-live-link').href = liveUrl;
    document.getElementById('ob-admin-link').href = adminUrl;
    document.getElementById('ob-embed-out').textContent =
      `<iframe src="${liveUrl}" width="100%" height="680" style="border:0;border-radius:12px;" allow="autoplay; fullscreen" loading="lazy"></iframe>`;
    document.getElementById('ob-cli-out').textContent =
      `node tools/export_brand_videos.mjs --brand=${res.slug} --set=${res.default_set}`;

    elLaunchBox.classList.add('show');
    elStatus.textContent = `Published "${name}" (?brand=${res.slug}) ✓`;
    elLaunchBox.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    elStatus.textContent = err.message;
    elStatus.className = 'status err';
  }
});
