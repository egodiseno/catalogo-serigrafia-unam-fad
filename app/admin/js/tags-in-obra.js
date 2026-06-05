/**
 * tags-in-obra.js — Tags (N:M) en formulario de obra
 * SPRINT1: ISSUE-05 (search UI con dropdown), ISSUE-06 (sin alert)
 *
 * Depende de: config.js (window.supabase_client), error-handler.js
 * Expone:     window.TagsInObra
 */

const TagsInObra = (() => {
  const client = window.supabase_client;
  let selectedTags = [];
  let allTags      = [];          // caché local de todos los tags

  // ── Cargar todos los tags de la BD ─────────────────────
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

  // ── Configurar la UI de búsqueda ───────────────────────
  function setupSearchUI() {
    const input    = document.getElementById('tagSearchInput');
    const dropdown = document.getElementById('tagSuggestionsDropdown');
    const btnNuevo = document.getElementById('btnNuevoTagInline');

    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      q ? renderDropdown(q, input, dropdown) : (dropdown.style.display = 'none');
    });

    input.addEventListener('focus', () => {
      const q = input.value.trim();
      if (q) renderDropdown(q, input, dropdown);
    });

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', e => {
      if (!e.target.closest('.tag-search-wrapper')) {
        dropdown.style.display = 'none';
      }
    });

    // Botón "+ Nuevo tag": crear con el texto actual del input
    if (btnNuevo) {
      btnNuevo.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) {
          window.ErrorHandler?.showToast('Escribe el nombre del tag primero', 'warning');
          input.focus();
          return;
        }
        await createAndAddTag(name, input, dropdown);
      });
    }
  }

  // ── Renderizar dropdown de sugerencias ─────────────────
  function renderDropdown(query, input, dropdown) {
    const q        = query.toLowerCase();
    const filtered = allTags.filter(t =>
      t.nombre.toLowerCase().includes(q) &&
      !selectedTags.find(s => s.id === t.id)
    );
    const exactMatch = allTags.some(t => t.nombre.toLowerCase() === q);

    let html = filtered.map(t => `
      <div class="tag-suggestion-item" data-id="${t.id}" data-nombre="${escapeHtml(t.nombre)}">
        ${escapeHtml(t.nombre)}
      </div>
    `).join('');

    if (!exactMatch) {
      html += `
        <div class="tag-suggestion-create">
          + Crear «${escapeHtml(query)}»
        </div>
      `;
    }

    if (!html) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.tag-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        addTag(item.dataset.id, item.dataset.nombre);
        input.value = '';
        dropdown.style.display = 'none';
      });
    });

    dropdown.querySelector('.tag-suggestion-create')?.addEventListener('click', async () => {
      await createAndAddTag(query, input, dropdown);
    });
  }

  // ── Crear tag en BD y agregarlo a la selección ─────────
  async function createAndAddTag(name, input, dropdown) {
    try {
      const slug = name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-');

      const { data, error } = await client
        .from('tags')
        .insert([{ nombre: name.trim(), slug }])
        .select('id, nombre')
        .single();

      if (error) throw error;

      // Actualizar caché local
      allTags.push(data);
      allTags.sort((a, b) => a.nombre.localeCompare(b.nombre));

      addTag(data.id, data.nombre);

      if (input)    input.value = '';
      if (dropdown) dropdown.style.display = 'none';

      window.ErrorHandler?.showToast(`Tag «${data.nombre}» creado y agregado`, 'success');
      document.dispatchEvent(new CustomEvent('tags:updated'));
    } catch (err) {
      console.error('createAndAddTag:', err);
      window.ErrorHandler?.showToast('No se pudo crear el tag', 'error');
    }
  }

  // ── Agregar tag a la selección ─────────────────────────
  function addTag(tagId, tagName) {
    if (selectedTags.find(t => t.id === tagId)) {
      window.ErrorHandler?.showToast('Este tag ya fue agregado', 'warning');
      return;
    }
    selectedTags.push({ id: tagId, nombre: tagName });
    renderChips();
  }

  // ── Quitar tag de la selección ─────────────────────────
  function removeTag(tagId) {
    selectedTags = selectedTags.filter(t => t.id !== tagId);
    renderChips();
  }

  // ── Renderizar chips de tags seleccionados ─────────────
  function renderChips() {
    const container = document.getElementById('selectedTagsList');
    if (!container) return;
    container.innerHTML = '';
    selectedTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        ${escapeHtml(tag.nombre)}
        <button type="button" data-tag-id="${tag.id}" class="removeTagBtn"
                aria-label="Quitar tag ${escapeHtml(tag.nombre)}">✕</button>
      `;
      container.appendChild(chip);
      chip.querySelector('.removeTagBtn').addEventListener('click', e => {
        e.preventDefault();
        removeTag(tag.id);
      });
    });
  }

  // ── Guardar tags en BD (delete + insert) ───────────────
  async function saveTags(obraId) {
    try {
      // Siempre eliminar los anteriores (permite limpiar todos)
      await client.from('obra_tags').delete().eq('obra_id', obraId);

      if (selectedTags.length === 0) return { success: true };

      const rows = selectedTags.map(t => ({ obra_id: obraId, tag_id: t.id }));
      const { error } = await client.from('obra_tags').insert(rows);
      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error('saveTags:', err);
      return { success: false, error: err.message };
    }
  }

  function getTags() { return selectedTags; }

  // ── Reset completo (al abrir/cerrar modal) ─────────────
  function reset() {
    selectedTags = [];
    renderChips();
    const input = document.getElementById('tagSearchInput');
    if (input) input.value = '';
    const dropdown = document.getElementById('tagSuggestionsDropdown');
    if (dropdown) dropdown.style.display = 'none';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ───────────────────────────────────────────────
  async function init() {
    await loadAllTags();
    setupSearchUI();
    // Refrescar caché cuando se crea un tag desde tags-crud
    document.addEventListener('tags:updated', loadAllTags);
    console.log(`🏷️  TagsInObra listo (${allTags.length} tags en caché)`);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { addTag, removeTag, saveTags, getTags, reset, loadAllTags };
})();

window.TagsInObra = TagsInObra;
