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
    this.cargarHistorialContrasena();
    this._limpiarForm();
  }

  // ══════════════════════════════════════════════════════
  // Cargar perfil desde Supabase
  // ══════════════════════════════════════════════════════

  async cargarPerfil() {
    const usuario = window.usuarioActual;
    console.log('[Profile] cargarPerfil() — usuarioActual:', usuario);
    console.log('[Profile] supabase_client disponible:', !!this.client);

    if (!usuario) {
      console.warn('[ProfileManager] Sin usuario activo — cargarPerfil() abortado.');
      return;
    }

    try {
      const { data, error } = await this.client
        .from('usuarios_admin')
        .select('email, nombre, rol, estado, created_at')
        .eq('email', usuario.email)
        .single();

      console.log('[Profile] Datos cargados desde BD:', data, '| error:', error);

      if (error) throw error;

      // Exponer nombre para otros módulos (portafolio.js lo usa como filtro artista)
      if (data?.nombre && window.usuarioActual) {
        window.usuarioActual.nombre = data.nombre;
      }

      this._renderPerfil(data);
      this._renderQuickActions();

    } catch (err) {
      console.error('[ProfileManager] cargarPerfil:', err);
      window.ErrorHandler?.showToast('No se pudo cargar el perfil.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════

  _renderPerfil(datos) {
    console.log('[Profile] _renderPerfil() llamado con:', datos);
    const email  = datos?.email  ?? window.usuarioActual?.email  ?? '—';
    const nombre = datos?.nombre ?? window.usuarioActual?.nombre ?? '';

    // Avatar: inicial del nombre (si existe) o del email
    const el = id => document.getElementById(id);
    const initial = (nombre || email).charAt(0).toUpperCase();
    if (el('profileInitial')) el('profileInitial').textContent = initial;

    // Nombre
    if (el('profileNombre')) el('profileNombre').textContent = nombre || '—';

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

      // Éxito
      this._showFormAlert('Contraseña cambiada correctamente.', 'success');
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
  // Historial de cambios de contraseña
  // ══════════════════════════════════════════════════════

  async cargarHistorialContrasena() {
    const usuario = window.usuarioActual;
    const tbody   = document.getElementById('historialTableBody');
    const cards   = document.getElementById('historialCards');
    if (!tbody) return;
    if (!usuario) return;

    const loadingRow  = '<tr><td colspan="2" class="loading-hint">Cargando historial…</td></tr>';
    const emptyRow    = '<tr><td colspan="2" class="empty-hint">Sin cambios de contraseña registrados.</td></tr>';
    const errorRow    = '<tr><td colspan="2" class="empty-hint">No se pudo cargar el historial.</td></tr>';

    tbody.innerHTML = loadingRow;
    if (cards) cards.innerHTML = '<p class="loading-hint">Cargando historial…</p>';

    try {
      const { data, error } = await this.client
        .from('audit_logs')
        .select('created_at, usuario_rol')
        .eq('accion', 'cambiar_contrasena')
        .eq('objeto_nombre', usuario.email)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        tbody.innerHTML = emptyRow;
        if (cards) cards.innerHTML = '<p class="empty-hint">Sin cambios de contraseña registrados.</p>';
        return;
      }

      // ── Desktop: filas en tabla ────────────────────────
      tbody.innerHTML = data.map(log => {
        const fecha = new Date(log.created_at).toLocaleString('es-MX', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        const rol = log.usuario_rol ?? 'editor';
        return `<tr>
          <td>${fecha}</td>
          <td><span class="badge badge-${rol}">${rol}</span></td>
        </tr>`;
      }).join('');

      // ── Mobile: cards apiladas ─────────────────────────
      if (cards) {
        cards.innerHTML = data.map(log => {
          const dt    = new Date(log.created_at);
          const fecha = dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
          const hora  = dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          const rol   = log.usuario_rol ?? 'editor';
          return `<div class="historial-card">
            <div class="historial-card-date">
              <span class="historial-card-day">${fecha}</span>
              <span class="historial-card-time">${hora}</span>
            </div>
            <span class="badge badge-${rol}">${rol}</span>
          </div>`;
        }).join('');
      }

    } catch (err) {
      console.warn('[ProfileManager] cargarHistorialContrasena:', err);
      tbody.innerHTML = errorRow;
      if (cards) cards.innerHTML = '<p class="empty-hint">No se pudo cargar el historial.</p>';
    }
  }

  // ══════════════════════════════════════════════════════
  // Acciones rápidas según rol
  // ══════════════════════════════════════════════════════

  _renderQuickActions() {
    const container = document.getElementById('quickActions');
    if (!container) return;

    const rol = window.getRolActual?.() ?? 'editor';

    const acciones = {
      admin: [
        { label: 'Nueva Obra',      icon: 'plus-circle',  seccion: 'obras',    hint: 'Agregar obra al catálogo' },
        { label: 'Nuevo Usuario',   icon: 'user-plus',    seccion: 'usuarios', hint: 'Crear cuenta de usuario' },
        { label: 'Ver Logs',        icon: 'activity',     seccion: 'logs',     hint: 'Auditoría del sistema' },
        { label: 'Gestionar Tags',  icon: 'tag',          seccion: 'tags',     hint: 'Administrar etiquetas' },
      ],
      super_editor: [
        { label: 'Nueva Obra',       icon: 'plus-circle', seccion: 'obras',     hint: 'Agregar obra al catálogo' },
        { label: 'Nuevo Usuario',    icon: 'user-plus',   seccion: 'usuarios',  hint: 'Crear cuenta de usuario' },
        { label: 'Gestionar Tags',   icon: 'tag',         seccion: 'tags',      hint: 'Administrar etiquetas' },
        { label: 'Técnicas',         icon: 'brush',       seccion: 'tecnicas',  hint: 'Administrar técnicas' },
      ],
      editor: [
        { label: 'Mi Portafolio',  icon: 'layout-grid', seccion: 'mi-portafolio', hint: 'Ver mis obras' },
        { label: 'Nueva Obra',     icon: 'plus-circle', seccion: 'obras',          hint: 'Agregar obra al catálogo' },
      ],
    };

    const lista = acciones[rol] ?? acciones.editor;

    container.innerHTML = lista.map(a => `
      <button class="quick-action-btn" data-goto="${a.seccion}" title="${a.hint}">
        <i data-lucide="${a.icon}" style="width:22px;height:22px;" aria-hidden="true"></i>
        <span>${a.label}</span>
      </button>`).join('');

    window.IconRegistry?.init();

    container.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.showSection?.(btn.dataset.goto);
      });
    });
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
