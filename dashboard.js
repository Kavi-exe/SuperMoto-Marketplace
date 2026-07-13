/* ── CeylonSuperHub User Dashboard ───────────────────────────────────────── */
'use strict';

const API = '';
let dashUser = null;
let accessToken = sessionStorage.getItem('ceylon_access_token') || '';
let currentPanel = 'overview';
let modalConfirmCallback = null;

const PANEL_TITLES = {
  overview:     'Overview',
  'my-listings':'My Listings',
  'post-listing':'Post New Listing',
  'spare-parts':'Spare Parts',
  favourites:   'Favourites',
  profile:      'Edit Profile',
  security:     'Security',
  notifications:'Notifications',
};

const state = {
  listings: { page: 1, limit: 10, search: '', status: 'all', total: 0 },
};

/* ── XSS escape ─────────────────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

/* ── API fetch with silent refresh ─────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (response.status === 401 && !options._retried && path !== '/api/auth/refresh') {
    const ok = await refreshToken();
    if (ok) return apiFetch(path, { ...options, _retried: true });
  }
  return { response, data };
}

async function refreshToken() {
  try {
    const { response, data } = await apiFetch('/api/auth/refresh', { method: 'POST', _retried: true });
    if (response.ok && data?.accessToken) {
      accessToken = data.accessToken;
      sessionStorage.setItem('ceylon_access_token', accessToken);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/* ── Init ───────────────────────────────────────────────────────────────── */
async function init() {
  // Auth check
  try {
    const { response, data } = await apiFetch('/api/auth/me');
    if (!response.ok || !data?.user) { window.location.href = '/?auth=required'; return; }
    // Admins should be on /admin, not /dashboard
    if (data.user.role === 'admin' || data.user.role === 'super_admin') {
      window.location.href = '/admin'; return;
    }
    // Block suspended users
    if (data.user.status === 'suspended') {
      document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#070a14;color:#f3f4f6;flex-direction:column;gap:16px;text-align:center;padding:24px">
        <i class="fas fa-ban" style="font-size:3rem;color:#ef4444"></i>
        <h2>Account Suspended</h2>
        <p style="color:#9ca3af">Your account has been suspended. Please contact support.</p>
        <a href="/" style="color:#1a6fff">← Return to site</a>
      </div>`;
      return;
    }
    dashUser = data.user;
  } catch { window.location.href = '/?auth=required'; return; }

  // Populate topbar
  const nameEl = document.getElementById('dash-topbar-name');
  if (nameEl) nameEl.textContent = dashUser.name || dashUser.email;
  const welcomeEl = document.getElementById('dash-welcome-name');
  if (welcomeEl) welcomeEl.textContent = (dashUser.name || 'there').split(' ')[0];

  // Apply saved theme
  const saved = JSON.parse(localStorage.getItem('ceylonsuper_settings') || '{}');
  if (saved.theme === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  }

  // Sidebar toggle
  const toggle  = document.getElementById('dash-sidebar-toggle');
  const sidebar = document.getElementById('dash-sidebar');
  const overlay = document.getElementById('dash-sidebar-overlay');
  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  // Nav panel switching
  document.querySelectorAll('.dash-nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      dashSwitchPanel(item.getAttribute('data-panel'));
    });
  });

  // Logout
  document.getElementById('dash-logout-btn')?.addEventListener('click', dashLogout);

  // Modal cancel
  document.getElementById('dash-modal-cancel')?.addEventListener('click', closeModal);

  // Load initial panel
  dashSwitchPanel('overview');
}

/* ── Panel switching ────────────────────────────────────────────────────── */
function dashSwitchPanel(name) {
  currentPanel = name;
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`panel-${name}`);
  if (target) target.classList.add('active');
  document.querySelectorAll('.dash-nav-item[data-panel]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-panel') === name);
  });
  const title = PANEL_TITLES[name] || name;
  const titleEl = document.getElementById('dash-topbar-title');
  if (titleEl) titleEl.textContent = title;
  const crumb = document.getElementById('dash-breadcrumb-current');
  if (crumb) crumb.textContent = title;
  // Close mobile sidebar
  document.getElementById('dash-sidebar')?.classList.remove('open');
  document.getElementById('dash-sidebar-overlay')?.classList.remove('active');

  switch (name) {
    case 'overview':     loadOverview();     break;
    case 'my-listings':  loadMyListings();   break;
    case 'spare-parts':  loadMySpareParts(); break;
    case 'favourites':   loadFavourites();   break;
    case 'profile':      loadProfile();      break;
  }
}

/* ── Overview ───────────────────────────────────────────────────────────── */
async function loadOverview() {
  try {
    const { response, data } = await apiFetch('/api/user/stats');
    if (response.ok) {
      const s = data.stats;
      setEl('dstat-total',   s.totalListings);
      setEl('dstat-active',  s.activeListings);
      setEl('dstat-pending', s.pendingListings);
      setEl('dstat-parts',   s.totalSpareParts);
    }
  } catch { /* silent */ }

  // Recent listings for overview table
  try {
    const { response, data } = await apiFetch('/api/user/listings?limit=5');
    if (!response.ok) return;
    const tbody = document.getElementById('overview-listings-tbody');
    const ads = data.ads || [];
    if (!ads.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">
        No listings yet. <a href="#" onclick="dashSwitchPanel('post-listing');return false" style="color:var(--accent-primary)">Post your first one →</a>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = ads.slice(0, 5).map(a => `<tr>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.title)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.type||'')}</td>
      <td style="font-size:0.82rem;white-space:nowrap">LKR ${Number(a.price||0).toLocaleString()}</td>
      <td>${statusBadge(a.status, a.featured)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.dateAdded||'')}</td>
      <td>
        <a href="/" class="dash-btn secondary sm" style="font-size:0.78rem;padding:4px 10px">View</a>
      </td>
    </tr>`).join('');
  } catch { /* silent */ }
}

/* ── My Listings ────────────────────────────────────────────────────────── */
let listingsSearchTimer;
function dashListingsSearchDebounced() {
  clearTimeout(listingsSearchTimer);
  listingsSearchTimer = setTimeout(() => {
    state.listings.search = document.getElementById('listings-search')?.value.trim() || '';
    state.listings.page = 1;
    loadMyListings();
  }, 350);
}

async function loadMyListings() {
  const s = state.listings;
  s.status = document.getElementById('listings-status-filter')?.value || 'all';
  try {
    const { response, data } = await apiFetch('/api/user/listings');
    if (!response.ok) throw new Error(data?.error || 'Failed');
    let ads = data.ads || [];
    // client-side filter (server returns all user's ads)
    if (s.status !== 'all') ads = ads.filter(a => a.status === s.status);
    if (s.search) {
      const q = s.search.toLowerCase();
      ads = ads.filter(a => a.title.toLowerCase().includes(q) || a.make.toLowerCase().includes(q));
    }
    s.total = ads.length;
    // paginate client-side
    const start = (s.page - 1) * s.limit;
    const paged = ads.slice(start, start + s.limit);
    renderMyListingsTable(paged);
    renderDashPagination('listings-pagination', s.total, s.page, s.limit, (p) => { s.page = p; loadMyListings(); });
  } catch (err) { showDashToast(err.message, 'error'); }
}

function renderMyListingsTable(ads) {
  const tbody = document.getElementById('my-listings-tbody');
  if (!ads.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">
      No listings found. <a href="#" onclick="dashSwitchPanel('post-listing');return false" style="color:var(--accent-primary)">Post one →</a>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = ads.map(a => {
    const img = Array.isArray(a.images) && a.images[0] ? a.images[0] : '';
    const imgHtml = img
      ? `<img src="${esc(img)}" class="dash-table-thumb" alt="" loading="lazy">`
      : `<div style="width:44px;height:34px;background:var(--bg-tertiary);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fas fa-car"></i></div>`;
    return `<tr>
      <td>${imgHtml}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong>${esc(a.title)}</strong></td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.type||'')}</td>
      <td style="font-size:0.82rem;white-space:nowrap">LKR ${Number(a.price||0).toLocaleString()}</td>
      <td>${statusBadge(a.status, a.featured)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.dateAdded||'')}</td>
      <td>
        <div style="display:flex;gap:5px">
          <a href="/" class="dash-btn secondary sm">View</a>
          <button class="dash-btn danger sm" onclick="deleteMyListing('${esc(a.id)}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function deleteMyListing(id) {
  showModal('Delete Listing', 'Permanently delete this listing? This cannot be undone.', async () => {
    const { response, data } = await apiFetch(`/api/ads/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { showDashToast(data?.error || 'Failed to delete', 'error'); return; }
    showDashToast('Listing deleted', 'success');
    loadMyListings();
    loadOverview();
  });
}

/* ── Spare Parts ────────────────────────────────────────────────────────── */
async function loadMySpareParts() {
  try {
    const { response, data } = await apiFetch('/api/user/spare-parts');
    if (!response.ok) throw new Error(data?.error || 'Failed');
    const tbody = document.getElementById('my-parts-tbody');
    const parts = data.spareParts || [];
    if (!parts.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No spare parts listed yet.</td></tr>';
      return;
    }
    tbody.innerHTML = parts.map(p => `<tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${esc(p.category)}</td>
      <td style="font-size:0.82rem;white-space:nowrap">LKR ${Number(p.price||0).toLocaleString()}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(p.dateAdded||'')}</td>
      <td>
        <button class="dash-btn danger sm" onclick="deleteMyPart('${esc(p.id)}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');
  } catch (err) { showDashToast(err.message, 'error'); }
}

async function deleteMyPart(id) {
  showModal('Delete Spare Part', 'Permanently delete this spare part listing?', async () => {
    const { response, data } = await apiFetch(`/api/spare-parts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { showDashToast(data?.error || 'Failed', 'error'); return; }
    showDashToast('Spare part deleted', 'success');
    loadMySpareParts();
  });
}

/* ── Favourites ─────────────────────────────────────────────────────────── */
function loadFavourites() {
  const grid = document.getElementById('favourites-grid');
  const raw = localStorage.getItem('ceylonsuper_favorites');
  const favIds = raw ? JSON.parse(raw) : [];
  const adsRaw = localStorage.getItem('ceylonsuper_ads');
  const allAds = adsRaw ? JSON.parse(adsRaw) : [];
  const favAds = allAds.filter(a => favIds.includes(a.id));
  if (!favAds.length) {
    grid.innerHTML = `<div class="dash-empty-state"><i class="fas fa-heart"></i><p>No saved favourites yet.<br>Browse listings and click ❤ to save.</p><a href="/" class="dash-btn secondary sm" style="margin-top:12px">Browse Listings</a></div>`;
    return;
  }
  grid.innerHTML = favAds.map(a => {
    const img = Array.isArray(a.images) && a.images[0] ? a.images[0] : '';
    return `<div class="dash-fav-card">
      ${img ? `<img src="${esc(img)}" alt="${esc(a.title)}" loading="lazy">` : `<div style="height:140px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fas fa-car" style="font-size:2rem"></i></div>`}
      <div class="dash-fav-card-body">
        <div class="dash-fav-card-title" title="${esc(a.title)}">${esc(a.title)}</div>
        <div class="dash-fav-card-price">LKR ${Number(a.price||0).toLocaleString()}</div>
        <div style="display:flex;gap:6px">
          <a href="/" class="dash-btn secondary sm" style="flex:1">View</a>
          <button class="dash-btn danger sm" onclick="removeFavourite('${esc(a.id)}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function removeFavourite(id) {
  const raw = localStorage.getItem('ceylonsuper_favorites');
  let favIds = raw ? JSON.parse(raw) : [];
  favIds = favIds.filter(f => f !== id);
  localStorage.setItem('ceylonsuper_favorites', JSON.stringify(favIds));
  showDashToast('Removed from favourites', 'success');
  loadFavourites();
}

/* ── Profile ────────────────────────────────────────────────────────────── */
function loadProfile() {
  // Pre-fill from current user + localStorage
  const saved = JSON.parse(localStorage.getItem('ceylonsuper_profile') || '{}');
  setInputVal('prof-name',     dashUser.name || saved.name || '');
  setInputVal('prof-email',    dashUser.email || '');
  setInputVal('prof-phone',    saved.phone || '');
  setInputVal('prof-location', saved.location || '');
  setInputVal('prof-bio',      saved.bio || '');
  setEl('dash-profile-name-display', dashUser.name || '—');
  setEl('dash-profile-email-display', dashUser.email || '—');
  const roleBadgeEl = document.getElementById('dash-profile-role-badge');
  if (roleBadgeEl) roleBadgeEl.textContent = dashUser.role === 'admin' ? 'Admin' : 'User';
  // Avatar
  const avatarEl = document.getElementById('dash-profile-avatar');
  if (avatarEl && saved.avatar) {
    avatarEl.innerHTML = `<img src="${esc(saved.avatar)}" alt="Avatar">`;
  }
}

function saveProfile() {
  const name     = document.getElementById('prof-name')?.value.trim();
  const phone    = document.getElementById('prof-phone')?.value.trim();
  const location = document.getElementById('prof-location')?.value.trim();
  const bio      = document.getElementById('prof-bio')?.value.trim();
  if (!name) { showDashToast('Name is required', 'warning'); return; }
  // Save to localStorage
  const profile = JSON.parse(localStorage.getItem('ceylonsuper_profile') || '{}');
  Object.assign(profile, { name, phone, location, bio });
  localStorage.setItem('ceylonsuper_profile', JSON.stringify(profile));
  // Update display
  setEl('dash-topbar-name', name);
  setEl('dash-welcome-name', name.split(' ')[0]);
  setEl('dash-profile-name-display', name);
  showDashToast('Profile saved', 'success');
}

/* ── Change Password ────────────────────────────────────────────────────── */
async function changePassword() {
  const current  = document.getElementById('sec-current-pw')?.value;
  const newPw    = document.getElementById('sec-new-pw')?.value;
  const confirm  = document.getElementById('sec-confirm-pw')?.value;
  const errorEl  = document.getElementById('sec-pw-error');
  if (errorEl) errorEl.textContent = '';

  if (!current || !newPw || !confirm) { if (errorEl) errorEl.textContent = 'All fields are required.'; return; }
  if (newPw.length < 8) { if (errorEl) errorEl.textContent = 'New password must be at least 8 characters.'; return; }
  if (newPw !== confirm) { if (errorEl) errorEl.textContent = 'Passwords do not match.'; return; }

  showDashToast('Password change will be available once the API endpoint is added.', 'info');
}

/* ── Notification Prefs ─────────────────────────────────────────────────── */
function saveNotifPrefs() {
  const prefs = {
    email:         document.getElementById('notif-email')?.checked,
    approvals:     document.getElementById('notif-approvals')?.checked,
    announcements: document.getElementById('notif-announcements')?.checked,
  };
  localStorage.setItem('ceylon_notif_prefs', JSON.stringify(prefs));
  showDashToast('Notification preferences saved', 'success');
}

/* ── Badges ─────────────────────────────────────────────────────────────── */
function statusBadge(status, featured) {
  if (featured) return '<span class="dash-badge" style="background:rgba(139,92,246,0.15);color:#8b5cf6"><i class="fas fa-star"></i> Featured</span>';
  switch (status) {
    case 'active':          return '<span class="dash-badge active">Active</span>';
    case 'pending_payment': return '<span class="dash-badge pending">Pending</span>';
    case 'removed':         return '<span class="dash-badge removed">Removed</span>';
    default: return `<span class="dash-badge" style="background:var(--bg-tertiary);color:var(--text-secondary)">${esc(status)}</span>`;
  }
}

/* ── Pagination ─────────────────────────────────────────────────────────── */
function renderDashPagination(id, total, page, limit, loadFn) {
  const container = document.getElementById(id);
  if (!container) return;
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = `<button class="dash-page-btn" onclick="(${loadFn.toString()})(${page-1})" ${page===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
  const start = Math.max(1, page-2), end = Math.min(totalPages, page+2);
  for (let i = start; i <= end; i++) {
    html += `<button class="dash-page-btn ${i===page?'active':''}" onclick="(${loadFn.toString()})(${i})">${i}</button>`;
  }
  html += `<button class="dash-page-btn" onclick="(${loadFn.toString()})(${page+1})" ${page===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
  container.innerHTML = html;
}

/* ── Modal ──────────────────────────────────────────────────────────────── */
function showModal(title, msg, onConfirm) {
  const overlay = document.getElementById('dash-modal-overlay');
  const titleEl = document.getElementById('dash-modal-title');
  const msgEl   = document.getElementById('dash-modal-msg');
  const confirmBtn = document.getElementById('dash-modal-confirm');
  if (!overlay) return;
  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.textContent   = msg;
  modalConfirmCallback = onConfirm;
  confirmBtn.onclick = () => { closeModal(); if (modalConfirmCallback) modalConfirmCallback(); };
  overlay.classList.add('active');
}
function closeModal() {
  document.getElementById('dash-modal-overlay')?.classList.remove('active');
  modalConfirmCallback = null;
}

/* ── Toast ──────────────────────────────────────────────────────────────── */
function showDashToast(msg, type = 'info') {
  const container = document.getElementById('dash-toast-container');
  if (!container) return;
  const icons = { success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle', warning:'fa-exclamation-circle' };
  const toast = document.createElement('div');
  toast.className = `dash-toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]||icons.info}"></i> ${esc(msg)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateX(30px)'; toast.style.transition = '0.3s';
    setTimeout(() => toast.remove(), 320);
  }, 3000);
}

/* ── Logout ─────────────────────────────────────────────────────────────── */
async function dashLogout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  sessionStorage.removeItem('ceylon_access_token');
  window.location.href = '/';
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; }
function setInputVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

/* ── Boot ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
