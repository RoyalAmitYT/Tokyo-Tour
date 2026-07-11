/* =====================================================
   TOKYO TOUR — admin-service.js
   Admin-only data access layer. Deliberately separate from
   data-service.js (never imported by it, never imports it)
   so the public site's TripsService/BookingsService/
   WishlistService are untouched by anything in here — this
   file is only ever loaded on admin.html.

   Every write here relies on the database's own admin RLS
   policies (…_admin_all / trips_admin_insert / etc., all
   gated on is_admin(), which reads the signed-in JWT's
   app_metadata.role). If a non-admin's client somehow calls
   these functions, Supabase itself rejects the query — this
   file adds friendly error handling on top, not the actual
   security boundary.

   Load order on admin.html: session.js → admin-service.js →
   admin.js.
===================================================== */
(function (global) {

  const SUPABASE_URL = 'https://jjbjvblienjyhsjvtrll.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_dbPwE4XYV46RAaXLKZQqzQ_fhh2C-e2';

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    console.error('TokyoTourAdmin: supabase-js was not found. Make sure the Supabase CDN <script> tag is included before admin-service.js.');
  }

  // Own client instance, same pattern as session.js / data-service.js —
  // supabase-js clients are safe to have multiple of against one project.
  const db = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /** Every error thrown out of this file is one of these — safe, friendly
   *  text only. Raw Supabase/Postgres errors are logged to the console but
   *  never surfaced to the UI. */
  function adminError(message) {
    const err = new Error(message);
    err.isFriendlyAdminError = true;
    return err;
  }

  /** Maps a raw `trips` row onto the same shape TripsService (data-service.js)
   *  uses on the public site, kept independently here so this file never
   *  needs to import data-service.js. */
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

  /* =====================================================
     TRIPS (admin) — full CRUD + publish toggle. Relies on
     trips_admin_select_all / trips_admin_insert /
     trips_admin_update / trips_admin_delete RLS policies.
  ===================================================== */
  const AdminTripsService = {
    /** Returns every trip (published or not), newest start date first. */
    async getAll() {
      const { data, error } = await db
        .from('trips')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('AdminTripsService.getAll: Supabase query failed:', error);
        return Promise.reject(adminError("We couldn't load trips right now. Please try again."));
      }
      return (data || []).map(mapTripRow);
    },

    /** payload: { title, destination, description, image_url, start_date,
     *  end_date, price, total_seats, seats_available, featured, published } */
    async create(payload) {
      const row = validateTripPayload(payload);
      const { data, error } = await db.from('trips').insert([row]).select().single();

      if (error) {
        console.error('AdminTripsService.create: Supabase insert failed:', error);
        return Promise.reject(adminError("We couldn't create this trip right now. Please check the details and try again."));
      }
      return mapTripRow(data);
    },

    async update(tripId, payload) {
      if (!tripId) return Promise.reject(adminError('Missing trip to update.'));
      const row = validateTripPayload(payload);
      const { data, error } = await db.from('trips').update(row).eq('id', tripId).select().maybeSingle();

      if (error) {
        console.error('AdminTripsService.update: Supabase update failed:', error);
        return Promise.reject(adminError("We couldn't save these changes right now. Please try again."));
      }
      if (!data) return Promise.reject(adminError('This trip no longer exists.'));
      return mapTripRow(data);
    },

    /** Convenience wrapper around update() for the Publish/Unpublish toggle. */
    async setPublished(tripId, published) {
      const { data, error } = await db.from('trips').update({ published: !!published }).eq('id', tripId).select().maybeSingle();
      if (error) {
        console.error('AdminTripsService.setPublished: Supabase update failed:', error);
        return Promise.reject(adminError("We couldn't update this trip's status right now. Please try again."));
      }
      return mapTripRow(data);
    },

    async remove(tripId) {
      if (!tripId) return Promise.reject(adminError('Missing trip to delete.'));
      const { error } = await db.from('trips').delete().eq('id', tripId);

      if (error) {
        console.error('AdminTripsService.remove: Supabase delete failed:', error);
        // Postgres 23503 = foreign key violation — this trip still has
        // bookings pointing at it (ON DELETE RESTRICT), which is expected
        // and should never leak as a raw DB error.
        if (error.code === '23503') {
          return Promise.reject(adminError('This trip has existing bookings and can\u2019t be deleted — unpublish it instead to hide it from customers.'));
        }
        return Promise.reject(adminError("We couldn't delete this trip right now. Please try again."));
      }
    }
  };

  function validateTripPayload(payload) {
    payload = payload || {};
    const title = (payload.title || '').trim();
    const destination = (payload.destination || '').trim();
    const startDate = payload.start_date;
    const endDate = payload.end_date;
    const price = Number(payload.price);
    const totalSeats = parseInt(payload.total_seats, 10);
    const seatsAvailable = payload.seats_available === '' || payload.seats_available == null
      ? totalSeats
      : parseInt(payload.seats_available, 10);

    if (!title) throw adminError('Please enter a trip title.');
    if (!destination) throw adminError('Please enter a destination.');
    if (!startDate || !endDate) throw adminError('Please choose a start and end date.');
    if (new Date(endDate) < new Date(startDate)) throw adminError('End date must be on or after the start date.');
    if (!Number.isFinite(price) || price < 0) throw adminError('Please enter a valid price.');
    if (!Number.isInteger(totalSeats) || totalSeats <= 0) throw adminError('Please enter a valid number of total seats.');
    if (!Number.isInteger(seatsAvailable) || seatsAvailable < 0) throw adminError('Please enter a valid number of available seats.');
    if (seatsAvailable > totalSeats) throw adminError('Seats available can\u2019t be more than total seats.');

    return {
      title,
      destination,
      description: (payload.description || '').trim() || null,
      image_url: (payload.image_url || '').trim() || null,
      start_date: startDate,
      end_date: endDate,
      price,
      total_seats: totalSeats,
      seats_available: seatsAvailable,
      featured: !!payload.featured,
      published: !!payload.published
    };
  }

  /* =====================================================
     BOOKINGS (admin) — read every booking (any user), with
     the related trip + customer profile embedded, and
     update booking_status. Relies on bookings_admin_all /
     profiles_admin_all RLS policies.
  ===================================================== */
  function mapAdminBookingRow(row) {
    return {
      id: row.id,
      booking_id: 'TT-' + String(row.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
      user_id: row.user_id,
      trip_id: row.trip_id,
      booking_status: row.booking_status,
      payment_status: row.payment_status,
      travelers: { adults: row.adults, children: row.children },
      seats: row.seat_quantity,
      subtotal: row.subtotal,
      discount: row.discount,
      total_price: row.total_price,
      created_at: row.created_at,
      updated_at: row.updated_at,
      trip: mapTripRow(row.trips),
      customer: row.profiles ? { full_name: row.profiles.full_name, phone: row.profiles.phone, country: row.profiles.country } : null
    };
  }

  const VALID_BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

  const AdminBookingsService = {
    /** Returns every booking on the platform, newest first, with trip and
     *  customer profile embedded. Search/filter happens client-side in
     *  admin.js against this list. */
    async getAll() {
      const { data, error } = await db
        .from('bookings')
        .select('*, trips(*), profiles(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('AdminBookingsService.getAll: Supabase query failed:', error);
        return Promise.reject(adminError("We couldn't load bookings right now. Please try again."));
      }
      return (data || []).map(mapAdminBookingRow);
    },

    async updateStatus(bookingId, bookingStatus) {
      if (!bookingId) return Promise.reject(adminError('Missing booking to update.'));
      if (!VALID_BOOKING_STATUSES.includes(bookingStatus)) {
        return Promise.reject(adminError('That is not a valid booking status.'));
      }
      const { data, error } = await db
        .from('bookings')
        .update({ booking_status: bookingStatus })
        .eq('id', bookingId)
        .select('*, trips(*), profiles(*)')
        .maybeSingle();

      if (error) {
        console.error('AdminBookingsService.updateStatus: Supabase update failed:', error);
        return Promise.reject(adminError("We couldn't update this booking right now. Please try again."));
      }
      if (!data) return Promise.reject(adminError('This booking no longer exists.'));
      return mapAdminBookingRow(data);
    }
  };

  /* =====================================================
     STATS — simple platform-wide counts for the Admin
     Dashboard panel. Uses count-only ({ head: true }) queries
     so no row data is transferred, just totals.
  ===================================================== */
  const AdminStatsService = {
    async getStats() {
      const [usersRes, tripsRes, publishedRes, bookingsRes] = await Promise.all([
        db.from('profiles').select('id', { count: 'exact', head: true }),
        db.from('trips').select('id', { count: 'exact', head: true }),
        db.from('trips').select('id', { count: 'exact', head: true }).eq('published', true),
        db.from('bookings').select('id', { count: 'exact', head: true })
      ]);

      const failed = [usersRes, tripsRes, publishedRes, bookingsRes].find(r => r.error);
      if (failed) {
        console.error('AdminStatsService.getStats: Supabase query failed:', failed.error);
        return Promise.reject(adminError("We couldn't load platform statistics right now. Please try again."));
      }

      return {
        totalUsers: usersRes.count || 0,
        totalTrips: tripsRes.count || 0,
        publishedTrips: publishedRes.count || 0,
        totalBookings: bookingsRes.count || 0
      };
    }
  };

  /* =====================================================
     USERS — read-only listing via the admin_list_users() RPC
     (auth.users/email isn't exposed to PostgREST directly) and
     role changes via admin_set_user_role(). Both re-check
     is_admin() server-side independently of this file, and
     admin_set_user_role() independently enforces "never remove
     the last remaining admin" — the client-side check in
     admin.js is just a defense-in-depth UX nicety, not the
     actual guarantee.
  ===================================================== */
  const AdminUsersService = {
    async getAll() {
      const { data, error } = await db.rpc('admin_list_users');
      if (error) {
        console.error('AdminUsersService.getAll: Supabase RPC failed:', error);
        return Promise.reject(adminError("We couldn't load users right now. Please try again."));
      }
      return (data || []).map(row => ({
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        role: row.role || 'user',
        created_at: row.created_at
      }));
    },

    /** role: 'admin' | 'user' */
    async setRole(userId, role) {
      if (!userId) return Promise.reject(adminError('Missing user.'));
      const { error } = await db.rpc('admin_set_user_role', { target_user_id: userId, new_role: role });
      if (error) {
        console.error('AdminUsersService.setRole: Supabase RPC failed:', error);
        // This one specific rejection reason is safe (and useful) to show
        // verbatim — everything else stays generic so no DB detail leaks.
        if (/last remaining admin/i.test(error.message || '')) {
          return Promise.reject(adminError('Cannot remove the last remaining admin.'));
        }
        return Promise.reject(adminError("We couldn't update this user's role right now. Please try again."));
      }
    }
  };

  global.TokyoTourAdmin = {
    TripsService: AdminTripsService,
    BookingsService: AdminBookingsService,
    StatsService: AdminStatsService,
    UsersService: AdminUsersService
  };

})(window);
