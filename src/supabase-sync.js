// Live Multi-Tenant Supabase Sync Client for ANIEZE & White-Label 3D Showrooms
// Zero external dependencies — works natively on local preview, GitHub Pages, and Vercel.

const PROJECT_REF = 'sfzehgqxnrzwjumzespa';
const SUPABASE_KEY = 'sb_publishable_IhAJUAhMQVQ8nCyCH0pZOw_Wj6ZYhR-';
const BASE_URL = ['https:/', '', `${PROJECT_REF}.supabase.co`].join('/');

let adminToken = sessionStorage.getItem('anieze_admin_jwt') || null;
let adminEmail = sessionStorage.getItem('anieze_admin_email') || null;

const SESSION_ID = (() => {
  try {
    let sid = sessionStorage.getItem('atelier_session_id');
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('atelier_session_id', sid);
    }
    return sid;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
})();

// Capture Supabase email confirmation / OAuth redirect hash (#access_token=...)
export function hydrateSessionFromHash() {
  if (!window.location.hash || !window.location.hash.includes('access_token=')) return false;
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const token = hashParams.get('access_token');
  if (!token) return false;
  adminToken = token;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    adminEmail = payload.email || 'admin';
  } catch {
    adminEmail = 'admin';
  }
  sessionStorage.setItem('anieze_admin_jwt', adminToken);
  sessionStorage.setItem('anieze_admin_email', adminEmail);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
}

export function getAdminSession() {
  return { token: adminToken, email: adminEmail };
}

export function adminSignOut() {
  adminToken = null;
  adminEmail = null;
  sessionStorage.removeItem('anieze_admin_jwt');
  sessionStorage.removeItem('anieze_admin_email');
}

export async function adminSignUp(email, password) {
  const res = await fetch(`${BASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || 'Sign-up failed');
  }
  if (data.access_token) {
    adminToken = data.access_token;
    adminEmail = data.user?.email || email;
    sessionStorage.setItem('anieze_admin_jwt', adminToken);
    sessionStorage.setItem('anieze_admin_email', adminEmail);
    return { token: adminToken, email: adminEmail, needsConfirm: false };
  }
  return { token: null, email, needsConfirm: true };
}

export async function adminSignIn(email, password) {
  const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.msg || 'Sign-in failed');
  }
  adminToken = data.access_token;
  adminEmail = data.user?.email || email;
  sessionStorage.setItem('anieze_admin_jwt', adminToken);
  sessionStorage.setItem('anieze_admin_email', adminEmail);
  return { token: adminToken, email: adminEmail };
}

function getHeaders(preferAuth = true) {
  const bearer = (preferAuth && adminToken) ? adminToken : SUPABASE_KEY;
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearer}` };
}

async function fetchWithAutoFallback(url) {
  let res = await fetch(url, { headers: getHeaders(true) });
  if (res.status === 401 && adminToken) {
    adminSignOut();
    res = await fetch(url, { headers: getHeaders(false) });
  }
  return res;
}

// Fetch multi-tenant brand profile + set items + active editions
export async function fetchBrandContext(brandSlug = 'anieze', setSlug = 'courtyard') {
  try {
    let brand = null;
    const brandRes = await fetchWithAutoFallback(
      `${BASE_URL}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&limit=1`
    );
    if (brandRes.ok) {
      const rows = await brandRes.json();
      brand = rows[0] || null;
    }

    const itemsQuery = brand?.id
      ? `${BASE_URL}/rest/v1/atelier_items?brand_id=eq.${encodeURIComponent(brand.id)}&set_slug=eq.${encodeURIComponent(setSlug)}&order=sort_order.asc`
      : `${BASE_URL}/rest/v1/atelier_items?set_slug=eq.${encodeURIComponent(setSlug)}&order=sort_order.asc`;

    const [itemsRes, editionsRes] = await Promise.all([
      fetchWithAutoFallback(itemsQuery),
      fetchWithAutoFallback(`${BASE_URL}/rest/v1/editions?is_active=eq.true`)
    ]);
    const items = itemsRes.ok ? await itemsRes.json() : [];
    const editions = editionsRes.ok ? await editionsRes.json() : [];
    return { brand, items, editions, connected: itemsRes.ok };
  } catch {
    return { brand: null, items: [], editions: [], connected: false };
  }
}

export async function fetchSetLayout(setSlug, brandSlug = 'anieze') {
  return fetchBrandContext(brandSlug, setSlug);
}

export async function saveItemTransform(setSlug, slug, patch, brandId = null) {
  if (!adminToken) throw new Error('Sign in as Brand Admin first to save layout.');
  const body = {
    pos_x: Number(patch.pos_x.toFixed(3)),
    pos_y: Number(patch.pos_y.toFixed(3)),
    pos_z: Number(patch.pos_z.toFixed(3)),
    rot_y: Number(patch.rot_y.toFixed(3)),
    scale: Number((patch.scale ?? 1).toFixed(3)),
    updated_at: new Date().toISOString()
  };
  if (typeof patch.is_visible === 'boolean') body.is_visible = patch.is_visible;
  if (typeof patch.cta_type === 'string') body.cta_type = patch.cta_type;
  if (typeof patch.cta_url === 'string') body.cta_url = patch.cta_url;

  const brandFilter = brandId ? `&brand_id=eq.${encodeURIComponent(brandId)}` : '';
  const res = await fetch(
    `${BASE_URL}/rest/v1/atelier_items?set_slug=eq.${encodeURIComponent(setSlug)}&slug=eq.${encodeURIComponent(slug)}${brandFilter}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Save failed (${res.status}): ${errText.slice(0, 120)}`);
  }
  return await res.json();
}

// Self-serve Brand Onboarding RPC
export async function createBrandWorkspace(payload) {
  if (!adminToken) throw new Error('Please sign in or create an account first.');
  const res = await fetch(`${BASE_URL}/rest/v1/rpc/create_brand_workspace`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_slug: payload.slug,
      p_name: payload.name,
      p_tagline: payload.tagline || 'Interactive 3D Showroom',
      p_shop_url: payload.shopUrl || '',
      p_instagram: payload.instagram || '',
      p_accent_hex: payload.accent || '#cf8c52',
      p_default_set: payload.defaultSet || 'courtyard',
      p_logo_url: payload.logoUrl || '',
      p_items: payload.items || []
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.hint || `Workspace creation failed (${res.status})`);
  }
  return data;
}

// Lightweight Showroom Analytics (non-blocking)
export function trackShowroomEvent({ brandId, setSlug, itemSlug = null, eventType, meta = {} }) {
  if (!brandId || !eventType) return;
  fetch(`${BASE_URL}/rest/v1/showroom_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      brand_id: brandId,
      set_slug: setSlug,
      item_slug: itemSlug,
      event_type: eventType,
      session_id: SESSION_ID,
      meta
    })
  }).catch(() => {});
}

export async function fetchBrandAnalytics(brandId) {
  if (!brandId || !adminToken) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/rest/v1/showroom_events?brand_id=eq.${encodeURIComponent(brandId)}&select=event_type,item_slug,created_at&order=created_at.desc&limit=500`,
      { headers: getHeaders(true) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const counts = { views: 0, lookClicks: 0, collects: 0, ctaClicks: 0, films: 0 };
    rows.forEach((r) => {
      if (r.event_type === 'view' || r.event_type === 'embed_view') counts.views++;
      else if (r.event_type === 'look_click') counts.lookClicks++;
      else if (r.event_type === 'collect') counts.collects++;
      else if (r.event_type === 'cta_click') counts.ctaClicks++;
      else if (r.event_type === 'film_start') counts.films++;
    });
    return counts;
  } catch {
    return null;
  }
}

// Built-In Marketing Export Engine — Queue & Check Render Jobs
export async function queueRenderJob({ brandId, setSlug, format = 'all_formats' }) {
  if (!adminToken) throw new Error('Sign in as Brand Admin to export videos.');
  if (!brandId) throw new Error('Apply the Phase 2 SQL migration in Supabase to enable render jobs.');
  const res = await fetch(`${BASE_URL}/rest/v1/render_jobs`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      brand_id: brandId,
      set_slug: setSlug,
      format,
      status: 'queued',
      requested_by: adminEmail || 'admin'
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Export queue failed (${res.status}): ${errText.slice(0, 100)}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

export async function fetchRenderJobs(brandId) {
  if (!brandId || !adminToken) return [];
  try {
    const res = await fetch(
      `${BASE_URL}/rest/v1/render_jobs?brand_id=eq.${encodeURIComponent(brandId)}&order=created_at.desc&limit=5`,
      { headers: getHeaders(true) }
    );
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}
