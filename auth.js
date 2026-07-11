/* =====================================================
   TOKYO TOUR — auth.js
   Client-side form validation for Login / Register.
   Auth actions themselves (login, register, Google OAuth,
   password reset) are delegated to TokyoTourSession
   (session.js), which is backed by real Supabase Auth.
===================================================== */
document.addEventListener('DOMContentLoaded', () => {

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (!field || !error) return;
    if (message) {
      field.classList.add('has-error');
      error.textContent = message;
    } else {
      field.classList.remove('has-error');
      error.textContent = '';
    }
  }

  /* ---------- Password visibility toggles (shared) ---------- */
  document.querySelectorAll('.auth-toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isHidden = target.type === 'password';
      target.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      btn.classList.toggle('is-active', isHidden);
    });
  });

  /* ================= LOGIN PAGE ================= */
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const emailInput = document.getElementById('li-email');
    const passwordInput = document.getElementById('li-password');
    const loginNote = document.getElementById('loginNote');

    // If the auth guard sent the user here (e.g. from "Reserve Your Seat" or
    // a protected dashboard page), reflect that in the existing subtitle text
    // — no layout/markup change, just the copy.
    const loginRedirectTarget = window.TokyoTourSession && TokyoTourSession.getRedirectParam();
    if (loginRedirectTarget) {
      const subtitle = document.querySelector('.auth__subtitle');
      if (subtitle) subtitle.textContent = 'Sign in to continue where you left off.';
    }

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      if (!emailInput.value.trim()) {
        setError('li-email-field', 'li-email-error', 'Email address is required.');
        valid = false;
      } else if (!EMAIL_RE.test(emailInput.value.trim())) {
        setError('li-email-field', 'li-email-error', 'Enter a valid email address.');
        valid = false;
      } else {
        setError('li-email-field', 'li-email-error', '');
      }

      if (!passwordInput.value) {
        setError('li-password-field', 'li-password-error', 'Password is required.');
        valid = false;
      } else if (passwordInput.value.length < 6) {
        setError('li-password-field', 'li-password-error', 'Password must be at least 6 characters.');
        valid = false;
      } else {
        setError('li-password-field', 'li-password-error', '');
      }

      if (!valid) {
        loginNote.textContent = '';
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      TokyoTourSession.login(emailInput.value.trim(), passwordInput.value).then(({ user, error }) => {
        submitBtn.disabled = false;
        if (error || !user) {
          loginNote.textContent = error || 'Unable to sign in. Please try again.';
          loginNote.style.color = '#ff7a6b';
          return;
        }
        // Return the user to wherever they were headed before the auth guard
        // intercepted them (e.g. back to booking.html to finish a reservation).
        // Absent that, admins land on the Admin Panel and everyone else on
        // their Dashboard — isAdmin() reflects the JWT claim refreshed by
        // the login() call just above, so it's accurate here.
        const redirectTarget = TokyoTourSession.getRedirectParam()
          || (TokyoTourSession.isAdmin() ? 'admin.html' : 'dashboard.html');
        loginNote.textContent = 'Signed in! Redirecting...';
        loginNote.style.color = 'var(--accent-2)';
        setTimeout(() => { window.location.href = redirectTarget; }, 700);
      });
    });

    // clear individual errors as the user types
    emailInput.addEventListener('input', () => setError('li-email-field', 'li-email-error', ''));
    passwordInput.addEventListener('input', () => setError('li-password-field', 'li-password-error', ''));

    /* ---------- Forgot password ---------- */
    const forgotToggle = document.getElementById('forgotPasswordToggle');
    const forgotPanel = document.getElementById('forgotPasswordPanel');
    const forgotSend = document.getElementById('forgotPasswordSend');
    const forgotNote = document.getElementById('forgotPasswordNote');
    const forgotEmail = document.getElementById('fp-email');

    forgotToggle && forgotToggle.addEventListener('click', () => {
      forgotPanel.classList.toggle('is-open');
      if (forgotPanel.classList.contains('is-open')) forgotEmail.focus();
    });
    forgotSend && forgotSend.addEventListener('click', () => {
      if (!forgotEmail.value.trim() || !EMAIL_RE.test(forgotEmail.value.trim())) {
        forgotNote.textContent = 'Enter a valid email address first.';
        forgotNote.style.color = '#ff7a6b';
        return;
      }
      forgotSend.disabled = true;
      TokyoTourSession.resetPasswordForEmail(forgotEmail.value.trim()).then(() => {
        // Always show the same neutral message, whether or not the address
        // has an account — this avoids leaking which emails are registered.
        forgotSend.disabled = false;
        forgotNote.textContent = 'If an account exists for that email, a reset link has been sent.';
        forgotNote.style.color = 'var(--accent-2)';
        forgotEmail.value = '';
      });
    });

    /* ---------- Google login ---------- */
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    googleLoginBtn && googleLoginBtn.addEventListener('click', async () => {
      googleLoginBtn.disabled = true;
      loginNote.textContent = 'Redirecting to Google…';
      loginNote.style.color = 'var(--text-dim)';
      const { error } = await TokyoTourSession.loginWithGoogle();
      if (error) {
        // Only reached if the redirect itself couldn't start — on success
        // the browser has already navigated away to Google.
        googleLoginBtn.disabled = false;
        loginNote.textContent = error;
        loginNote.style.color = '#ff7a6b';
      }
    });
  }

  /* ================= REGISTER PAGE ================= */
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    const nameInput = document.getElementById('rg-name');
    const emailInput = document.getElementById('rg-email');
    const phoneInput = document.getElementById('rg-phone');
    const countrySelect = document.getElementById('rg-country');
    const passwordInput = document.getElementById('rg-password');
    const confirmInput = document.getElementById('rg-confirm');
    const termsInput = document.getElementById('rg-terms');
    const registerNote = document.getElementById('registerNote');

    const PHONE_RE = /^[0-9+()\-.\s]{7,}$/;

    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      if (!nameInput.value.trim()) {
        setError('rg-name-field', 'rg-name-error', 'Full name is required.');
        valid = false;
      } else {
        setError('rg-name-field', 'rg-name-error', '');
      }

      if (!emailInput.value.trim()) {
        setError('rg-email-field', 'rg-email-error', 'Email address is required.');
        valid = false;
      } else if (!EMAIL_RE.test(emailInput.value.trim())) {
        setError('rg-email-field', 'rg-email-error', 'Enter a valid email address.');
        valid = false;
      } else {
        setError('rg-email-field', 'rg-email-error', '');
      }

      if (!phoneInput.value.trim()) {
        setError('rg-phone-field', 'rg-phone-error', 'Phone number is required.');
        valid = false;
      } else if (!PHONE_RE.test(phoneInput.value.trim())) {
        setError('rg-phone-field', 'rg-phone-error', 'Enter a valid phone number.');
        valid = false;
      } else {
        setError('rg-phone-field', 'rg-phone-error', '');
      }

      if (!countrySelect.value) {
        setError('rg-country-field', 'rg-country-error', 'Please select your country.');
        valid = false;
      } else {
        setError('rg-country-field', 'rg-country-error', '');
      }

      if (!passwordInput.value) {
        setError('rg-password-field', 'rg-password-error', 'Password is required.');
        valid = false;
      } else if (passwordInput.value.length < 6) {
        setError('rg-password-field', 'rg-password-error', 'Password must be at least 6 characters.');
        valid = false;
      } else {
        setError('rg-password-field', 'rg-password-error', '');
      }

      if (!confirmInput.value) {
        setError('rg-confirm-field', 'rg-confirm-error', 'Please confirm your password.');
        valid = false;
      } else if (confirmInput.value !== passwordInput.value) {
        setError('rg-confirm-field', 'rg-confirm-error', 'Passwords do not match.');
        valid = false;
      } else {
        setError('rg-confirm-field', 'rg-confirm-error', '');
      }

      if (!termsInput.checked) {
        setError('rg-terms-field', 'rg-terms-error', 'You must agree to the Terms & Conditions to continue.');
        valid = false;
      } else {
        setError('rg-terms-field', 'rg-terms-error', '');
      }

      if (!valid) {
        registerNote.textContent = '';
        return;
      }

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      TokyoTourSession.register({
        fullName: nameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        country: countrySelect.value,
        password: passwordInput.value
      }).then(({ user, error, needsEmailConfirmation }) => {
        submitBtn.disabled = false;
        if (error) {
          registerNote.textContent = error;
          registerNote.style.color = '#ff7a6b';
          return;
        }
        if (needsEmailConfirmation) {
          registerNote.textContent = 'Account created! Check your email to confirm your address, then sign in.';
          registerNote.style.color = 'var(--accent-2)';
          registerForm.reset();
          return;
        }
        if (!user) {
          registerNote.textContent = 'Unable to create your account. Please try again.';
          registerNote.style.color = '#ff7a6b';
          return;
        }
        const redirectTarget = TokyoTourSession.getRedirectParam() || 'dashboard.html';
        registerNote.textContent = 'Account created! Redirecting...';
        registerNote.style.color = 'var(--accent-2)';
        setTimeout(() => { window.location.href = redirectTarget; }, 700);
      });
    });

    // clear individual errors as the user interacts
    nameInput.addEventListener('input', () => setError('rg-name-field', 'rg-name-error', ''));
    emailInput.addEventListener('input', () => setError('rg-email-field', 'rg-email-error', ''));
    phoneInput.addEventListener('input', () => setError('rg-phone-field', 'rg-phone-error', ''));
    countrySelect.addEventListener('change', () => setError('rg-country-field', 'rg-country-error', ''));
    passwordInput.addEventListener('input', () => setError('rg-password-field', 'rg-password-error', ''));
    confirmInput.addEventListener('input', () => setError('rg-confirm-field', 'rg-confirm-error', ''));
    termsInput.addEventListener('change', () => setError('rg-terms-field', 'rg-terms-error', ''));

    /* ---------- Google register ---------- */
    const googleRegisterBtn = document.getElementById('googleRegisterBtn');
    googleRegisterBtn && googleRegisterBtn.addEventListener('click', async () => {
      googleRegisterBtn.disabled = true;
      registerNote.textContent = 'Redirecting to Google…';
      registerNote.style.color = 'var(--text-dim)';
      const { error } = await TokyoTourSession.loginWithGoogle();
      if (error) {
        googleRegisterBtn.disabled = false;
        registerNote.textContent = error;
        registerNote.style.color = '#ff7a6b';
      }
    });
  }

  /* ================= GOOGLE OAUTH LANDING (Login + Register) =================
     signInWithOAuth() above is a full-page redirect, so there's no promise
     to await for "the user finished signing in with Google" — instead,
     Google/Supabase send the browser BACK to this exact page afterwards.
     supabase-js's detectSessionInUrl (already on in session.js) turns that
     return trip into a real session before `TokyoTourSession.ready`
     resolves, so this runs on every load of Login/Register and simply asks:
     are we authenticated yet? If so — whether that's from finishing Google
     OAuth just now, or an existing session from an earlier visit — route
     onward exactly like a fresh email/password sign-in does. This never
     runs on any other page, and never touches the email/password form
     logic above. */
  if (window.TokyoTourSession && (loginForm || registerForm)) {
    const landingNote = loginForm
      ? document.getElementById('loginNote')
      : document.getElementById('registerNote');

    // Google/Supabase report OAuth problems (the user cancelled the consent
    // screen, access was denied, etc.) as ?error=...&error_description=...
    // on the way back — never a JS exception, since the whole flow is a
    // full-page redirect. Surface a friendly note once, then tidy the URL.
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthError = queryParams.get('error_description') || queryParams.get('error')
      || hashParams.get('error_description') || hashParams.get('error');

    if (oauthError && landingNote) {
      landingNote.textContent = /access_denied|cancel/i.test(oauthError)
        ? 'Google sign-in was cancelled.'
        : "We couldn't sign you in with Google. Please try again.";
      landingNote.style.color = '#ff7a6b';
      const preservedRedirect = TokyoTourSession.getRedirectParam();
      const cleanUrl = window.location.pathname + (preservedRedirect ? ('?redirect=' + encodeURIComponent(preservedRedirect)) : '');
      history.replaceState(null, '', cleanUrl);
    }

    TokyoTourSession.ready.then(() => {
      if (!TokyoTourSession.isAuthenticated()) return;
      const target = TokyoTourSession.getRedirectParam()
        || (TokyoTourSession.isAdmin() ? 'admin.html' : 'dashboard.html');
      window.location.replace(target);
    });
  }

});
