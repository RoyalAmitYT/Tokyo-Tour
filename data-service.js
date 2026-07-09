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
     Maps to a future `trips` table. Field names below are
     the intended Postgres column names.
  ===================================================== */
  const TRIPS = [
    { id: 'tt-2026-08-tokyo-summer', destination: 'Tokyo', title: 'Tokyo Summer Festival & Fireworks Tour', start_date: '2026-08-08', end_date: '2026-08-15', duration: '8 Days / 7 Nights', price: 1350, total_seats: 12, seats_available: 7, image: 'images/tokyo.jpg' },
    { id: 'tt-2026-09-kyoto-heritage', destination: 'Kyoto', title: 'Kyoto Heritage & Tea Ceremony Journey', start_date: '2026-09-12', end_date: '2026-09-19', duration: '8 Days / 7 Nights', price: 1480, total_seats: 10, seats_available: 2, image: 'images/kyoto.jpg' },
    { id: 'tt-2026-10-hakone-autumn', destination: 'Hakone', title: 'Nikko & Hakone Autumn Foliage Tour', start_date: '2026-10-03', end_date: '2026-10-10', duration: '8 Days / 7 Nights', price: 1590, total_seats: 12, seats_available: 9, image: 'images/Hakone.jpg' },
    { id: 'tt-2026-10-osaka-autumn', destination: 'Osaka', title: 'Osaka Food & Autumn Colors Escape', start_date: '2026-10-21', end_date: '2026-10-27', duration: '7 Days / 6 Nights', price: 1420, total_seats: 10, seats_available: 0, image: 'images/osaka_castle_grounds.jpg' },
    { id: 'tt-2026-11-kyoto-maple', destination: 'Kyoto', title: 'Kyoto Autumn Maple Leaves Tour', start_date: '2026-11-06', end_date: '2026-11-13', duration: '8 Days / 7 Nights', price: 1650, total_seats: 12, seats_available: 3, image: 'images/kyoto_lanterns.jpg' },
    { id: 'tt-2026-11-fuji-autumn', destination: 'Mount Fuji', title: 'Mount Fuji Autumn Splendor Trek', start_date: '2026-11-18', end_date: '2026-11-24', duration: '7 Days / 6 Nights', price: 1580, total_seats: 10, seats_available: 6, image: 'images/mount_fuji.jpg' },
    { id: 'tt-2026-12-tokyo-winter', destination: 'Tokyo', title: 'Tokyo Winter Illumination & Culture Tour', start_date: '2026-12-05', end_date: '2026-12-12', duration: '8 Days / 7 Nights', price: 1490, total_seats: 12, seats_available: 4, image: 'images/shibuya_crossing.jpg' },
    { id: 'tt-2027-01-tokyo-newyear', destination: 'Tokyo', title: 'Tokyo New Year Traditions Tour', start_date: '2027-01-10', end_date: '2027-01-17', duration: '8 Days / 7 Nights', price: 1550, total_seats: 12, seats_available: 1, image: 'images/tokyo.jpg' },
    { id: 'tt-2027-02-hakone-snow', destination: 'Hakone', title: 'Hakone Snow & Hot Springs Retreat', start_date: '2027-02-14', end_date: '2027-02-20', duration: '7 Days / 6 Nights', price: 1620, total_seats: 10, seats_available: 8, image: 'images/hakone_mist.jpg' },
    { id: 'tt-2027-03-kyoto-sakura-early', destination: 'Kyoto', title: 'Kyoto Early Cherry Blossom Tour', start_date: '2027-03-06', end_date: '2027-03-13', duration: '8 Days / 7 Nights', price: 1780, total_seats: 12, seats_available: 5, image: 'images/kyoto.jpg' },
    { id: 'tt-2027-03-tokyo-sakura', destination: 'Tokyo', title: 'Tokyo Sakura Bloom Experience', start_date: '2027-03-24', end_date: '2027-03-31', duration: '8 Days / 7 Nights', price: 1850, total_seats: 14, seats_available: 0, image: 'images/gion_district.jpg' },
    { id: 'tt-2027-04-fuji-sakura', destination: 'Mount Fuji', title: 'Mount Fuji & Hakone Cherry Blossom Tour', start_date: '2027-04-04', end_date: '2027-04-11', duration: '8 Days / 7 Nights', price: 1920, total_seats: 12, seats_available: 2, image: 'images/mount_fuji.jpg' },
    { id: 'tt-2027-04-osaka-kyoto-bloom', destination: 'Osaka', title: 'Osaka & Kyoto Full Bloom Grand Tour', start_date: '2027-04-16', end_date: '2027-04-25', duration: '10 Days / 9 Nights', price: 2380, total_seats: 14, seats_available: 10, image: 'images/osaka_castle.jpg' },
    { id: 'tt-2027-05-tokyo-golden-week', destination: 'Tokyo', title: 'Tokyo Golden Week Discovery Tour', start_date: '2027-05-08', end_date: '2027-05-15', duration: '8 Days / 7 Nights', price: 1500, total_seats: 12, seats_available: 6, image: 'images/tokyo.jpg' },
    { id: 'tt-2027-06-kyoto-zen', destination: 'Kyoto', title: 'Kyoto Rainy Season Zen Retreat', start_date: '2027-06-12', end_date: '2027-06-18', duration: '7 Days / 6 Nights', price: 1380, total_seats: 10, seats_available: 9, image: 'images/kyoto.jpg' },
    { id: 'tt-2027-07-osaka-summer', destination: 'Osaka', title: 'Osaka Summer Festival & Street Food Tour', start_date: '2027-07-09', end_date: '2027-07-16', duration: '8 Days / 7 Nights', price: 1460, total_seats: 12, seats_available: 3, image: 'images/Osaka.jpg' }
  ];

  const TripsService = {
    async getAll() {
      // Backend integration point:
      //   const { data, error } = await supabase.from('trips').select('*').order('start_date');
      //   return data;
      return Promise.resolve(TRIPS);
    },
    async getById(tripId) {
      // Backend integration point:
      //   const { data } = await supabase.from('trips').select('*').eq('id', tripId).single();
      //   return data;
      return Promise.resolve(TRIPS.find(t => t.id === tripId) || null);
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
