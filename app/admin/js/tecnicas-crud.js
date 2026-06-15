/**
 * tecnicas-crud.js — CRUD de Técnicas
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-06 (sin alert)
 * UX-AUDIT SPRINT-A: CRIT-01 (openEditModal), CRIT-03 (generateSlug), CRIT-05 (openConfirm)
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.TecnicasCRUD
 */

const TecnicasCRUD = (() => {
  const client = window.supabase_client;
  let tecnicasData = [];   // caché local para edición

  // ── Cargar y renderizar lista de técnicas ──────────────
  async function loadTecnicas() {
    const tbody = document.getElementById('tecnicasList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Cargando…</td></tr>';

    try {
      const _sort = window.sortManager?.getSort('tecnicas-table') ?? { field: 'nombre', direction: 'asc' };
      const { data, error } = await client
        .from('tecnicas')
        .select('id, nombre, descripcion')
        .order(_sort.field, { ascending: _sort.direction === 'asc' });
      if (error) throw error;

      tecnicasData = data ?? [];

      if (tecnicasData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state">
          Sin técnicas. <a href="#" class="cta-link"
            onclick="window.TecnicasCRUD?.openCreateModal(); return false">Crear primera técnica →</a>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = tecnicasData.map(t => `
        <tr>
          <td>${escapeHtml(t.nombre)}</td>
          <td>${t.descripcion ? escapeHtml(t.descripcion) : '<span class="text-muted">—</span>'}</td>
          <td class="actions-cell">
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary"
                      data-edit-id="${t.id}" title="Editar">
                <i data-lucide="pen" style="width:14px;height:14px;" aria-hidden="true"></i> Editar
              </button>
              <button class="btn btn-sm btn-danger"
                      data-del-id="${t.id}"
                      data-del-nombre="${escapeHtml(t.nombre)}"
                      data-permiso="tecnicas.borrar" title="Eliminar">
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
        btn.addEventListener('click', () => deleteTecnica(btn.dataset.delId, btn.dataset.delNombre));
      });
      window.IconRegistry?.init();
      // Aplicar permisos sobre los botones recién renderizados
      if (typeof inicializarPermisos === 'function') inicializarPermisos();

    } catch (err) {
      console.error('loadTecnicas:', err);
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Error al cargar técnicas.</td></tr>';
    }
  }

  // ── Abrir modal de creación ────────────────────────────
  function openCreateModal() {
    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: 'Nueva Técnica',
      fields: [
        { name: 'nombre',      label: 'Nombre',      type: 'text',     required: true  },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false }
      ],
      onSave: async (data) => {
        const slug = (window.generateSlug ?? slugFallback)(data.nombre);
        const { data: nueva, error } = await client.from('tecnicas').insert([{
          nombre:      data.nombre.trim(),
          slug,
          descripcion: data.descripcion?.trim() || null
        }]).select('id, nombre').single();

        if (error) throw error;

        window.auditLogger?.crearTecnica(nueva.id, nueva.nombre);
        window.ErrorHandler?.showToast('Técnica creada correctamente', 'success');
        document.dispatchEvent(new CustomEvent('tecnicas:updated', { detail: nueva }));
      }
    });
  }

  // ── Abrir modal de edición (CRIT-01) ──────────────────
  function openEditModal(id) {
    const tecnica = tecnicasData.find(t => t.id === id);
    if (!tecnica) {
      window.ErrorHandler?.showToast('Técnica no encontrada', 'error');
      return;
    }

    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: 'Editar Técnica',
      submitText: 'Guardar cambios',
      fields: [
        { name: 'nombre',      label: 'Nombre',      type: 'text',     required: true,  defaultValue: tecnica.nombre        },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false, defaultValue: tecnica.descripcion ?? '' }
      ],
      onSave: async (data) => {
        const slug = (window.generateSlug ?? slugFallback)(data.nombre);
        const { error } = await client.from('tecnicas').update({
          nombre:      data.nombre.trim(),
          slug,
          descripcion: data.descripcion?.trim() || null
        }).eq('id', id);

        if (error) throw error;

        window.auditLogger?.editarTecnica(id, data.nombre.trim());
        window.ErrorHandler?.showToast('Técnica actualizada', 'success');
        document.dispatchEvent(new CustomEvent('tecnicas:updated'));
      }
    });
  }

  // ── Eliminar técnica (CRIT-05: openConfirm) ───────────
  async function deleteTecnica(id, nombre) {
    if (window.ModalManager?.openConfirm) {
      window.ModalManager.openConfirm({
        title:       '¿Eliminar técnica?',
        message:     `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText:  'Cancelar',
        onConfirm:   async () => _doDeleteTecnica(id, nombre)
      });
    } else {
      // Fallback a confirm() nativo si openConfirm no está disponible
      if (!confirm(`¿Eliminar la técnica "${nombre}"?`)) return;
      await _doDeleteTecnica(id, nombre);
    }
  }

  async function _doDeleteTecnica(id, nombre) {
    try {
      const { error } = await client.from('tecnicas').delete().eq('id', id);
      if (error) throw error;
      window.auditLogger?.borrarTecnica(id, nombre);
      window.ErrorHandler?.showToast(`Técnica "${nombre}" eliminada`, 'success');
      document.dispatchEvent(new CustomEvent('tecnicas:updated'));
    } catch (err) {
      console.error('deleteTecnica:', err);
      window.ErrorHandler?.showToast('No se pudo eliminar la técnica.', 'error');
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
    const btn = document.getElementById('newTecnicaBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); openCreateModal(); });

    document.addEventListener('tecnicas:updated', loadTecnicas);

    document.querySelectorAll('[data-section="tecnicas"]').forEach(navBtn => {
      navBtn.addEventListener('click', () => setTimeout(loadTecnicas, 60));
    });

    // ── Sort dropdown ──────────────────────────────────────
    window.sortManager?.registerTable('tecnicas-table', [
      { label: 'Nombre A–Z',    field: 'nombre'     },
      { label: 'Más recientes', field: 'created_at' },
    ], { field: 'nombre', direction: 'asc' });   // default = comportamiento actual
    window.sortManager?.mountDropdown('tecnicas-table', () => loadTecnicas());

    console.log('🔧 TecnicasCRUD listo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal, openEditModal, deleteTecnica, loadTecnicas };
})();

window.TecnicasCRUD = TecnicasCRUD;
