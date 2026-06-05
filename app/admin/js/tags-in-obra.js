/**
 * PHASE 1.H: Tags en Formulario Obra
 * Maneja tags (N:M) en crear/editar obra
 */

const TagsInObra = (() => {
  const client = window.supabase_client;
  let selectedTags = [];

  async function init() {
    console.log('🏷️  Tags in obra module loaded');
    await loadTags();
  }

  async function loadTags() {
    try {
      const { data, error } = await client
        .from('tags')
        .select('id, nombre')
        .order('nombre');

      if (error) throw error;

      const tagSelect = document.getElementById('tagSelect');
      if (!tagSelect) return;

      tagSelect.innerHTML = '<option value="">-- Seleccionar tag --</option>';

      data.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.nombre;
        tagSelect.appendChild(option);
      });

      console.log(`✅ ${data.length} tags cargados`);
    } catch (error) {
      console.error('❌ Error loading tags:', error);
    }
  }

  function addTag(tagId, tagName) {
    if (selectedTags.find(t => t.id === tagId)) {
      alert('Tag ya agregado');
      return;
    }

    selectedTags.push({ id: tagId, nombre: tagName });
    updateTagsUI();
  }

  function removeTag(tagId) {
    selectedTags = selectedTags.filter(t => t.id !== tagId);
    updateTagsUI();
  }

  function updateTagsUI() {
    const container = document.getElementById('selectedTagsList');
    if (!container) return;

    container.innerHTML = '';

    selectedTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        ${tag.nombre}
        <button type="button" data-tag-id="${tag.id}" class="removeTagBtn">✕</button>
      `;
      container.appendChild(chip);

      chip.querySelector('.removeTagBtn').addEventListener('click', (e) => {
        e.preventDefault();
        removeTag(tag.id);
      });
    });
  }

  async function saveTags(obraId) {
    try {
      if (selectedTags.length === 0) return { success: true };

      // Eliminar tags antiguos
      await client
        .from('obra_tags')
        .delete()
        .eq('obra_id', obraId);

      // Insertar nuevos tags
      const data = selectedTags.map(tag => ({
        obra_id: obraId,
        tag_id: tag.id,
      }));

      const { error } = await client
        .from('obra_tags')
        .insert(data);

      if (error) throw error;

      console.log(`✅ ${selectedTags.length} tags guardados`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving tags:', error);
      return { success: false, error: error.message };
    }
  }

  function getTags() {
    return selectedTags;
  }

  function reset() {
    selectedTags = [];
    updateTagsUI();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { addTag, removeTag, saveTags, getTags, reset, loadTags };
})();

window.TagsInObra = TagsInObra;
console.log('✅ Tags in obra module ready');
