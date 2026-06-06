/**
 * usuarios-crud.js — CRUD de Usuarios Admin
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-06 (sin alert)
 * SPRINT3: ISSUE-15 — documenta deuda técnica en creación de usuarios
 * FASE1.I: openEditModal (rol/estado), guard "último admin"
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.UsuariosCRUD
 *
 * ──────────────────────────────────────────────────────────────────
 * ⚠️  DEUDA TÉCNICA — Creación de usuarios:
 *
 * Se usa `supabase.auth.signUp()` con la anon key (SPRINT 1 fix).
 * Esto funciona pero tiene limitaciones:
 *
 *  1. El nuevo usuario recibe un email de confirmación; no puede
 *     iniciar sesión hasta confirmar su dirección.
 *  2. No es posible asignar una contraseña temporal sin que el
 *     usuario la reciba por email.
 *  3. `auth.admin.createUser()` (la alternativa que no requiere
 *     confirmación) exige la SERVICE ROLE KEY — nunca debe
 *     exponerse en el frontend.
 *
 * TODO para producción:
 *  → Crear una Supabase Edge Function que reciba email + rol y
 *    llame a `auth.admin.inviteUserByEmail()` usando la service
 *    role key en el servidor.
 *  → Refs: https://supabase.com/docs/guides/functions
 *          https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
 * ──────────────────────────────────────────────────────────────────
 */

const UsuariosCRUD = (() => {
  const client = window.supabase_client;
  let usuariosData = [];   // caché local para guards y edición

  // ── Cargar y renderizar lista de usuarios ──────────────
  async function loadUsuarios() {
    const tbody = document.getElementById('usuariosList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Cargando…</td></tr>';

    try {
      const { data, error } = await client
        .from('usuarios_admin')
        .select('id, email, rol, estado')
        .order('email');
      if (error) throw error;

      usuariosData = data ?? [];

      if (usuariosData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
          Sin usuarios. <a href="#" class="cta-link"
            onclick="window.UsuariosCRUD?.openCreateModal(); return false">Invitar primero →</a>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = usuariosData.map(u => `
        <tr>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="badge badge-${escapeHtml(u.rol)}">${escapeHtml(u.rol)}</span></td>
          <td>
            <span class="badge ${u.estado ? 'badge-publicado' : 'badge-archivado'}">
              ${u.estado ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-secondary"
                    data-edit-id="${u.id}" title="Editar">✏️ Editar</button>
            <button class="btn btn-sm btn-danger"
                    data-del-id="${u.id}"
                    data-del-email="${escapeHtml(u.email)}" title="Eliminar">🗑️</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.editId));
      });
      tbody.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteUsuario(btn.dataset.delId, btn.dataset.delEmail));
      });

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
            { value: 'admin',  label: 'Admin'  },
            { value: 'editor', label: 'Editor' },
            { value: 'viewer', label: 'Viewer' }
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

        window.ErrorHandler?.showToast('✅ Usuario actualizado', 'success');
        document.dispatchEvent(new CustomEvent('usuarios:updated'));
      }
    });
  }

  // ── Eliminar usuario (con guard de último admin) ───────
  async function deleteUsuario(id, email) {
    // Guard: no eliminar el último admin
    const admins = usuariosData.filter(u => u.rol === 'admin');
    const target  = usuariosData.find(u => u.id === id);
    if (target?.rol === 'admin' && admins.length <= 1) {
      window.ErrorHandler?.showToast('No se puede eliminar el último administrador', 'error');
      return;
    }

    if (!confirm(`¿Eliminar el usuario "${email}"?\nEsta acción no se puede deshacer.`)) return;

    try {
      const { error } = await client.from('usuarios_admin').delete().eq('id', id);
      if (error) throw error;
      window.ErrorHandler?.showToast(`Usuario "${email}" eliminado`, 'success');
      document.dispatchEvent(new CustomEvent('usuarios:updated'));
    } catch (err) {
      console.error('deleteUsuario:', err);
      window.ErrorHandler?.showToast('No se pudo eliminar el usuario.', 'error');
    }
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
        { name: 'email',    label: 'Email',      type: 'email', required: true },
        { name: 'password', label: 'Contraseña', type: 'text',  required: true },
        {
          name: 'rol',
          label: 'Rol',
          type: 'select',
          required: true,
          options: [
            { value: 'admin',  label: 'Admin'  },
            { value: 'editor', label: 'Editor' },
            { value: 'viewer', label: 'Viewer' }
          ]
        }
      ],
      onSave: async (data) => {
        // Crear usuario en Supabase Auth (funciona con anon key)
        const { data: authData, error: authError } = await client.auth.signUp({
          email:    data.email,
          password: data.password
        });

        if (authError) throw authError;
        if (!authData?.user) throw new Error('No se pudo obtener el ID del usuario creado.');

        const { error } = await client.from('usuarios_admin').insert([{
          id:     authData.user.id,
          email:  data.email,
          rol:    data.rol,
          estado: true
        }]);

        if (error) throw error;

        window.ErrorHandler?.showToast(
          '✅ Usuario creado. Se envió email de confirmación al correo registrado.',
          'success'
        );
        document.dispatchEvent(new CustomEvent('usuarios:updated'));
      }
    });
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

    document.addEventListener('usuarios:updated', loadUsuarios);

    document.querySelectorAll('[data-section="usuarios"]').forEach(navBtn => {
      navBtn.addEventListener('click', () => setTimeout(loadUsuarios, 60));
    });

    console.log('👥 UsuariosCRUD listo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal, openEditModal, deleteUsuario, loadUsuarios };
})();

window.UsuariosCRUD = UsuariosCRUD;
