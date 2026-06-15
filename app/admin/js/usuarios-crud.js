/**
 * usuarios-crud.js — CRUD de Usuarios Admin
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-06 (sin alert)
 * SPRINT3: ISSUE-15 — creación de usuarios via Edge Function segura
 * FASE1.I: openEditModal (rol/estado), guard "último admin"
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.UsuariosCRUD
 *
 * ──────────────────────────────────────────────────────────────────
 * ✅  CREACIÓN DE USUARIOS — Edge Function:
 *
 * La creación se delega a la Edge Function `create-admin-user`
 * (supabase/functions/create-admin-user/index.ts).
 *
 * La Edge Function usa la SERVICE_ROLE_KEY en el servidor para:
 *   1. auth.admin.createUser() con email_confirm: true
 *   2. INSERT en usuarios_admin con estado: 'activo'
 *   3. Rollback automático si el INSERT falla
 *
 * El frontend solo envía: { email, password, rol }
 * con el JWT de sesión como Bearer token para autenticación.
 * ──────────────────────────────────────────────────────────────────
 */

const UsuariosCRUD = (() => {
  const client = window.supabase_client;
  let usuariosData = [];   // caché local para guards y edición

  // ── Cargar y renderizar lista de usuarios ──────────────
  async function loadUsuarios() {
    const tbody = document.getElementById('usuariosList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Cargando…</td></tr>';

    try {
      const _sort = window.sortManager?.getSort('usuarios-table') ?? { field: 'email', direction: 'asc' };
      const { data, error } = await client
        .from('usuarios_admin')
        .select('id, email, nombre, rol, estado')
        .order(_sort.field, { ascending: _sort.direction === 'asc' });
      if (error) throw error;

      usuariosData = data ?? [];

      if (usuariosData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
          Sin usuarios. <a href="#" class="cta-link"
            onclick="window.UsuariosCRUD?.openCreateModal(); return false">Invitar primero →</a>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = usuariosData.map(u => `
        <tr>
          <td class="td-checkbox">
            <input type="checkbox" class="select-user" data-email="${escapeHtml(u.email)}" aria-label="Seleccionar ${escapeHtml(u.email)}">
          </td>
          <td>${escapeHtml(u.email)}</td>
          <td>${u.nombre ? escapeHtml(u.nombre) : '<span class="text-muted">—</span>'}</td>
          <td><span class="badge badge-${escapeHtml(u.rol)}">${escapeHtml(u.rol)}</span></td>
          <td>
            <span class="badge ${u.estado ? 'badge-publicado' : 'badge-archivado'}">
              ${u.estado ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="actions-cell">
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary"
                      data-edit-id="${u.id}" title="Editar">
                <i data-lucide="pen" style="width:14px;height:14px;" aria-hidden="true"></i> Editar
              </button>
              <button class="btn btn-sm btn-secondary"
                      data-reset-email="${escapeHtml(u.email)}" title="Resetear contraseña">
                <i data-lucide="key-round" style="width:14px;height:14px;" aria-hidden="true"></i> Resetear
              </button>
              <button class="btn btn-sm btn-danger btn--icon-only"
                      data-del-id="${u.id}"
                      data-del-email="${escapeHtml(u.email)}"
                      data-permiso="usuarios.borrar" title="Eliminar">
                <i data-lucide="trash-2" style="width:14px;height:14px;" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.editId));
      });
      tbody.querySelectorAll('[data-reset-email]').forEach(btn => {
        btn.addEventListener('click', () => resetPasswordUsuario(btn.dataset.resetEmail));
      });
      tbody.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteUsuario(btn.dataset.delId, btn.dataset.delEmail));
      });
      window.IconRegistry?.init();
      // Aplicar permisos sobre los botones recién renderizados
      if (typeof inicializarPermisos === 'function') inicializarPermisos();

    } catch (err) {
      console.error('loadUsuarios:', err);
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error al cargar usuarios.</td></tr>';
    }
  }

  // ── Abrir modal de edición (rol + estado) ─────────────
  function openEditModal(id) {
    const usuario = usuariosData.find(u => u.id === id);
    if (!usuario) {
      window.ErrorHandler?.showToast('Usuario no encontrado', 'error');
      return;
    }

    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: `Editar: ${usuario.email}`,
      fields: [
        {
          name: 'rol',
          label: 'Rol',
          type: 'select',
          required: true,
          options: [
            { value: 'admin',        label: 'Admin'        },
            { value: 'super_editor', label: 'Super Editor' },
            { value: 'editor',       label: 'Editor'       }
          ]
        },
        {
          name: 'estado',
          label: 'Estado',
          type: 'select',
          required: true,
          options: [
            { value: 'true',  label: 'Activo'   },
            { value: 'false', label: 'Inactivo' }
          ]
        }
      ],
      onSave: async (data) => {
        const estado = data.estado === 'true' || data.estado === true;

        const { error } = await client
          .from('usuarios_admin')
          .update({ rol: data.rol, estado })
          .eq('id', id);

        if (error) throw error;

        window.auditLogger?.editarUsuario(usuario.email);
        window.ErrorHandler?.showToast('Usuario actualizado', 'success');
        document.dispatchEvent(new CustomEvent('usuarios:updated'));
      }
    });
  }

  // ── Eliminar usuario ────────────────────────────────────
  async function deleteUsuario(id, email) {
    const rolActual   = window.getRolActual?.() ?? 'editor';
    const emailActual = window.usuarioActual?.email ?? '';
    const target      = usuariosData.find(u => u.id === id);

    // ── Guard 1: EDITOR no tiene acceso a usuarios ────────
    if (rolActual === 'editor') {
      window.ErrorHandler?.showToast('No tienes acceso a esta función.', 'error');
      return;
    }

    // ── Guard 2: nadie puede eliminarse a sí mismo ────────
    if (emailActual && target?.email === emailActual) {
      window.ErrorHandler?.showToast('No puedes eliminar tu propia cuenta.', 'error');
      return;
    }

    // ── Guard 3: SUPER_EDITOR no puede eliminar ADMIN ─────
    if (rolActual === 'super_editor' && target?.rol === 'admin') {
      window.ErrorHandler?.showToast('No puedes eliminar cuentas de administrador.', 'error');
      return;
    }

    // ── Guard 4: no eliminar el último admin ──────────────
    const admins = usuariosData.filter(u => u.rol === 'admin');
    if (target?.rol === 'admin' && admins.length <= 1) {
      window.ErrorHandler?.showToast('No se puede eliminar el último administrador.', 'error');
      return;
    }

    if (window.ModalManager?.openConfirm) {
      window.ModalManager.openConfirm({
        title:       '¿Eliminar usuario?',
        message:     `Se eliminará "${email}". Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText:  'Cancelar',
        onConfirm:   async () => _doDeleteUsuario(id, email)
      });
    } else {
      if (!confirm(`¿Eliminar el usuario "${email}"?\nEsta acción no se puede deshacer.`)) return;
      await _doDeleteUsuario(id, email);
    }
  }

  async function _doDeleteUsuario(id, email) {
    try {
      const { error } = await client.from('usuarios_admin').delete().eq('id', id);
      if (error) throw error;
      window.auditLogger?.borrarUsuario(email);
      window.ErrorHandler?.showToast(`Usuario "${email}" eliminado`, 'success');
      document.dispatchEvent(new CustomEvent('usuarios:updated'));
    } catch (err) {
      console.error('deleteUsuario:', err);
      window.ErrorHandler?.showToast('No se pudo eliminar el usuario.', 'error');
    }
  }

  // ── Resetear contraseña de usuario (Edge Function) ────
  async function resetPasswordUsuario(email) {
    if (window.ModalManager?.openConfirm) {
      window.ModalManager.openConfirm({
        title:       'Resetear contraseña',
        message:     `Se enviará un link de restablecimiento a "${email}". El usuario deberá revisar su bandeja de entrada.`,
        confirmText: 'Enviar link',
        cancelText:  'Cancelar',
        onConfirm:   async () => _doResetPassword(email)
      });
    } else {
      if (!confirm(`¿Enviar link de restablecimiento a "${email}"?`)) return;
      await _doResetPassword(email);
    }
  }

  async function _doResetPassword(email) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');

      const SUPABASE_URL  = window.supabaseConfig?.url      ?? 'https://kfvjansfmhamkrnbxmgp.supabase.co';
      const ANON_KEY      = window.supabaseConfig?.anonKey  ?? '';
      const FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/reset-user-password`;

      let response;
      try {
        response = await fetch(FUNCTION_URL, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey':        ANON_KEY,
          },
          body: JSON.stringify({ email }),
        });
      } catch (networkErr) {
        throw new Error(`Error de red: ${networkErr.message}`);
      }

      let result;
      try { result = await response.json(); } catch { throw new Error(`Respuesta inválida (HTTP ${response.status}).`); }

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? `Error ${response.status}.`);
      }

      window.ErrorHandler?.showToast(`Link de restablecimiento enviado a ${email}`, 'success', 'mail-check');
    } catch (err) {
      console.error('[UsuariosCRUD] resetPassword:', err);
      window.ErrorHandler?.showToast(err.message || 'No se pudo enviar el link.', 'error');
    }
  }

  // ── Toggle contraseña (icono ojo) ─────────────────────
  function setupPasswordToggle() {
    // El input puede estar recién creado por ModalManager (DOM síncrono)
    const passwordInput = document.querySelector('.modal-form input[type="password"]');
    if (!passwordInput || passwordInput.dataset.toggleDone) return;
    passwordInput.dataset.toggleDone = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'password-toggle-wrapper';
    passwordInput.parentNode.insertBefore(wrapper, passwordInput);
    wrapper.appendChild(passwordInput);

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'password-toggle-btn';
    btn.setAttribute('aria-label',   'Mostrar contraseña');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<i data-lucide="eye" style="width:16px;height:16px;" aria-hidden="true"></i>';
    wrapper.appendChild(btn);
    window.IconRegistry?.init();   // renderizar el icono eye recién insertado

    btn.addEventListener('click', () => {
      const visible = passwordInput.type === 'text';
      passwordInput.type  = visible ? 'password' : 'text';
      btn.innerHTML = visible
        ? '<i data-lucide="eye"     style="width:16px;height:16px;" aria-hidden="true"></i>'
        : '<i data-lucide="eye-off" style="width:16px;height:16px;" aria-hidden="true"></i>';
      window.IconRegistry?.init();   // re-renderizar al cambiar ícono
      btn.setAttribute('aria-label',   visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      btn.setAttribute('aria-pressed', String(!visible));
    });
  }

  // ── Abrir modal de creación ────────────────────────────
  function openCreateModal() {
    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: 'Nuevo Usuario Admin',
      fields: [
        { name: 'nombre',   label: 'Nombre',     type: 'text',     required: true },
        { name: 'email',    label: 'Email',      type: 'email',    required: true },
        { name: 'password', label: 'Contraseña', type: 'password', required: true },
        {
          name: 'rol',
          label: 'Rol',
          type: 'select',
          required: true,
          options: [
            { value: 'admin',        label: 'Administrador' },
            { value: 'super_editor', label: 'Super Editor'  },
            { value: 'editor',       label: 'Editor'        }
          ]
        }
      ],
      onSave: async (data) => {
        try {
          // ── Validar campos requeridos ──────────────────────────────
          if (!data.nombre?.trim()) {
            throw new Error('El nombre es obligatorio.');
          }
          const VALID_ROLES = ['admin', 'super_editor', 'editor'];
          if (!VALID_ROLES.includes(data.rol)) {
            throw new Error(`Rol no permitido: "${data.rol}". Valores válidos: admin, super_editor, editor.`);
          }

          // ── Obtener sesión activa del admin que ejecuta la acción ──
          const { data: sessionData } = await client.auth.getSession();
          const accessToken = sessionData?.session?.access_token;

          if (!accessToken) {
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          }

          // ── Construir URL de la Edge Function ─────────────────────
          const SUPABASE_URL = window.supabaseConfig?.url
            ?? 'https://kfvjansfmhamkrnbxmgp.supabase.co';
          const ANON_KEY = window.supabaseConfig?.anonKey ?? '';
          const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-admin-user`;

          // ── Llamar a la Edge Function ──────────────────────────────
          let response;
          try {
            response = await fetch(FUNCTION_URL, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey':        ANON_KEY,
              },
              body: JSON.stringify({
                email:    data.email,
                password: data.password,
                nombre:   data.nombre.trim(),
                rol:      data.rol,
              }),
            });
          } catch (networkErr) {
            throw new Error(`Error de red al contactar la Edge Function: ${networkErr.message}`);
          }

          // ── Parsear respuesta ──────────────────────────────────────
          let result;
          try {
            result = await response.json();
          } catch {
            throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}).`);
          }

          if (!response.ok || !result.success) {
            throw new Error(result.error ?? `Error ${response.status} al crear el usuario.`);
          }

          window.auditLogger?.crearUsuario(result.email ?? data.email);
          window.ErrorHandler?.showToast(
            `Usuario ${result.email} creado y activado correctamente.`,
            'success'
          );
          document.dispatchEvent(new CustomEvent('usuarios:updated'));

          // ── Enviar email de bienvenida (no bloquea si falla) ────────
          try {
            const WELCOME_URL = `${SUPABASE_URL}/functions/v1/send-welcome-email`;
            const welcomeRes  = await fetch(WELCOME_URL, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey':        ANON_KEY,
              },
              body: JSON.stringify({
                email:  data.email,
                nombre: data.email.split('@')[0],
                rol:    data.rol,
              }),
            });
            const welcomeResult = await welcomeRes.json().catch(() => ({}));
            if (welcomeRes.ok && welcomeResult.success) {
              console.log(`[UsuariosCRUD] Welcome email enviado (${welcomeResult.method}) → ${data.email}`);
              window.ErrorHandler?.showToast(
                `Email de bienvenida enviado a ${data.email}`,
                'success',
                'mail-check'
              );
            } else {
              console.warn('[UsuariosCRUD] Welcome email no enviado:', welcomeResult.error);
            }
          } catch (welcomeErr) {
            // No crítico — el usuario ya fue creado
            console.warn('[UsuariosCRUD] Welcome email error (no crítico):', welcomeErr);
          }

        } catch (err) {
          document.getElementById('errorTitle').textContent = 'Error al crear usuario';
          document.getElementById('errorDetail').textContent = err.message;
          document.getElementById('errorMessage').style.display = 'flex';
          return false; // señal a ModalManager: mantener modal abierto
        }
      }
    });

    // ModalManager crea el DOM síncronamente → el toggle ya puede conectarse
    setupPasswordToggle();
  }

  // ── Utilidad ───────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    const btn = document.getElementById('newUsuarioBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); openCreateModal(); });

    // ── CSV Import ─────────────────────────────────────────
    const csvBtn  = document.getElementById('csvImportBtn');
    const csvFile = document.getElementById('csvImportFile');
    if (csvBtn && csvFile) {
      csvBtn.addEventListener('click', () => csvFile.click());
      csvFile.addEventListener('change', () => {
        const file = csvFile.files?.[0];
        if (file) {
          window.csvImportManager?.importarUsuarios(file);
          csvFile.value = ''; // resetear para permitir reimportar el mismo archivo
        }
      });
    }

    document.addEventListener('usuarios:updated', loadUsuarios);

    document.querySelectorAll('[data-section="usuarios"]').forEach(navBtn => {
      navBtn.addEventListener('click', () => setTimeout(loadUsuarios, 60));
    });

    // ── Sort dropdown ──────────────────────────────────────
    window.sortManager?.registerTable('usuarios-table', [
      { label: 'Email A–Z',     field: 'email'      },
      { label: 'Rol',           field: 'rol'        },
      { label: 'Más recientes', field: 'created_at' },
    ], { field: 'email', direction: 'asc' });    // default = comportamiento actual
    window.sortManager?.mountDropdown('usuarios-table', () => loadUsuarios());

    // ── Select All checkbox ────────────────────────────────
    document.addEventListener('click', (e) => {
      if (e.target?.id === 'selectAllUsers') {
        const checked = e.target.checked;
        document.querySelectorAll('.select-user').forEach(cb => { cb.checked = checked; });
      }
    });

    console.log('👥 UsuariosCRUD listo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal, openEditModal, deleteUsuario, loadUsuarios, resetPasswordUsuario };
})();

window.UsuariosCRUD = UsuariosCRUD;
