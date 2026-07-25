/*
 * CeylonSuperHub Admin Panel JavaScript
 * Handles admin panel functionality, API integration, and state management
 */

const ADMIN_CONFIG = {
  API_BASE: '/api',
  appConfig: null,
  currentUser: null,
  currentSection: 'dashboard'
};

// Initialize Admin Panel
async function initAdminPanel() {
  console.log('[AdminPanel] Initializing admin panel...');

  // Load public config
  await loadAdminConfig();

  // Check if user is authenticated and is admin
  if (!ADMIN_CONFIG.currentUser) {
    redirectToLogin();
    return;
  }

  if (ADMIN_CONFIG.currentUser.role !== 'admin') {
    showNotification('Access denied. Admin privileges required.', 'error');
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    return;
  }

  // Update UI with user info
  updateAdminUI();

  // Load section based on URL hash or default to dashboard
  const hash = window.location.hash || '#dashboard';
  const section = hash.replace('#', '');
  adminNavigate(section || 'dashboard');

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const section = window.location.hash.replace('#', '');
    adminNavigate(section || 'dashboard');
  });
}

// Load public configuration
async function loadAdminConfig() {
  try {
    const response = await apiFetch('/api/config/public');
    if (response.ok) {
      ADMIN_CONFIG.appConfig = response.data;
      console.log('[AdminPanel] Loaded public config');
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load admin config:', error);
  }
}

// Update admin UI with user information
async function updateAdminUI() {
  const user = ADMIN_CONFIG.currentUser;
  ADMIN_CONFIG.currentUser = user;

  // Update user info in sidebar
  const avatarInitial = user.name ? user.name.charAt(0).toUpperCase() : 'A';
  document.getElementById('admin-avatar-initial').textContent = avatarInitial;
  document.getElementById('admin-user-name').textContent = user.name || 'Admin';
  document.getElementById('admin-user-email').textContent = user.email || 'admin@example.com';
  document.getElementById('admin-name').value = user.name || '';
  document.getElementById('admin-email').value = user.email || '';

  // Update sidebar visibility for admin users
  const adminSidebar = document.getElementById('admin-sidebar');
  if (adminSidebar) {
    adminSidebar.style.display = 'block';
  }
}

// Navigation handler for admin sections
function adminNavigate(section) {
  // Update active state in sidebar
  document.querySelectorAll('.admin-sidebar-nav a').forEach(item => {
    item.classList.remove('active');
  });

  const activeItem = document.querySelector(`.admin-sidebar-nav a[href*="${section}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // Hide all sections
  document.querySelectorAll('.admin-section').forEach(sectionEl => {
    sectionEl.style.display = 'none';
    sectionEl.classList.remove('active');
  });

  // Show selected section
  const targetSection = document.getElementById(`admin-${section}`);
  if (targetSection) {
    targetSection.style.display = 'block';
    targetSection.classList.add('active');

    // Load section data
    loadSectionData(section);
  }

  // Update URL hash
  window.location.hash = section;
  ADMIN_CONFIG.currentSection = section;

  // Close mobile sidebar on mobile devices
  if (window.innerWidth <= 768) {
    toggleAdminSidebar();
  }
}

// Load data for specific sections
async function loadSectionData(section) {
  try {
    switch (section) {
      case 'dashboard':
        await loadDashboardData();
        break;
      case 'users':
        await loadUsersData();
        break;
      case 'listings':
        await loadListingsData();
        break;
      case 'featured':
        await loadFeaturedData();
        break;
      case 'pending':
        await loadPendingData();
        break;
      case 'revenue':
        await loadRevenueData();
        break;
      case 'admins':
        await loadAdminsData();
        break;
      case 'settings':
        loadSettingsPage();
        break;
    }
  } catch (error) {
    console.error(`[AdminPanel] Error loading section ${section}:`, error);
    showNotification(`Failed to load ${section} data`, 'error');
  }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    const response = await apiFetch('/admin/dashboard');
    if (response.ok) {
      updateDashboardStats(response.data.stats);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load dashboard data:', error);
    showNotification('Failed to load dashboard data', 'error');
  }
}

// Update dashboard statistics
function updateDashboardStats(stats) {
  document.getElementById('stat-revenue').textContent = `LKR ${stats.totalRevenue || 0}`;
  document.getElementById('stat-users').textContent = stats.totalUsers || 0;
  document.getElementById('stat-ads').textContent = stats.activeAds || 0;
  document.getElementById('stat-active-listings').textContent = stats.activeAds || 0;
  document.getElementById('stat-featured').textContent = stats.featuredAds || 0;
  document.getElementById('stat-pending').textContent = stats.pendingAds || 0;

  // Update changes (placeholder values for now)
  updateChangeIndicators(stats);
}

// Update change indicators for statistics
function updateChangeIndicators(stats) {
  const changes = {
    revenue: '+12.5%',
    users: '+8.2%',
    ads: '+5.1%',
    listings: '+3.7%',
    featured: '+15.3%',
    pending: '-2.4%'
  };

  document.getElementById('revenue-change').textContent = changes.revenue;
  document.getElementById('users-change').textContent = changes.users;
  document.getElementById('ads-change').textContent = changes.ads;
  document.getElementById('listings-change').textContent = changes.listings;
  document.getElementById('featured-change').textContent = changes.featured;
  document.getElementById('pending-change').textContent = changes.pending;
}

// Load users data
async function loadUsersData() {
  try {
    const response = await apiFetch('/admin/users');
    if (response.ok) {
      renderUsersGrid(response.data.users);
      setupUserSearchFilter(response.data.users);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load users data:', error);
    showNotification('Failed to load users data', 'error');
  }
}

// Render users grid
function renderUsersGrid(users) {
  const container = document.getElementById('users-grid');
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = `
      <div class="admin-empty-state">
        <i class="fas fa-users"></i>
        <h3>No users found</h3>
        <p>Try adjusting your search criteria.</p>
      </div>
    `;
    return;
  }

  let html = '';
  users.forEach(user => {
    const roleBadge = user.role === 'admin' ?
      '<span class="admin-badge admin">Admin</span>' :
      '<span class="admin-badge user">User</span>';
    const statusBadge = user.status === 'active' ?
      '<span class="admin-badge active">Active</span>' :
      '<span class="admin-badge disabled">Disabled</span>';

    html += `
      <div class="admin-card user-card">
        <div class="admin-card-header">
          <h3>${user.name}</h3>
          <div class="user-badges">
            ${roleBadge}
            ${statusBadge}
          </div>
        </div>
        <div class="admin-card-body">
          <div class="user-info">
            <div class="user-info-item">
              <i class="fas fa-envelope"></i>
              <span>${user.email}</span>
            </div>
            <div class="user-info-item">
              <i class="fas fa-calendar"></i>
              <span>Registered: ${new Date(user.created_at).toLocaleDateString()}</span>
            </div>
            <div class="user-info-item">
              <i class="fas fa-clock"></i>
              <span>Last login: ${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</span>
            </div>
          </div>
        </div>
        <div class="admin-card-footer">
          <button class="admin-btn admin-btn-secondary view-user-btn" onclick="viewUserDetails('${user.id}', '${user.name}')">
            <i class="fas fa-eye"></i> View Profile
          </button>
          ${user.status === 'active' ?
            `<button class="admin-btn admin-btn-danger disable-user-btn" onclick="disableUser('${user.id}', '${user.name}')">
              <i class="fas fa-ban"></i> Disable
            </button>` :
            `<button class="admin-btn admin-btn-primary enable-user-btn" onclick="enableUser('${user.id}', '${user.name}')">
              <i class="fas fa-check"></i> Enable
            </button>`
          }
          <button class="admin-btn admin-btn-danger delete-user-btn" onclick="deleteUser('${user.id}', '${user.name}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Setup search and filter for users
function setupUserSearchFilter(allUsers) {
  const searchInput = document.getElementById('user-search');
  const statusFilter = document.getElementById('user-status-filter');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filtered = allUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
      renderUsersGrid(filtered);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      const status = e.target.value;
      let filtered = allUsers;
      if (status !== 'all') {
        filtered = allUsers.filter(user => user.status === status);
      }
      renderUsersGrid(filtered);
    });
  }
}

// Load listings data
async function loadListingsData() {
  try {
    const response = await apiFetch('/admin/listings');
    if (response.ok) {
      renderListingsTable(response.data.listings);
      setupListingFilters(response.data.listings);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load listings data:', error);
    showNotification('Failed to load listings data', 'error');
  }
}

// Render listings table
function renderListingsTable(listings) {
  const tbody = document.getElementById('listings-tbody');
  if (!tbody) return;

  if (listings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-empty-state">
          <i class="fas fa-car"></i>
          <h3>No listings found</h3>
          <p>Try adjusting your search criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  listings.forEach(listing => {
    const statusBadge = {
      'active': '<span class="admin-badge active">Active</span>',
      'pending_payment': '<span class="admin-badge">Pending Payment</span>',
      'pending': '<span class="admin-badge">Pending</span>',
      'rejected': '<span class="admin-badge disabled">Rejected</span>'
    }[listing.status] || `<span class="admin-badge">${listing.status}</span>`;

    const featuredBadge = listing.featured ?
      '<span class="admin-badge" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);"><i class="fas fa-star" style="margin-right: 4px;"></i>Featured</span>' :
      '';

    html += `
      <tr>
        <td>#${listing.id}</td>
        <td>
          <div class="listing-title">${listing.title}</div>
          <div class="listing-meta">${listing.type} | ${listing.year}</div>
        </td>
        <td>
          <div class="listing-price">LKR ${listing.price?.toLocaleString() || 0}</div>
          ${featuredBadge}
        </td>
        <td>${statusBadge}</td>
        <td>${new Date(listing.date_added).toLocaleDateString()}</td>
        <td>${listing.seller_name || 'Unknown'}</td>
        <td>
          <div class="action-buttons">
            <button class="admin-btn admin-btn-secondary view-listing-btn" onclick="viewListingDetails('${listing.id}')">
              <i class="fas fa-eye"></i>
            </button>
            ${listing.status === 'pending_payment' || listing.status === 'pending' ?
              `<button class="admin-btn admin-btn-primary approve-listing-btn" onclick="approveListing('${listing.id}', '${listing.title}')">
                <i class="fas fa-check"></i> Approve
              </button>
              <button class="admin-btn admin-btn-danger reject-listing-btn" onclick="rejectListing('${listing.id}', '${listing.title}')">
                <i class="fas fa-times"></i> Reject
              </button>` :
              ''
            }
            ${listing.featured ?
              `<button class="admin-btn admin-btn-secondary unfeature-listing-btn" onclick="unfeatureListing('${listing.id}', '${listing.title}')">
                <i class="fas fa-star-o"></i> Unfeature
              </button>` :
              `<button class="admin-btn admin-btn-primary feature-listing-btn" onclick="featureListing('${listing.id}')">
                <i class="fas fa-star"></i> Feature
              </button>`
            }
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Setup filters for listings
function setupListingFilters(allListings) {
  const searchInput = document.getElementById('listing-search');
  const statusFilter = document.getElementById('listing-status-filter');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filtered = allListings.filter(listing =>
        listing.title.toLowerCase().includes(searchTerm) ||
        listing.make.toLowerCase().includes(searchTerm) ||
        listing.model.toLowerCase().includes(searchTerm)
      );
      renderListingsTable(filtered);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      const status = e.target.value;
      let filtered = allListings;
      if (status !== 'all') {
        filtered = allListings.filter(listing => listing.status === status);
      }
      renderListingsTable(filtered);
    });
  }
}

// Load featured listings data
async function loadFeaturedData() {
  try {
    const response = await apiFetch('/admin/featured');
    if (response.ok) {
      renderFeaturedGrid(response.data.featured);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load featured data:', error);
    showNotification('Failed to load featured data', 'error');
  }
}

// Render featured grid
function renderFeaturedGrid(featured) {
  const container = document.getElementById('featured-grid');
  if (!container) return;

  if (featured.length === 0) {
    container.innerHTML = `
      <div class="admin-empty-state">
        <i class="fas fa-star"></i>
        <h3>No featured listings found</h3>
        <p>Feature some listings to get started.</p>
      </div>
    `;
    return;
  }

  let html = '';
  featured.forEach(listing => {
    html += `
      <div class="admin-card featured-listing-card">
        <div class="featured-listing-content">
          <div class="featured-listing-image">
            <img src="${listing.images && listing.images[0] ? listing.images[0] : 'https://via.placeholder.com/80x80?text=No+Image'}"
                 alt="${listing.title}"
                 onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'" />
          </div>
          <div class="featured-listing-info">
            <h3>${listing.title}</h3>
            <p class="listing-details">
              <span><i class="fas fa-car"></i> ${listing.type}</span>
              <span><i class="fas fa-rupee-sign"></i> LKR ${listing.price?.toLocaleString() || 0}</span>
              <span><i class="fas fa-map-marker-alt"></i> ${listing.location}</span>
            </p>
            <p class="listing-meta">
              <span><i class="fas fa-calendar"></i> Added: ${new Date(listing.date_added).toLocaleDateString()}</span>
            </p>
          </div>
          <div class="featured-listing-actions">
            <button class="admin-btn admin-btn-secondary view-featured-btn" onclick="viewListingDetails('${listing.id}')">
              <i class="fas fa-eye"></i> View Details
            </button>
            <button class="admin-btn admin-btn-danger remove-featured-btn" onclick="unfeatureListing('${listing.id}', '${listing.title}')">
              <i class="fas fa-times-circle"></i> Remove Featured
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Load pending approvals data
async function loadPendingData() {
  try {
    const response = await apiFetch('/admin/pending');
    if (response.ok) {
      renderPendingTable(response.data.pending);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load pending data:', error);
    showNotification('Failed to load pending data', 'error');
  }
}

// Render pending table
function renderPendingTable(pending) {
  const tbody = document.getElementById('pending-tbody');
  if (!tbody) return;

  if (pending.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="admin-empty-state">
          <i class="fas fa-clock"></i>
          <h3>No pending listings found</h3>
          <p>All listings have been reviewed.</p>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  pending.forEach(listing => {
    html += `
      <tr>
        <td>
          <div class="pending-listing-info">
            <div class="pending-listing-title">${listing.title}</div>
            <div class="pending-listing-type">${listing.type}</div>
          </div>
        </td>
        <td>
          <div class="seller-info">
            <div class="seller-name">${listing.seller_name || 'Unknown'}</div>
            <div class="seller-phone">${listing.seller_phone || ''}</div>
          </div>
        </td>
        <td>
          <div class="pending-listing-price">LKR ${listing.price?.toLocaleString() || 0}</div>
          <div class="pending-listing-location">${listing.location}</div>
        </td>
        <td>${new Date(listing.date_added).toLocaleDateString()}</td>
        <td>
          <div class="pending-actions">
            <button class="admin-btn admin-btn-primary approve-pending-btn" onclick="approveListing('${listing.id}', '${listing.title}')">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="admin-btn admin-btn-danger reject-pending-btn" onclick="rejectListing('${listing.id}', '${listing.title}')">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Load revenue data
async function loadRevenueData() {
  try {
    const response = await apiFetch('/admin/revenue');
    if (response.ok) {
      updateRevenueStats(response.data.revenue);
      renderPaymentsTable(response.data.recentPayments);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load revenue data:', error);
    showNotification('Failed to load revenue data', 'error');
  }
}

// Update revenue statistics
function updateRevenueStats(stats) {
  document.getElementById('stat-today-revenue').textContent = `LKR ${stats.today || 0}`;
  document.getElementById('stat-weekly-revenue').textContent = `LKR ${stats.weekly || 0}`;
  document.getElementById('stat-monthly-revenue').textContent = `LKR ${stats.monthly || 0}`;
  document.getElementById('stat-lifetime-revenue').textContent = `LKR ${stats.lifetime || 0}`;
}

// Render payments table
function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="admin-empty-state">
          <i class="fas fa-receipt"></i>
          <h3>No payment records found</h3>
          <p>Payment transactions will appear here.</p>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  payments.forEach(payment => {
    const statusBadge = payment.status === 'succeeded' ?
      '<span class="admin-badge active">Success</span>' :
      '<span class="admin-badge disabled">Failed</span>';

    html += `
      <tr>
        <td>#${payment.id}</td>
        <td>${payment.seller_name || 'Unknown'}</td>
        <td><span class="payment-amount">LKR ${payment.amount?.toLocaleString() || 0}</span></td>
        <td>${new Date(payment.date).toLocaleDateString()}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Load admins data
async function loadAdminsData() {
  try {
    const response = await apiFetch('/admin/admins');
    if (response.ok) {
      renderAdminsTable(response.data.admins);
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load admins data:', error);
    showNotification('Failed to load admins data', 'error');
  }
}

// Render admins table
function renderAdminsTable(admins) {
  const tbody = document.getElementById('admins-tbody');
  if (!tbody) return;

  if (admins.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-empty-state">
          <i class="fas fa-user-shield"></i>
          <h3>No administrators found</h3>
          <p>Administrators are created manually in the database.</p>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  admins.forEach(admin => {
    const lastLogin = admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never';
    const createdDate = new Date(admin.created_at).toLocaleDateString();

    html += `
      <tr>
        <td>
          <div class="admin-user-info">
            <div class="admin-user-avatar">
              <span>${admin.full_name ? admin.full_name.charAt(0).toUpperCase() : 'A'}</span>
            </div>
            <div class="admin-user-details">
              <div class="admin-user-name">${admin.full_name || 'Unknown'}</div>
              <div class="admin-user-email">${admin.email}</div>
            </div>
          </div>
        </td>
        <td>${admin.email}</td>
        <td>
          <span class="admin-badge permission-badge">
            ${admin.permissions || 'Limited'}
          </span>
        </td>
        <td>${lastLogin}</td>
        <td>${createdDate}</td>
        <td>
          <span class="admin-badge admin">Admin</span>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Load settings page
async function loadSettingsPage() {
  try {
    const response = await apiFetch('/admin/settings');
    if (response.ok) {
      document.getElementById('admin-name').value = response.data.profile.name;
      document.getElementById('admin-email').value = response.data.profile.email;
    }
  } catch (error) {
    console.error('[AdminPanel] Failed to load settings:', error);
    showNotification('Failed to load settings', 'error');
  }
}

// Admin action functions
async function approveListing(adId, title = '') {
  if (!confirm(`Are you sure you want to approve "${title || adId}"?`)) return;

  try {
    showLoading(true);
    const response = await apiFetch('/admin/listing/approve', {
      method: 'POST',
      body: JSON.stringify({ adId })
    });

    if (response.ok) {
      showNotification('Listing approved successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to approve listing', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error approving listing:', error);
    showNotification('Error approving listing', 'error');
  } finally {
    showLoading(false);
  }
}

async function rejectListing(adId, title = '') {
  if (!confirm(`Are you sure you want to reject "${title || adId}"?`)) return;

  try {
    showLoading(true);
    const response = await apiFetch('/admin/listing/reject', {
      method: 'POST',
      body: JSON.stringify({ adId })
    });

    if (response.ok) {
      showNotification('Listing rejected successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to reject listing', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error rejecting listing:', error);
    showNotification('Error rejecting listing', 'error');
  } finally {
    showLoading(false);
  }
}

async function featureListing(adId) {
  if (!confirm('Are you sure you want to feature this listing?')) return;

  try {
    showLoading(true);
    const response = await apiFetch('/admin/listing/feature', {
      method: 'POST',
      body: JSON.stringify({ adId })
    });

    if (response.ok) {
      showNotification('Listing featured successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to feature listing', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error featuring listing:', error);
    showNotification('Error featuring listing', 'error');
  } finally {
    showLoading(false);
  }
}

async function unfeatureListing(adId, title = '') {
  if (!confirm(`Are you sure you want to remove featured status from "${title || adId}"?`)) return;

  try {
    showLoading(true);
    const response = await apiFetch('/admin/listing/unfeature', {
      method: 'POST',
      body: JSON.stringify({ adId })
    });

    if (response.ok) {
      showNotification('Featured listing removed successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to remove featured status', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error unfeaturing listing:', error);
    showNotification('Error removing featured status', 'error');
  } finally {
    showLoading(false);
  }
}

async function disableUser(userId, userName = '') {
  if (!confirm(`Are you sure you want to disable "${userName}"?`)) return;

  try {
    showLoading(true);
    const response = await apiFetch('/admin/user/disable', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });

    if (response.ok) {
      showNotification('User disabled successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to disable user', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error disabling user:', error);
    showNotification('Error disabling user', 'error');
  } finally {
    showLoading(false);
  }
}

async function enableUser(userId, userName = '') {
  if (!confirm(`Are you sure you want to enable "${userName}"?`)) return;

  try {
    showLoading(true);
    const response = await apiFetch('/admin/user/enable', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });

    if (response.ok) {
      showNotification('User enabled successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to enable user', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error enabling user:', error);
    showNotification('Error enabling user', 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteUser(userId, userName = '') {
  if (!confirm(`Are you absolutely sure you want to delete "${userName}"? This action cannot be undone.`)) return;

  try {
    showLoading(true);
    const response = await apiFetch(`/admin/user/${userId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showNotification('User deleted successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to delete user', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error deleting user:', error);
    showNotification('Error deleting user', 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteListing(listingId) {
  if (!confirm('Are you absolutely sure you want to delete this listing? This action cannot be undone.')) return;

  try {
    showLoading(true);
    const response = await apiFetch(`/admin/listing/${listingId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showNotification('Listing deleted successfully', 'success');
      refreshCurrentSection();
    } else {
      showNotification(response.data?.error || 'Failed to delete listing', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error deleting listing:', error);
    showNotification('Error deleting listing', 'error');
  } finally {
    showLoading(false);
  }
}

async function updateAdminProfile() {
  const name = document.getElementById('admin-name').value;
  const email = document.getElementById('admin-email').value;

  if (!name || !email) {
    showNotification('Name and email are required', 'error');
    return;
  }

  try {
    showLoading(true);
    const response = await apiFetch('/admin/settings/update-profile', {
      method: 'POST',
      body: JSON.stringify({ name, email })
    });

    if (response.ok) {
      showNotification('Profile updated successfully', 'success');
      // Update local user info
      ADMIN_CONFIG.currentUser.name = name;
      ADMIN_CONFIG.currentUser.email = email;
      updateAdminUI();
    } else {
      showNotification(response.data?.error || 'Failed to update profile', 'error');
    }
  } catch (error) {
    console.error('[AdminPanel] Error updating profile:', error);
    showNotification('Error updating profile', 'error');
  } finally {
    showLoading(false);
  }
}

function adminLogout() {
  if (confirm('Are you sure you want to logout?')) {
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    // Clear admin state
    ADMIN_CONFIG.currentUser = null;
    ADMIN_CONFIG.currentSection = 'dashboard';
    // Redirect to home page
    window.location.href = '/';
  }
}

function redirectToLogin() {
  window.location.href = '/';
}
function toggleAdminSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  sidebar.classList.toggle('active');
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('admin-notification');
  if (!container) return;

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };

  container.innerHTML = `
    <div class="admin-notification-content" style="background: ${colors[type]}; color: white; padding: 15px 20px; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); margin-bottom: 10px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;

  container.classList.add('show');
  setTimeout(() => {
    container.classList.remove('show');
  }, 5000);
}

function showLoading(show) {
  // Implement loading indicator if needed
  console.log(show ? 'Loading...' : 'Done loading');
}

function refreshCurrentSection() {
  const currentSection = ADMIN_CONFIG.currentSection;
  loadSectionData(currentSection);
}

function viewUserDetails(userId, userName) {
  showNotification(`Viewing user details for user ID: ${userId} (${userName})`, 'info');
}

function viewListingDetails(listingId) {
  showNotification(`Viewing listing details for ID: ${listingId}`, 'info');
}

// API fetch helper function
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (ADMIN_CONFIG.currentUser?.accessToken) {
    headers.Authorization = `Bearer ${ADMIN_CONFIG.currentUser.accessToken}`;
  }

  const API_BASE = '/api';
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return { response, data };
}

// Expose global functions for HTML onclick handlers
window.adminNavigate = adminNavigate;
window.toggleAdminSidebar = toggleAdminSidebar;
window.adminLogout = adminLogout;
window.approveListing = approveListing;
window.rejectListing = rejectListing;
window.featureListing = featureListing;
window.unfeatureListing = unfeatureListing;
window.disableUser = disableUser;
window.enableUser = enableUser;
window.deleteUser = deleteUser;
window.deleteListing = deleteListing;
window.updateAdminProfile = updateAdminProfile;
window.viewUserDetails = viewUserDetails;
window.viewListingDetails = viewListingDetails;

console.log('[AdminPanel] Admin panel JavaScript loaded successfully');
