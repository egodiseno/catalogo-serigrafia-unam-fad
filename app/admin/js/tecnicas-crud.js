/**
 * PHASE 1.I: Técnicas CRUD
 */

const TecnicasCRUD = (() => {
  const client = window.supabase_client;

  async function init() {
    console.log('🔧 Técnicas CRUD loaded');

    const btn = document.getElementById('newTecnicaBtn');
    if (btn) {
      btn.addEventListener('click', openCreateModal);
    }
  }

  function openCreateModal() {
    window.ModalManager.open({
      title: 'Nueva Técnica',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false }
      ],
      onSave: async (data) => {
        const { error } = await client
          .from('tecnicas')
          .insert([{
            nombre: data.nombre,
            slug: data.nombre.toLowerCase().replace(/\s+/g, '-'),
            descripcion: data.descripcion
          }]);

        if (error) throw error;

        console.log('✅ Técnica creada');
        alert('Técnica creada exitosamente');
        location.reload();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openCreateModal };
})();

window.TecnicasCRUD = TecnicasCRUD;
