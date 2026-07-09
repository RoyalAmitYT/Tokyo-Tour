/* =====================================================
   TOKYO TOUR — script.js
   Frontend-only. Clean, backend-ready hooks.
===================================================== */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Header auth state (Login/Register vs Dashboard/Logout) ---------- */
  (function renderHeaderAuthState() {
    if (!window.TokyoTourSession) return; // guard in case a page loads script.js without session.js
    const loggedIn = TokyoTourSession.isAuthenticated();

    const loginLink = document.getElementById('headerLoginLink');
    const registerLink = document.getElementById('headerRegisterLink');
    const dashboardLink = document.getElementById('headerDashboardLink');
    const logoutLink = document.getElementById('headerLogoutLink');
    const mobileLoginItem = document.getElementById('mobileLoginItem');
    const mobileRegisterItem = document.getElementById('mobileRegisterItem');
    const mobileDashboardItem = document.getElementById('mobileDashboardItem');
    const mobileLogoutItem = document.getElementById('mobileLogoutItem');

    if (loginLink) loginLink.style.display = loggedIn ? 'none' : '';
    if (registerLink) registerLink.style.display = loggedIn ? 'none' : '';
    if (dashboardLink) dashboardLink.style.display = loggedIn ? '' : 'none';
    if (logoutLink) logoutLink.style.display = loggedIn ? '' : 'none';
    if (mobileLoginItem) mobileLoginItem.style.display = loggedIn ? 'none' : '';
    if (mobileRegisterItem) mobileRegisterItem.style.display = loggedIn ? 'none' : '';
    if (mobileDashboardItem) mobileDashboardItem.style.display = loggedIn ? '' : 'none';
    if (mobileLogoutItem) mobileLogoutItem.style.display = loggedIn ? '' : 'none';

    function handleLogoutClick(e) {
      e.preventDefault();
      TokyoTourSession.logout();
      window.location.href = 'index.html';
    }
    logoutLink && logoutLink.addEventListener('click', handleLogoutClick);
    const mobileLogoutLink = document.getElementById('mobileLogoutLink');
    mobileLogoutLink && mobileLogoutLink.addEventListener('click', handleLogoutClick);
  })();

  /* ---------- Loading screen ---------- */
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    setTimeout(() => loader && loader.classList.add('is-hidden'), 400);
  });
  // fallback in case 'load' already fired
  setTimeout(() => loader && loader.classList.add('is-hidden'), 2500);

  /* ---------- Header: blur on scroll + progress bar ---------- */
  const header = document.getElementById('siteHeader');
  const progress = document.getElementById('scrollProgress');
  const backToTop = document.getElementById('backToTop');

  function onScroll(){
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 40);
    backToTop && backToTop.classList.toggle('is-visible', y > 600);

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (y / docHeight) * 100 : 0;
    if (progress) progress.style.width = pct + '%';
  }
  document.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  backToTop && backToTop.addEventListener('click', () => {
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  /* ---------- Mobile nav drawer ---------- */
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');

  function closeMobileNav(){
    mobileNav && mobileNav.classList.remove('is-open');
    mobileNavBackdrop && mobileNavBackdrop.classList.remove('is-open');
    hamburgerBtn && hamburgerBtn.classList.remove('is-active');
    hamburgerBtn && hamburgerBtn.setAttribute('aria-expanded', 'false');
  }
  hamburgerBtn && hamburgerBtn.setAttribute('aria-expanded', 'false');
  hamburgerBtn && hamburgerBtn.addEventListener('click', () => {
    const opening = !mobileNav.classList.contains('is-open');
    mobileNav.classList.toggle('is-open');
    mobileNavBackdrop.classList.toggle('is-open');
    hamburgerBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) {
      const firstLink = mobileNav.querySelector('a');
      firstLink && firstLink.focus();
    }
  });
  mobileNavBackdrop && mobileNavBackdrop.addEventListener('click', closeMobileNav);
  mobileNav && mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav));

  /* ---------- Search overlay ---------- */
  const searchToggle = document.getElementById('searchToggle');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');

  searchToggle && searchToggle.setAttribute('aria-expanded', 'false');
  function closeSearchOverlay(){
    searchOverlay && searchOverlay.classList.remove('is-open');
    searchToggle && searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle && searchToggle.focus();
  }
  searchToggle && searchToggle.addEventListener('click', () => {
    searchOverlay.classList.add('is-open');
    searchToggle.setAttribute('aria-expanded', 'true');
    setTimeout(() => searchInput && searchInput.focus(), 350);
  });
  searchClose && searchClose.addEventListener('click', closeSearchOverlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchOverlay && searchOverlay.classList.contains('is-open')) closeSearchOverlay();
      closeMobileNav();
    }
  });


  /* ---------- Smooth anchor scrolling (accounts for fixed header) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = 90;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior:'smooth' });
    });
  });

  /* ---------- Scroll-reveal animations ---------- */
  const animatedEls = document.querySelectorAll('[data-animate]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold:0.15 });
  animatedEls.forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 0.08 + 's';
    io.observe(el);
  });

  /* ---------- Hero slide indicator (decorative auto-cycle) ---------- */
  const slideItems = document.querySelectorAll('.hero__slides-list li');
  if (slideItems.length){
    let current = 2; // matches "03" active in reference
    setInterval(() => {
      slideItems[current].classList.remove('is-active');
      current = (current + 1) % slideItems.length;
      slideItems[current].classList.add('is-active');
    }, 4000);
  }

  /* ---------- Watch film button (placeholder — hook up real video later) ---------- */
  const playVideoBtn = document.getElementById('playVideoBtn');
  playVideoBtn && playVideoBtn.addEventListener('click', () => {
    console.log('TODO: open film modal / lightbox video player');
  });

  /* ---------- Testimonials: auto-playing slider ---------- */
  const testiTrack = document.getElementById('testiTrack');
  const testiDotsWrap = document.getElementById('testiDots');
  const testiPrev = document.getElementById('testiPrev');
  const testiNext = document.getElementById('testiNext');

  if (testiTrack) {
    const slides = Array.from(testiTrack.children);
    let index = 0;
    let autoplayId = null;

    // build dots
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', () => goTo(i));
      testiDotsWrap.appendChild(dot);
    });
    const dots = Array.from(testiDotsWrap.children);

    function render(){
      testiTrack.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    }
    function goTo(i){
      index = (i + slides.length) % slides.length;
      render();
      restartAutoplay();
    }
    function next(){ goTo(index + 1); }
    function prev(){ goTo(index - 1); }
    function restartAutoplay(){
      clearInterval(autoplayId);
      autoplayId = setInterval(next, 6000);
    }

    testiNext && testiNext.addEventListener('click', next);
    testiPrev && testiPrev.addEventListener('click', prev);
    render();
    restartAutoplay();

    // pause autoplay while hovering the slider
    const testiEl = testiTrack.closest('.testi');
    testiEl && testiEl.addEventListener('mouseenter', () => clearInterval(autoplayId));
    testiEl && testiEl.addEventListener('mouseleave', restartAutoplay);
  }

  /* ---------- FAQ: animated accordion (single-open) ---------- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-item__q');
    btn && btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      faqItems.forEach(other => {
        other.classList.remove('is-open');
        other.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Contact form (frontend-only — backend integration point) ---------- */
  const contactForm = document.getElementById('contactForm');
  const contactFormNote = document.getElementById('contactFormNote');
  contactForm && contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Backend integration point: POST form data to your API / email service here.
    contactFormNote.textContent = 'Thanks — your message has been noted. Our team will reply within 24 hours.';
    contactForm.reset();
  });

  /* ---------- Newsletter form (frontend-only — backend integration point) ---------- */
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterNote = document.getElementById('newsletterNote');
  newsletterForm && newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Backend integration point: POST email to your newsletter provider here.
    newsletterNote.textContent = "You're on the list — welcome aboard!";
    newsletterForm.reset();
  });

  /* ---------- Footer year ---------- */
  const footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  /* =====================================================
     ---------- Booking page: Upcoming Trips + Reserve flow ----------
     Frontend-only. Trip data is structured as plain JS objects so it
     can be swapped for a Firebase Firestore collection later — just
     replace TRIPS with data fetched from Firestore and keep the same
     field names. No-ops automatically on any page without these
     elements (e.g. the homepage), so it's safe to load everywhere.
  ===================================================== */
  initBookingPage();

  function initBookingPage() {
    const tripsContainer = document.getElementById('tripsContainer');
    const bookingForm = document.getElementById('bookingForm');
    if (!tripsContainer && !bookingForm) return; // not the booking page

    /* ---- 1. Trip schedule data ----
       Loaded from TokyoTourData.TripsService (data-service.js) instead of a
       hardcoded array, so swapping in `supabase.from('trips').select()`
       later requires no changes here. TRIPS is populated asynchronously
       by loadTrips() below and every renderer reads from it. Field names
       (start_date, end_date, total_seats, seats_available) match the
       intended `trips` table columns. */
    let TRIPS = [];

    async function loadTrips() {
      TRIPS = await TokyoTourData.TripsService.getAll();
    }

    /* ---- 2. Helpers ---- */
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function parseISO(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    function formatShortDate(iso) {
      const d = parseISO(iso);
      return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
    }
    function monthLabel(iso) {
      const d = parseISO(iso);
      return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    function getStatus(trip) {
      if (trip.seats_available <= 0) return { key: 'soldout', label: 'Sold Out' };
      if (trip.seats_available <= 3) return { key: 'few', label: 'Few Seats Left' };
      return { key: 'available', label: 'Available' };
    }
    function formatMoney(n) {
      return '$' + Math.round(n).toLocaleString('en-US');
    }
    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    /* ---- 3. Render Upcoming Trips (grouped by month, alternating layout) ---- */
    let cardIndex = 0; // global counter — alternation continues across months

    function renderTrips() {
      if (!tripsContainer) return;

      const groups = [];
      const groupMap = new Map();
      TRIPS.forEach(trip => {
        const label = monthLabel(trip.start_date);
        if (!groupMap.has(label)) {
          const group = { label, trips: [] };
          groupMap.set(label, group);
          groups.push(group);
        }
        groupMap.get(label).trips.push(trip);
      });

      tripsContainer.innerHTML = groups.map(group => `
        <div class="trips-month" data-animate="fade-up">
          <h2 class="trips-month__title">${escapeHtml(group.label)}</h2>
          <div class="trips-month__list">
            ${group.trips.map(trip => renderTripCard(trip)).join('')}
          </div>
        </div>
      `).join('');

      bindReserveButtons();
      initTripScrollReveal();
    }

    function renderTripCard(trip) {
      const reverse = cardIndex % 2 === 1;
      cardIndex++;
      const status = getStatus(trip);

      const reserveButton = status.key === 'soldout'
        ? `<button type="button" class="btn btn--outline btn--sm" disabled>Sold Out</button>`
        : `<button type="button" class="btn btn--primary btn--sm trip-card__reserve" data-trip-id="${escapeHtml(trip.id)}">Reserve Your Seat</button>`;

      return `
        <article class="trip-card${reverse ? ' trip-card--reverse' : ''}" data-animate="fade-up">
          <div class="trip-card__media">
            <span class="trip-card__badge trip-card__badge--${status.key}">${status.label}</span>
            <img src="${escapeHtml(trip.image)}" alt="${escapeHtml(trip.destination)} — ${escapeHtml(trip.title)}" loading="lazy">
          </div>
          <div class="trip-card__info">
            <p class="trip-card__dest">${escapeHtml(trip.destination)}</p>
            <h3 class="trip-card__title">${escapeHtml(trip.title)}</h3>

            <div class="trip-card__meta">
              <div class="trip-card__meta-item">
                <span>Start Date</span>
                <strong>${formatShortDate(trip.start_date)}</strong>
              </div>
              <div class="trip-card__meta-item">
                <span>Return Date</span>
                <strong>${formatShortDate(trip.end_date)}</strong>
              </div>
              <div class="trip-card__meta-item">
                <span>Duration</span>
                <strong>${escapeHtml(trip.duration)}</strong>
              </div>
              <div class="trip-card__meta-item">
                <span>Available Seats</span>
                <strong>${trip.seats_available} / ${trip.total_seats}</strong>
              </div>
            </div>

            <div class="trip-card__footer">
              <div class="trip-card__price">
                ${formatMoney(trip.price)}
                <span>Starting Price / Seat</span>
              </div>
              ${reserveButton}
            </div>
          </div>
        </article>
      `;
    }

    /* ---- 4. Reserve flow — fill booking form + scroll into view ---- */
    let selectedTrip = null;

    const bkTripField = document.getElementById('bk-trip-field');
    const bkTripInput = document.getElementById('bk-trip');
    const bkTripError = document.getElementById('bk-trip-error');
    const reserveSection = document.getElementById('reserveSection');

    function bindReserveButtons() {
      document.querySelectorAll('.trip-card__reserve').forEach(btn => {
        btn.addEventListener('click', () => {
          const trip = TRIPS.find(t => t.id === btn.dataset.tripId);
          if (!trip) return;

          // Auth guard: guests cannot proceed with a reservation. Stash the
          // chosen trip, then send them to sign in — they land back here
          // with the trip auto-selected and the booking flow continuing.
          if (!TokyoTourSession.isAuthenticated()) {
            TokyoTourSession.setPendingTripSelection(trip.id);
            openAuthRequiredModal();
            return;
          }

          selectTrip(trip);
        });
      });
    }

    /* ---- 4b. Login-required modal (guest tried to reserve) ---- */
    const authModal = document.getElementById('authRequiredModal');
    const authModalBackdrop = document.getElementById('authModalBackdrop');
    const authModalClose = document.getElementById('authModalClose');
    const authModalLoginBtn = document.getElementById('authModalLoginBtn');
    const authModalRegisterBtn = document.getElementById('authModalRegisterBtn');

    function openAuthRequiredModal() {
      if (!authModal) return;
      const redirect = 'booking.html';
      if (authModalLoginBtn) authModalLoginBtn.href = 'login.html?redirect=' + encodeURIComponent(redirect);
      if (authModalRegisterBtn) authModalRegisterBtn.href = 'register.html?redirect=' + encodeURIComponent(redirect);
      authModal.classList.add('is-open');
      authModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
    }
    function closeAuthRequiredModal() {
      if (!authModal) return;
      authModal.classList.remove('is-open');
      authModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
    }
    authModalBackdrop && authModalBackdrop.addEventListener('click', closeAuthRequiredModal);
    authModalClose && authModalClose.addEventListener('click', closeAuthRequiredModal);

    function selectTrip(trip) {
      selectedTrip = trip;

      if (bkTripInput) {
        bkTripInput.value = `${trip.title} — ${trip.destination} (${formatShortDate(trip.start_date)} – ${formatShortDate(trip.end_date)})`;
      }
      bkTripField && bkTripField.classList.remove('has-error');
      if (bkTripError) bkTripError.textContent = '';

      updateSummary();

      if (reserveSection) {
        const offset = 90;
        const top = reserveSection.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }

    /* ---- 5. Trip summary + price calculation ---- */
    const summaryDestImg = document.getElementById('summaryDestImg');
    const summaryDestName = document.getElementById('summaryDestName');
    const summaryPackage = document.getElementById('summaryPackage');
    const summaryDates = document.getElementById('summaryDates');
    const summaryNights = document.getElementById('summaryNights');
    const summaryTravelers = document.getElementById('summaryTravelers');
    const summarySeats = document.getElementById('summarySeats');
    const summarySubtotal = document.getElementById('summarySubtotal');
    const summaryDiscountRow = document.getElementById('summaryDiscountRow');
    const summaryDiscount = document.getElementById('summaryDiscount');
    const summaryTotal = document.getElementById('summaryTotal');

    const adultsInput = document.getElementById('bk-adults');
    const childrenInput = document.getElementById('bk-children');
    const seatsInput = document.getElementById('bk-seats');
    const couponInput = document.getElementById('bk-coupon');
    const couponHint = document.getElementById('bk-coupon-hint');

    // Sample coupon codes — swap for a real validation service later.
    const COUPONS = { TOKYO10: 0.10, SAKURA15: 0.15, FUJI20: 0.20 };

    function getCouponDiscount() {
      const code = (couponInput && couponInput.value || '').trim().toUpperCase();
      if (!code) {
        if (couponHint) couponHint.textContent = '';
        return 0;
      }
      if (COUPONS[code] !== undefined) {
        if (couponHint) couponHint.textContent = `Coupon applied: ${Math.round(COUPONS[code] * 100)}% off`;
        return COUPONS[code];
      }
      if (couponHint) couponHint.textContent = 'Coupon code not recognized';
      return 0;
    }

    function updateSummary() {
      const adults = Math.max(parseInt(adultsInput && adultsInput.value, 10) || 0, 0);
      const children = Math.max(parseInt(childrenInput && childrenInput.value, 10) || 0, 0);
      const seats = Math.max(parseInt(seatsInput && seatsInput.value, 10) || 0, 0);

      if (summaryTravelers) {
        const parts = [];
        parts.push(`${adults} Adult${adults === 1 ? '' : 's'}`);
        if (children > 0) parts.push(`${children} Child${children === 1 ? '' : 'ren'}`);
        summaryTravelers.textContent = parts.join(', ');
      }
      if (summarySeats) summarySeats.textContent = seats;

      if (!selectedTrip) {
        if (summaryDestImg) { summaryDestImg.src = 'images/japan.jpg'; summaryDestImg.alt = 'Selected trip destination preview'; }
        if (summaryDestName) summaryDestName.textContent = 'Choose a trip';
        if (summaryPackage) summaryPackage.textContent = '—';
        if (summaryDates) summaryDates.textContent = '—';
        if (summaryNights) summaryNights.textContent = '—';
        if (summarySubtotal) summarySubtotal.textContent = '$0';
        if (summaryDiscountRow) summaryDiscountRow.style.display = 'none';
        if (summaryTotal) summaryTotal.textContent = '$0';
        return;
      }

      if (summaryDestImg) { summaryDestImg.src = selectedTrip.image; summaryDestImg.alt = selectedTrip.destination + ' — ' + selectedTrip.title; }
      if (summaryDestName) summaryDestName.textContent = selectedTrip.destination;
      if (summaryPackage) summaryPackage.textContent = selectedTrip.title;
      if (summaryDates) summaryDates.textContent = `${formatShortDate(selectedTrip.start_date)} – ${formatShortDate(selectedTrip.end_date)}`;
      if (summaryNights) summaryNights.textContent = selectedTrip.duration;

      const subtotal = selectedTrip.price * (seats || 1);
      const discountRate = getCouponDiscount();
      const discount = subtotal * discountRate;
      const total = subtotal - discount;

      if (summarySubtotal) summarySubtotal.textContent = formatMoney(subtotal);
      if (discountRate > 0) {
        if (summaryDiscountRow) summaryDiscountRow.style.display = 'flex';
        if (summaryDiscount) summaryDiscount.textContent = '-' + formatMoney(discount);
      } else if (summaryDiscountRow) {
        summaryDiscountRow.style.display = 'none';
      }
      if (summaryTotal) summaryTotal.textContent = formatMoney(total);
    }

    [adultsInput, childrenInput, seatsInput, couponInput].forEach(el => {
      el && el.addEventListener('input', updateSummary);
    });

    /* ---- 6. Form submission + confirmation modal ---- */
    const modal = document.getElementById('confirmationModal');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalClose = document.getElementById('modalClose');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    function openModal() {
      if (!modal) return;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
      modalLastFocused = document.activeElement;
      const panel = modal.querySelector('.modal__panel');
      if (panel) panel.setAttribute('tabindex', '-1');
      (modalClose || panel) && (modalClose || panel).focus();
      document.addEventListener('keydown', trapModalFocus);
    }
    function closeModal() {
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', trapModalFocus);
      if (modalLastFocused && typeof modalLastFocused.focus === 'function') modalLastFocused.focus();
    }
    let modalLastFocused = null;
    function trapModalFocus(e) {
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    modalBackdrop && modalBackdrop.addEventListener('click', closeModal);
    modalClose && modalClose.addEventListener('click', closeModal);
    modalCloseBtn && modalCloseBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closeModal();
    });

    bookingForm && bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Auth guard (defense in depth — the Reserve button already blocks
      // guests before a trip can even be selected, but a real backend
      // should never trust the client, so we check again here too).
      if (!TokyoTourSession.isAuthenticated()) {
        if (selectedTrip) TokyoTourSession.setPendingTripSelection(selectedTrip.id);
        openAuthRequiredModal();
        return;
      }

      if (!selectedTrip) {
        bkTripField && bkTripField.classList.add('has-error');
        if (bkTripError) bkTripError.textContent = 'Please choose a trip from Upcoming Trips above.';
        if (reserveSection) {
          const offset = 90;
          const top = reserveSection.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
        return;
      }

      const adults = Math.max(parseInt(adultsInput && adultsInput.value, 10) || 0, 1);
      const children = Math.max(parseInt(childrenInput && childrenInput.value, 10) || 0, 0);
      const seats = Math.max(parseInt(seatsInput && seatsInput.value, 10) || 0, 1);

      const subtotal = selectedTrip.price * seats;
      const discountRate = getCouponDiscount();
      const total = subtotal - (subtotal * discountRate);

      const requestsField = document.getElementById('bk-requests');
      const submitBtn = bookingForm.querySelector('.auth-submit');
      submitBtn && (submitBtn.disabled = true);

      // Backend integration point: this now goes through BookingsService.create()
      // (data-service.js), which is the single place that will be swapped to
      // `supabase.from('bookings').insert(...)`. The returned record already
      // maps 1:1 to the intended `bookings` table columns: booking_id, user_id,
      // trip_id, booking_status, payment_status, travelers, total_price,
      // created_at, updated_at.
      TokyoTourData.BookingsService.create({
        trip_id: selectedTrip.id,
        adults, children, seats,
        coupon_code: (couponInput && couponInput.value || '').trim().toUpperCase() || null,
        special_requests: requestsField ? requestsField.value : '',
        total_price: total
      }).then(booking => {
        submitBtn && (submitBtn.disabled = false);

        document.getElementById('modalRef').textContent = `Booking Reference: ${booking.booking_id}`;
        document.getElementById('modalDestination').textContent = selectedTrip.destination;
        document.getElementById('modalPackage').textContent = selectedTrip.title;
        document.getElementById('modalDates').textContent = `${formatShortDate(selectedTrip.start_date)} – ${formatShortDate(selectedTrip.end_date)}`;
        document.getElementById('modalTravelers').textContent = `${adults} Adult${adults === 1 ? '' : 's'}${children > 0 ? `, ${children} Child${children === 1 ? '' : 'ren'}` : ''}`;
        document.getElementById('modalSeats').textContent = seats;
        document.getElementById('modalTotal').textContent = formatMoney(booking.total_price);

        openModal();
      }).catch(() => {
        submitBtn && (submitBtn.disabled = false);
        if (bkTripError) bkTripError.textContent = 'Something went wrong creating your booking. Please try again.';
      });
    });

    /* ---- 7. Scroll-reveal for dynamically-injected trip cards ---- */
    function initTripScrollReveal() {
      const animatedEls = document.querySelectorAll('#tripsContainer [data-animate]:not(.is-in-view)');
      const tripIo = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in-view');
            tripIo.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      animatedEls.forEach((el, i) => {
        el.style.transitionDelay = (i % 4) * 0.06 + 's';
        tripIo.observe(el);
      });
    }

    /* ---- Init ---- */
    (async function init() {
      await loadTrips(); // Backend integration point: this is the future `await supabase.from('trips').select()` call
      renderTrips();
      updateSummary();

      // Resume the booking flow: if the user just signed in after clicking
      // "Reserve Your Seat" as a guest, auto-select that trip now and
      // scroll straight to the reservation form.
      if (TokyoTourSession.isAuthenticated()) {
        const pendingTripId = TokyoTourSession.consumePendingTripSelection();
        if (pendingTripId) {
          const trip = TRIPS.find(t => t.id === pendingTripId);
          if (trip) selectTrip(trip);
        }
      }
    })();
  }

});
