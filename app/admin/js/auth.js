/**
 * auth.js — Login / Logout con Supabase Auth
 * Fase 1.B
 *
 * Depende de: config.js (window.supabaseConfig)
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Referencias DOM ────────────────────────────────────
  const loginPage     = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  const loginForm     = document.getElementById('loginForm');
  const loginError    = document.getElementById('loginError');
  const logoutBtn     = document.getElementById('logoutBtn');
  const userEmail     = document.getElementById('userEmail');
  const emailInput    = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  console.log('🔐 auth.js cargado');

  // ── Estado inicial: verificar sesión activa ────────────
  const session = await window.supabaseConfig.getSession();
  if (session?.user) {
    showDashboard(session.user.email);
  } else {
    showLogin();
  }

  // ── Login ──────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Email y contraseña son requeridos.');
      return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Ingresando…';

    try {
      const result = await window.supabaseConfig.loginWithEmail(email, password);
      if (result.success) {
        showDashboard(email);
      } else {
        const msg = result.error?.message || 'Credenciales incorrectas.';
        showError(translateError(msg));
      }
    } catch (err) {
      showError('Error de conexión. Verifica tu red.');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Ingresar';
    }
  });

  // ── Logout ─────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseConfig.logout();
      loginForm.reset();
      showLogin();
    });
  }

  // ── Escuchar cambios de sesión (tab cruzado, expiración) ─
  window.supabaseConfig.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      showDashboard(session.user.email);
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });

  // ── Helpers ────────────────────────────────────────────
  function showLogin() {
    loginPage.style.display     = 'flex';
    dashboardPage.style.display = 'none';
    emailInput.focus();
  }

  function showDashboard(email) {
    loginPage.style.display     = 'none';
    dashboardPage.style.display = 'flex';
    if (userEmail) userEmail.textContent = email;
  }

  function showError(msg) {
    if (!loginError) return;
    loginError.textContent    = msg;
    loginError.style.display  = 'block';
  }

  function hideError() {
    if (!loginError) return;
    loginError.textContent   = '';
    loginError.style.display = 'none';
  }

  /** Traduce mensajes de Supabase Auth al español */
  function translateError(msg) {
    const map = {
      'Invalid login credentials':       'Email o contraseña incorrectos.',
      'Email not confirmed':             'Confirma tu email antes de ingresar.',
      'Too many requests':               'Demasiados intentos. Espera unos minutos.',
      'User not found':                  'No existe una cuenta con ese email.',
    };
    return map[msg] ?? msg;
  }
});
