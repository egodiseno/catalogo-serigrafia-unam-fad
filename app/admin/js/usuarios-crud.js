/**
 * PHASE 1.K: Usuarios CRUD
 */

const UsuariosCRUD = (() => {
  const client = window.supabase_client;

  function openCreateModal() {
    console.log('👥 Abriendo modal usuarios...');
    
    if (!window.ModalManager) {
      alert('❌ ModalManager no cargado');
      return;
    }

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
        console.log('💾 Guardando usuario:', data);
        
        try {
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

          console.log('✅ Usuario guardado');
          alert('✅ Usuario creado. Se envió email de invitación.');
          
          setTimeout(() => location.reload(), 500);
        } catch (error) {
          console.error('❌ Error:', error);
          throw error;
        }
      }
    });
  }

  function init() {
    console.log('👥 Inicializando UsuariosCRUD...');
    
    const btn = document.getElementById('newUsuarioBtn');
    
    if (btn) {
      console.log('✅ Botón encontrado, agregando listener...');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCreateModal();
      });
    } else {
      console.warn('⚠️  Botón newUsuarioBtn no encontrado');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal };
})();

window.UsuariosCRUD = UsuariosCRUD;
console.log('✅ UsuariosCRUD loaded');
