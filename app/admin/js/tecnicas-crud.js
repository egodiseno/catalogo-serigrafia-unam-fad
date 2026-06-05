/**
 * PHASE 1.I: Técnicas CRUD
 */

const TecnicasCRUD = (() => {
  const client = window.supabase_client;

  function openCreateModal() {
    console.log('🔧 Abriendo modal técnicas...');
    
    if (!window.ModalManager) {
      alert('❌ ModalManager no cargado');
      return;
    }

    window.ModalManager.open({
      title: 'Nueva Técnica',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false }
      ],
      onSave: async (data) => {
        console.log('💾 Guardando técnica:', data);
        
        const { error } = await client
          .from('tecnicas')
          .insert([{
            nombre: data.nombre,
            slug: data.nombre.toLowerCase().replace(/\s+/g, '-'),
            descripcion: data.descripcion || ''
          }]);

        if (error) {
          console.error('❌ Error:', error);
          throw error;
        }

        console.log('✅ Técnica guardada');
        alert('✅ Técnica creada. Recargando...');
        
        // Recargar página para actualizar dropdown
        setTimeout(() => location.reload(), 500);
      }
    });
  }

  function init() {
    console.log('🔧 Inicializando TecnicasCRUD...');
    
    const btn = document.getElementById('newTecnicaBtn');
    
    if (btn) {
      console.log('✅ Botón encontrado, agregando listener...');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCreateModal();
      });
    } else {
      console.warn('⚠️  Botón newTecnicaBtn no encontrado en DOM');
    }
  }

  // Esperar a que DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal };
})();

window.TecnicasCRUD = TecnicasCRUD;
console.log('✅ TecnicasCRUD loaded');
