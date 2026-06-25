/**
 * password-recovery.js — Recuperación y restablecimiento de contraseña
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * FLUJO 1 — "¿Olvidaste tu contraseña?" (self-service desde el login)
 *   Clic en .link-forgot
 *   → showSection('forgotSection')
 *   → Usuario ingresa email
 *   → Edge Function reset-user-password (PASO A)
 *   → Email con link de reset (expiración 30 min)
 *   → Mensaje genérico (no revela si el email existe)
 *
 * FLUJO 2 — Nuevo token de reset (desde link del email)
 *   Email del catálogo → link con ?reset_token=<uuid>
 *   → auth.js detecta el param, limpia la URL y llama showTokenResetSection()
 *   → showSection('tokenResetSection')
 *   → Usuario ingresa nueva contraseña + confirma
 *   → Edge Function reset-user-password/confirm (PASO B)
 *   → Redirige al login con mensaje de éxito
 *
 * FLUJO 3 — PASSWORD_RECOVERY (Supabase native — enlace legacy)
 *   Email de Supabase → link con #access_token=...&type=recovery
 *   → auth.js detecta el hash y llama showNewPasswordForm()
 *   → showSection('newPasswordSection')
 *   → supabase.auth.updateUser({ password }) → signOut() → vuelve al login
 *
 * Depende de: config.js (window.supabaseConfig, window.supabase_client)
 * Expone:     window.PasswordRecovery = { showNewPasswordForm, showSection, showTokenResetSection }
 */

const PasswordRecovery = (() => {
  let client = null;

  // ── Utilidad DOM ──────────────────────────────────────────────
  const getEl = id => document.getElementById(id);

  // ── Mostrar sección activa del login, ocultar las demás ──────
  function showSection(activeId) {
    const sections = [
      'loginFormSection', 'forgotSection', 'newPasswordSection',
      'mfaVerifySection', 'mfaEnrollSection', 'tokenResetSection',
    ];
    sections.forEach(id => {
      const el = getEl(id);
      if (!el) return;
      el.style.display = (id === activeId) ? '' : 'none';
    });

    // Auto-focus al primer input visible de la sección activa
    const activeEl = getEl(activeId);
    if (activeEl) {
      const firstInput = activeEl.querySelector('input');
      if (firstInput) {
        // setTimeout 0 para que el display:'' se aplique antes del focus
        setTimeout(() => firstInput.focus(), 0);
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  // FLUJO 1: Olvidé mi contraseña
  // ════════════════════════════════════════════════════════════

  function initForgotLink() {
    // Clic en "¿Olvidaste tu contraseña?" → mostrar sección de recuperación
    const forgotLink = document.querySelector('.link-forgot');
    if (forgotLink) {
      forgotLink.addEventListener('click', e => {
        e.preventDefault();
        // Capturar email del login ANTES de resetear el formulario
        const loginEmail = getEl('email')?.value.trim() ?? '';
        getEl('forgotForm')?.reset();
        setForgotMsg('', '');
        hideForgotWarning();
        showSection('forgotSection');
        // Pre-llenar el input de recuperación si el usuario ya había escrito su email
        if (loginEmail) {
          const forgotInput = getEl('forgotEmailInput');
          if (forgotInput) forgotInput.value = loginEmail;
        }
      });
    }

    // Formulario: enviar email de recuperación
    const forgotForm = getEl('forgotForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', handleForgotSubmit);
    }

    // Botón "← Volver al login"
    const backBtn = getEl('backToLoginBtn');
    if (backBtn) {
      backBtn.addEventListener('click', e => {
        e.preventDefault();
        getEl('forgotForm')?.reset();
        setForgotMsg('', '');
        hideForgotWarning();
        showSection('loginFormSection');
      });
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();

    const emailInput = getEl('forgotEmailInput');
    const email      = emailInput?.value.trim();

    if (!email) {
      setForgotMsg('Ingresa tu email.', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; }

    // Mensaje genérico reutilizable (no revela si el email existe)
    const successMsg = 'Si existe una cuenta con ese email, recibirás un enlace en los próximos minutos.';

    try {
      // ── Llamar al PASO A de la Edge Function ────────────────────────────
      const edgeUrl = `${window.supabaseConfig.url}/functions/v1/reset-user-password`;

      const res = await fetch(edgeUrl, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        window.supabaseConfig.anonKey,
          'Authorization': `Bearer ${window.supabaseConfig.anonKey}`,
        },
        body: JSON.stringify({ email }),
      });

      // Si la Edge Function responde un error de servidor (5xx) lo registramos
      // en consola, pero siempre mostramos el mensaje genérico al usuario.
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('[PasswordRecovery] Edge Function error:', res.status, errBody);
      }

      // Siempre mostrar el mismo mensaje — sin revelar si el email existe
      setForgotMsg(`✅ ${successMsg}`, 'success');
      showForgotWarning();
      if (emailInput) emailInput.value = '';

    } catch (err) {
      // Error de red — misma UX; el log queda para diagnóstico
      console.error('[PasswordRecovery] handleForgotSubmit fetch error:', err);
      setForgotMsg(`✅ ${successMsg}`, 'success');
      showForgotWarning();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar link'; }
    }
  }

  function setForgotMsg(msg, type) {
    const el = getEl('forgotMessage');
    if (!el) return;
    el.textContent   = msg;
    el.className     = type ? `recovery-message ${type}` : 'recovery-message';
    el.style.display = msg ? 'block' : 'none';
  }

  /** Muestra la advertencia de carpeta spam tras envío exitoso */
  function showForgotWarning() {
    const el = getEl('forgotWarning');
    if (!el) return;
    el.style.display = '';
    window.IconRegistry?.init();  // renderizar el ícono alert-circle
  }

  /** Oculta la advertencia (al resetear el form o volver al login) */
  function hideForgotWarning() {
    const el = getEl('forgotWarning');
    if (el) el.style.display = 'none';
  }

  // ════════════════════════════════════════════════════════════
  // FLUJO 2: Nueva contraseña (llegó desde link del email)
  // ════════════════════════════════════════════════════════════

  /** Llamado por auth.js cuando detecta PASSWORD_RECOVERY */
  function showNewPasswordForm() {
    getEl('newPasswordForm')?.reset();
    clearNewPasswordError();
    showSection('newPasswordSection');
  }

  function initNewPasswordForm() {
    const form = getEl('newPasswordForm');
    if (form) form.addEventListener('submit', handleNewPasswordSubmit);

    // Toggle mostrar/ocultar contraseña — misma lógica que modal "Nuevo Usuario"
    setupPasswordToggle('newPasswordInput');
    setupPasswordToggle('confirmPasswordInput');
  }

  /**
   * Conecta el botón .password-toggle-btn al input dentro del mismo
   * .password-toggle-wrapper. El HTML estático ya tiene el wrapper y el botón;
   * aquí solo se adjunta el event listener (idéntico a setupPasswordToggle
   * en usuarios-crud.js).
   */
  function setupPasswordToggle(inputId) {
    const input = getEl(inputId);
    if (!input || input.dataset.toggleDone) return;
    input.dataset.toggleDone = '1';

    const wrapper = input.closest('.password-toggle-wrapper');
    if (!wrapper) return;

    const btn = wrapper.querySelector('.password-toggle-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type    = visible ? 'password' : 'text';
      btn.innerHTML = visible
        ? '<i data-lucide="eye"     style="width:16px;height:16px;" aria-hidden="true"></i>'
        : '<i data-lucide="eye-off" style="width:16px;height:16px;" aria-hidden="true"></i>';
      window.IconRegistry?.init();   // re-renderizar el icono cambiado
      btn.setAttribute('aria-label',   visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      btn.setAttribute('aria-pressed', String(!visible));
    });
  }

  function clearNewPasswordError() {
    const el = getEl('newPasswordError');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function showNewPasswordError(msg) {
    const el = getEl('newPasswordError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  async function handleNewPasswordSubmit(e) {
    e.preventDefault();

    const newPwd     = getEl('newPasswordInput')?.value  ?? '';
    const confirmPwd = getEl('confirmPasswordInput')?.value ?? '';

    clearNewPasswordError();

    if (newPwd.length < 8) {
      showNewPasswordError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      showNewPasswordError('Las contraseñas no coinciden.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando…'; }

    try {
      // ✅ Paso 9: actualizar contraseña con el token de recovery activo
      const { error } = await client.auth.updateUser({ password: newPwd });

      if (error) {
        showNewPasswordError(`Error: ${error.message}`);
        return;
      }

      // Éxito — cerrar sesión de recovery y volver al login limpio
      window.ErrorHandler?.showToast('Contraseña actualizada correctamente. Inicia sesión.', 'success');

      // Limpiar el hash de recovery de la URL (sin recargar la página)
      history.replaceState(null, '', window.location.pathname);

      // Cerrar la sesión de recovery para que el usuario inicie sesión normalmente
      await client.auth.signOut();

      // Mostrar formulario de login (el SIGNED_OUT en auth.js también lo hará,
      // pero por si acaso lo manejamos aquí también)
      showSection('loginFormSection');

    } catch (err) {
      showNewPasswordError('Error de conexión. Intenta de nuevo.');
      console.error('[PasswordRecovery] handleNewPasswordSubmit:', err);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar contraseña'; }
    }
  }

  // ════════════════════════════════════════════════════════════
  // FLUJO 2: Reset con token custom (desde link ?reset_token=...)
  // ════════════════════════════════════════════════════════════

  /** Token recibido desde la URL — lo guarda auth.js antes de llamar showTokenResetSection */
  let _activeResetToken = '';

  /**
   * Llamado por auth.js cuando detecta ?reset_token= en la URL.
   * Guarda el token y muestra la sección de nueva contraseña.
   */
  function showTokenResetSection(token) {
    _activeResetToken = token ?? '';
    getEl('tokenResetForm')?.reset();
    clearTokenResetError();
    showSection('tokenResetSection');
    window.IconRegistry?.init();
    console.log('[PasswordRecovery] Token reset section visible');
  }

  function initTokenResetForm() {
    const form = getEl('tokenResetForm');
    if (form) form.addEventListener('submit', handleTokenResetSubmit);

    setupPasswordToggle('tokenResetNewPwd');
    setupPasswordToggle('tokenResetConfirmPwd');
  }

  function clearTokenResetError() {
    const el = getEl('tokenResetError');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function showTokenResetError(msg) {
    const el = getEl('tokenResetError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  async function handleTokenResetSubmit(e) {
    e.preventDefault();

    const newPwd     = getEl('tokenResetNewPwd')?.value     ?? '';
    const confirmPwd = getEl('tokenResetConfirmPwd')?.value ?? '';

    clearTokenResetError();

    // Validaciones cliente
    if (newPwd.length < 8) {
      showTokenResetError('La contraseña debe tener al menos 8 caracteres.');
      getEl('tokenResetNewPwd')?.focus();
      return;
    }
    if (newPwd !== confirmPwd) {
      showTokenResetError('Las contraseñas no coinciden. Verifica ambos campos.');
      getEl('tokenResetConfirmPwd')?.focus();
      return;
    }

    if (!_activeResetToken) {
      showTokenResetError('Token de reset no disponible. Solicita un nuevo enlace.');
      return;
    }

    const btn = getEl('tokenResetBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
      // ── Llamar al PASO B de la Edge Function ────────────────────────────
      const edgeUrl = `${window.supabaseConfig.url}/functions/v1/reset-user-password/confirm`;

      const res  = await fetch(edgeUrl, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        window.supabaseConfig.anonKey,
          'Authorization': `Bearer ${window.supabaseConfig.anonKey}`,
        },
        body: JSON.stringify({ token: _activeResetToken, new_password: newPwd }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        // Errores claros del servidor (token inválido, expirado, usado, etc.)
        const errMsg = data.error ?? 'Error al guardar la contraseña. Intenta de nuevo.';
        showTokenResetError(errMsg);
        return;
      }

      // ✅ Éxito — limpiar token, volver al login con toast
      _activeResetToken = '';
      window.ErrorHandler?.showToast(
        'Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.',
        'success'
      );
      getEl('tokenResetForm')?.reset();
      showSection('loginFormSection');

    } catch (err) {
      showTokenResetError('Error de conexión. Verifica tu red e intenta de nuevo.');
      console.error('[PasswordRecovery] handleTokenResetSubmit:', err);
    } finally {
      if (btn) {
        btn.disabled  = false;
        btn.innerHTML = '<i data-lucide="save" style="width:15px;height:15px;" aria-hidden="true"></i> Guardar contraseña';
        window.IconRegistry?.init();
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    client = window.supabase_client;

    if (!client) {
      console.error('[PasswordRecovery] window.supabase_client no está disponible. Verifica que config.js carga antes que este script.');
      return;
    }

    initForgotLink();
    initNewPasswordForm();
    initTokenResetForm();

    console.log('🔑 password-recovery.js listo');
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── API pública ───────────────────────────────────────────────
  return { showNewPasswordForm, showSection, showTokenResetSection };
})();

window.PasswordRecovery = PasswordRecovery;
