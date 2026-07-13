/* ── CeylonSuperHub Admin Panel JS ─────────────────────────────────────── */
'use strict';

const API = '';
let adminUser = null;
let accessToken = sessionStorage.getItem('ceylon_access_token') || '';
let currentPanel = 'dashboard';

// Per-panel state
const state = {
  users:    { page: 1, limit: 15, search: '', role: 'all', status: 'all', total: 0 },
  listings: { page: 1, limit: 15, search: '', status: 'all', total: 0 },
  pending:  { page: 1, limit: 15, search: '', total: 0 },
  parts:    { page: 1, limit: 15, search: '', total: 0 },
  logs:     { limit: 50 },
};

const PANEL_TITLES = {
  dashboard:   'Dashboard',
  users:       'Users',
  listings:    'All Listings',
  pending:     'Pending Approval',
  featured:    'Featured Listings',
  'spare-parts': 'Spare Parts',
  payments:    'Payments',
  analytics:   'Analytics',
  logs:        'Activity Logs',
  settings:    'Settings',
  security:    'Security',
  admins:      'Admin Management',
  maintenance: 'Maintenance',
};

/* ── XSS escape ─────────────────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/* ── API fetch with auto-refresh ────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
  let data = null;
  try { data = await response.json(); } catch { data = null; }

  if (response.status === 401 && !options._retried && path !== '/api/auth/refresh') {
    const ok = await refreshAccessToken();
    if (ok) return apiFetch(path, { ...options, _retried: true });
  }
  return { response, data };
}

async function refreshAccessToken() {
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

/* ── Initialise ─────────────────────────────────────────────────────────── */
async function init() {
  // Check auth
  try {
    const { response, data } = await apiFetch('/api/auth/me');
    if (!response.ok || !data?.user) { redirect(); return; }
    const role = data.user.role;
    if (role !== 'admin' && role !== 'super_admin') { redirect(); return; }
    adminUser = data.user;
  } catch {
    redirect();
    return;
  }

  // Update topbar
  const userEl = document.getElementById('admin-topbar-user');
  if (userEl) userEl.textContent = adminUser.name || 'Admin';

  // Show super_admin badge and unlock super-admin-only nav items
  const isSuperAdmin = adminUser.role === 'super_admin';
  document.querySelectorAll('.super-admin-only').forEach(el => {
    el.style.display = isSuperAdmin ? '' : 'none';
  });
  // Show role badge in topbar
  const avatarEl = document.getElementById('admin-topbar-avatar');
  if (avatarEl) {
    avatarEl.title = isSuperAdmin ? 'Super Admin' : 'Admin';
    avatarEl.innerHTML = isSuperAdmin
      ? '<i class="fas fa-crown" style="color:#ffb300"></i>'
      : '<i class="fas fa-user-shield"></i>';
  }

  // Bind sidebar navigation
  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      switchPanel(item.getAttribute('data-panel'));
    });
  });

  // Sidebar toggle (mobile)
  const toggleBtn = document.getElementById('admin-sidebar-toggle');
  const sidebar   = document.getElementById('admin-sidebar');
  const overlay   = document.getElementById('admin-sidebar-overlay');
  if (toggleBtn && sidebar && overlay) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Logout
  document.getElementById('admin-logout-btn')?.addEventListener('click', logout);

  // Modal buttons
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

  // Settings theme toggle
  document.getElementById('setting-theme-toggle')?.addEventListener('change', e => {
    document.body.classList.toggle('theme-light', e.target.checked);
    document.body.classList.toggle('theme-dark', !e.target.checked);
  });

  // Maintenance mode toggle
  document.getElementById('maintenance-mode-toggle')?.addEventListener('change', e => {
    const lbl = document.getElementById('maintenance-mode-label');
    if (lbl) lbl.textContent = `Maintenance Mode: ${e.target.checked ? 'ON' : 'Off'}`;
    showToast(e.target.checked ? 'Maintenance mode enabled (visual only)' : 'Maintenance mode disabled', 'info');
  });

  // Users panel search/filter
  let usersSearchTimer;
  document.getElementById('users-search')?.addEventListener('input', e => {
    clearTimeout(usersSearchTimer);
    usersSearchTimer = setTimeout(() => {
      state.users.search = e.target.value.trim();
      state.users.page = 1;
      loadUsers();
    }, 350);
  });
  document.getElementById('users-role-filter')?.addEventListener('change', e => {
    state.users.role = e.target.value;
    state.users.page = 1;
    loadUsers();
  });
  document.getElementById('users-status-filter')?.addEventListener('change', e => {
    state.users.status = e.target.value;
    state.users.page = 1;
    loadUsers();
  });

  // Listings panel search + status pills
  let listingsSearchTimer;
  document.getElementById('listings-search')?.addEventListener('input', e => {
    clearTimeout(listingsSearchTimer);
    listingsSearchTimer = setTimeout(() => {
      state.listings.search = e.target.value.trim();
      state.listings.page = 1;
      loadListings();
    }, 350);
  });
  document.querySelectorAll('#listings-status-pills .admin-status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#listings-status-pills .admin-status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.listings.status = pill.getAttribute('data-status');
      state.listings.page = 1;
      loadListings();
    });
  });

  // Spare parts search
  let partsSearchTimer;
  document.getElementById('parts-search')?.addEventListener('input', e => {
    clearTimeout(partsSearchTimer);
    partsSearchTimer = setTimeout(() => {
      state.parts.search = e.target.value.trim();
      state.parts.page = 1;
      loadSpareParts();
    }, 350);
  });

  // Load initial panel
  loadDashboard();
  loadSettings();
  updateServerTime();
  setInterval(updateServerTime, 1000);
}

function redirect() {
  window.location.href = '/?auth=required';
}

function updateServerTime() {
  const el = document.getElementById('server-current-time');
  if (el) el.textContent = new Date().toLocaleString();
  const startEl = document.getElementById('server-start-time');
  if (startEl && startEl.textContent === '—') {
    startEl.textContent = new Date().toLocaleString();
  }
}

/* ── Panel switching ────────────────────────────────────────────────────── */
function switchPanel(name) {
  currentPanel = name;

  // Hide all panels
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  // Show target
  const target = document.getElementById(`panel-${name}`);
  if (target) target.classList.add('active');

  // Update sidebar active
  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-panel') === name);
  });

  // Update topbar title
  const titleEl = document.getElementById('admin-topbar-title');
  if (titleEl) titleEl.textContent = PANEL_TITLES[name] || name;

  // Close mobile sidebar
  document.getElementById('admin-sidebar')?.classList.remove('open');
  document.getElementById('admin-sidebar-overlay')?.classList.remove('active');

  // Load panel data
  switch (name) {
    case 'dashboard':   loadDashboard();   break;
    case 'users':       loadUsers();       break;
    case 'listings':    loadListings();    break;
    case 'pending':     loadPending();     break;
    case 'featured':    loadFeatured();    break;
    case 'spare-parts': loadSpareParts();  break;
    case 'logs':        loadLogs();        break;
    case 'admins':      loadAdmins();      break;
    case 'analytics':   drawAnalyticsChart(); break;
    case 'maintenance': updateServerTime(); break;
    case 'super-admin': loadSuperAdminPanel(); break;
  }
}

/* ── Dashboard ──────────────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const { response, data } = await apiFetch('/api/admin/stats');
    if (!response.ok) throw new Error(data?.error || 'Failed to load stats');
    const s = data.stats;
    document.getElementById('stat-total-users').textContent  = s.totalUsers;
    document.getElementById('stat-total-ads').textContent    = s.totalAds;
    document.getElementById('stat-active-ads').textContent   = s.activeAds;
    document.getElementById('stat-pending-ads').textContent  = s.pendingAds;
    document.getElementById('stat-featured-ads').textContent = s.featuredAds;
    document.getElementById('stat-spare-parts').textContent  = s.totalSpareParts;
  } catch (err) {
    showToast(err.message, 'error');
  }

  // Recent users
  try {
    const { response, data } = await apiFetch('/api/admin/users?page=1&limit=5');
    if (response.ok && data?.users) {
      const tbody = document.getElementById('dash-recent-users');
      if (!data.users.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No users yet</td></tr>';
      } else {
        tbody.innerHTML = data.users.map(u => `
          <tr>
            <td>${esc(u.name)}</td>
            <td style="color:var(--text-muted);font-size:0.8rem">${esc(u.email)}</td>
            <td>${roleBadge(u.role)}</td>
            <td style="color:var(--text-muted);font-size:0.8rem">${esc(u.created_at ? u.created_at.split('T')[0] : '')}</td>
          </tr>`).join('');
      }
    }
  } catch { /* silent */ }

  // Recent ads
  try {
    const { response, data } = await apiFetch('/api/admin/ads?page=1&limit=5');
    if (response.ok && data?.ads) {
      const tbody = document.getElementById('dash-recent-ads');
      if (!data.ads.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No listings yet</td></tr>';
      } else {
        tbody.innerHTML = data.ads.map(a => `
          <tr>
            <td>${esc(a.title)}</td>
            <td>${statusBadge(a.status, a.featured)}</td>
            <td style="color:var(--text-muted);font-size:0.8rem">${esc(a.dateAdded || '')}</td>
          </tr>`).join('');
      }
    }
  } catch { /* silent */ }

  drawActivityChart();
}

/* ── Users ──────────────────────────────────────────────────────────────── */
async function loadUsers() {
  const s = state.users;
  const params = new URLSearchParams({
    page: s.page, limit: s.limit,
    search: s.search, role: s.role, status: s.status,
  });
  try {
    const { response, data } = await apiFetch(`/api/admin/users?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    s.total = data.total || 0;
    renderUsersTable(data.users || []);
    renderPagination('users-pagination', s.total, s.page, s.limit, (p) => { s.page = p; loadUsers(); });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No users found</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const isSelf = adminUser && u.id === adminUser.id;
    const isSuspended = u.role === 'suspended';
    const isAdmin = u.role === 'admin';
    const verified = u.email_verified === 1;
    const statusBadgeHtml = isSuspended
      ? '<span class="admin-badge suspended">Suspended</span>'
      : (verified ? '<span class="admin-badge active">Active</span>' : '<span class="admin-badge unverified">Unverified</span>');
    return `<tr>
      <td style="color:var(--text-muted);font-size:0.8rem">${esc(u.id)}</td>
      <td>${esc(u.name)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${esc(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${statusBadgeHtml}</td>
      <td>${verified ? '<span style="color:#10b981"><i class="fas fa-check"></i></span>' : '<span style="color:#6b7280"><i class="fas fa-times"></i></span>'}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${esc(u.created_at ? u.created_at.split('T')[0] : '')}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${!isSelf && !isAdmin ? `<button class="admin-btn sm primary" onclick="promoteUser(${u.id})"><i class="fas fa-arrow-up"></i> Admin</button>` : ''}
          ${!isSelf && isAdmin  ? `<button class="admin-btn sm secondary" onclick="demoteUser(${u.id})"><i class="fas fa-arrow-down"></i> Demote</button>` : ''}
          ${!isSelf && !isSuspended ? `<button class="admin-btn sm warning" onclick="suspendUser(${u.id})"><i class="fas fa-ban"></i></button>` : ''}
          ${!isSelf && isSuspended  ? `<button class="admin-btn sm success" onclick="unsuspendUser(${u.id})"><i class="fas fa-check"></i></button>` : ''}
          ${!isSelf ? `<button class="admin-btn sm danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Listings ───────────────────────────────────────────────────────────── */
async function loadListings() {
  const s = state.listings;
  const params = new URLSearchParams({ page: s.page, limit: s.limit, search: s.search, status: s.status });
  try {
    const { response, data } = await apiFetch(`/api/admin/ads?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    s.total = data.total || 0;
    renderListingsTable(data.ads || [], 'listings-table-body', true);
    renderPagination('listings-pagination', s.total, s.page, s.limit, (p) => { s.page = p; loadListings(); });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadPending() {
  const s = state.pending;
  const params = new URLSearchParams({ page: s.page, limit: s.limit, status: 'pending_payment' });
  try {
    const { response, data } = await apiFetch(`/api/admin/ads?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    s.total = data.total || 0;
    renderPendingTable(data.ads || []);
    renderPagination('pending-pagination', s.total, s.page, s.limit, (p) => { s.page = p; loadPending(); });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadFeatured() {
  const params = new URLSearchParams({ page: 1, limit: 100, status: 'featured' });
  try {
    const { response, data } = await apiFetch(`/api/admin/ads?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    renderFeaturedGrid(data.ads || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderListingsTable(ads, tbodyId, showFeaturedCol) {
  const tbody = document.getElementById(tbodyId);
  if (!ads.length) {
    const cols = showFeaturedCol ? 9 : 7;
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;color:var(--text-muted)">No listings found</td></tr>`;
    return;
  }
  tbody.innerHTML = ads.map(a => {
    const img = Array.isArray(a.images) && a.images[0] ? a.images[0] : '';
    const imgHtml = img ? `<img src="${esc(img)}" class="admin-table-thumb" alt="">` : '<div style="width:40px;height:32px;background:var(--bg-tertiary);border-radius:6px"></div>';
    const featuredToggle = showFeaturedCol
      ? `<td><button class="admin-btn sm ${a.featured ? 'purple' : 'secondary'}" onclick="toggleFeatured('${esc(a.id)}')" title="${a.featured ? 'Unfeature' : 'Feature'}"><i class="fas fa-star"></i></button></td>`
      : '';
    return `<tr>
      <td>${imgHtml}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.title)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.type || '')}</td>
      <td>${statusBadge(a.status, a.featured)}</td>
      <td style="font-size:0.82rem;white-space:nowrap">LKR ${Number(a.price || 0).toLocaleString()}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.publisherName || 'Guest')}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">${esc(a.dateAdded || '')}</td>
      ${featuredToggle}
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${a.status !== 'active'   ? `<button class="admin-btn sm success" onclick="activateAd('${esc(a.id)}')"><i class="fas fa-check"></i></button>` : ''}
          ${a.status !== 'removed'  ? `<button class="admin-btn sm warning" onclick="removeAd('${esc(a.id)}')"><i class="fas fa-eye-slash"></i></button>` : ''}
          <button class="admin-btn sm danger" onclick="deleteAd('${esc(a.id)}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderPendingTable(ads) {
  const tbody = document.getElementById('pending-table-body');
  if (!ads.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)"><i class="fas fa-check-circle" style="color:#10b981;margin-right:6px"></i>No pending listings</td></tr>';
    return;
  }
  tbody.innerHTML = ads.map(a => {
    const img = Array.isArray(a.images) && a.images[0] ? a.images[0] : '';
    const imgHtml = img ? `<img src="${esc(img)}" class="admin-table-thumb" alt="">` : '<div style="width:40px;height:32px;background:var(--bg-tertiary);border-radius:6px"></div>';
    return `<tr>
      <td>${imgHtml}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.title)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.type || '')}</td>
      <td style="font-size:0.82rem;white-space:nowrap">LKR ${Number(a.price || 0).toLocaleString()}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.publisherName || 'Guest')}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(a.dateAdded || '')}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="admin-btn success" onclick="activateAd('${esc(a.id)}');"><i class="fas fa-check"></i> Approve</button>
          <button class="admin-btn danger"  onclick="removeAd('${esc(a.id)}');"><i class="fas fa-times"></i> Reject</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderFeaturedGrid(ads) {
  const grid = document.getElementById('featured-grid');
  if (!ads.length) {
    grid.innerHTML = '<div class="admin-empty-state"><i class="fas fa-star"></i><p>No featured listings</p></div>';
    return;
  }
  grid.innerHTML = ads.map(a => {
    const img = Array.isArray(a.images) && a.images[0] ? a.images[0] : '';
    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${esc(a.title)}">`
      : `<div style="width:100%;height:130px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fas fa-image"></i></div>`;
    return `<div class="admin-featured-card">
      ${imgHtml}
      <div class="admin-featured-card-body">
        <div class="admin-featured-card-title" title="${esc(a.title)}">${esc(a.title)}</div>
        <div class="admin-featured-card-price">LKR ${Number(a.price || 0).toLocaleString()}</div>
        <button class="admin-btn sm warning" style="width:100%" onclick="toggleFeatured('${esc(a.id)}');loadFeatured()"><i class="fas fa-star-half-alt"></i> Unfeature</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Spare Parts ────────────────────────────────────────────────────────── */
async function loadSpareParts() {
  const s = state.parts;
  const params = new URLSearchParams({ page: s.page, limit: s.limit, search: s.search });
  try {
    const { response, data } = await apiFetch(`/api/admin/spare-parts?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    s.total = data.total || 0;
    const tbody = document.getElementById('parts-table-body');
    const parts = data.spareParts || [];
    if (!parts.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No spare parts found</td></tr>';
    } else {
      tbody.innerHTML = parts.map(p => `<tr>
        <td style="color:var(--text-muted);font-size:0.78rem">${esc(p.id)}</td>
        <td>${esc(p.name)}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${esc(p.category)}</td>
        <td style="font-size:0.82rem">${esc(p.condition)}</td>
        <td style="font-size:0.82rem;white-space:nowrap">LKR ${Number(p.price || 0).toLocaleString()}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${esc(p.publisherName || 'Unknown')}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${esc(p.dateAdded || '')}</td>
        <td><button class="admin-btn sm danger" onclick="deletePart('${esc(p.id)}')"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('');
    }
    renderPagination('parts-pagination', s.total, s.page, s.limit, (p) => { s.page = p; loadSpareParts(); });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Logs ───────────────────────────────────────────────────────────────── */
async function loadLogs() {
  try {
    const { response, data } = await apiFetch(`/api/admin/logs?limit=${state.logs.limit}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    const tbody = document.getElementById('logs-table-body');
    const logs = data.logs || [];
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No actions logged yet</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(l => `<tr>
      <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">${esc(l.created_at ? l.created_at.replace('T', ' ').split('.')[0] : '')}</td>
      <td style="font-size:0.82rem">${esc(l.admin_name || `#${l.admin_id}`)}</td>
      <td><code style="font-size:0.8rem;color:var(--accent-primary)">${esc(l.action)}</code></td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(l.target_type || '')} ${esc(l.target_id || '')}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(l.details || '—')}</td>
    </tr>`).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Admin Management ───────────────────────────────────────────────────── */
async function loadAdmins() {
  const params = new URLSearchParams({ page: 1, limit: 100, role: 'admin' });
  try {
    const { response, data } = await apiFetch(`/api/admin/users?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Failed');
    const tbody = document.getElementById('admins-table-body');
    const admins = (data.users || []).filter(u => u.role === 'admin');
    if (!admins.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No admins found</td></tr>';
      return;
    }
    tbody.innerHTML = admins.map(u => {
      const isSelf = adminUser && u.id === adminUser.id;
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${esc(u.id)}</td>
        <td>${esc(u.name)}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${esc(u.email)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${esc(u.created_at ? u.created_at.split('T')[0] : '')}</td>
        <td>${isSelf ? '<span style="color:var(--text-muted);font-size:0.8rem">You</span>' : `<button class="admin-btn sm warning" onclick="demoteUser(${u.id})"><i class="fas fa-arrow-down"></i> Demote</button>`}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function promoteByEmail() {
  const email = document.getElementById('promote-email')?.value?.trim();
  if (!email) { showToast('Enter a user email', 'warning'); return; }

  if (adminUser.role !== 'super_admin') {
    showToast('Only Super Admins can promote users to admin.', 'error');
    return;
  }

  try {
    const params = new URLSearchParams({ page: 1, limit: 5, search: email });
    const { response, data } = await apiFetch(`/api/admin/users?${params}`);
    if (!response.ok) throw new Error(data?.error || 'Search failed');
    const match = (data.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!match) { showToast('User not found with that email', 'error'); return; }

    const { response: r2, data: d2 } = await apiFetch('/api/super-admin/promote', {
      method: 'POST',
      body: JSON.stringify({ userId: match.id, role: 'admin' }),
    });
    if (!r2.ok) throw new Error(d2?.error || 'Promotion failed');
    showToast(`${match.name} promoted to admin`, 'success');
    document.getElementById('promote-email').value = '';
    loadAdmins();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Action helpers ─────────────────────────────────────────────────────── */
async function activateAd(id) {
  try {
    const { response, data } = await apiFetch(`/api/admin/ads/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: 'active' }),
    });
    if (!response.ok) throw new Error(data?.error || 'Failed');
    showToast('Ad activated', 'success');
    reloadCurrentAdsPanel();
  } catch (err) { showToast(err.message, 'error'); }
}

async function removeAd(id) {
  try {
    const { response, data } = await apiFetch(`/api/admin/ads/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: 'removed' }),
    });
    if (!response.ok) throw new Error(data?.error || 'Failed');
    showToast('Ad removed', 'success');
    reloadCurrentAdsPanel();
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteAd(id) {
  showConfirm('Delete this listing permanently? This cannot be undone.', async () => {
    try {
      const { response, data } = await apiFetch(`/api/admin/ads/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(data?.error || 'Failed');
      showToast('Ad deleted', 'success');
      reloadCurrentAdsPanel();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function toggleFeatured(id) {
  try {
    const { response, data } = await apiFetch(`/api/admin/ads/${encodeURIComponent(id)}/featured`, { method: 'PATCH' });
    if (!response.ok) throw new Error(data?.error || 'Failed');
    showToast('Featured status toggled', 'success');
    reloadCurrentAdsPanel();
  } catch (err) { showToast(err.message, 'error'); }
}

function reloadCurrentAdsPanel() {
  if (currentPanel === 'listings') loadListings();
  else if (currentPanel === 'pending') loadPending();
  else if (currentPanel === 'featured') loadFeatured();
  else if (currentPanel === 'dashboard') loadDashboard();
}

async function promoteUser(id) {
  try {
    const { response, data } = await apiFetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH', body: JSON.stringify({ role: 'admin' }),
    });
    if (!response.ok) throw new Error(data?.error || 'Failed');
    showToast('User promoted to admin', 'success');
    loadUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function demoteUser(id) {
  showConfirm('Demote this admin to regular user?', async () => {
    try {
      const { response, data } = await apiFetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH', body: JSON.stringify({ role: 'user' }),
      });
      if (!response.ok) throw new Error(data?.error || 'Failed');
      showToast('User demoted', 'success');
      loadUsers();
      if (currentPanel === 'admins') loadAdmins();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function suspendUser(id) {
  showConfirm('Suspend this user? They will not be able to log in.', async () => {
    try {
      const { response, data } = await apiFetch(`/api/admin/users/${id}/suspend`, { method: 'PATCH' });
      if (!response.ok) throw new Error(data?.error || 'Failed');
      showToast('User suspended', 'success');
      loadUsers();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function unsuspendUser(id) {
  try {
    const { response, data } = await apiFetch(`/api/admin/users/${id}/unsuspend`, { method: 'PATCH' });
    if (!response.ok) throw new Error(data?.error || 'Failed');
    showToast('User unsuspended', 'success');
    loadUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteUser(id) {
  showConfirm('Delete this user permanently? All their data will be removed.', async () => {
    try {
      const { response, data } = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(data?.error || 'Failed');
      showToast('User deleted', 'success');
      loadUsers();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function deletePart(id) {
  showConfirm('Delete this spare part listing permanently?', async () => {
    try {
      const { response, data } = await apiFetch(`/api/admin/spare-parts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(data?.error || 'Failed');
      showToast('Spare part deleted', 'success');
      loadSpareParts();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function forceLogoutAll() {
  showConfirm('Force logout all sessions? All users will need to log in again.', async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      showToast('All sessions cleared. Redirecting…', 'success');
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function exportData() {
  try {
    showToast('Fetching listings…', 'info');
    const { response, data } = await apiFetch('/api/admin/ads?page=1&limit=1000');
    if (!response.ok) throw new Error(data?.error || 'Failed');
    const blob = new Blob([JSON.stringify(data.ads || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ceylon-listings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

/* ── Settings ───────────────────────────────────────────────────────────── */
function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('ceylon_admin_settings') || '{}');
  if (saved.siteName)     document.getElementById('setting-site-name').value       = saved.siteName;
  if (saved.contactEmail) document.getElementById('setting-contact-email').value   = saved.contactEmail;
  if (saved.supportPhone) document.getElementById('setting-support-phone').value   = saved.supportPhone;
  if (saved.footerText)   document.getElementById('setting-footer-text').value     = saved.footerText;
  if (saved.lightMode) {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    const toggle = document.getElementById('setting-theme-toggle');
    if (toggle) toggle.checked = true;
  }
}

function saveSettings() {
  const settings = {
    siteName:     document.getElementById('setting-site-name')?.value || '',
    contactEmail: document.getElementById('setting-contact-email')?.value || '',
    supportPhone: document.getElementById('setting-support-phone')?.value || '',
    footerText:   document.getElementById('setting-footer-text')?.value || '',
    lightMode:    document.getElementById('setting-theme-toggle')?.checked || false,
  };
  localStorage.setItem('ceylon_admin_settings', JSON.stringify(settings));
  showToast('Settings saved', 'success');
}

/* ── Pagination ─────────────────────────────────────────────────────────── */
function renderPagination(containerId, total, currentPage, limit, loadFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="admin-page-btn" onclick="(${loadFn.toString()})(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage   = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="admin-page-btn ${i === currentPage ? 'active' : ''}" onclick="(${loadFn.toString()})(${i})">${i}</button>`;
  }

  html += `<button class="admin-page-btn" onclick="(${loadFn.toString()})(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  html += `<span class="admin-page-info">${total} total</span>`;
  container.innerHTML = html;
}

/* ── Badge helpers ──────────────────────────────────────────────────────── */
function statusBadge(status, featured) {
  if (featured) return '<span class="admin-badge featured"><i class="fas fa-star"></i> Featured</span>';
  switch (status) {
    case 'active':          return '<span class="admin-badge active">Active</span>';
    case 'pending_payment': return '<span class="admin-badge pending">Pending</span>';
    case 'removed':         return '<span class="admin-badge removed">Removed</span>';
    default: return `<span class="admin-badge user">${esc(status)}</span>`;
  }
}

function roleBadge(role) {
  switch (role) {
    case 'admin':     return '<span class="admin-badge admin"><i class="fas fa-shield-alt"></i> Admin</span>';
    case 'suspended': return '<span class="admin-badge suspended">Suspended</span>';
    default:          return '<span class="admin-badge user">User</span>';
  }
}

/* ── Modal ──────────────────────────────────────────────────────────────── */
let modalConfirmCallback = null;

function showConfirm(msg, onConfirm) {
  const overlay = document.getElementById('admin-modal-overlay');
  const msgEl   = document.getElementById('modal-msg');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  if (!overlay) return;
  if (msgEl) msgEl.textContent = msg;
  modalConfirmCallback = onConfirm;
  confirmBtn.onclick = () => { closeModal(); if (modalConfirmCallback) modalConfirmCallback(); };
  overlay.classList.add('active');
}

function closeModal() {
  document.getElementById('admin-modal-overlay')?.classList.remove('active');
  modalConfirmCallback = null;
}

/* ── Toast ──────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-circle' };
  const toast = document.createElement('div');
  toast.className = `admin-toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${esc(msg)}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(30px)'; toast.style.transition = 'opacity 0.3s, transform 0.3s'; setTimeout(() => toast.remove(), 350); }, 3000);
}

/* ── Logout ─────────────────────────────────────────────────────────────── */
async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  sessionStorage.removeItem('ceylon_access_token');
  window.location.href = '/';
}

/* ── Charts ─────────────────────────────────────────────────────────────── */
function drawBarChart(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.offsetWidth || canvas.parentElement.offsetWidth || 600;
  const displayH = parseInt(canvas.getAttribute('height')) || 160;
  canvas.width  = displayW * dpr;
  canvas.height = displayH * dpr;
  canvas.style.width  = displayW + 'px';
  canvas.style.height = displayH + 'px';
  ctx.scale(dpr, dpr);

  const w = displayW;
  const h = displayH;
  const padL = 36, padR = 12, padT = 16, padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const max = Math.max(...values, 1);

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (chartH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    const val = Math.round(max * i / 4);
    ctx.fillStyle = 'rgba(156,163,175,0.7)';
    ctx.font = `${11 / dpr * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(val, padL - 4, y + 4);
  }

  const barW = (chartW / labels.length) * 0.55;
  const gap  = (chartW / labels.length) * 0.45;

  labels.forEach((label, i) => {
    const x = padL + i * (barW + gap) + gap / 2;
    const barH = (values[i] / max) * chartH;
    const y = padT + chartH - barH;

    // Bar gradient
    const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
    grad.addColorStop(0, color || 'rgba(26,111,255,0.9)');
    grad.addColorStop(1, 'rgba(26,111,255,0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.arcTo(x + barW, y, x + barW, y + r, r);
    ctx.lineTo(x + barW, padT + chartH);
    ctx.lineTo(x, padT + chartH);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();

    // Value label on top
    if (values[i] > 0) {
      ctx.fillStyle = 'rgba(243,244,246,0.8)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(values[i], x + barW / 2, y - 4);
    }

    // X label
    ctx.fillStyle = 'rgba(107,114,128,0.9)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barW / 2, padT + chartH + 14);
  });
}

function drawActivityChart() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = [3, 7, 5, 8, 6, 12, 9];
  drawBarChart('activity-chart', days, values, 'rgba(26,111,255,0.9)');
}

function drawAnalyticsChart() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = [14, 21, 18, 25, 19, 30, 22];
  drawBarChart('analytics-chart', days, values, 'rgba(16,185,129,0.9)');
}

/* ── Boot ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);

/* ── Super Admin functions ──────────────────────────────────────────────── */
async function loadSuperAdminPanel() {
  if (adminUser.role !== 'super_admin') return;
  await Promise.all([loadSaAdmins(), loadSaLogs()]);
}

async function loadSaAdmins() {
  const { response, data } = await apiFetch('/api/admin/users?role=admin&limit=100');
  const tbody = document.getElementById('sa-admins-tbody');
  if (!response.ok || !tbody) return;
  const admins = data.users || [];
  if (!admins.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No admins</td></tr>';
    return;
  }
  tbody.innerHTML = admins.map(u => {
    const isSelf = adminUser && u.id === adminUser.id;
    const isSuperAdminUser = u.role === 'super_admin';
    return `<tr>
      <td style="color:var(--text-muted);font-size:0.8rem">${esc(u.id)}</td>
      <td>${esc(u.name)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${esc(u.email)}</td>
      <td>${isSuperAdminUser
        ? '<span class="admin-badge" style="background:rgba(255,179,0,0.15);color:#ffb300"><i class="fas fa-crown"></i> Super Admin</span>'
        : roleBadge(u.role)}</td>
      <td>${u.status === 'suspended' ? '<span class="admin-badge suspended">Suspended</span>' : '<span class="admin-badge active">Active</span>'}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${esc(u.created_at ? u.created_at.split('T')[0] : '')}</td>
      <td>
        ${!isSelf && !isSuperAdminUser ? `
          <button class="admin-btn sm warning" onclick="saSetRole(${u.id},'user')"><i class="fas fa-arrow-down"></i> Demote</button>
        ` : (isSelf ? '<span style="font-size:0.8rem;color:var(--text-muted)">You</span>' : '<span style="font-size:0.8rem;color:var(--text-muted)">Protected</span>')}
      </td>
    </tr>`;
  }).join('');
}

async function loadSaLogs() {
  const { response, data } = await apiFetch('/api/admin/logs?limit=100');
  const tbody = document.getElementById('sa-logs-tbody');
  if (!response.ok || !tbody) return;
  const logs = data.logs || [];
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No logs yet</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => `<tr>
    <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${esc(l.created_at ? l.created_at.replace('T',' ').split('.')[0] : '')}</td>
    <td style="font-size:0.82rem">${esc(l.admin_name || `#${l.admin_id}`)}</td>
    <td><code style="font-size:0.78rem;color:var(--accent-primary)">${esc(l.action)}</code></td>
    <td style="font-size:0.8rem;color:var(--text-muted)">${esc(l.target_type||'')} ${esc(l.target_id||'')}</td>
    <td style="font-size:0.8rem;color:var(--text-muted)">${esc(l.details||'—')}</td>
  </tr>`).join('');
}

async function superAdminPromote(role) {
  const email = document.getElementById('sa-promote-email')?.value?.trim();
  if (!email) { showToast('Enter a user email', 'warning'); return; }
  try {
    const { response, data } = await apiFetch('/api/admin/users?search=' + encodeURIComponent(email) + '&limit=5');
    if (!response.ok) throw new Error(data?.error || 'Search failed');
    const match = (data.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!match) { showToast('User not found', 'error'); return; }
    if (match.role === 'super_admin') { showToast('Cannot modify a super_admin', 'error'); return; }
    const { response: r2, data: d2 } = await apiFetch('/api/super-admin/promote', {
      method: 'POST', body: JSON.stringify({ userId: match.id, role }),
    });
    if (!r2.ok) throw new Error(d2?.error || 'Failed');
    showToast(`${match.name} ${role === 'admin' ? 'promoted to Admin' : 'demoted to User'}`, 'success');
    document.getElementById('sa-promote-email').value = '';
    loadSaAdmins();
  } catch (err) { showToast(err.message, 'error'); }
}

async function saSetRole(userId, role) {
  showConfirm(`${role === 'user' ? 'Demote this admin to regular user?' : 'Promote to admin?'}`, async () => {
    const { response, data } = await apiFetch('/api/super-admin/promote', {
      method: 'POST', body: JSON.stringify({ userId, role }),
    });
    if (!response.ok) { showToast(data?.error || 'Failed', 'error'); return; }
    showToast('Role updated', 'success');
    loadSaAdmins();
  });
}
