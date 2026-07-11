/* =====================================================
   TOKYO TOUR — session.js
   Centralized authentication / session layer.

   Every page (index, booking, dashboard, login, register)
   loads the Supabase CDN script, then this file, BEFORE
   its own page script. It is the single source of truth
   for "is someone logged in" and "who are they" — no
   other file should talk to supabase.auth directly.

   Backed by real Supabase Authentication (auth.users +
   a `profiles` row, created automatically by a database
   trigger on signup). Session persistence, refresh and
   the Guest/Authenticated nav state are all driven by
   Supabase's own onAuthStateChange listener.

   Session user shape returned by getUser():
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

  const SUPABASE_URL = 'https://jjbjvblienjyhsjvtrll.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_dbPwE4XYV46RAaXLKZQqzQ_fhh2C-e2';
  const PENDING_TRIP_KEY = 'tt_pending_trip_id';
  const RECOVERY_FLAG_KEY = 'tt_password_recovery';

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    console.error('TokyoTourSession: supabase-js was not found. Make sure the Supabase CDN <script> tag is included before session.js.');
  }

  // Detect a password-recovery redirect (…#type=recovery… or ?type=recovery…)
  // as early as possible, straight from the URL — don't rely solely on the
  // PASSWORD_RECOVERY auth event, whose timing relative to `ready` isn't
  // guaranteed. onAuthStateChange (registered below) will confirm/refresh
  // this once the recovery session is actually established.
  if (/type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search)) {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
  }

  const client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  /* ---------- internal cached auth state ---------- */
  let cachedUser = null;       // merged auth.users + profiles record, synchronously readable
  let cachedIsAdmin = false;   // derived from the signed-in JWT's app_metadata.role — never user-editable
  const listeners = [];        // functions to call whenever cachedUser changes

  function notify() {
    listeners.forEach(fn => {
      try { fn(cachedUser); } catch (e) { /* a bad listener shouldn't break auth */ }
    });
  }

  function mapUser(authUser, profile) {
    if (!authUser) return null;
    return {
      id: authUser.id,
      email: authUser.email,
      full_name: (profile && profile.full_name) || authUser.user_metadata?.full_name || (authUser.email ? authUser.email.split('@')[0] : ''),
      phone: (profile && profile.phone) || '',
      country: (profile && profile.country) || '',
      avatar_url: (profile && profile.avatar_url) || '',
      created_at: (profile && profile.created_at) || authUser.created_at
    };
  }

  async function fetchProfile(userId) {
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) return null;
    return data;
  }

  /** Defense-in-depth alongside the `on_auth_user_created` DB trigger — the
   *  trigger is what actually creates the row in practice; this only fills
   *  the gap if a profile is somehow still missing, and never inserts a
   *  duplicate. */
  async function ensureProfile(authUser, extra) {
    extra = extra || {};
    const existing = await fetchProfile(authUser.id);
    if (existing) return existing;
    const { data, error } = await client.from('profiles').insert({
      id: authUser.id,
      full_name: extra.full_name || authUser.user_metadata?.full_name || authUser.email.split('@')[0],
      phone: extra.phone || authUser.user_metadata?.phone || null,
      country: extra.country || authUser.user_metadata?.country || null
    }).select().maybeSingle();
    if (error) return null; // e.g. lost the race with the trigger — that's fine
    return data;
  }

  async function refreshCachedUser(authUser) {
    if (!authUser) { cachedUser = null; cachedIsAdmin = false; return null; }
    const profile = await fetchProfile(authUser.id);
    cachedUser = mapUser(authUser, profile);
    // Admin status lives in the JWT's app_metadata (set server-side only —
    // RLS's is_admin() reads this same claim), never in user-editable
    // profiles/user_metadata, so it can't be self-granted from the client.
    cachedIsAdmin = !!(authUser.app_metadata && authUser.app_metadata.role === 'admin');
    return cachedUser;
  }

  /** Turns raw Supabase Auth errors into short, friendly, non-technical copy. */
  function friendlyError(error) {
    const msg = (error && error.message) || '';
    if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
    if (/email not confirmed/i.test(msg)) return 'Please confirm your email address before signing in.';
    if (/user already registered|already registered|already exists/i.test(msg)) return 'An account with that email already exists.';
    if (/password should be at least|password.*(short|weak)/i.test(msg)) return 'Password must be at least 6 characters.';
    if (/rate limit|too many requests/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.';
    if (/network/i.test(msg)) return 'Network error. Please check your connection and try again.';
    return 'Something went wrong. Please try again.';
  }

  /* ---------- initial session bootstrap ---------- */
  const readyPromise = (async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      await refreshCachedUser(session ? session.user : null);
    } finally {
      // Strip the one-time recovery token out of the address bar once
      // supabase-js has consumed it, so it isn't left visible/bookmarkable.
      if (window.location.hash && /access_token|type=recovery/.test(window.location.hash)) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      notify();
    }
  })();

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    }
    await refreshCachedUser(session ? session.user : null);
    notify();
  });

  const Session = {

    /** Resolves once the initial session check (and profile fetch, if any)
     *  has completed. Any code that reads getUser()/isAuthenticated() on
     *  page load should `await` this first. */
    ready: readyPromise,

    /* =================================================
       CORE SESSION STATE
    ================================================= */

    /** Returns the current user object, or null if signed out.
     *  Synchronous — safe to call once `ready` has resolved, and always
     *  up to date afterwards via the Supabase auth-state listener. */
    getUser() {
      return cachedUser;
    },

    isAuthenticated() {
      return !!cachedUser;
    },

    /** True if the signed-in user's JWT carries app_metadata.role === 'admin'.
     *  This is the same claim the database's is_admin() RLS check reads, so
     *  it can never be spoofed from the client — only ever gated by what
     *  Supabase actually issued the user's token with. */
    isAdmin() {
      return cachedIsAdmin;
    },

    /** Register a callback that fires with the current user (or null)
     *  whenever auth state changes (sign in, sign out, token refresh). */
    onAuthChange(fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },

    /** True once, right after the user follows a password-reset email link
     *  and lands back on the site with a temporary recovery session. */
    isPasswordRecovery() {
      return sessionStorage.getItem(RECOVERY_FLAG_KEY) === '1';
    },
    clearPasswordRecovery() {
      sessionStorage.removeItem(RECOVERY_FLAG_KEY);
    },

    /* =================================================
       AUTH ACTIONS
       All return { user, error }.
    ================================================= */

    async login(email, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error || !data.user) return { user: null, error: friendlyError(error) };
      await refreshCachedUser(data.user);
      notify();
      return { user: cachedUser, error: null };
    },

    /** payload: { fullName, email, phone, country, password } */
    async register({ fullName, email, phone, country, password }) {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName, phone, country } }
      });
      if (error) return { user: null, error: friendlyError(error) };
      if (!data.user) return { user: null, error: 'Unable to create your account. Please try again.' };

      await ensureProfile(data.user, { full_name: fullName, phone, country });

      if (data.session) {
        // Email confirmation is OFF for this project — the account is
        // immediately usable, so sign the user straight in.
        await refreshCachedUser(data.user);
        notify();
        return { user: cachedUser, error: null };
      }

      // Email confirmation is ON — no session yet until the user verifies.
      return { user: null, error: null, needsEmailConfirmation: true };
    },

    /** Starts Google OAuth via Supabase (`signInWithOAuth`). This is a
     *  full-page redirect to Google on success — the browser leaves this
     *  page immediately, so there's no user to return here. This only
     *  resolves with an error if something stopped the redirect from even
     *  starting (Google provider not configured, network error, etc).
     *
     *  redirectTo defaults to the current page's full URL (query string
     *  included), so an existing `?redirect=...` param survives the round
     *  trip to Google and back, and the page's own "already authenticated"
     *  landing check (see auth.js) can reuse getRedirectParam()/isAdmin()
     *  to route the user on, exactly like a fresh email/password sign-in.
     *
     *  First-time Google sign-ins get a profile row exactly the way
     *  email/password sign-ups do — the same `on_auth_user_created` DB
     *  trigger fires for every new auth.users row regardless of provider,
     *  and refreshCachedUser()'s fetchProfile() call picks it up once the
     *  session lands back here. Returning Google users are matched to
     *  their existing account by email automatically (Supabase's default
     *  behavior), so no duplicate profile is ever created. */
    async loginWithGoogle(redirectTo) {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo || window.location.href }
      });
      if (error) return { error: friendlyError(error) };
      return { error: null };
    },

    async logout() {
      await client.auth.signOut();
      cachedUser = null;
      notify();
    },

    /** Persists a profile patch for the current user (Settings / Dashboard). */
    async updateProfile(patch) {
      const user = this.getUser();
      if (!user) return null;
      const { data, error } = await client
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .maybeSingle();
      if (error) return null;
      cachedUser = mapUser({ id: user.id, email: user.email, created_at: user.created_at, user_metadata: {} }, data);
      notify();
      return cachedUser;
    },

    /** Sends a Supabase password-reset email. The link brings the user back
     *  to dashboard.html with a temporary recovery session (handled above
     *  by the PASSWORD_RECOVERY auth event). */
    async resetPasswordForEmail(email) {
      const redirectTo = new URL('dashboard.html', window.location.href).href;
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) return { error: friendlyError(error) };
      return { error: null };
    },

    /** Completes a password reset while a recovery session is active. */
    async updatePassword(newPassword) {
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) return { error: friendlyError(error) };
      this.clearPasswordRecovery();
      await refreshCachedUser(data.user);
      notify();
      return { error: null };
    },

    /* =================================================
       ROUTE GUARDING
       Call at the top of any protected page (Dashboard,
       Profile, Wishlist, Settings, My Bookings) BEFORE
       rendering user data. Redirects to Login with a
       `redirect` param so the user lands back where they
       started after signing in. Async now (waits for the
       real Supabase session check) — call/await it before
       reading any protected data.
    ================================================= */
    async requireAuth(currentPage) {
      await this.ready;
      if (this.isAuthenticated()) return true;
      const target = currentPage || (location.pathname.split('/').pop() || 'index.html');
      window.location.replace('login.html?redirect=' + encodeURIComponent(target));
      return false;
    },

    /** Same as requireAuth(), plus an admin check. Guests are sent to Login
     *  (and return here afterwards); signed-in non-admins are quietly sent
     *  to their own Dashboard rather than shown an access-denied page, since
     *  the Admin Panel isn't something a regular account should ever see a
     *  trace of. */
    async requireAdmin(currentPage) {
      await this.ready;
      if (!this.isAuthenticated()) {
        const target = currentPage || (location.pathname.split('/').pop() || 'index.html');
        window.location.replace('login.html?redirect=' + encodeURIComponent(target));
        return false;
      }
      if (!this.isAdmin()) {
        window.location.replace('dashboard.html');
        return false;
      }
      return true;
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
