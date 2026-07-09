/* =====================================================
   TOKYO TOUR — session.js
   Centralized authentication / session layer.

   Every page (index, booking, dashboard, login, register)
   loads this file BEFORE its own script. It is the single
   source of truth for "is someone logged in" and "who are
   they" — no other file should read/write auth state
   directly.

   Currently backed by localStorage as a realistic mock so
   the full auth flow (guard → login → return-to-booking)
   can be demoed with no backend. Every function that will
   change when Supabase is connected is marked with a
   "Backend integration point" comment showing the exact
   Supabase call to drop in — the calling code below it
   does not need to change shape (still returns
   { user, error } / boolean / etc).

   Expected session user shape (maps 1:1 to a future
   Supabase `auth.users` row + a `profiles` table row):
   {
     id:          string (uuid)   -> auth.users.id
     email:       string
     full_name:   string          -> profiles.full_name
     phone:       string          -> profiles.phone
     country:     string          -> profiles.country
     avatar_url:  string          -> profiles.avatar_url
     created_at:  ISO string
   }
===================================================== */
(function (global) {

  const SESSION_KEY   = 'tt_session';        // Supabase: managed internally by supabase-js
  const USERS_KEY      = 'tt_mock_users';      // mock "auth.users" table — delete once Supabase Auth is wired
  const PENDING_TRIP_KEY = 'tt_pending_trip_id';

  /* ---------- tiny helpers ---------- */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function nowISO() { return new Date().toISOString(); }
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  const Session = {

    /* =================================================
       CORE SESSION STATE
    ================================================= */

    /** Returns the current user object, or null if signed out. */
    getUser() {
      // Backend integration point:
      //   const { data: { user } } = await supabase.auth.getUser();
      //   return user;
      try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
      catch (e) { return null; }
    },

    isAuthenticated() {
      return !!this.getUser();
    },

    /* =================================================
       AUTH ACTIONS
       (mock, but return the same { user, error } shape
       supabase-js's auth methods do)
    ================================================= */

    async login(email, password) {
      // Backend integration point:
      //   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      //   if (error) return { user: null, error: error.message };
      //   return { user: data.user, error: null };
      const users = readUsers();
      let user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) {
        // Demo-only convenience so the flow is testable without a real backend.
        // Remove this auto-create once Supabase Auth handles real credential checks.
        user = {
          id: uuid(),
          email: email.trim(),
          full_name: email.split('@')[0],
          phone: '',
          country: '',
          avatar_url: '',
          created_at: nowISO()
        };
        users.push(user);
        writeUsers(users);
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { user, error: null };
    },

    async register({ fullName, email, phone, country, password }) {
      // Backend integration point:
      //   const { data, error } = await supabase.auth.signUp({
      //     email, password,
      //     options: { data: { full_name: fullName, phone, country } }
      //   });
      //   if (error) return { user: null, error: error.message };
      //   // A `profiles` row is typically created via a DB trigger on auth.users insert.
      //   return { user: data.user, error: null };
      const users = readUsers();
      if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
        return { user: null, error: 'An account with that email already exists.' };
      }
      const user = {
        id: uuid(),
        email: email.trim(),
        full_name: fullName,
        phone,
        country,
        avatar_url: '',
        created_at: nowISO()
      };
      users.push(user);
      writeUsers(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { user, error: null };
    },

    logout() {
      // Backend integration point:
      //   await supabase.auth.signOut();
      localStorage.removeItem(SESSION_KEY);
    },

    /** Persists a profile patch for the current user (Settings / Dashboard). */
    updateProfile(patch) {
      // Backend integration point:
      //   const { data, error } = await supabase
      //     .from('profiles').update(patch).eq('id', user.id).select().single();
      const user = this.getUser();
      if (!user) return null;
      const updated = { ...user, ...patch };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      const users = readUsers().map(u => (u.id === user.id ? updated : u));
      writeUsers(users);
      return updated;
    },

    /* =================================================
       ROUTE GUARDING
       Call at the top of any protected page (Dashboard,
       Profile, Wishlist, Settings, My Bookings) BEFORE
       rendering user data. Redirects to Login with a
       `redirect` param so the user lands back where they
       started after signing in.
    ================================================= */
    requireAuth(currentPage) {
      if (this.isAuthenticated()) return true;
      const target = currentPage || (location.pathname.split('/').pop() || 'index.html');
      window.location.replace('login.html?redirect=' + encodeURIComponent(target));
      return false;
    },

    /** Reads the `?redirect=` query param set by requireAuth() / the booking-guard flow. */
    getRedirectParam() {
      const params = new URLSearchParams(window.location.search);
      return params.get('redirect') || null;
    },

    /* =================================================
       POST-LOGIN "RETURN TO BOOKING" FLOW
       Used when a guest clicks "Reserve Your Seat": the
       trip id is stashed here, the user is sent to Login,
       and booking.html reads it back after auth succeeds
       to auto-select the trip and continue.
    ================================================= */
    setPendingTripSelection(tripId) {
      sessionStorage.setItem(PENDING_TRIP_KEY, tripId);
    },
    consumePendingTripSelection() {
      const id = sessionStorage.getItem(PENDING_TRIP_KEY);
      sessionStorage.removeItem(PENDING_TRIP_KEY);
      return id;
    }
  };

  global.TokyoTourSession = Session;

})(window);
