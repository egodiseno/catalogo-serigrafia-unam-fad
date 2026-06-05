/**
 * usuarios-crud.js — CRUD de Usuarios Admin
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-06 (sin alert)
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.UsuariosCRUD
 *
 * NOTA: La creación usa supabase.auth.signUp() (anon key).
 *       El usuario recibirá un email de confirmación antes de poder ingresar.
 */

const UsuariosCRUD = (() => {
  const client = window.supabase_client;

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

      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay usuarios registrados.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(u => `
        <tr>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="badge badge-${escapeHtml(u.rol)}">${escapeHtml(u.rol)}</span></td>
          <td>
            <span class="badge ${u.estado ? 'badge-publicado' : 'badge-archivado'}">
              ${u.estado ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-danger"
                    data-del-id="${u.id}"
                    data-del-email="${escapeHtml(u.email)}">Eliminar</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteUsuario(btn.dataset.delId, btn.dataset.delEmail));
      });

    } catch (err) {
      console.error('loadUsuarios:', err);
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error al cargar usuarios.</td></tr>';
    }
  }

  // ── Eliminar usuario ───────────────────────────────────
  async function deleteUsuario(id, email) {
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

        // Registrar en la tabla de admins
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

  return { openCreateModal, loadUsuarios };
})();

window.UsuariosCRUD = UsuariosCRUD;
