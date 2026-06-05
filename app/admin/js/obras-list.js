/**
 * obras-list.js — Tabla dinámica de obras desde Supabase
 * Fase 1.D
 *
 * Depende de: config.js (window.supabase_client)
 * DOM: #obrasList, #searchObras, #filterEstado, #loadMoreBtn, #obraCount, #newObraBtn
 */

document.addEventListener('DOMContentLoaded', () => {
  const client = window.supabase_client;

  // ── Constantes ────────────────────────────────────────
  const PAGE_SIZE = 10;

  // ── Estado interno ────────────────────────────────────
  let state = {
    obras:       [],   // obras cargadas hasta ahora
    total:       0,    // total en DB con los filtros activos
    offset:      0,    // paginación
    query:       '',   // búsqueda por título
    estado:      '',   // filtro por estado
    loading:     false,
  };

  // ── Referencias DOM ───────────────────────────────────
  const tbody       = document.getElementById('obrasList');
  const searchInput = document.getElementById('searchObras');
  const estadoSel   = document.getElementById('filterEstado');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const obraCount   = document.getElementById('obraCount');
  const newObraBtn  = document.getElementById('newObraBtn');

  // ── Activar módulo solo si la sección existe ──────────
  if (!tbody) return;

  // ── Cargar obras desde Supabase ───────────────────────
  async function loadObras(reset = false) {
    if (state.loading) return;
    state.loading = true;

    if (reset) {
      state.obras  = [];
      state.offset = 0;
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Cargando…</td></tr>';
    }

    try {
      let query = client
        .from('obras')
        .select('id, titulo, artista, año, estado, created_at, tecnicas(nombre)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(state.offset, state.offset + PAGE_SIZE - 1);

      if (state.query) {
        query = query.ilike('titulo', `%${state.query}%`);
      }
      if (state.estado) {
        query = query.eq('estado', state.estado);
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
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error al cargar obras.</td></tr>';
    } finally {
      state.loading = false;
    }
  }

  // ── Render tabla ──────────────────────────────────────
  function renderTabla() {
    if (state.obras.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay obras con ese criterio.</td></tr>';
      return;
    }

    tbody.innerHTML = state.obras.map(obra => {
      const tecnica = obra.tecnicas?.nombre ?? '—';
      return `
        <tr data-id="${obra.id}">
          <td>${escHtml(obra.titulo)}</td>
          <td>${escHtml(obra.artista)}</td>
          <td>${obra.año ?? '—'}</td>
          <td>${escHtml(tecnica)}</td>
          <td><span class="badge badge-${obra.estado}">${obra.estado}</span></td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-secondary btn-edit"
                    data-id="${obra.id}" title="Editar">✏️</button>
            <button class="btn btn-sm btn-danger btn-delete"
                    data-id="${obra.id}"
                    data-titulo="${escAttr(obra.titulo)}" title="Eliminar">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    // Delegación de eventos en los botones de la tabla
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.titulo));
    });
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => editObra(btn.dataset.id));
    });
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
    const hayMas = state.obras.length < state.total;
    loadMoreBtn.style.display = hayMas ? 'inline-block' : 'none';
  }

  // ── Confirmar y eliminar ──────────────────────────────
  async function confirmDelete(id, titulo) {
    if (!confirm(`¿Eliminar la obra "${titulo}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
      const { error } = await client.from('obras').delete().eq('id', id);
      if (error) throw error;

      // Quitar de estado local y re-renderizar sin recargar todo
      state.obras  = state.obras.filter(o => o.id !== id);
      state.total  = Math.max(0, state.total - 1);
      state.offset = state.obras.length;

      renderTabla();
      renderContador();
      toggleLoadMore();

    } catch (err) {
      console.error('deleteObra:', err);
      alert('Error al eliminar la obra. Inténtalo de nuevo.');
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
      searchInput && (searchInput.value = '');
      estadoSel   && (estadoSel.value   = '');
      state.query  = '';
      state.estado = '';
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

  // ── Escuchar evento de obras-form.js ─────────────────
  document.addEventListener('obras:refresh', () => loadObras(true));

  // ── Carga inicial ─────────────────────────────────────
  loadObras(true);

  console.log('🎨 obras-list.js cargado');
});
