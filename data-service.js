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
     mapped onto the exact same shape the old mock TRIPS
     array used (id, destination, title, start_date, end_date,
     duration, price, total_seats, seats_available, image) so
     calling code doesn't need to change until the UI is
     wired up in a later phase.
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
     Maps to a future `bookings` table (RLS: user_id = auth.uid()).
  ===================================================== */
  function bookingsKey(userId) { return `tt_bookings_${userId}`; }

  const BookingsService = {
    /**
     * payload: { trip_id, adults, children, seats, coupon_code, special_requests, total_price }
     * Returns a booking record shaped exactly like a future `bookings` row.
     */
    async create(payload) {
      // Backend integration point:
      //   const { data, error } = await supabase.from('bookings').insert([{
      //     user_id: user.id, trip_id: payload.trip_id, booking_status: 'pending',
      //     payment_status: 'unpaid', travelers: {...}, seats: payload.seats,
      //     coupon_code: payload.coupon_code, special_requests: payload.special_requests,
      //     total_price: payload.total_price
      //   }]).select().single();
      const user = global.TokyoTourSession.getUser();
      if (!user) return Promise.reject(new Error('Cannot create a booking without an authenticated user.'));

      const booking = {
        booking_id: 'TT-' + Math.floor(100000 + Math.random() * 900000), // Supabase: use gen_random_uuid() default
        user_id: user.id,
        trip_id: payload.trip_id,
        booking_status: 'pending',   // 'pending' | 'confirmed' | 'cancelled'
        payment_status: 'unpaid',    // 'unpaid' | 'paid' | 'refunded'
        travelers: { adults: payload.adults, children: payload.children },
        seats: payload.seats,
        coupon_code: payload.coupon_code || null,
        special_requests: payload.special_requests || '',
        total_price: payload.total_price,
        created_at: nowISO(),
        updated_at: nowISO()
      };

      const key = bookingsKey(user.id);
      const list = readJSON(key, []);
      list.push(booking);
      writeJSON(key, list);
      return Promise.resolve(booking);
    },

    async getForCurrentUser() {
      // Backend integration point:
      //   const { data } = await supabase.from('bookings').select('*, trips(*)').eq('user_id', user.id).order('created_at', { ascending:false });
      const user = global.TokyoTourSession.getUser();
      if (!user) return Promise.resolve([]);
      return Promise.resolve(readJSON(bookingsKey(user.id), []));
    }
  };

  /* =====================================================
     WISHLIST
     Maps to a future `wishlist_items` table (RLS: user_id = auth.uid()).
     Seeded with the same demo rows currently in dashboard.html so
     the panel looks identical until Supabase is connected.
  ===================================================== */
  function wishlistKey(userId) { return `tt_wishlist_${userId}`; }

  const DEFAULT_WISHLIST = [
    { id: 'wl-tokyo', name: 'Tokyo', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Shibuya,_Tokyo,_from_Above.jpg?width=500' },
    { id: 'wl-osaka', name: 'Osaka', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Osaka_Castle_01bs3200.jpg?width=500' },
    { id: 'wl-fuji', name: 'Mount Fuji', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Lake_Kawaguchiko_Sakura_Mount_Fuji_3.JPG?width=500' }
  ];
  const DEFAULT_SAVED = [
    { id: 'sv-kyoto-lanterns', name: 'Kyoto Lanterns Tour', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=600&auto=format&fit=crop' },
    { id: 'sv-sakura-tokyo', name: 'Sakura Season, Tokyo', image: 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?q=80&w=600&auto=format&fit=crop' }
  ];

  const WishlistService = {
    async getForCurrentUser(kind /* 'wishlist' | 'saved' */) {
      // Backend integration point:
      //   const { data } = await supabase.from('wishlist_items').select('*').eq('user_id', user.id).eq('kind', kind);
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
      // Backend integration point:
      //   await supabase.from('wishlist_items').delete().eq('id', itemId).eq('user_id', user.id);
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
