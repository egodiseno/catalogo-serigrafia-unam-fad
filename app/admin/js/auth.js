/**
 * auth.js — Login / Logout / Recovery / MFA con Supabase Auth
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * FLUJOS:
 *   A. Login normal  → checkMFARequired() → MFA SIEMPRE (sin excepciones)
 *   B. MFA Verificar → usuario con TOTP enrollado → ingresa código → dashboard
 *   C. MFA Enroll    → usuario sin factor TOTP → QR + código → dashboard
 *   D. Recovery      → hash #type=recovery → showRecovery() (password-recovery.js)
 *
 * ⚠️  MFA forzado en cliente: checkMFARequired() devuelve siempre true.
 *     Nunca se accede al dashboard sin código TOTP verificado.
 *
 * Secciones de login (gestionadas por window.PasswordRecovery.showSection):
 *   loginFormSection | forgotSection | newPasswordSection |
 *   mfaVerifySection | mfaEnrollSection
 *
 * Depende de: config.js (window.supabaseConfig, window.supabase_client),
 *             password-recovery.js (window.PasswordRecovery)
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Restaurar usuario desde localStorage (SYNC — antes del primer await) ──
  // Esto garantiza que window.usuarioActual esté disponible para los demás
  // módulos (obras-list, tecnicas-crud…) que también escuchan DOMContentLoaded.
  try {
    const _saved = localStorage.getItem('usuarioActual');
    if (_saved) window.usuarioActual = JSON.parse(_saved);
  } catch (_e) { /* JSON inválido — ignorar */ }

  // ── Referencias DOM ────────────────────────────────────────────────────────
  const loginPage     = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  const loginForm     = document.getElementById('loginForm');
  const loginError    = document.getElementById('loginError');
  const logoutBtn     = document.getElementById('logoutBtn');
  const userEmail     = document.getElementById('userEmail');
  const emailInput    = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  // Cliente Supabase directo (para MFA API)
  const client = window.supabase_client;

  console.log('🔐 auth.js cargado');

  // ── Estado de flujo ────────────────────────────────────────────────────────
  let inRecoveryFlow = false;   // true mientras se restablece contraseña
  let mfaFlowActive  = false;   // true mientras se completa MFA tras login
  let mfaFactorId    = null;    // id del factor TOTP activo

  // ── Detectar flujo de recovery ANTES de getSession() ──────────────────────
  // Supabase redirige desde email con #access_token=...&type=recovery
  const _hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  inRecoveryFlow    = _hashParams.get('type') === 'recovery';

  // ── Estado inicial ─────────────────────────────────────────────────────────
  if (inRecoveryFlow) {
    // Token de recovery en la URL — el evento PASSWORD_RECOVERY llegará en breve
    showLogin();
  } else {
    const session = await window.supabaseConfig.getSession();
    if (session?.user) {
      // ── Actualizar rol si localStorage está vacío o es de otro usuario ────
      if (!window.usuarioActual || window.usuarioActual.email !== session.user.email) {
        try {
          const { data: _ud } = await window.supabase_client
            .from('usuarios_admin')
            .select('rol')
            .eq('email', session.user.email)
            .single();

          window.usuarioActual = {
            email: session.user.email,
            rol:   _ud?.rol || 'editor'
          };
          localStorage.setItem('usuarioActual', JSON.stringify(window.usuarioActual));
        } catch (_e) {
          window.usuarioActual = { email: session.user.email, rol: 'editor' };
          localStorage.setItem('usuarioActual', JSON.stringify(window.usuarioActual));
        }
      }

      // Hay sesión activa — verificar nivel de aseguramiento MFA
      const needsMFA = await checkMFARequired();
      if (!needsMFA) showDashboard(session.user.email);
    } else {
      showLogin();
    }
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
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
        inRecoveryFlow = false;

        // ── Obtener rol del usuario desde Supabase ──────────────────────────
        try {
          const { data: _rolData } = await window.supabase_client
            .from('usuarios_admin')
            .select('rol')
            .eq('email', email)
            .single();

          window.usuarioActual = {
            email: email,
            rol:   _rolData?.rol || 'editor'
          };
          localStorage.setItem('usuarioActual', JSON.stringify(window.usuarioActual));
          console.log('👤 Usuario logueado:', window.usuarioActual);
          window.auditLogger?.login(email);
        } catch (_rolErr) {
          console.warn('[auth] No se pudo obtener rol; usando editor por defecto.', _rolErr);
          window.usuarioActual = { email, rol: 'editor' };
          localStorage.setItem('usuarioActual', JSON.stringify(window.usuarioActual));
          window.auditLogger?.login(email);
        }

        // Verificar si se necesita MFA (puede redirigir a mfaVerify/Enroll)
        const needsMFA = await checkMFARequired();
        if (!needsMFA) showDashboard(email);

      } else {
        const msg = result.error?.message || 'Credenciales incorrectas.';
        showError(translateAuthError(msg));
      }

    } catch (err) {
      showError('Error de conexión. Verifica tu red.');
      console.error('[auth] login error:', err);
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Ingresar';
    }
  });

  // ── MFA VERIFICAR (factor ya enrollado) ───────────────────────────────────
  const mfaVerifyForm = document.getElementById('mfaVerifyForm');
  if (mfaVerifyForm) {
    mfaVerifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const code = document.getElementById('mfaCodeInput')?.value.replace(/\s/g, '');

      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        setMFAError('mfaVerifyError', 'Ingresa los 6 dígitos del código.');
        return;
      }

      clearMFAError('mfaVerifyError');
      const btn = mfaVerifyForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

      try {
        const { error } = await client.auth.mfa.challengeAndVerify({
          factorId: mfaFactorId,
          code,
        });

        if (error) {
          setMFAError('mfaVerifyError', translateMFAError(error.message));
          return;
        }

        // ✅ MFA verificado con éxito
        const { data: { session } } = await client.auth.getSession();
        mfaFlowActive = false;
        showDashboard(session?.user?.email ?? '');

      } catch (err) {
        setMFAError('mfaVerifyError', 'Error de conexión. Intenta de nuevo.');
        console.error('[MFA] verify error:', err);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Verificar'; }
      }
    });
  }

  // ── MFA CANCELAR verificación (volver al login + signOut) ─────────────────
  const mfaCancelBtn = document.getElementById('mfaCancelBtn');
  if (mfaCancelBtn) {
    mfaCancelBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      mfaFlowActive = false;
      mfaFactorId   = null;
      await client.auth.signOut();
      showLogin();
    });
  }

  // ── MFA ENROLLAR (primera vez — QR + código) ──────────────────────────────
  const mfaEnrollForm = document.getElementById('mfaEnrollForm');
  if (mfaEnrollForm) {
    mfaEnrollForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const code = document.getElementById('mfaEnrollCodeInput')?.value.replace(/\s/g, '');

      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        setMFAError('mfaEnrollError', 'Ingresa los 6 dígitos del código generado por la app.');
        return;
      }

      clearMFAError('mfaEnrollError');
      const btn = mfaEnrollForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Activando…'; }

      try {
        const { error } = await client.auth.mfa.challengeAndVerify({
          factorId: mfaFactorId,
          code,
        });

        if (error) {
          setMFAError('mfaEnrollError', translateMFAError(error.message));
          return;
        }

        // ✅ MFA enrollado y verificado con éxito
        const { data: { session } } = await client.auth.getSession();
        mfaFlowActive = false;
        window.ErrorHandler?.showToast('Autenticación de dos pasos activada correctamente', 'success');
        showDashboard(session?.user?.email ?? '');

      } catch (err) {
        setMFAError('mfaEnrollError', 'Error de conexión. Intenta de nuevo.');
        console.error('[MFA] enroll verify error:', err);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Activar autenticación'; }
      }
    });
  }

  // ── MFA CANCELAR enroll (unenroll + signOut) ──────────────────────────────
  const mfaEnrollCancelBtn = document.getElementById('mfaEnrollCancelBtn');
  if (mfaEnrollCancelBtn) {
    mfaEnrollCancelBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Unenroll el factor pendiente de verificar (no se puede usar sin verificar)
      if (mfaFactorId) {
        try {
          await client.auth.mfa.unenroll({ factorId: mfaFactorId });
        } catch (unenrollErr) {
          console.warn('[MFA] unenroll on cancel:', unenrollErr);
        }
        mfaFactorId = null;
      }

      mfaFlowActive = false;
      await client.auth.signOut();
      showLogin();
    });
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      mfaFlowActive = false;
      mfaFactorId   = null;
      // Registrar logout antes de limpiar (el logger lee window.usuarioActual)
      window.auditLogger?.logout(window.usuarioActual?.email);
      // Limpiar datos del usuario
      window.usuarioActual = null;
      localStorage.removeItem('usuarioActual');
      window.dashboardManager?.limpiar?.();
      await window.supabaseConfig.logout();
      loginForm.reset();
      showLogin();
    });
  }

  // ── CAMBIOS DE SESIÓN (tab cruzado, recovery, expiración) ─────────────────
  window.supabaseConfig.onAuthStateChange((event, session) => {

    if (event === 'PASSWORD_RECOVERY') {
      inRecoveryFlow = true;
      console.log('🔑 auth.js: PASSWORD_RECOVERY detectado');
      showRecovery();

    } else if (event === 'SIGNED_IN' && session?.user) {
      // SIGNED_IN se dispara en login normal y también tras MFA/updateUser.
      // Los flujos activos (recovery, mfa) manejan su propia UI — ignorar.
      if (!inRecoveryFlow && !mfaFlowActive) {
        showDashboard(session.user.email);
      }

    } else if (event === 'SIGNED_OUT') {
      inRecoveryFlow = false;
      mfaFlowActive  = false;
      // Registrar logout antes de limpiar (el logger lee window.usuarioActual)
      window.auditLogger?.logout(window.usuarioActual?.email);
      // Limpiar datos del usuario
      window.usuarioActual = null;
      localStorage.removeItem('usuarioActual');
      window.dashboardManager?.limpiar?.();
      showLogin();
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MFA — Lógica central
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * MFA obligatorio (forzado en cliente).
   * - Si la sesión ya está en AAL2 (MFA verificado en esta sesión) → false, ir al dashboard.
   * - Si está en AAL1 y tiene factor TOTP enrollado                → showMFAVerify().
   * - Si está en AAL1 y no tiene factor                            → showMFAEnroll().
   * Retorna false si el dashboard es accesible directamente, true si se muestra pantalla MFA.
   */
  async function checkMFARequired() {

    // ── 🚧 MFA DESACTIVADO TEMPORALMENTE (desarrollo) ──────────────────────────
    // Para reactivar: eliminar estas dos líneas.
    console.warn('[MFA] ⚠️  MFA desactivado — modo desarrollo');
    return false;
    // ── fin bloque temporal ────────────────────────────────────────────────────

    try {
      // ── Comprobar nivel de aseguramiento actual ──────────────────────────────
      // AAL2 = MFA ya verificado en esta sesión (persiste en localStorage).
      // En ese caso no hay que volver a pedir el código.
      const { data: aalData, error: aalError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!aalError && aalData?.currentLevel === 'aal2') {
        console.log('[MFA] Sesión ya en AAL2 — acceso directo al dashboard');
        return false;
      }

      // ── AAL1: necesita completar MFA ─────────────────────────────────────────
      mfaFlowActive = true;

      const { data: factorsData, error: factorsError } =
        await client.auth.mfa.listFactors();

      if (factorsError) {
        console.error('[MFA] listFactors:', factorsError);
        // Error irrecuperable — denegar acceso y volver al login
        mfaFlowActive = false;
        await client.auth.signOut();
        showLogin();
        showError('Error al verificar MFA. Intenta de nuevo.');
        return true; // Seguir bloqueando el dashboard
      }

      const totpFactors = factorsData?.totp ?? [];

      if (totpFactors.length > 0) {
        // Factor TOTP ya registrado → pedir código
        mfaFactorId = totpFactors[0].id;
        showMFAVerify();
      } else {
        // Sin factor TOTP → enroll obligatorio antes de continuar
        await startMFAEnroll();
      }

      return true;

    } catch (err) {
      console.error('[MFA] checkMFARequired:', err);
      mfaFlowActive = false;
      return true; // Bloquear acceso ante cualquier error inesperado
    }
  }

  /** Inicia el proceso de enroll: genera QR + secret y muestra la pantalla */
  async function startMFAEnroll() {
    try {
      const { data, error } = await client.auth.mfa.enroll({
        factorType:   'totp',
        issuer:       'Catálogo Serigráfica UNAM',
        friendlyName: 'Admin Panel',
      });

      if (error) {
        console.error('[MFA] enroll error:', error);
        showError('Error al configurar MFA: ' + error.message);
        mfaFlowActive = false;
        return;
      }

      mfaFactorId = data.id;

      // Mostrar QR
      const qrImg = document.getElementById('mfaQRImage');
      if (qrImg) qrImg.src = data.totp.qr_code;

      // Mostrar código manual (base32 secret)
      const secretEl = document.getElementById('mfaSecretCode');
      if (secretEl) secretEl.textContent = data.totp.secret;

      showMFAEnroll();
      window.IconRegistry?.init(); // renderizar ícono shield-plus

    } catch (err) {
      console.error('[MFA] startMFAEnroll:', err);
      showError('Error al configurar MFA. Intenta de nuevo.');
      mfaFlowActive = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Helpers de UI
  // ══════════════════════════════════════════════════════════════════════════

  function showLogin() {
    loginPage.style.display     = 'flex';
    dashboardPage.style.display = 'none';
    window.PasswordRecovery?.showSection('loginFormSection');
    emailInput?.focus();
  }

  function showDashboard(email) {
    loginPage.style.display     = 'none';
    dashboardPage.style.display = 'flex';
    if (userEmail) userEmail.textContent = email;
    // Aplicar visibilidad de botones / secciones según el rol
    if (typeof inicializarPermisos === 'function') inicializarPermisos();
    // Recargar estadísticas con el rol del usuario actual
    // (garantiza datos correctos tras login o cambio de sesión)
    window.dashboardManager?.loadStats?.();
  }

  function showRecovery() {
    loginPage.style.display     = 'flex';
    dashboardPage.style.display = 'none';
    window.PasswordRecovery?.showNewPasswordForm();
  }

  function showMFAVerify() {
    loginPage.style.display     = 'flex';
    dashboardPage.style.display = 'none';
    window.PasswordRecovery?.showSection('mfaVerifySection');
    window.IconRegistry?.init();
    document.getElementById('mfaCodeInput')?.focus();
  }

  function showMFAEnroll() {
    loginPage.style.display     = 'flex';
    dashboardPage.style.display = 'none';
    window.PasswordRecovery?.showSection('mfaEnrollSection');
    window.IconRegistry?.init();
    document.getElementById('mfaEnrollCodeInput')?.focus();
  }

  function showError(msg) {
    if (!loginError) return;
    loginError.textContent   = msg;
    loginError.style.display = 'block';
  }

  function hideError() {
    if (!loginError) return;
    loginError.textContent   = '';
    loginError.style.display = 'none';
  }

  function setMFAError(elId, msg) {
    const el = document.getElementById(elId);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function clearMFAError(elId) {
    const el = document.getElementById(elId);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  /** Traduce mensajes de Supabase Auth al español */
  function translateAuthError(msg) {
    const map = {
      'Invalid login credentials': 'Email o contraseña incorrectos.',
      'Email not confirmed':        'Confirma tu email antes de ingresar.',
      'Too many requests':          'Demasiados intentos. Espera unos minutos.',
      'User not found':             'No existe una cuenta con ese email.',
    };
    return map[msg] ?? msg;
  }

  /** Traduce errores de MFA al español */
  function translateMFAError(msg) {
    if (!msg) return 'Código inválido. Intenta de nuevo.';
    const lc = msg.toLowerCase();
    if (lc.includes('invalid') || lc.includes('incorrect') || lc.includes('wrong'))
      return 'Código incorrecto. Verifica el código en tu app.';
    if (lc.includes('expired'))
      return 'El código ha expirado. Genera uno nuevo en tu app.';
    if (lc.includes('already') || lc.includes('enrolled'))
      return 'Este factor ya está registrado.';
    return msg;
  }

});
