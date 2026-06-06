/**
 * tags-crud.js — CRUD de Tags
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-04 (slug auto), ISSUE-06 (sin alert)
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.TagsCRUD
 */

const TagsCRUD = (() => {
  const client = window.supabase_client;

  // ── Cargar y renderizar lista de tags ──────────────────
  async function loadTagsTable() {
    const tbody = document.getElementById('tagsList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Cargando…</td></tr>';

    try {
      const { data, error } = await client
        .from('tags')
        .select('id, nombre, slug')
        .order('nombre');
      if (error) throw error;

      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state">
          Sin tags. <a href="#" class="cta-link"
            onclick="window.TagsCRUD?.openCreateModal(); return false">Crear primer tag →</a>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(t => `
        <tr>
          <td>${escapeHtml(t.nombre)}</td>
          <td><code>${escapeHtml(t.slug)}</code></td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-danger"
                    data-del-id="${t.id}"
                    data-del-nombre="${escapeHtml(t.nombre)}">Eliminar</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteTag(btn.dataset.delId, btn.dataset.delNombre));
      });

    } catch (err) {
      console.error('loadTagsTable:', err);
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Error al cargar tags.</td></tr>';
    }
  }

  // ── Eliminar tag ───────────────────────────────────────
  async function deleteTag(id, nombre) {
    if (!confirm(`¿Eliminar el tag "${nombre}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      const { error } = await client.from('tags').delete().eq('id', id);
      if (error) throw error;
      window.ErrorHandler?.showToast(`Tag "${nombre}" eliminado`, 'success');
      document.dispatchEvent(new CustomEvent('tags:updated'));
    } catch (err) {
      console.error('deleteTag:', err);
      window.ErrorHandler?.showToast('No se pudo eliminar el tag.', 'error');
    }
  }

  // ── Abrir modal de creación ────────────────────────────
  function openCreateModal() {
    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: 'Nuevo Tag',
      fields: [
        // ISSUE-04: solo campo nombre, slug se genera automáticamente
        { name: 'nombre', label: 'Nombre', type: 'text', required: true }
      ],
      onSave: async (data) => {
        // ISSUE-04: auto-generar slug con normalización de acentos
        const slug = data.nombre
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/\s+/g, '-');

        const { error } = await client.from('tags').insert([{
          nombre: data.nombre.trim(),
          slug
        }]);

        if (error) throw error;

        window.ErrorHandler?.showToast('✅ Tag creado correctamente', 'success');
        document.dispatchEvent(new CustomEvent('tags:updated'));
      }
    });
  }

  // ── Utilidad ───────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    const btn = document.getElementById('newTagBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); openCreateModal(); });

    // Recargar lista cuando hay cambios
    document.addEventListener('tags:updated', loadTagsTable);

    // Cargar cuando el usuario navega a la sección
    document.querySelectorAll('[data-section="tags"]').forEach(navBtn => {
      navBtn.addEventListener('click', () => setTimeout(loadTagsTable, 60));
    });

    console.log('🏷️  TagsCRUD listo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal, loadTagsTable };
})();

window.TagsCRUD = TagsCRUD;
