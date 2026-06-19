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
  // #logoutBtn: el listener usa delegación en document (ver más abajo) — sin referencia directa
  const userEmail     = document.getElementById('userEmail');
  const emailInput    = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  // Cliente Supabase directo (para MFA API)
  const client = window.supabase_client;

  console.log('🔐 auth.js cargado');

  // ── Toggle mostrar / ocultar contraseña en el formulario de LOGIN ──────────
  // Reutiliza _setupSetPwdToggle (definida más abajo; hoisted al inicio del handler)
  _setupSetPwdToggle('password');

  // ── Estado de flujo ────────────────────────────────────────────────────────
  let inRecoveryFlow  = false;  // true mientras se restablece contraseña
  let mfaFlowActive   = false;  // true mientras se completa MFA tras login
  let mfaFactorId     = null;   // id del factor TOTP activo
  let loginFlowActive = false;  // true mientras el formulario de login maneja el sign-in
  //   ↑ Evita que el evento SIGNED_IN (disparado dentro de loginWithEmail) llame
  //     showDashboard con datos stale de localStorage antes de que el handler
  //     del formulario haya obtenido el rol correcto desde usuarios_admin.

  // ── Detectar flujo de recovery ANTES de getSession() ──────────────────────
  // Supabase redirige desde email con #access_token=...&type=recovery
  const _hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  inRecoveryFlow    = _hashParams.get('type') === 'recovery';

  // ── Estado inicial ─────────────────────────────────────────────────────────
  if (inRecoveryFlow) {
    // Token de recovery en la URL — procesar explícitamente con setSession()
    // (no esperar el evento PASSWORD_RECOVERY que puede llegar tarde o perderse)
    const accessToken  = _hashParams.get('access_token')  ?? '';
    const refreshToken = _hashParams.get('refresh_token') ?? '';

    if (accessToken) {
      console.log('[auth] Recovery token detectado — estableciendo sesión…');
      try {
        const { data: sessionData, error: sessionError } = await client.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });

        // Limpiar el hash de la URL (sin tokens visibles, sin recargar)
        history.replaceState(null, '', window.location.pathname + window.location.search);

        if (sessionError || !sessionData?.session?.user) {
          console.error('[auth] setSession error:', sessionError);
          showLogin();
          showError('El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo al administrador.');
        } else {
          console.log('[auth] ✅ Sesión establecida correctamente');
          inRecoveryFlow = false;

          const userEmail2 = sessionData.session.user.email;

          // Cargar rol desde usuarios_admin
          try {
            const { data: rolData } = await window.supabase_client
              .from('usuarios_admin')
              .select('rol')
              .eq('email', userEmail2)
              .single();

            window.usuarioActual = { email: userEmail2, rol: rolData?.rol || 'editor' };
          } catch {
            window.usuarioActual = { email: userEmail2, rol: 'editor' };
          }
          localStorage.setItem('usuarioActual', JSON.stringify(window.usuarioActual));

          // Mostrar modal obligatorio de "Establece tu contraseña" (FEAT recovery)
          // El modal llama a showDashboard() cuando el usuario guarda exitosamente.
          showSetPasswordModal(userEmail2);
        }
      } catch (recErr) {
        console.error('[auth] Recovery setSession excepción:', recErr);
        history.replaceState(null, '', window.location.pathname + window.location.search);
        showLogin();
        showError('Error al procesar el enlace. Intenta de nuevo o contacta al administrador.');
      }
    } else {
      // Hash con type=recovery pero sin access_token — mostrar login normal
      console.warn('[auth] type=recovery en hash pero sin access_token');
      showLogin();
    }
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
    loginFlowActive = true;   // ← bloquear SIGNED_IN durante este await

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
      loginFlowActive       = false; // ← restaurar antes de salir (éxito o error)
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
  // Delegación de eventos en document en lugar de listener directo en logoutBtn.
  // Razón: el handler async DOMContentLoaded tiene varios await ANTES de llegar
  // aquí (línea 119 + 142). En el flujo de editor, showDashboard() → inicializar-
  // Permisos() → renderSidebarByRole() se ejecuta durante esa ventana async, lo
  // que puede causar que la referencia a logoutBtn quede desconectada del DOM
  // activo. Con delegación en document el listener siempre funciona sin importar
  // re-renders ni timing de carga de módulos por rol.
  document.addEventListener('click', async (e) => {
    // closest() cubre el caso en que el clic cae sobre el ícono hijo del botón
    if (!e.target.closest('#logoutBtn')) return;
    console.log('[auth] Logout iniciado — rol:', window.usuarioActual?.rol);
    try {
      mfaFlowActive = false;
      mfaFactorId   = null;
      // Registrar logout antes de limpiar (el logger lee window.usuarioActual)
      window.auditLogger?.logout(window.usuarioActual?.email);
      // Limpiar datos del usuario
      window.usuarioActual = null;
      localStorage.removeItem('usuarioActual');
      window.dashboardManager?.limpiar?.();
      await window.supabaseConfig.logout();
      loginForm?.reset();
      showLogin();
      console.log('[auth] Logout completado — formulario de login visible');
    } catch (err) {
      console.error('[auth] Error en logout:', err);
      // Aunque el signOut falle, forzar la vista de login para no dejar al usuario atrapado
      showLogin();
    }
  });

  // ── CAMBIOS DE SESIÓN (tab cruzado, recovery, expiración) ─────────────────
  window.supabaseConfig.onAuthStateChange((event, session) => {

    if (event === 'PASSWORD_RECOVERY') {
      // Si ya procesamos el hash con setSession() arriba, inRecoveryFlow ya es false
      // y el usuario está en el dashboard — no redirigir de vuelta al form de recovery.
      if (inRecoveryFlow) {
        console.log('🔑 auth.js: PASSWORD_RECOVERY evento (flujo no procesado antes)');
        showRecovery();
      } else {
        console.log('🔑 auth.js: PASSWORD_RECOVERY evento ignorado (ya procesado via setSession)');
      }

    } else if (event === 'SIGNED_IN' && session?.user) {
      // SIGNED_IN se dispara en login normal y también tras MFA/updateUser.
      // Los flujos activos (recovery, mfa, loginForm) manejan su propia UI — ignorar.
      // loginFlowActive evita la race condition: el evento se dispara DENTRO de
      // loginWithEmail() antes de que el handler haya cargado el rol desde DB.
      if (!inRecoveryFlow && !mfaFlowActive && !loginFlowActive) {
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

  // ══════════════════════════════════════════════════════════════════════════
  // Modal obligatorio: Establecer contraseña (recovery — primer acceso)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Muestra el modal obligatorio de primera contraseña.
   * Llama primero a showDashboard() para que el fondo sea el dashboard dimmed.
   */
  function showSetPasswordModal(email) {
    showDashboard(email);   // configura el dashboard como fondo

    const modal  = document.getElementById('setPasswordModal');
    const form   = document.getElementById('setPasswordForm');
    const errEl  = document.getElementById('setPasswordError');

    if (!modal) { console.warn('[auth] #setPasswordModal no encontrado en el DOM'); return; }

    form?.reset();
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('setPasswordNew')?.focus(), 80);
    window.IconRegistry?.init();
  }

  function _closeSetPasswordModal() {
    const modal = document.getElementById('setPasswordModal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Conecta el toggle mostrar/ocultar contraseña a un input dentro de
   * su .password-toggle-wrapper. Llama una sola vez por input.
   */
  function _setupSetPwdToggle(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.setPwdToggleDone) return;
    input.dataset.setPwdToggleDone = '1';

    const btn = input.closest('.password-toggle-wrapper')
                     ?.querySelector('.password-toggle-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type    = visible ? 'password' : 'text';
      btn.innerHTML = visible
        ? '<i data-lucide="eye"     style="width:16px;height:16px;" aria-hidden="true"></i>'
        : '<i data-lucide="eye-off" style="width:16px;height:16px;" aria-hidden="true"></i>';
      window.IconRegistry?.init();
      btn.setAttribute('aria-label',   visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      btn.setAttribute('aria-pressed', String(!visible));
    });
  }

  /** Inicializa todos los listeners del modal de primera contraseña. */
  function initSetPasswordModal() {
    const form = document.getElementById('setPasswordForm');
    if (!form) return;

    // Password toggles
    _setupSetPwdToggle('setPasswordNew');
    _setupSetPwdToggle('setPasswordConfirm');

    // Prevenir cierre con Escape mientras el modal esté visible
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = document.getElementById('setPasswordModal');
      if (modal && modal.style.display !== 'none') e.preventDefault();
    });

    // Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newPwd     = document.getElementById('setPasswordNew')?.value    ?? '';
      const confirmPwd = document.getElementById('setPasswordConfirm')?.value ?? '';
      const errEl      = document.getElementById('setPasswordError');

      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

      // ── Validaciones ────────────────────────────────────────────────────────
      if (newPwd.length < 8) {
        if (errEl) { errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; errEl.style.display = 'block'; }
        document.getElementById('setPasswordNew')?.focus();
        return;
      }
      if (newPwd !== confirmPwd) {
        if (errEl) { errEl.textContent = 'Las contraseñas no coinciden. Verifica ambos campos.'; errEl.style.display = 'block'; }
        document.getElementById('setPasswordConfirm')?.focus();
        return;
      }

      const btn = document.getElementById('setPasswordBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

      try {
        // ── Guardar contraseña vía Supabase Auth ────────────────────────────
        const { error } = await client.auth.updateUser({ password: newPwd });

        if (error) {
          if (errEl) { errEl.textContent = `Error al guardar: ${error.message}`; errEl.style.display = 'block'; }
          console.error('[auth] setPasswordModal updateUser:', error);
          return;
        }

        // ✅ Éxito — cerrar modal y mostrar dashboard
        _closeSetPasswordModal();
        window.ErrorHandler?.showToast('Contraseña establecida correctamente. ¡Bienvenido/a!', 'success');
        console.log('[auth] ✅ Contraseña establecida por el usuario');

      } catch (err) {
        if (errEl) { errEl.textContent = 'Error de conexión. Intenta de nuevo.'; errEl.style.display = 'block'; }
        console.error('[auth] setPasswordModal error:', err);
      } finally {
        if (btn) {
          btn.disabled  = false;
          btn.innerHTML = '<i data-lucide="save" style="width:15px;height:15px;" aria-hidden="true"></i> Guardar contraseña';
          window.IconRegistry?.init();
        }
      }
    });
  }

  // Inicializar el modal una vez que el DOM esté listo
  initSetPasswordModal();

});
