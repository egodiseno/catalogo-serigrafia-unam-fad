/**
 * obras-list.js — Tabla dinámica de obras desde Supabase
 * Fase 1.D
 * SPRINT2: ISSUE-08 (filtro por técnica), ISSUE-06 fix (alert en confirmDelete)
 *
 * Depende de: config.js (window.supabase_client)
 * DOM: #obrasList, #searchObras, #filterEstado, #filterTecnica,
 *      #loadMoreBtn, #obraCount, #newObraBtn
 */

document.addEventListener('DOMContentLoaded', () => {
  const client = window.supabase_client;

  // ── Constantes ────────────────────────────────────────
  const PAGE_SIZE = 10;

  // ── Estado interno ────────────────────────────────────
  let state = {
    obras:    [],
    total:    0,
    offset:   0,
    query:    '',
    estado:   '',
    tecnica:  '',     // ISSUE-08: filtro por técnica_id
    loading:  false,
  };

  // ── Referencias DOM ───────────────────────────────────
  const tbody        = document.getElementById('obrasList');
  const searchInput  = document.getElementById('searchObras');
  const estadoSel    = document.getElementById('filterEstado');
  const tecnicaSel   = document.getElementById('filterTecnica');  // ISSUE-08
  const loadMoreBtn  = document.getElementById('loadMoreBtn');
  const obraCount    = document.getElementById('obraCount');
  const newObraBtn   = document.getElementById('newObraBtn');

  if (!tbody) return;

  // ── Cargar técnicas para el select de filtro (ISSUE-08) ──
  async function loadTecnicasFilter() {
    if (!tecnicaSel) return;
    try {
      const { data } = await client
        .from('tecnicas')
        .select('id, nombre')
        .order('nombre');

      if (!data) return;
      tecnicaSel.innerHTML =
        '<option value="">— Todas las técnicas —</option>' +
        data.map(t => `<option value="${t.id}">${escHtml(t.nombre)}</option>`).join('');
    } catch (err) {
      console.error('loadTecnicasFilter:', err);
    }
  }

  // ── Cargar obras desde Supabase ───────────────────────
  async function loadObras(reset = false) {
    if (state.loading) return;
    state.loading = true;

    if (reset) {
      state.obras  = [];
      state.offset = 0;
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Cargando…</td></tr>';
    }

    try {
      let query = client
        .from('obras')
        .select(
          'id, titulo, artista, año, estado, created_at,' +
          'tecnicas(nombre),' +
          'imagenes(url_storage, principal),' +
          'obra_tags(tags(id, nombre))',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(state.offset, state.offset + PAGE_SIZE - 1);

      if (state.query) {
        query = query.ilike('titulo', `%${state.query}%`);
      }
      if (state.estado) {
        query = query.eq('estado', state.estado);
      }
      if (state.tecnica) {                          // ISSUE-08
        query = query.eq('tecnica_id', state.tecnica);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      state.obras  = reset ? (data ?? []) : [...state.obras, ...(data ?? [])];
      state.total  = count ?? 0;
      state.offset = state.obras.length;

      renderTabla();
      renderContador();
      toggleLoadMore();

    } catch (err) {
      console.error('obras-list loadObras:', err);
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar obras.</td></tr>';
    } finally {
      state.loading = false;
    }
  }

  // ── Render tabla ──────────────────────────────────────
  function renderTabla() {
    if (state.obras.length === 0) {
      // ISSUE-13: CTA accionable solo cuando no hay filtros activos
      const noFiltros = !state.query && !state.estado && !state.tecnica;
      const msg = noFiltros
        ? `No hay obras aún. <a href="#" class="cta-link"
             onclick="window.obrasForm?.open(); return false">Crear primera obra →</a>`
        : 'No hay obras con ese criterio.';
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = state.obras.map(obra => {
      const tecnica = obra.tecnicas?.nombre ?? '—';

      // Thumbnail de imagen principal
      const imgUrl = obra.imagenes?.find(i => i.principal)?.url_storage
                  ?? obra.imagenes?.[0]?.url_storage;
      const thumb = imgUrl
        ? `<img src="${imgUrl}" alt="thumb" class="obra-thumb"
               data-src="${escAttr(imgUrl)}" title="Ver imagen">`
        : '<span class="no-thumb">—</span>';

      // Tags de la obra (N:M via obra_tags)
      const tagNames = (obra.obra_tags ?? [])
        .map(ot => ot.tags?.nombre)
        .filter(Boolean);
      const tagsHtml = tagNames.length
        ? tagNames.map(n => `<span class="tag-badge">${escHtml(n)}</span>`).join('')
        : '<span class="text-muted">—</span>';

      return `
        <tr data-id="${obra.id}">
          <td class="td-thumb">${thumb}</td>
          <td>${escHtml(obra.titulo)}</td>
          <td>${escHtml(obra.artista)}</td>
          <td>${obra.año ?? '—'}</td>
          <td>${escHtml(tecnica)}</td>
          <td class="tags-cell">${tagsHtml}</td>
          <td><span class="badge badge-${obra.estado}">${obra.estado}</span></td>
          <td class="actions-cell">
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary btn-edit"
                      data-id="${obra.id}" title="Editar">
                <i data-lucide="pen" style="width:14px;height:14px;" aria-hidden="true"></i>
              </button>
              <button class="btn btn-sm btn-danger btn-delete btn--icon-only"
                      data-id="${obra.id}"
                      data-titulo="${escAttr(obra.titulo)}" title="Eliminar">
                <i data-lucide="trash-2" style="width:14px;height:14px;" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.titulo));
    });
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => editObra(btn.dataset.id));
    });
    // Click en thumbnail → modal preview (openImagePreview)
    tbody.querySelectorAll('.obra-thumb').forEach(img => {
      img.addEventListener('click', () => window.ModalManager?.openImagePreview(img.dataset.src));
    });
    // Renderizar iconos Lucide inyectados en el innerHTML dinámico
    window.IconRegistry?.init();
  }

  // ── Render contador ───────────────────────────────────
  function renderContador() {
    if (obraCount) {
      obraCount.textContent = `${state.obras.length} de ${state.total} obra${state.total !== 1 ? 's' : ''}`;
    }
  }

  // ── Mostrar / ocultar "Cargar más" ────────────────────
  function toggleLoadMore() {
    if (!loadMoreBtn) return;
    loadMoreBtn.style.display = state.obras.length < state.total ? 'inline-block' : 'none';
  }

  // ── Confirmar y eliminar ──────────────────────────────
  function confirmDelete(id, titulo) {
    const doDelete = async () => {
      try {
        const { error } = await client.from('obras').delete().eq('id', id);
        if (error) throw error;

        state.obras  = state.obras.filter(o => o.id !== id);
        state.total  = Math.max(0, state.total - 1);
        state.offset = state.obras.length;

        renderTabla();
        renderContador();
        toggleLoadMore();

        window.ErrorHandler?.showToast('Obra eliminada correctamente', 'success');
      } catch (err) {
        console.error('deleteObra:', err);
        window.ErrorHandler?.showToast('Error al eliminar la obra. Inténtalo de nuevo.', 'error');
      }
    };

    if (window.ModalManager?.openConfirm) {
      window.ModalManager.openConfirm({
        title:       '¿Eliminar obra?',
        message:     `Se eliminará "${titulo}". Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText:  'Cancelar',
        onConfirm:   doDelete,
      });
    } else {
      if (confirm(`¿Eliminar la obra "${titulo}"?\n\nEsta acción no se puede deshacer.`)) {
        doDelete();
      }
    }
  }

  // ── Editar ────────────────────────────────────────────
  function editObra(id) {
    window.obrasForm?.open(id);
  }

  // ── Búsqueda en tiempo real (debounce 300ms) ──────────
  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.query = searchInput.value.trim();
        loadObras(true);
      }, 300);
    });
  }

  // ── Filtro por estado ─────────────────────────────────
  if (estadoSel) {
    estadoSel.addEventListener('change', () => {
      state.estado = estadoSel.value;
      loadObras(true);
    });
  }

  // ── Filtro por técnica (ISSUE-08) ──────────────────────
  if (tecnicaSel) {
    tecnicaSel.addEventListener('change', () => {
      state.tecnica = tecnicaSel.value;
      loadObras(true);
    });
  }

  // ── Cargar más ────────────────────────────────────────
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadObras(false));
  }

  // ── Nueva obra ────────────────────────────────────────
  if (newObraBtn) {
    newObraBtn.addEventListener('click', () => window.obrasForm?.open());
  }

  // ── Recargar al entrar a la sección Obras ─────────────
  const obrasNavBtn = document.querySelector('[data-section="obras"]');
  if (obrasNavBtn) {
    obrasNavBtn.addEventListener('click', () => {
      searchInput  && (searchInput.value  = '');
      estadoSel    && (estadoSel.value    = '');
      tecnicaSel   && (tecnicaSel.value   = '');   // ISSUE-08
      state.query   = '';
      state.estado  = '';
      state.tecnica = '';                           // ISSUE-08
      loadObras(true);
    });
  }

  // ── Helpers ───────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Escuchar eventos ──────────────────────────────────
  document.addEventListener('obras:refresh', () => loadObras(true));

  // Refrescar el filtro de técnicas cuando se crea/elimina una
  document.addEventListener('tecnicas:updated', loadTecnicasFilter);

  // ── Carga inicial ─────────────────────────────────────
  loadTecnicasFilter();   // ISSUE-08: poblar el select de técnicas
  loadObras(true);

  console.log('🎨 obras-list.js cargado');
});
