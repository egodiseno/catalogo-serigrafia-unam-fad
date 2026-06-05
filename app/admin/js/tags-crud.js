/**
 * PHASE 1.J: Tags CRUD
 */

const TagsCRUD = (() => {
  const client = window.supabase_client;

  async function init() {
    console.log('🏷️  Tags CRUD loaded');

    const btn = document.getElementById('newTagBtn');
    if (btn) {
      btn.addEventListener('click', openCreateModal);
    }
  }

  function openCreateModal() {
    window.ModalManager.open({
      title: 'Nuevo Tag',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'slug', label: 'Slug', type: 'text', required: true }
      ],
      onSave: async (data) => {
        const { error } = await client
          .from('tags')
          .insert([{
            nombre: data.nombre,
            slug: data.slug
          }]);

        if (error) throw error;

        console.log('✅ Tag creado');
        alert('Tag creado exitosamente');
        location.reload();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openCreateModal };
})();

window.TagsCRUD = TagsCRUD;
