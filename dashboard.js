/* =====================================================
   TOKYO TOUR — dashboard.js
   User dashboard interactions. This page is protected by
   the inline auth guard at the top of dashboard.html — by
   the time this file runs, TokyoTourSession.getUser() is
   guaranteed to be non-null.

   Data is sourced from TokyoTourData (data-service.js):
   profile <- session user, bookings <- BookingsService,
   wishlist/saved <- WishlistService. Swapping any one of
   those services for real Supabase calls is the only
   change needed later — the rendering code here stays the
   same since it already works off returned records.
===================================================== */
document.addEventListener('DOMContentLoaded', () => {

  // Defense in depth: the inline guard in dashboard.html already redirects
  // guests before this script loads, but never trust a single check.
  if (!window.TokyoTourSession || !TokyoTourSession.requireAuth('dashboard.html')) return;

  const currentUser = TokyoTourSession.getUser();

  /* ---------- Tab navigation ---------- */
  const navLinks = document.querySelectorAll('.dash__nav-link');
  const panels = document.querySelectorAll('.dash__panel');
  const sidebar = document.querySelector('.dash__sidebar');

  function activateTab(tab) {
    navLinks.forEach(l => l.classList.toggle('is-active', l.dataset.tab === tab));
    panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab));
    sidebar.classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => activateTab(link.dataset.tab));
  });

  /* ---------- Mobile sidebar toggle ---------- */
  const menuToggle = document.getElementById('dashMenuToggle');
  menuToggle && menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle && menuToggle.addEventListener('click', () => {
    const opening = !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });

  /* ---------- Render profile / sidebar identity from session ---------- */
  function renderIdentity() {
    const avatarUrl = currentUser.avatar_url || 'https://randomuser.me/api/portraits/women/68.jpg';
    const name = currentUser.full_name || currentUser.email;

    const dashUserAvatar = document.getElementById('dashUserAvatar');
    const dashUserName = document.getElementById('dashUserName');
    const dashUserEmail = document.getElementById('dashUserEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileNameHeading = document.getElementById('profileNameHeading');
    const profileMemberSince = document.getElementById('profileMemberSince');
    const pfName = document.getElementById('pf-name');
    const pfEmail = document.getElementById('pf-email');
    const pfPhone = document.getElementById('pf-phone');
    const pfCountry = document.getElementById('pf-country');

    if (dashUserAvatar) dashUserAvatar.src = avatarUrl;
    if (dashUserAvatar) dashUserAvatar.alt = name;
    if (dashUserName) dashUserName.textContent = name;
    if (dashUserEmail) dashUserEmail.textContent = currentUser.email;
    if (profileAvatar) { profileAvatar.src = avatarUrl; profileAvatar.alt = name; }
    if (profileNameHeading) profileNameHeading.textContent = name;
    if (profileMemberSince && currentUser.created_at) {
      const d = new Date(currentUser.created_at);
      profileMemberSince.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (pfName) pfName.value = currentUser.full_name || '';
    if (pfEmail) pfEmail.value = currentUser.email || '';
    if (pfPhone) pfPhone.value = currentUser.phone || '';
    if (pfCountry) pfCountry.value = currentUser.country || '';
  }
  renderIdentity();

  /* ---------- Profile edit toggle + save ---------- */
  const editProfileBtn = document.getElementById('editProfileBtn');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const profileForm = document.getElementById('profileForm');
  const profileNote = document.getElementById('profileNote');
  const profileInputs = profileForm ? profileForm.querySelectorAll('input') : [];

  let editing = false;
  editProfileBtn && editProfileBtn.addEventListener('click', () => {
    editing = !editing;
    profileInputs.forEach(input => input.disabled = !editing);
    saveProfileBtn.style.display = editing ? 'inline-flex' : 'none';
    editProfileBtn.textContent = editing ? 'Cancel' : 'Edit Profile';
    profileNote.textContent = '';
    if (editing) profileInputs[0].focus();
    else renderIdentity(); // cancel: restore session values into the inputs
  });

  profileForm && profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Backend integration point: this calls TokyoTourSession.updateProfile(),
    // which is the single place that will be swapped to
    // `supabase.from('profiles').update(patch).eq('id', user.id)`.
    TokyoTourSession.updateProfile({
      full_name: document.getElementById('pf-name').value.trim(),
      phone: document.getElementById('pf-phone').value.trim(),
      country: document.getElementById('pf-country').value.trim()
    });
    profileNote.textContent = 'Profile updated.';
    profileNote.style.color = 'var(--accent-2)';
    editing = false;
    profileInputs.forEach(input => input.disabled = true);
    saveProfileBtn.style.display = 'none';
    editProfileBtn.textContent = 'Edit Profile';
    renderIdentity();
  });

  /* ---------- Upcoming bookings (from BookingsService) ---------- */
  function bookingCardHtml(booking, trip) {
    const statusMap = {
      pending: { cls: 'dash-status--pending', label: 'Payment Pending' },
      confirmed: { cls: 'dash-status--confirmed', label: 'Confirmed' },
      cancelled: { cls: 'dash-status--cancelled', label: 'Cancelled' }
    };
    const status = statusMap[booking.booking_status] || statusMap.pending;
    const actionLabel = booking.payment_status === 'paid' ? 'Manage' : 'Complete Payment';
    const actionClass = booking.payment_status === 'paid' ? 'btn--outline' : 'btn--primary';
    const dateRange = trip
      ? `${new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : '';
    const travelers = `${booking.travelers.adults} Adult${booking.travelers.adults === 1 ? '' : 's'}`;

    return `
      <article class="dash-booking" data-booking-id="${booking.booking_id}">
        <img src="${trip ? trip.image : 'images/japan.jpg'}" alt="${trip ? trip.title : 'Booked tour'}" loading="lazy">
        <div class="dash-booking__body">
          <div class="dash-booking__top">
            <h3>${trip ? trip.title : 'Tour'}</h3>
            <span class="dash-status ${status.cls}">${status.label}</span>
          </div>
          <p class="dash-booking__meta">${dateRange} · ${travelers} · ${booking.seats} Seat${booking.seats === 1 ? '' : 's'}</p>
          <p class="dash-booking__ref">Booking Reference: ${booking.booking_id}</p>
        </div>
        <div class="dash-booking__actions">
          <span class="dash-booking__price">$${Math.round(booking.total_price).toLocaleString('en-US')}</span>
          <button class="btn ${actionClass} btn--sm">${actionLabel}</button>
        </div>
      </article>`;
  }

  async function renderUpcomingBookings() {
    const list = document.getElementById('upcomingBookingsList');
    if (!list || !window.TokyoTourData) return;

    const bookings = await TokyoTourData.BookingsService.getForCurrentUser();
    if (!bookings.length) return; // keep the illustrative demo cards already in the HTML

    const withTrips = await Promise.all(bookings.map(async b => ({
      booking: b,
      trip: await TokyoTourData.TripsService.getById(b.trip_id)
    })));

    const html = withTrips.map(({ booking, trip }) => bookingCardHtml(booking, trip)).join('');
    list.insertAdjacentHTML('afterbegin', html);
  }
  renderUpcomingBookings();

  /* ---------- Wishlist / Saved Tours (from WishlistService) ---------- */
  function miniCardHtml(item, kind) {
    if (kind === 'saved') {
      return `
        <article class="dash-mini-card dash-mini-card--wide" data-id="${item.id}">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
          <button class="dash-mini-card__heart is-active" aria-label="Remove saved tour">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5h12v17l-6-3.6-6 3.6v-17Z"/></svg>
          </button>
          <div class="dash-mini-card__footer">
            <span class="dash-mini-card__name">${item.name}</span>
            <a href="booking.html" class="btn btn--outline btn--sm">Book Now</a>
          </div>
        </article>`;
    }
    return `
      <article class="dash-mini-card" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}" loading="lazy">
        <button class="dash-mini-card__heart is-active" aria-label="Remove from wishlist">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.3-9.5-8.6C.7 8 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.3 4 3.5 7.4C19 15.7 12 20 12 20Z"/></svg>
        </button>
        <span class="dash-mini-card__name">${item.name}</span>
      </article>`;
  }

  async function renderWishlistGrid(gridId, emptyId, kind) {
    const grid = document.getElementById(gridId);
    const empty = document.getElementById(emptyId);
    if (!grid || !window.TokyoTourData) return;

    const items = await TokyoTourData.WishlistService.getForCurrentUser(kind);
    grid.innerHTML = items.map(item => miniCardHtml(item, kind)).join('');
    empty.style.display = items.length ? 'none' : 'block';

    grid.querySelectorAll('.dash-mini-card__heart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.dash-mini-card');
        const itemId = card.dataset.id;
        // Backend integration point: swaps to
        // `supabase.from('wishlist_items').delete().eq('id', itemId)`.
        await TokyoTourData.WishlistService.remove(kind, itemId);
        card.style.transition = 'opacity .35s ease, transform .35s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.94)';
        setTimeout(() => {
          card.remove();
          empty.style.display = grid.querySelectorAll('.dash-mini-card').length ? 'none' : 'block';
        }, 350);
      });
    });
  }
  renderWishlistGrid('wishlistGrid', 'wishlistEmpty', 'wishlist');
  renderWishlistGrid('savedGrid', 'savedEmpty', 'saved');

  /* ---------- Settings: change password ---------- */
  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    const currentInput = document.getElementById('st-current');
    const newInput = document.getElementById('st-new');
    const confirmInput = document.getElementById('st-confirm');
    const passwordNote = document.getElementById('passwordNote');

    function setErr(fieldEl, errId, msg) {
      const errEl = document.getElementById(errId);
      if (msg) { fieldEl.closest('.form-field').classList.add('has-error'); errEl.textContent = msg; }
      else { fieldEl.closest('.form-field').classList.remove('has-error'); errEl.textContent = ''; }
    }

    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      if (!currentInput.value) { setErr(currentInput, 'st-current-error', 'Enter your current password.'); valid = false; }
      else setErr(currentInput, 'st-current-error', '');

      if (!newInput.value || newInput.value.length < 6) { setErr(newInput, 'st-new-error', 'Minimum 6 characters.'); valid = false; }
      else setErr(newInput, 'st-new-error', '');

      if (confirmInput.value !== newInput.value || !confirmInput.value) { setErr(confirmInput, 'st-confirm-error', 'Passwords do not match.'); valid = false; }
      else setErr(confirmInput, 'st-confirm-error', '');

      if (!valid) { passwordNote.textContent = ''; return; }

      // Backend integration point:
      //   await supabase.auth.updateUser({ password: newInput.value });
      passwordNote.textContent = 'Password updated.';
      passwordNote.style.color = 'var(--accent-2)';
      passwordForm.reset();
    });
  }

  /* ---------- Settings: delete account ---------- */
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  const deleteAccountNote = document.getElementById('deleteAccountNote');
  deleteAccountBtn && deleteAccountBtn.addEventListener('click', () => {
    const confirmed = window.confirm('Are you sure you want to permanently delete your account? This cannot be undone.');
    if (!confirmed) return;
    // Backend integration point:
    //   await supabase.rpc('delete_user_account'); // or an Edge Function w/ service role
    //   await supabase.auth.signOut();
    TokyoTourSession.logout();
    deleteAccountNote.textContent = 'Account deletion simulated — redirecting to homepage...';
    deleteAccountNote.style.color = 'var(--accent-2)';
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  });

  /* ---------- Logout ---------- */
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn && logoutBtn.addEventListener('click', () => {
    TokyoTourSession.logout();
    window.location.href = 'index.html';
  });

});
