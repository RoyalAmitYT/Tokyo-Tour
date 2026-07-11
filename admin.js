/* =====================================================
   TOKYO TOUR — admin.js
   Admin Panel page logic. Entirely separate from
   dashboard.js — the user Dashboard is untouched by this
   file, and this file never runs anywhere but admin.html.

   This page is protected by the inline guard at the top of
   admin.html (auth + isAdmin) — by the time this file runs,
   TokyoTourSession.getUser() is non-null and
   TokyoTourSession.isAdmin() is true. requireAdmin() below
   repeats the check anyway (defense in depth, matches the
   pattern dashboard.js already uses for requireAuth()).

   Data is sourced from TokyoTourAdmin (admin-service.js):
   TripsService, BookingsService, StatsService.
===================================================== */
document.addEventListener('DOMContentLoaded', async () => {

  if (!window.TokyoTourSession || !(await TokyoTourSession.requireAdmin('admin.html'))) return;

  /* ---------- Tab navigation (same pattern as dashboard.js) ---------- */
  const navLinks = document.querySelectorAll('.dash__nav-link[data-tab]');
  const panels = document.querySelectorAll('.dash__panel');
  const sidebar = document.querySelector('.dash__sidebar');

  function activateTab(tab) {
    navLinks.forEach(l => l.classList.toggle('is-active', l.dataset.tab === tab));
    panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab));
    sidebar.classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  navLinks.forEach(link => link.addEventListener('click', () => activateTab(link.dataset.tab)));

  const menuToggle = document.getElementById('dashMenuToggle');
  menuToggle && menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle && menuToggle.addEventListener('click', () => {
    const opening = !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });

  /* ---------- Sidebar identity ---------- */
  (function renderIdentity() {
    const user = TokyoTourSession.getUser();
    if (!user) return;
    const nameEl = document.getElementById('adminUserName');
    const emailEl = document.getElementById('adminUserEmail');
    if (nameEl) nameEl.textContent = user.full_name || user.email;
    if (emailEl) emailEl.textContent = user.email;
  })();

  /* ---------- Shared helpers ---------- */
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatMoney(n) {
    return '$' + Math.round(n || 0).toLocaleString('en-US');
  }
  function formatDateRange(trip) {
    if (!trip || !trip.start_date || !trip.end_date) return 'Dates unavailable';
    const start = new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} – ${end}`;
  }
  function stateMessageHtml(text) {
    return `<p class="dash-empty" style="display:block;">${escapeHtml(text)}</p>`;
  }
  function friendlyMessage(err, fallback) {
    return (err && err.isFriendlyAdminError && err.message) ? err.message : fallback;
  }

  /* =====================================================
     DASHBOARD (stats)
  ===================================================== */
  async function renderStats() {
    const statsMessage = document.getElementById('statsMessage');
    const els = {
      totalUsers: document.getElementById('statUsers'),
      totalTrips: document.getElementById('statTrips'),
      publishedTrips: document.getElementById('statPublished'),
      totalBookings: document.getElementById('statBookings')
    };
    if (!window.TokyoTourAdmin) return;
    if (statsMessage) statsMessage.textContent = '';

    try {
      const stats = await TokyoTourAdmin.StatsService.getStats();
      Object.keys(els).forEach(key => { if (els[key]) els[key].textContent = (stats[key] ?? 0).toLocaleString('en-US'); });
    } catch (err) {
      console.error('Admin dashboard: failed to load stats:', err);
      if (statsMessage) statsMessage.textContent = friendlyMessage(err, "We couldn't load platform statistics right now. Please try again.");
    }
  }
  renderStats();

  /* =====================================================
     TRIPS
  ===================================================== */
  const tripsTable = document.getElementById('tripsTable');
  const tripsHead = tripsTable ? tripsTable.querySelector('.dash-table__row--head') : null;
  let tripsCache = [];

  function setTripsBody(html) {
    if (!tripsTable) return;
    tripsTable.querySelectorAll('.dash-table__row:not(.dash-table__row--head)').forEach(row => row.remove());
    if (tripsHead) tripsHead.insertAdjacentHTML('afterend', html);
    else tripsTable.insertAdjacentHTML('beforeend', html);
  }

  function tripRowHtml(trip) {
    const statusCls = trip.published ? 'dash-status--confirmed' : 'dash-status--cancelled';
    const statusLabel = trip.published ? 'Published' : 'Unpublished';
    const featuredNote = trip.featured ? ' · Featured' : '';
    return `
      <div class="dash-table__row" data-trip-id="${escapeHtml(trip.id)}">
        <span data-label="Trip">
          ${escapeHtml(trip.title)}
          <br><small style="color:var(--text-faint);">${escapeHtml(trip.destination)} · ${trip.seats_available ?? 0}/${trip.total_seats ?? 0} seats available${featuredNote}</small>
        </span>
        <span data-label="Dates">${formatDateRange(trip)}</span>
        <span data-label="Price">${formatMoney(trip.price)}</span>
        <span data-label="Status"><span class="dash-status ${statusCls}">${statusLabel}</span></span>
        <span data-label="">
          <div class="dash-table__actions">
            <button class="btn btn--outline btn--sm" data-action="edit-trip">Edit</button>
            <button class="btn btn--outline btn--sm" data-action="toggle-publish">${trip.published ? 'Unpublish' : 'Publish'}</button>
            <button class="btn btn--outline btn--sm dash-danger-btn" data-action="delete-trip">Delete</button>
          </div>
        </span>
      </div>`;
  }

  async function renderTrips() {
    if (!tripsTable || !window.TokyoTourAdmin) return;
    setTripsBody(stateMessageHtml('Loading trips…'));
    try {
      tripsCache = await TokyoTourAdmin.TripsService.getAll();
      setTripsBody(tripsCache.length
        ? tripsCache.map(tripRowHtml).join('')
        : stateMessageHtml('No trips yet — add your first trip to get started.'));
    } catch (err) {
      console.error('Admin trips: failed to load trips:', err);
      setTripsBody(stateMessageHtml(friendlyMessage(err, "We couldn't load trips right now. Please try again.")));
    }
  }
  renderTrips();

  /* ---------- Add / Edit Trip modal ---------- */
  const tripModal = document.getElementById('tripModal');
  const tripForm = document.getElementById('tripForm');
  const tripFormNote = document.getElementById('tripFormNote');
  const tripModalTitle = document.getElementById('tripModalTitle');
  const tripFormSubmit = document.getElementById('tripFormSubmit');
  const addTripBtn = document.getElementById('addTripBtn');

  const tf = {
    title: document.getElementById('tf-title'),
    destination: document.getElementById('tf-destination'),
    image: document.getElementById('tf-image'),
    description: document.getElementById('tf-description'),
    start: document.getElementById('tf-start'),
    end: document.getElementById('tf-end'),
    price: document.getElementById('tf-price'),
    seats: document.getElementById('tf-seats'),
    available: document.getElementById('tf-available'),
    featured: document.getElementById('tf-featured'),
    published: document.getElementById('tf-published')
  };

  let editingTripId = null;

  function openTripModal(trip) {
    editingTripId = trip ? trip.id : null;
    tripModalTitle.textContent = trip ? 'Edit Trip' : 'Add Trip';
    tripFormSubmit.textContent = trip ? 'Save Changes' : 'Save Trip';
    tripFormNote.textContent = '';

    tf.title.value = trip ? trip.title || '' : '';
    tf.destination.value = trip ? trip.destination || '' : '';
    tf.image.value = trip ? trip.image || '' : '';
    tf.description.value = trip ? trip.description || '' : '';
    tf.start.value = trip ? (trip.start_date || '').slice(0, 10) : '';
    tf.end.value = trip ? (trip.end_date || '').slice(0, 10) : '';
    tf.price.value = trip ? trip.price ?? '' : '';
    tf.seats.value = trip ? trip.total_seats ?? '' : '';
    tf.available.value = trip ? trip.seats_available ?? '' : '';
    tf.featured.checked = trip ? !!trip.featured : false;
    tf.published.checked = trip ? !!trip.published : true;

    tripModal.classList.add('is-open');
    tripModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    tf.title.focus();
  }

  function closeTripModal() {
    tripModal.classList.remove('is-open');
    tripModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    editingTripId = null;
  }

  addTripBtn && addTripBtn.addEventListener('click', () => openTripModal(null));
  document.getElementById('tripModalClose').addEventListener('click', closeTripModal);
  document.getElementById('tripModalCancel').addEventListener('click', closeTripModal);
  document.getElementById('tripModalBackdrop').addEventListener('click', closeTripModal);

  tripForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    tripFormNote.textContent = '';
    tripFormSubmit.disabled = true;

    const payload = {
      title: tf.title.value,
      destination: tf.destination.value,
      image_url: tf.image.value,
      description: tf.description.value,
      start_date: tf.start.value,
      end_date: tf.end.value,
      price: tf.price.value,
      total_seats: tf.seats.value,
      seats_available: tf.available.value,
      featured: tf.featured.checked,
      published: tf.published.checked
    };

    try {
      if (editingTripId) {
        await TokyoTourAdmin.TripsService.update(editingTripId, payload);
      } else {
        await TokyoTourAdmin.TripsService.create(payload);
      }
      tripFormSubmit.disabled = false;
      closeTripModal();
      renderTrips();
      renderStats();
    } catch (err) {
      tripFormSubmit.disabled = false;
      console.error('Admin trips: save failed:', err);
      tripFormNote.textContent = friendlyMessage(err, "We couldn't save this trip right now. Please try again.");
      tripFormNote.style.color = '#ff7a6b';
    }
  });

  tripsTable && tripsTable.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const row = btn.closest('.dash-table__row');
    const tripId = row && row.dataset.tripId;
    const trip = tripsCache.find(t => String(t.id) === String(tripId));
    if (!trip) return;

    if (btn.dataset.action === 'edit-trip') {
      openTripModal(trip);
      return;
    }

    if (btn.dataset.action === 'toggle-publish') {
      btn.disabled = true;
      try {
        await TokyoTourAdmin.TripsService.setPublished(trip.id, !trip.published);
        await renderTrips();
        renderStats();
      } catch (err) {
        console.error('Admin trips: publish toggle failed:', err);
        alert(friendlyMessage(err, "We couldn't update this trip's status right now. Please try again."));
        btn.disabled = false;
      }
      return;
    }

    if (btn.dataset.action === 'delete-trip') {
      const confirmed = window.confirm(`Delete "${trip.title}"? This cannot be undone.`);
      if (!confirmed) return;
      btn.disabled = true;
      try {
        await TokyoTourAdmin.TripsService.remove(trip.id);
        await renderTrips();
        renderStats();
      } catch (err) {
        console.error('Admin trips: delete failed:', err);
        alert(friendlyMessage(err, "We couldn't delete this trip right now. Please try again."));
        btn.disabled = false;
      }
    }
  });

  /* =====================================================
     BOOKINGS
  ===================================================== */
  const bookingsTable = document.getElementById('bookingsTable');
  const bookingsHead = bookingsTable ? bookingsTable.querySelector('.dash-table__row--head') : null;
  const bookingSearch = document.getElementById('bookingSearch');
  const bookingStatusFilter = document.getElementById('bookingStatusFilter');
  let bookingsCache = [];

  const BOOKING_STATUS_LABEL = {
    pending: { cls: 'dash-status--pending', label: 'Pending' },
    confirmed: { cls: 'dash-status--confirmed', label: 'Confirmed' },
    completed: { cls: 'dash-status--completed', label: 'Completed' },
    cancelled: { cls: 'dash-status--cancelled', label: 'Cancelled' }
  };

  function setBookingsBody(html) {
    if (!bookingsTable) return;
    bookingsTable.querySelectorAll('.dash-table__row:not(.dash-table__row--head)').forEach(row => row.remove());
    if (bookingsHead) bookingsHead.insertAdjacentHTML('afterend', html);
    else bookingsTable.insertAdjacentHTML('beforeend', html);
  }

  function statusOptionsHtml(current) {
    return Object.keys(BOOKING_STATUS_LABEL).map(status =>
      `<option value="${status}" ${status === current ? 'selected' : ''}>${BOOKING_STATUS_LABEL[status].label}</option>`
    ).join('');
  }

  function bookingRowHtml(booking) {
    const trip = booking.trip;
    const status = BOOKING_STATUS_LABEL[booking.booking_status] || BOOKING_STATUS_LABEL.pending;
    const customerName = booking.customer && booking.customer.full_name ? escapeHtml(booking.customer.full_name) : 'Unknown customer';
    return `
      <div class="dash-table__row" data-booking-id="${escapeHtml(booking.id)}">
        <span data-label="Booking">
          ${customerName} — ${escapeHtml(trip ? trip.title : 'Tour')}
          <br><small style="color:var(--text-faint);">${trip ? escapeHtml(trip.destination) + ' · ' : ''}Ref: ${escapeHtml(booking.booking_id)}</small>
        </span>
        <span data-label="Dates">${formatDateRange(trip)}</span>
        <span data-label="Amount">${formatMoney(booking.total_price)}</span>
        <span data-label="Status"><span class="dash-status ${status.cls}">${status.label}</span></span>
        <span data-label="Update Status">
          <div class="dash-table__actions">
            <select data-action="status-select">${statusOptionsHtml(booking.booking_status)}</select>
          </div>
        </span>
      </div>`;
  }

  function matchesFilters(booking, query, statusFilter) {
    if (statusFilter && booking.booking_status !== statusFilter) return false;
    if (!query) return true;
    const trip = booking.trip;
    const haystack = [
      booking.booking_id,
      booking.customer && booking.customer.full_name,
      trip && trip.title,
      trip && trip.destination
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  }

  function renderBookingsList() {
    const query = (bookingSearch.value || '').trim().toLowerCase();
    const statusFilter = bookingStatusFilter.value;
    const filtered = bookingsCache.filter(b => matchesFilters(b, query, statusFilter));

    setBookingsBody(filtered.length
      ? filtered.map(bookingRowHtml).join('')
      : stateMessageHtml(bookingsCache.length ? 'No bookings match your search/filter.' : 'No bookings yet.'));
  }

  async function renderBookings() {
    if (!bookingsTable || !window.TokyoTourAdmin) return;
    setBookingsBody(stateMessageHtml('Loading bookings…'));
    try {
      bookingsCache = await TokyoTourAdmin.BookingsService.getAll();
      renderBookingsList();
    } catch (err) {
      console.error('Admin bookings: failed to load bookings:', err);
      setBookingsBody(stateMessageHtml(friendlyMessage(err, "We couldn't load bookings right now. Please try again.")));
    }
  }
  renderBookings();

  bookingSearch && bookingSearch.addEventListener('input', renderBookingsList);
  bookingStatusFilter && bookingStatusFilter.addEventListener('change', renderBookingsList);

  bookingsTable && bookingsTable.addEventListener('change', async (e) => {
    const select = e.target.closest('select[data-action="status-select"]');
    if (!select) return;
    const row = select.closest('.dash-table__row');
    const bookingId = row && row.dataset.bookingId;
    const newStatus = select.value;
    const booking = bookingsCache.find(b => String(b.id) === String(bookingId));
    if (!booking) return;

    const previousStatus = booking.booking_status;
    select.disabled = true;
    try {
      const updated = await TokyoTourAdmin.BookingsService.updateStatus(bookingId, newStatus);
      const idx = bookingsCache.findIndex(b => String(b.id) === String(bookingId));
      if (idx !== -1) bookingsCache[idx] = updated;
      renderBookingsList();
      renderStats();
    } catch (err) {
      console.error('Admin bookings: status update failed:', err);
      select.value = previousStatus;
      select.disabled = false;
      alert(friendlyMessage(err, "We couldn't update this booking right now. Please try again."));
    }
  });

  /* ---------- Logout ---------- */
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn && logoutBtn.addEventListener('click', async () => {
    await TokyoTourSession.logout();
    window.location.href = 'index.html';
  });

  const adminTopLogoutBtn = document.getElementById('adminTopLogoutBtn');
  adminTopLogoutBtn && adminTopLogoutBtn.addEventListener('click', async () => {
    await TokyoTourSession.logout();
    window.location.href = 'index.html';
  });

  /* =====================================================
     USERS
  ===================================================== */
  const usersTable = document.getElementById('usersTable');
  const usersHead = usersTable ? usersTable.querySelector('.dash-table__row--head') : null;
  const userSearch = document.getElementById('userSearch');
  let usersCache = [];
  const currentUserId = TokyoTourSession.getUser() && TokyoTourSession.getUser().id;

  function setUsersBody(html) {
    if (!usersTable) return;
    usersTable.querySelectorAll('.dash-table__row:not(.dash-table__row--head)').forEach(row => row.remove());
    if (usersHead) usersHead.insertAdjacentHTML('afterend', html);
    else usersTable.insertAdjacentHTML('beforeend', html);
  }

  function formatJoinedDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function userRowHtml(user, adminCount) {
    const isAdminRole = user.role === 'admin';
    const statusCls = isAdminRole ? 'dash-status--confirmed' : 'dash-status--pending';
    const statusLabel = isAdminRole ? 'Admin' : 'User';
    const isLastAdmin = isAdminRole && adminCount <= 1;
    const isSelf = String(user.id) === String(currentUserId);
    const actionLabel = isAdminRole ? 'Remove Admin' : 'Make Admin';
    const disabledAttr = isLastAdmin ? 'disabled' : '';
    const title = isLastAdmin ? 'title="This is the only remaining admin"' : '';

    return `
      <div class="dash-table__row" data-user-id="${escapeHtml(user.id)}" data-role="${escapeHtml(user.role)}">
        <span data-label="Name">${escapeHtml(user.full_name || '—')}${isSelf ? ' <small style="color:var(--text-faint);">(you)</small>' : ''}</span>
        <span data-label="Email">${escapeHtml(user.email)}</span>
        <span data-label="Role"><span class="dash-status ${statusCls}">${statusLabel}</span></span>
        <span data-label="Created">${formatJoinedDate(user.created_at)}</span>
        <span data-label="">
          <div class="dash-table__actions">
            <button class="btn btn--outline btn--sm ${isAdminRole ? 'dash-danger-btn' : ''}" data-action="toggle-role" ${disabledAttr} ${title}>${actionLabel}</button>
          </div>
        </span>
      </div>`;
  }

  function renderUsersList() {
    const query = (userSearch.value || '').trim().toLowerCase();
    const adminCount = usersCache.filter(u => u.role === 'admin').length;
    const filtered = query
      ? usersCache.filter(u => `${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(query))
      : usersCache;

    setUsersBody(filtered.length
      ? filtered.map(u => userRowHtml(u, adminCount)).join('')
      : stateMessageHtml(usersCache.length ? 'No users match your search.' : 'No registered users yet.'));
  }

  async function renderUsers() {
    if (!usersTable || !window.TokyoTourAdmin) return;
    setUsersBody(stateMessageHtml('Loading users…'));
    try {
      usersCache = await TokyoTourAdmin.UsersService.getAll();
      renderUsersList();
    } catch (err) {
      console.error('Admin users: failed to load users:', err);
      setUsersBody(stateMessageHtml(friendlyMessage(err, "We couldn't load users right now. Please try again.")));
    }
  }
  renderUsers();

  userSearch && userSearch.addEventListener('input', renderUsersList);

  usersTable && usersTable.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="toggle-role"]');
    if (!btn || btn.disabled) return;
    const row = btn.closest('.dash-table__row');
    const userId = row && row.dataset.userId;
    const user = usersCache.find(u => String(u.id) === String(userId));
    if (!user) return;

    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmMsg = nextRole === 'admin'
      ? `Make ${user.full_name || user.email} an admin? They'll get full access to this Admin Panel.`
      : `Remove admin access from ${user.full_name || user.email}?`;
    if (!window.confirm(confirmMsg)) return;

    btn.disabled = true;
    try {
      await TokyoTourAdmin.UsersService.setRole(user.id, nextRole);
      user.role = nextRole;
      renderUsersList();
      // Demoting/promoting doesn't change this admin's own session role
      // mid-visit (that would need a fresh token), so no reload is needed —
      // it only affects the target account going forward.
    } catch (err) {
      console.error('Admin users: role change failed:', err);
      alert(friendlyMessage(err, "We couldn't update this user's role right now. Please try again."));
      btn.disabled = false;
    }
  });

});
