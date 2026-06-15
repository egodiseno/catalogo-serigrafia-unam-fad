/**
 * password-recovery.js — Recuperación y restablecimiento de contraseña
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * FLUJO 1 — "¿Olvidaste tu contraseña?" (desde el login)
 *   Clic en .link-forgot
 *   → showSection('forgotSection')
 *   → Usuario ingresa email
 *   → supabase.auth.resetPasswordForEmail() → Supabase envía email
 *   → Mensaje: "✅ Revisa tu correo para resetear tu contraseña"
 *
 * FLUJO 2 — PASSWORD_RECOVERY (desde link del email)
 *   Email de Supabase → link redirige aquí con #access_token=...&type=recovery
 *   → auth.js detecta el hash y llama window.PasswordRecovery.showNewPasswordForm()
 *   → showSection('newPasswordSection')
 *   → Usuario ingresa nueva contraseña
 *   → supabase.auth.updateUser({ password }) → signOut() → vuelve al login
 *
 * Depende de: config.js (window.supabase_client)
 * Expone:     window.PasswordRecovery = { showNewPasswordForm, showSection }
 */

const PasswordRecovery = (() => {
  let client = null;

  // ── Utilidad DOM ──────────────────────────────────────────────
  const getEl = id => document.getElementById(id);

  // ── Mostrar sección activa del login, ocultar las demás ──────
  function showSection(activeId) {
    const sections = ['loginFormSection', 'forgotSection', 'newPasswordSection', 'mfaVerifySection', 'mfaEnrollSection'];
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
        getEl('forgotForm')?.reset();
        setForgotMsg('', '');
        hideForgotWarning();
        showSection('forgotSection');
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

    try {
      // redirectTo: esta misma página → Supabase redirigirá aquí con #type=recovery
      const redirectTo = `${window.location.origin}${window.location.pathname}`;

      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        setForgotMsg(`Error: ${error.message}`, 'error');
        hideForgotWarning();
      } else {
        // ✅ Paso 4 del flujo: mensaje de confirmación + advertencia de spam
        setForgotMsg(
          '✅ Revisa tu correo para resetear tu contraseña.',
          'success'
        );
        showForgotWarning();
        if (emailInput) emailInput.value = '';
      }
    } catch (err) {
      setForgotMsg('Error de conexión. Intenta de nuevo.', 'error');
      console.error('[PasswordRecovery] handleForgotSubmit:', err);
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

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    client = window.supabase_client;

    if (!client) {
      console.error('[PasswordRecovery] window.supabase_client no está disponible. Verifica que config.js carga antes que este script.');
      return;
    }

    initForgotLink();
    initNewPasswordForm();

    console.log('🔑 password-recovery.js listo');
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── API pública ───────────────────────────────────────────────
  return { showNewPasswordForm, showSection };
})();

window.PasswordRecovery = PasswordRecovery;
