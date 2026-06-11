/**
 * profile.js — Pantalla Mi Perfil
 * FASE 1 — Información del usuario + cambio de contraseña
 *
 * Carga datos desde `usuarios_admin` y permite cambiar contraseña vía Supabase Auth.
 * Depende de: config.js (window.supabase_client), audit-logger.js, error-handler.js
 * Expone: window.profileManager
 */

class ProfileManager {
  constructor() {
    this._client       = null;
    this._initialized  = false;   // listeners montados una sola vez
  }

  get client() {
    if (!this._client) this._client = window.supabase_client;
    return this._client;
  }

  // ══════════════════════════════════════════════════════
  // Init — llamado cada vez que se muestra la sección
  // ══════════════════════════════════════════════════════

  inicializar() {
    if (!this._initialized) {
      this._conectarForm();
      this._conectarPasswordToggles();
      this._initialized = true;
    }
    this.cargarPerfil();
    this._limpiarForm();
  }

  // ══════════════════════════════════════════════════════
  // Cargar perfil desde Supabase
  // ══════════════════════════════════════════════════════

  async cargarPerfil() {
    const usuario = window.usuarioActual;
    if (!usuario) {
      console.warn('[ProfileManager] Sin usuario activo.');
      return;
    }

    try {
      const { data, error } = await this.client
        .from('usuarios_admin')
        .select('email, rol, estado, created_at')
        .eq('email', usuario.email)
        .single();

      if (error) throw error;

      this._renderPerfil(data);

    } catch (err) {
      console.error('[ProfileManager] cargarPerfil:', err);
      window.ErrorHandler?.showToast('No se pudo cargar el perfil.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════

  _renderPerfil(datos) {
    const email = datos?.email ?? window.usuarioActual?.email ?? '—';

    // Avatar: inicial del email
    const el = id => document.getElementById(id);
    const initial = email.charAt(0).toUpperCase();
    if (el('profileInitial')) el('profileInitial').textContent = initial;

    // Email
    if (el('profileEmail')) el('profileEmail').textContent = email;

    // Rol
    const rolLabel = { admin: 'Administrador', super_editor: 'Super Editor', editor: 'Editor' };
    const rol      = datos?.rol ?? window.usuarioActual?.rol ?? 'editor';
    if (el('profileRol')) {
      el('profileRol').textContent = rolLabel[rol] ?? rol;
      el('profileRol').className   = `badge badge-${rol}`;
    }

    // Fecha de creación
    if (el('profileFecha')) {
      if (datos?.created_at) {
        el('profileFecha').textContent = new Date(datos.created_at)
          .toLocaleString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
      } else {
        el('profileFecha').textContent = '—';
      }
    }

    // Estado (campo booleano en BD)
    if (el('profileEstado')) {
      const activo = datos?.estado ?? true;
      el('profileEstado').textContent = activo ? 'Activo' : 'Inactivo';
      el('profileEstado').className   = `badge ${activo ? 'badge-publicado' : 'badge-borrador'}`;
    }
  }

  // ══════════════════════════════════════════════════════
  // Cambiar contraseña
  // ══════════════════════════════════════════════════════

  async _cambiarContrasena(e) {
    e.preventDefault();
    this._limpiarErrores();

    const actual      = document.getElementById('contrasenaActual')?.value ?? '';
    const nueva       = document.getElementById('contrasenaNueva')?.value ?? '';
    const confirmar   = document.getElementById('contrasenaConfirmar')?.value ?? '';

    // ── Validaciones client-side ────────────────────────
    let valid = true;

    if (!actual) {
      this._showFieldError('errorContrasenaActual', 'Ingresa tu contraseña actual.'); valid = false;
    }
    if (nueva.length < 8) {
      this._showFieldError('errorContrasenaNueva', 'Mínimo 8 caracteres.'); valid = false;
    }
    if (nueva && actual && nueva === actual) {
      this._showFieldError('errorContrasenaNueva', 'Debe ser diferente a la contraseña actual.'); valid = false;
    }
    if (nueva !== confirmar) {
      this._showFieldError('errorContrasenaConfirmar', 'Las contraseñas no coinciden.'); valid = false;
    }
    if (!valid) return;

    // ── Disable botón ───────────────────────────────────
    const btn = document.getElementById('btnGuardarContrasena');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
      // Verificar contraseña actual re-autenticando (sin cerrar sesión)
      const { error: loginErr } = await this.client.auth.signInWithPassword({
        email:    window.usuarioActual?.email ?? '',
        password: actual
      });

      if (loginErr) {
        this._showFieldError('errorContrasenaActual', 'Contraseña actual incorrecta.');
        return;
      }

      // Cambiar contraseña
      const { error: updateErr } = await this.client.auth.updateUser({ password: nueva });
      if (updateErr) throw updateErr;

      // ✅ Éxito
      this._showFormAlert('✅ Contraseña cambiada correctamente.', 'success');
      this._limpiarForm(true);   // resetea inputs, mantiene el alert
      window.ErrorHandler?.showToast('Contraseña actualizada', 'success');

      // Audit log
      window.auditLogger?.registrar('cambiar_contrasena', 'usuario', {
        objeto_nombre: window.usuarioActual?.email
      });

    } catch (err) {
      console.error('[ProfileManager] cambiarContrasena:', err);
      const msg = err.message?.toLowerCase().includes('weak')
        ? 'La contraseña es demasiado débil. Usa letras, números y símbolos.'
        : (err.message ?? 'No se pudo cambiar la contraseña.');
      this._showFormAlert(msg, 'error');
    } finally {
      if (btn) {
        btn.disabled    = false;
        btn.innerHTML   = '<i data-lucide="save" style="width:16px;height:16px;" aria-hidden="true"></i> Guardar contraseña';
        window.IconRegistry?.init();
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // Helpers de UI
  // ══════════════════════════════════════════════════════

  _showFieldError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';

    // Marcar input con clase error (el id del error es `error` + PascalCase del input id)
    const inputId = elId.replace(/^error/, '');
    const input   = document.getElementById(inputId.charAt(0).toLowerCase() + inputId.slice(1));
    input?.classList.add('input--error');
  }

  _showFormAlert(msg, type = 'error') {
    const el = document.getElementById('perfilFormAlert');
    if (!el) return;
    el.textContent   = msg;
    el.className     = `form-alert ${type}`;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _limpiarErrores() {
    ['errorContrasenaActual','errorContrasenaNueva','errorContrasenaConfirmar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
    document.querySelectorAll('#miPerfilSection .input--error')
            .forEach(el => el.classList.remove('input--error'));
  }

  _limpiarForm(mantenerAlert = false) {
    document.getElementById('formCambiarContrasena')?.reset();
    this._limpiarErrores();
    if (!mantenerAlert) {
      const al = document.getElementById('perfilFormAlert');
      if (al) { al.style.display = 'none'; al.textContent = ''; al.className = 'form-alert'; }
    }
  }

  // ── Conectar el formulario (una sola vez) ──────────────
  _conectarForm() {
    const form = document.getElementById('formCambiarContrasena');
    form?.addEventListener('submit', e => this._cambiarContrasena(e));

    document.getElementById('btnCancelarContrasena')
      ?.addEventListener('click', () => this._limpiarForm());
  }

  // ── Toggle show/hide password (3 campos) ─────────────
  _conectarPasswordToggles() {
    document.querySelectorAll('#miPerfilSection .password-toggle-btn')
      .forEach(btn => {
        if (btn.dataset.toggleDone) return;
        btn.dataset.toggleDone = '1';

        btn.addEventListener('click', () => {
          const input   = btn.previousElementSibling;
          if (!input) return;
          const visible = input.type === 'text';
          input.type    = visible ? 'password' : 'text';
          btn.innerHTML = visible
            ? '<i data-lucide="eye"     style="width:16px;height:16px;" aria-hidden="true"></i>'
            : '<i data-lucide="eye-off" style="width:16px;height:16px;" aria-hidden="true"></i>';
          btn.setAttribute('aria-pressed', String(!visible));
          window.IconRegistry?.init();
        });
      });
  }
}

// ── Instancia global ───────────────────────────────────────
window.profileManager = new ProfileManager();

console.log('👤 profile.js cargado');
