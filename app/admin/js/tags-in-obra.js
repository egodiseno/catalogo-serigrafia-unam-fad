/**
 * tags-in-obra.js — Tags (N:M) en formulario de obra
 * UX v2: selector visual de pills (reemplaza búsqueda + dropdown)
 *
 * Depende de: config.js (window.supabase_client)
 * Expone:     window.TagsInObra
 *
 * API pública:
 *   addTag(id, nombre)   — selecciona un pill (usado al cargar obra para edición)
 *   removeTag(id)        — deselecciona un pill
 *   saveTags(obraId)     — persiste en obra_tags (DELETE + INSERT)
 *   getTags()            — devuelve array de tags seleccionados
 *   reset()              — deselecciona todos los pills
 *   loadAllTags()        — recarga caché desde BD
 *   setInitialTags([])   — carga selección inicial y re-renderiza
 *   setAllowCreate(bool) — no-op (compatibilidad, ya sin UI de creación)
 */

const TagsInObra = (() => {
  const client     = window.supabase_client;
  let selectedTags = [];
  let allTags      = [];

  // ══════════════════════════════════════════════════════
  // Cargar todos los tags de la BD
  // ══════════════════════════════════════════════════════

  async function loadAllTags() {
    try {
      const { data, error } = await client
        .from('tags')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      allTags = data ?? [];
    } catch (err) {
      console.error('TagsInObra.loadAllTags:', err);
    }
  }

  // ══════════════════════════════════════════════════════
  // Renderizar todos los tags como pills interactivos
  // ══════════════════════════════════════════════════════

  function renderTagPills() {
    const container = document.getElementById('tagPillsContainer');
    if (!container) return;

    if (!allTags.length) {
      container.innerHTML = '<span class="field-hint">No hay tags disponibles.</span>';
      return;
    }

    container.innerHTML = allTags.map(tag => {
      const sel = !!selectedTags.find(t => t.id === tag.id);
      return `
        <label class="tag-pill-label${sel ? ' tag-pill--selected' : ''}"
               data-tag-id="${esc(tag.id)}">
          <input type="checkbox"
                 class="tag-pill-checkbox sr-only"
                 data-tag-id="${esc(tag.id)}"
                 data-tag-nombre="${esc(tag.nombre)}"
                 ${sel ? 'checked' : ''}>
          <span class="tag-pill-text">${esc(tag.nombre)}</span>
        </label>`;
    }).join('');

    container.querySelectorAll('.tag-pill-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const tagId  = cb.dataset.tagId;
        const nombre = cb.dataset.tagNombre;
        const label  = cb.closest('.tag-pill-label');
        if (cb.checked) {
          if (!selectedTags.find(t => t.id === tagId)) {
            selectedTags.push({ id: tagId, nombre });
          }
          label?.classList.add('tag-pill--selected');
        } else {
          selectedTags = selectedTags.filter(t => t.id !== tagId);
          label?.classList.remove('tag-pill--selected');
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════
  // addTag — selecciona programáticamente (al cargar obra)
  // ══════════════════════════════════════════════════════

  function addTag(tagId, tagName) {
    if (selectedTags.find(t => t.id === tagId)) return;
    selectedTags.push({ id: tagId, nombre: tagName });
    // Actualizar pill en DOM si ya está renderizado
    const cb = document.querySelector(`.tag-pill-checkbox[data-tag-id="${tagId}"]`);
    if (cb) {
      cb.checked = true;
      cb.closest('.tag-pill-label')?.classList.add('tag-pill--selected');
    }
  }

  // ══════════════════════════════════════════════════════
  // removeTag
  // ══════════════════════════════════════════════════════

  function removeTag(tagId) {
    selectedTags = selectedTags.filter(t => t.id !== tagId);
    const cb = document.querySelector(`.tag-pill-checkbox[data-tag-id="${tagId}"]`);
    if (cb) {
      cb.checked = false;
      cb.closest('.tag-pill-label')?.classList.remove('tag-pill--selected');
    }
  }

  // ══════════════════════════════════════════════════════
  // saveTags — persiste en BD (DELETE previos + INSERT nuevos)
  // ══════════════════════════════════════════════════════

  async function saveTags(obraId) {
    try {
      await client.from('obra_tags').delete().eq('obra_id', obraId);
      if (selectedTags.length === 0) return { success: true };
      const rows = selectedTags.map(t => ({ obra_id: obraId, tag_id: t.id }));
      const { error } = await client.from('obra_tags').insert(rows);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('TagsInObra.saveTags:', err);
      return { success: false, error: err.message };
    }
  }

  // ══════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════

  function getTags() { return [...selectedTags]; }

  // Reset al abrir / cerrar modal
  function reset() {
    selectedTags = [];
    document.querySelectorAll('.tag-pill-checkbox').forEach(cb => {
      cb.checked = false;
      cb.closest('.tag-pill-label')?.classList.remove('tag-pill--selected');
    });
  }

  // Carga selección inicial y re-renderiza (usado por setInitialTags)
  function setInitialTags(tagsArray) {
    selectedTags = tagsArray ?? [];
    renderTagPills();
  }

  // No-op — compatibilidad con código que llamaba setAllowCreate()
  // (ya no hay UI de creación de tags en el formulario)
  function setAllowCreate() {}

  function esc(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // ══════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════

  async function init() {
    await loadAllTags();
    renderTagPills();
    // Refrescar pills cuando se creen / eliminen tags desde la sección Tags
    document.addEventListener('tags:updated', async () => {
      await loadAllTags();
      renderTagPills();
    });
    console.log(`🏷️  TagsInObra listo — ${allTags.length} tags disponibles`);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    addTag,
    removeTag,
    saveTags,
    getTags,
    reset,
    loadAllTags,
    setInitialTags,
    setAllowCreate,
  };
})();

window.TagsInObra = TagsInObra;
