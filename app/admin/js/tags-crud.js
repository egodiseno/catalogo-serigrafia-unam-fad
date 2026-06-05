/**
 * PHASE 1.J: Tags CRUD
 */

const TagsCRUD = (() => {
  const client = window.supabase_client;

  function openCreateModal() {
    console.log('🏷️  Abriendo modal tags...');
    
    if (!window.ModalManager) {
      alert('❌ ModalManager no cargado');
      return;
    }

    window.ModalManager.open({
      title: 'Nuevo Tag',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'slug', label: 'Slug', type: 'text', required: true }
      ],
      onSave: async (data) => {
        console.log('💾 Guardando tag:', data);
        
        const { error } = await client
          .from('tags')
          .insert([{
            nombre: data.nombre,
            slug: data.slug
          }]);

        if (error) {
          console.error('❌ Error:', error);
          throw error;
        }

        console.log('✅ Tag guardado');
        alert('✅ Tag creado. Recargando...');
        
        setTimeout(() => location.reload(), 500);
      }
    });
  }

  function init() {
    console.log('🏷️  Inicializando TagsCRUD...');
    
    const btn = document.getElementById('newTagBtn');
    
    if (btn) {
      console.log('✅ Botón encontrado, agregando listener...');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCreateModal();
      });
    } else {
      console.warn('⚠️  Botón newTagBtn no encontrado');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal };
})();

window.TagsCRUD = TagsCRUD;
console.log('✅ TagsCRUD loaded');
