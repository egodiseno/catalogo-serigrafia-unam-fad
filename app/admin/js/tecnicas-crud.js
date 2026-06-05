/**
 * tecnicas-crud.js — CRUD de Técnicas
 * SPRINT1: ISSUE-01 (sin location.reload), ISSUE-06 (sin alert)
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.TecnicasCRUD
 */

const TecnicasCRUD = (() => {
  const client = window.supabase_client;

  // ── Cargar y renderizar lista de técnicas ──────────────
  async function loadTecnicas() {
    const tbody = document.getElementById('tecnicasList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Cargando…</td></tr>';

    try {
      const { data, error } = await client
        .from('tecnicas')
        .select('id, nombre, descripcion')
        .order('nombre');
      if (error) throw error;

      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No hay técnicas registradas.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(t => `
        <tr>
          <td>${escapeHtml(t.nombre)}</td>
          <td>${t.descripcion ? escapeHtml(t.descripcion) : '<span class="text-muted">—</span>'}</td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-danger"
                    data-del-id="${t.id}"
                    data-del-nombre="${escapeHtml(t.nombre)}">Eliminar</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', () => deleteTecnica(btn.dataset.delId, btn.dataset.delNombre));
      });

    } catch (err) {
      console.error('loadTecnicas:', err);
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Error al cargar técnicas.</td></tr>';
    }
  }

  // ── Eliminar técnica ───────────────────────────────────
  async function deleteTecnica(id, nombre) {
    if (!confirm(`¿Eliminar la técnica "${nombre}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      const { error } = await client.from('tecnicas').delete().eq('id', id);
      if (error) throw error;
      window.ErrorHandler?.showToast(`Técnica "${nombre}" eliminada`, 'success');
      document.dispatchEvent(new CustomEvent('tecnicas:updated'));
    } catch (err) {
      console.error('deleteTecnica:', err);
      window.ErrorHandler?.showToast('No se pudo eliminar la técnica.', 'error');
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
        const slug = data.nombre
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/\s+/g, '-');

        const { error } = await client.from('tecnicas').insert([{
          nombre:      data.nombre.trim(),
          slug,
          descripcion: data.descripcion?.trim() || null
        }]);

        if (error) throw error;

        window.ErrorHandler?.showToast('✅ Técnica creada correctamente', 'success');
        document.dispatchEvent(new CustomEvent('tecnicas:updated'));
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
    const btn = document.getElementById('newTecnicaBtn');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); openCreateModal(); });

    // Recargar lista cuando hay cambios
    document.addEventListener('tecnicas:updated', loadTecnicas);

    // Cargar cuando el usuario navega a la sección
    document.querySelectorAll('[data-section="tecnicas"]').forEach(navBtn => {
      navBtn.addEventListener('click', () => setTimeout(loadTecnicas, 60));
    });

    console.log('🔧 TecnicasCRUD listo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openCreateModal, loadTecnicas };
})();

window.TecnicasCRUD = TecnicasCRUD;
