/**
 * tags-in-obra.js — Tags (N:M) en formulario de obra
 * UX v2: selector visual de pills + límite MAX_TAGS + creación inline
 *
 * Depende de: config.js (window.supabase_client)
 * Expone:     window.TagsInObra
 *
 * API pública:
 *   addTag(id, nombre)        — selecciona un pill (usado al cargar obra para edición)
 *   removeTag(id)             — deselecciona un pill
 *   saveTags(obraId)          — persiste en obra_tags (DELETE + INSERT)
 *   getTags()                 — devuelve array de tags seleccionados
 *   reset()                   — deselecciona todos los pills
 *   loadAllTags()             — recarga caché desde BD
 *   setInitialTags([])        — carga selección inicial y re-renderiza
 *   setAllowCreate(bool)      — muestra/oculta botón "+ Crear tag" (ADMIN / SUPER_EDITOR)
 */

const TagsInObra = (() => {
  const client     = window.supabase_client;
  let selectedTags = [];
  let allTags      = [];

  const MAX_TAGS = 3;

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
  // _syncUI — actualiza contador y estado de pills
  // ══════════════════════════════════════════════════════

  function _syncUI() {
    const count     = selectedTags.length;
    const atLimit   = count >= MAX_TAGS;
    const container = document.getElementById('tagPillsContainer');
    const counter   = document.getElementById('tagCounter');

    // Actualizar contador
    if (counter) {
      counter.textContent = `${count} de ${MAX_TAGS}`;
      counter.classList.toggle('at-limit', atLimit);
    }

    // Deshabilitar pills no seleccionados cuando se alcanza el límite
    if (container) {
      container.classList.toggle('tag-pills-container--at-limit', atLimit);
      container.querySelectorAll('.tag-pill-checkbox').forEach(cb => {
        if (!cb.checked) {
          cb.disabled = atLimit;
          cb.closest('.tag-pill-label')?.classList.toggle('tag-pill--disabled', atLimit);
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // Renderizar todos los tags como pills interactivos
  // ══════════════════════════════════════════════════════

  function renderTagPills() {
    const container = document.getElementById('tagPillsContainer');
    if (!container) return;

    const atLimit = selectedTags.length >= MAX_TAGS;

    if (!allTags.length) {
      container.innerHTML = '<span class="field-hint">No hay tags disponibles.</span>';
      _syncUI();
      return;
    }

    container.innerHTML = allTags.map(tag => {
      const sel      = !!selectedTags.find(t => t.id === tag.id);
      const disabled = !sel && atLimit;
      return `
        <label class="tag-pill-label${sel ? ' tag-pill--selected' : ''}${disabled ? ' tag-pill--disabled' : ''}"
               data-tag-id="${esc(tag.id)}">
          <input type="checkbox"
                 class="tag-pill-checkbox sr-only"
                 data-tag-id="${esc(tag.id)}"
                 data-tag-nombre="${esc(tag.nombre)}"
                 ${sel      ? 'checked'  : ''}
                 ${disabled ? 'disabled' : ''}>
          <span class="tag-pill-text">${esc(tag.nombre)}</span>
        </label>`;
    }).join('');

    container.querySelectorAll('.tag-pill-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const tagId  = cb.dataset.tagId;
        const nombre = cb.dataset.tagNombre;
        const label  = cb.closest('.tag-pill-label');

        if (cb.checked) {
          // Comprobar límite antes de aceptar
          if (selectedTags.length >= MAX_TAGS) {
            cb.checked = false;                 // revertir
            window.ErrorHandler?.showToast(`Máximo ${MAX_TAGS} tags por obra`, 'warning');
            return;
          }
          if (!selectedTags.find(t => t.id === tagId)) {
            selectedTags.push({ id: tagId, nombre });
          }
          label?.classList.add('tag-pill--selected');
        } else {
          selectedTags = selectedTags.filter(t => t.id !== tagId);
          label?.classList.remove('tag-pill--selected');
        }

        _syncUI();
      });
    });

    _syncUI();
  }

  // ══════════════════════════════════════════════════════
  // addTag — selecciona programáticamente (al cargar obra)
  // ══════════════════════════════════════════════════════

  function addTag(tagId, tagName) {
    if (selectedTags.find(t => t.id === tagId)) return;
    if (selectedTags.length >= MAX_TAGS) return;   // respetar límite también programáticamente
    selectedTags.push({ id: tagId, nombre: tagName });
    // Actualizar pill en DOM si ya está renderizado
    const cb = document.querySelector(`.tag-pill-checkbox[data-tag-id="${tagId}"]`);
    if (cb) {
      cb.checked = true;
      cb.closest('.tag-pill-label')?.classList.add('tag-pill--selected');
    }
    _syncUI();
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
    _syncUI();
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
      cb.checked  = false;
      cb.disabled = false;
      cb.closest('.tag-pill-label')?.classList.remove('tag-pill--selected', 'tag-pill--disabled');
    });
    _syncUI();
  }

  // Carga selección inicial y re-renderiza
  function setInitialTags(tagsArray) {
    selectedTags = tagsArray ?? [];
    renderTagPills();
  }

  // Muestra u oculta el botón "+ Crear tag" según rol
  function setAllowCreate(allow) {
    const btn = document.getElementById('btnCrearTagInline');
    if (btn) btn.style.display = allow ? '' : 'none';
    // Si se oculta mientras el formulario inline está abierto, cerrarlo
    if (!allow) _hideInlineTagForm();
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // ══════════════════════════════════════════════════════
  // Creación de tag inline
  // ══════════════════════════════════════════════════════

  function _showInlineTagForm() {
    const form  = document.getElementById('inlineTagForm');
    const input = document.getElementById('inlineTagInput');
    if (!form) return;
    form.style.display = 'flex';
    input?.focus();
  }

  function _hideInlineTagForm() {
    const form  = document.getElementById('inlineTagForm');
    const input = document.getElementById('inlineTagInput');
    if (!form) return;
    form.style.display = 'none';
    if (input) input.value = '';
  }

  async function _createTagInline() {
    const input  = document.getElementById('inlineTagInput');
    const nombre = input?.value.trim();

    if (!nombre) {
      window.ErrorHandler?.showToast('Escribe un nombre para el tag', 'warning');
      input?.focus();
      return;
    }

    const confirmBtn = document.getElementById('btnConfirmTagInline');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Creando…'; }

    try {
      const { data, error } = await client
        .from('tags')
        .insert({ nombre })
        .select('id, nombre')
        .single();

      if (error) {
        // Posible duplicado (restricción UNIQUE)
        if (error.code === '23505') {
          window.ErrorHandler?.showToast(`El tag "${nombre}" ya existe`, 'warning');
        } else {
          throw error;
        }
        return;
      }

      // Agregar al caché local sin recargar toda la lista
      allTags.push(data);
      allTags.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      // Re-renderizar pills con el nuevo tag
      renderTagPills();

      // Auto-seleccionar si no se supera el límite
      if (selectedTags.length < MAX_TAGS) {
        addTag(data.id, data.nombre);
        renderTagPills();
      } else {
        window.ErrorHandler?.showToast(`Tag "${nombre}" creado — selecciona manualmente cuando haya espacio`, 'info');
      }

      _hideInlineTagForm();
      window.ErrorHandler?.showToast(`Tag "${nombre}" creado`, 'success');

      // Notificar a la sección de Tags para que actualice su tabla
      document.dispatchEvent(new CustomEvent('tags:updated'));

    } catch (err) {
      console.error('TagsInObra._createTagInline:', err);
      window.ErrorHandler?.showToast('Error al crear el tag', 'error');
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Crear'; }
    }
  }

  // ══════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════

  async function init() {
    await loadAllTags();
    renderTagPills();

    // ── Botón "+ Crear tag" ──────────────────────────────
    document.getElementById('btnCrearTagInline')?.addEventListener('click', _showInlineTagForm);

    // ── Botón confirmar inline ───────────────────────────
    document.getElementById('btnConfirmTagInline')?.addEventListener('click', _createTagInline);

    // ── Botón cancelar inline ────────────────────────────
    document.getElementById('btnCancelTagInline')?.addEventListener('click', _hideInlineTagForm);

    // ── Enter en el input del inline form ───────────────
    document.getElementById('inlineTagInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); _createTagInline(); }
      if (e.key === 'Escape') _hideInlineTagForm();
    });

    // Refrescar pills cuando se creen / eliminen tags desde la sección Tags
    document.addEventListener('tags:updated', async () => {
      await loadAllTags();
      renderTagPills();
    });

    console.log(`🏷️  TagsInObra listo — ${allTags.length} tags disponibles (máx. ${MAX_TAGS} por obra)`);
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
