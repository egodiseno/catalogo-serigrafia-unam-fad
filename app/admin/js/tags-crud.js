/**
 * tags-crud.js — CRUD de Tags
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-04 (slug auto), ISSUE-06 (sin alert)
 * UX-AUDIT SPRINT-A: CRIT-02 (openEditModal), CRIT-03 (generateSlug), CRIT-05 (openConfirm)
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.TagsCRUD
 */

const TagsCRUD = (() => {
  const client = window.supabase_client;
  let tagsData = [];   // caché local para edición

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

      tagsData = data ?? [];

      if (tagsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state">
          Sin tags. <a href="#" class="cta-link"
            onclick="window.TagsCRUD?.openCreateModal(); return false">Crear primer tag →</a>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = tagsData.map(t => `
        <tr>
          <td>${escapeHtml(t.nombre)}</td>
          <td><code>${escapeHtml(t.slug)}</code></td>
          <td class="actions-cell">
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary"
                      data-edit-id="${t.id}" title="Editar">
                <i data-lucide="pen" style="width:14px;height:14px;" aria-hidden="true"></i> Editar
              </button>
              <button class="btn btn-sm btn-danger btn--icon-only"
                      data-del-id="${t.id}"
                      data-del-nombre="${escapeHtml(t.nombre)}"
                      data-permiso="tags.borrar" title="Eliminar">
                <i data-lucide="trash-2" style="width:14px;height:14px;" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.editId));
      });
      tbody.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteTag(btn.dataset.delId, btn.dataset.delNombre));
      });
      window.IconRegistry?.init();
      // Aplicar permisos sobre los botones recién renderizados
      if (typeof inicializarPermisos === 'function') inicializarPermisos();

    } catch (err) {
      console.error('loadTagsTable:', err);
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Error al cargar tags.</td></tr>';
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
        { name: 'nombre', label: 'Nombre', type: 'text', required: true }
      ],
      onSave: async (data) => {
        const slug = (window.generateSlug ?? slugFallback)(data.nombre);
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

  // ── Abrir modal de edición (CRIT-02) ──────────────────
  function openEditModal(id) {
    const tag = tagsData.find(t => t.id === id);
    if (!tag) {
      window.ErrorHandler?.showToast('Tag no encontrado', 'error');
      return;
    }

    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: 'Editar Tag',
      submitText: 'Guardar cambios',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true, defaultValue: tag.nombre }
      ],
      onSave: async (data) => {
        const slug = (window.generateSlug ?? slugFallback)(data.nombre);
        const { error } = await client.from('tags').update({
          nombre: data.nombre.trim(),
          slug
        }).eq('id', id);

        if (error) throw error;

        window.ErrorHandler?.showToast('✅ Tag actualizado', 'success');
        document.dispatchEvent(new CustomEvent('tags:updated'));
      }
    });
  }

  // ── Eliminar tag (CRIT-05: openConfirm) ───────────────
  async function deleteTag(id, nombre) {
    if (window.ModalManager?.openConfirm) {
      window.ModalManager.openConfirm({
        title:       '¿Eliminar tag?',
        message:     `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText:  'Cancelar',
        onConfirm:   async () => _doDeleteTag(id, nombre)
      });
    } else {
      if (!confirm(`¿Eliminar el tag "${nombre}"?`)) return;
      await _doDeleteTag(id, nombre);
    }
  }

  async function _doDeleteTag(id, nombre) {
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

  // ── Utilidades ─────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugFallback(text) {
    return String(text).trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    const btn = document.getElementById('newTagBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); openCreateModal(); });

    document.addEventListener('tags:updated', loadTagsTable);

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

  return { openCreateModal, openEditModal, deleteTag, loadTagsTable };
})();

window.TagsCRUD = TagsCRUD;
