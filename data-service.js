/* =====================================================
   TOKYO TOUR — data-service.js
   Data access layer. UI code (script.js, dashboard.js)
   never touches raw arrays or localStorage directly — it
   calls these services, all of which return Promises so
   the calling code doesn't change shape when a service
   body is swapped for a real Supabase call.

   Load order on every page: session.js → data-service.js →
   page script (script.js / dashboard.js).
===================================================== */
(function (global) {

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function nowISO() { return new Date().toISOString(); }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  /* =====================================================
     TRIPS
     Backed by the real `trips` table in Supabase. Rows are
     mapped onto the shape the UI expects (id, destination,
     title, start_date, end_date, duration, price,
     total_seats, seats_available, image).
  ===================================================== */
  const SUPABASE_URL = 'https://jjbjvblienjyhsjvtrll.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_dbPwE4XYV46RAaXLKZQqzQ_fhh2C-e2';

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    console.error('TokyoTourData: supabase-js was not found. Make sure the Supabase CDN <script> tag is included before data-service.js.');
  }

  // Separate client instance from session.js's own — both talk to the
  // same project, and supabase-js clients are safe to have multiple of.
  const db = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /** Maps a raw `trips` row onto the shape the UI already expects. */
  function mapTripRow(row) {
    if (!row) return null;
    const nights = typeof row.duration_days === 'number' ? row.duration_days - 1 : null;
    return {
      id: row.id,
      destination: row.destination,
      title: row.title,
      description: row.description,
      start_date: row.start_date,
      end_date: row.end_date,
      duration: row.duration_days != null ? `${row.duration_days} Days / ${nights} Nights` : null,
      duration_days: row.duration_days,
      price: row.price,
      total_seats: row.total_seats,
      seats_available: row.seats_available,
      image: row.image_url,
      featured: row.featured,
      published: row.published
    };
  }

  const TripsService = {
    async getAll() {
      const today = nowISO().slice(0, 10); // 'YYYY-MM-DD', matches Postgres `date` columns
      const { data, error } = await db
        .from('trips')
        .select('*')
        .eq('published', true)        // only published trips
        .gte('start_date', today)     // ignore expired trips (already started/passed)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('TripsService.getAll: Supabase query failed:', error);
        return Promise.reject(error);
      }
      return Promise.resolve((data || []).map(mapTripRow));
    },
    async getById(tripId) {
      const { data, error } = await db
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .maybeSingle();

      if (error) {
        console.error('TripsService.getById: Supabase query failed:', error);
        return Promise.reject(error);
      }
      return Promise.resolve(mapTripRow(data));
    }
  };

  /* =====================================================
     BOOKINGS
     Backed by the real `bookings` table (RLS: user_id =
     auth.uid(), enforced on INSERT/SELECT/UPDATE). Both
     create() and getForCurrentUser() talk to Supabase —
     Dashboard integration (Phase 5B) wired up below.
  ===================================================== */

  /** Every error thrown out of BookingsService.create()/getForCurrentUser() is one of these —
   *  safe, friendly text only. Raw Supabase/Postgres errors are logged to
   *  the console but never surfaced to the UI. */
  function bookingError(message) {
    const err = new Error(message);
    err.isFriendlyBookingError = true;
    return err;
  }

  const BookingsService = {
    /**
     * payload: { trip_id, adults, children, seats, coupon_code, special_requests, total_price }
     * Returns a booking record shaped like the future `bookings` row, plus a
     * `booking_id` field the UI can show as the confirmation reference.
     */
    async create(payload) {
      if (!payload || !payload.trip_id) {
        return Promise.reject(bookingError('Please choose a trip before booking.'));
      }

      const adults = Math.max(parseInt(payload.adults, 10) || 0, 1);
      const children = Math.max(parseInt(payload.children, 10) || 0, 0);
      const seats = Math.max(parseInt(payload.seats, 10) || (adults + children), 1);

      // The client performing the insert must actually be signed in — this is
      // what auth.uid() resolves to for the RLS check, so it's the source of
      // truth for user_id (not just the locally-cached TokyoTourSession user).
      let authUser = null;
      try {
        const { data: sessionData, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        authUser = sessionData && sessionData.session && sessionData.session.user;
      } catch (err) {
        console.error('BookingsService.create: session lookup failed:', err);
      }
      if (!authUser) {
        return Promise.reject(bookingError('You need to be signed in to make a booking.'));
      }

      // Re-check live seat availability right before booking — the trip list
      // the user picked from may be stale by the time they submit.
      const { data: tripRow, error: tripError } = await db
        .from('trips')
        .select('id, price, seats_available, published')
        .eq('id', payload.trip_id)
        .maybeSingle();

      if (tripError) {
        console.error('BookingsService.create: trip lookup failed:', tripError);
        return Promise.reject(bookingError("We couldn't verify this trip right now. Please try again."));
      }
      if (!tripRow || !tripRow.published) {
        return Promise.reject(bookingError('This trip is no longer available.'));
      }
      if (seats > tripRow.seats_available) {
        const remaining = tripRow.seats_available;
        return Promise.reject(bookingError(
          remaining > 0
            ? `Only ${remaining} seat${remaining === 1 ? '' : 's'} left on this trip — please lower your seat count.`
            : 'Sorry, this trip is fully booked.'
        ));
      }

      const subtotal = typeof payload.subtotal === 'number' ? payload.subtotal : (tripRow.price * seats);
      const discount = typeof payload.discount === 'number' ? payload.discount : Math.max(subtotal - (payload.total_price != null ? payload.total_price : subtotal), 0);
      const totalPrice = payload.total_price != null ? payload.total_price : (subtotal - discount);

      const { data, error } = await db
        .from('bookings')
        .insert([{
          user_id: authUser.id,
          trip_id: payload.trip_id,
          booking_status: 'pending',   // 'pending' | 'confirmed' | 'cancelled' | 'completed'
          payment_status: 'unpaid',    // 'unpaid' | 'paid' | 'refunded' | 'failed'
          adults,
          children,
          coupon_code: payload.coupon_code || null,
          special_requests: payload.special_requests || '',
          subtotal,
          discount,
          total_price: totalPrice
        }])
        .select()
        .single();

      if (error) {
        console.error('BookingsService.create: Supabase insert failed:', error);
        // RLS violations surface as a generic Postgres error code — treat any
        // insert failure the same way rather than leaking DB-specific detail.
        return Promise.reject(bookingError("We couldn't complete your booking right now. Please try again."));
      }

      return Promise.resolve(mapBookingRow(data));
    },

    /**
     * Returns every booking belonging to the signed-in user, most recent
     * first, with its related trip embedded as `.trip` (already mapped to
     * the same shape TripsService returns). RLS restricts the underlying
     * query to `user_id = auth.uid()` regardless, but the explicit filter
     * below is kept too so the query's intent is obvious from the code.
     */
    async getForCurrentUser() {
      const user = global.TokyoTourSession.getUser();
      if (!user) return Promise.resolve([]);

      const { data, error } = await db
        .from('bookings')
        .select('*, trips(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('BookingsService.getForCurrentUser: Supabase query failed:', error);
        return Promise.reject(bookingError("We couldn't load your bookings right now. Please try again."));
      }

      return Promise.resolve((data || []).map(row => {
        const booking = mapBookingRow(row);
        booking.trip = mapTripRow(row.trips);
        return booking;
      }));
    }
  };

  /** Maps a raw `bookings` row onto the shape the UI expects, adding a
   *  short, human-friendly `booking_id` reference derived from the real
   *  (uuid) primary key returned by Supabase — never a mock/random value. */
  function mapBookingRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      booking_id: 'TT-' + String(row.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
      user_id: row.user_id,
      trip_id: row.trip_id,
      booking_status: row.booking_status,
      payment_status: row.payment_status,
      travelers: { adults: row.adults, children: row.children },
      seats: row.seat_quantity,
      coupon_code: row.coupon_code,
      special_requests: row.special_requests,
      subtotal: row.subtotal,
      discount: row.discount,
      total_price: row.total_price,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /* =====================================================
     WISHLIST
     Not yet backed by a database table — persisted to
     localStorage per user, seeded with the same demo rows
     originally shown in dashboard.html. A future
     `wishlist_items` table (RLS: user_id = auth.uid()) can
     replace the storage calls below without changing the
     service's public shape.
  ===================================================== */
  function wishlistKey(userId) { return `tt_wishlist_${userId}`; }

  const DEFAULT_WISHLIST = [
    { id: 'wl-tokyo', name: 'Tokyo', image: 'images/tokyo.jpg' },
    { id: 'wl-osaka', name: 'Osaka', image: 'images/Osaka.jpg' },
    { id: 'wl-fuji', name: 'Mount Fuji', image: 'images/mount_fuji.jpg' }
  ];
  const DEFAULT_SAVED = [
    { id: 'sv-kyoto-lanterns', name: 'Kyoto Lanterns Tour', image: 'images/kyoto_lanterns.jpg' },
    { id: 'sv-sakura-tokyo', name: 'Sakura Season, Tokyo', image: 'images/tokyo.jpg' }
  ];

  const WishlistService = {
    async getForCurrentUser(kind /* 'wishlist' | 'saved' */) {
      const user = global.TokyoTourSession.getUser();
      if (!user) return Promise.resolve([]);
      const key = `${wishlistKey(user.id)}_${kind}`;
      const seeded = readJSON(key, null);
      if (seeded === null) {
        const defaults = kind === 'saved' ? DEFAULT_SAVED : DEFAULT_WISHLIST;
        writeJSON(key, defaults);
        return Promise.resolve(defaults);
      }
      return Promise.resolve(seeded);
    },
    async remove(kind, itemId) {
      const user = global.TokyoTourSession.getUser();
      if (!user) return Promise.resolve();
      const key = `${wishlistKey(user.id)}_${kind}`;
      const list = readJSON(key, []).filter(i => i.id !== itemId);
      writeJSON(key, list);
      return Promise.resolve();
    }
  };

  global.TokyoTourData = { TripsService, BookingsService, WishlistService };

})(window);
