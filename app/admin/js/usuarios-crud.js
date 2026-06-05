/**
 * PHASE 1.K: Usuarios CRUD
 */

const UsuariosCRUD = (() => {
  const client = window.supabase_client;

  async function init() {
    console.log('👥 Usuarios CRUD loaded');

    const btn = document.getElementById('newUsuarioBtn');
    if (btn) {
      btn.addEventListener('click', openCreateModal);
    }
  }

  function openCreateModal() {
    window.ModalManager.open({
      title: 'Nuevo Usuario Admin',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { 
          name: 'rol', 
          label: 'Rol', 
          type: 'select', 
          required: true,
          options: [
            { value: 'admin', label: 'Admin' },
            { value: 'editor', label: 'Editor' },
            { value: 'viewer', label: 'Viewer' }
          ]
        }
      ],
      onSave: async (data) => {
        // Crear en Supabase Auth
        const { data: authData, error: authError } = await client.auth.admin.createUser({
          email: data.email,
          password: Math.random().toString(36).substring(7) + 'Temp123!',
          email_confirm: true
        });

        if (authError) throw authError;

        // Guardar en tabla usuarios_admin
        const { error } = await client
          .from('usuarios_admin')
          .insert([{
            id: authData.user.id,
            email: data.email,
            rol: data.rol,
            estado: true
          }]);

        if (error) throw error;

        console.log('✅ Usuario creado');
        alert('Usuario creado. Se envió email de invitación.');
        location.reload();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openCreateModal };
})();

window.UsuariosCRUD = UsuariosCRUD;
