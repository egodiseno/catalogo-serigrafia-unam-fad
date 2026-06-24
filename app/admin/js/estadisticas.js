/**
 * estadisticas.js — Sección Estadísticas
 *
 * Parte A — Top 10 del mes actual
 *   Llama a get_top_obras_visitas_mes(p_limit:10) — misma RPC del Dashboard.
 *
 * Parte B — Historial todos los tiempos
 *   Llama a get_historial_obras_visitas(p_ascending, p_limit, p_offset)
 *   con scroll infinito (IntersectionObserver) y toggle ASC / DESC.
 *
 * Depende de: config.js (window.supabase_client), icons.js (window.IconRegistry)
 * Expone: window.EstadisticasManager
 * Ciclo de vida:
 *   init.js         → EstadisticasManager.init()       — adjunta listeners (1 sola vez)
 *   navigation.js   → EstadisticasManager.inicializar() — carga datos al abrir la sección
 */

const EstadisticasManager = (() => {
  // ── Estado ─────────────────────────────────────────────
  let _client      = null;
  let _listenersOk = false;    // listeners adjuntados una sola vez
  let _histPage    = 0;        // página actual del historial (0-based)
  let _ascending   = false;    // false = DESC (mayor → menor) por defecto
  let _hasMore     = true;
  let _loading     = false;
  let _observer    = null;     // IntersectionObserver para scroll infinito

  const PAGE_SIZE = 20;

  // ── Cliente Supabase (lazy) ─────────────────────────────
  function client() {
    if (!_client) _client = window.supabase_client;
    return _client;
  }

  // ── Helpers ─────────────────────────────────────────────
  function esc(str) {
    if (!str) return '—';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Nombre del mes actual en español, p.ej. "junio 2026" */
  function mesActual() {
    return new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  const $ = id => document.getElementById(id);

  // ── PARTE A: Top 10 del mes ─────────────────────────────
  async function loadTop10() {
    const list = $('estTop10List');
    if (!list) return;

    list.innerHTML = '<li class="est-state-row">Cargando…</li>';

    try {
      const { data, error } = await client()
        .rpc('get_top_obras_visitas_mes', { p_limit: 10 });

      if (error) throw error;

      if (!data || data.length === 0) {
        list.innerHTML = '<li class="est-state-row">Sin visitas registradas este mes.</li>';
        return;
      }

      list.innerHTML = data.map((row, i) => `
        <li class="top-visitas-item">
          <span class="top-visitas-rank${i === 0 ? ' top-visitas-rank--gold' : ''}">${i + 1}</span>
          <span class="top-visitas-info">
            <span class="top-visitas-title">${esc(row.titulo)}</span>
            <span class="top-visitas-artist">${esc(row.artista)}</span>
          </span>
          <span class="top-visitas-stats">
            <span class="top-visitas-stat" title="Visitas este mes">
              <i data-lucide="eye" style="width:13px;height:13px;" aria-hidden="true"></i>
              ${row.visitas}
            </span>
            <span class="top-visitas-stat top-visitas-stat--fav" title="Corazones totales">
              <i data-lucide="heart" style="width:13px;height:13px;" aria-hidden="true"></i>
              ${row.favoritos ?? 0}
            </span>
          </span>
        </li>`).join('');

      window.IconRegistry?.init();
    } catch (err) {
      console.error('[Estadisticas] loadTop10:', err);
      list.innerHTML = '<li class="est-state-row">Error al cargar datos.</li>';
    }
  }

  // ── PARTE B: Historial todos los tiempos ───────────────
  async function loadHistPage() {
    if (_loading || !_hasMore) return;
    _loading = true;

    const list = $('estHistorialList');
    const loadingEl = $('estLoadingRow');
    if (!list) { _loading = false; return; }
    if (loadingEl) loadingEl.style.display = '';

    try {
      const offset = _histPage * PAGE_SIZE;

      const { data, error } = await client()
        .rpc('get_historial_obras_visitas', {
          p_ascending: _ascending,
          p_limit:     PAGE_SIZE,
          p_offset:    offset,
        });

      if (error) throw error;

      const rows = data ?? [];
      _hasMore = rows.length === PAGE_SIZE;

      if (_histPage === 0 && rows.length === 0) {
        list.innerHTML = '<li class="est-state-row">Sin visitas registradas aún.</li>';
        _hasMore = false;
      } else {
        rows.forEach((row, idx) => {
          const pos = offset + idx + 1;
          list.insertAdjacentHTML('beforeend', `
            <li class="est-hist-item">
              <span class="est-hist-pos">${pos}</span>
              <span class="top-visitas-info">
                <span class="top-visitas-title">${esc(row.titulo)}</span>
                <span class="top-visitas-artist">${esc(row.artista)}</span>
              </span>
              <span class="top-visitas-stats">
                <span class="top-visitas-stat" title="Visitas totales">
                  <i data-lucide="eye" style="width:13px;height:13px;" aria-hidden="true"></i>
                  ${row.visitas}
                </span>
                <span class="top-visitas-stat top-visitas-stat--fav" title="Corazones totales">
                  <i data-lucide="heart" style="width:13px;height:13px;" aria-hidden="true"></i>
                  ${row.favoritos ?? 0}
                </span>
              </span>
            </li>`);
        });
        window.IconRegistry?.init();
      }

      _histPage++;
    } catch (err) {
      console.error('[Estadisticas] loadHistPage:', err);
      if (_histPage === 0 && list) {
        list.innerHTML = '<li class="est-state-row">Error al cargar historial.</li>';
      }
    } finally {
      _loading = false;
      const el = $('estLoadingRow');
      if (el) el.style.display = 'none';
    }
  }

  function resetHistorial() {
    _histPage = 0;
    _hasMore  = true;
    _loading  = false;
    const list = $('estHistorialList');
    if (list) list.innerHTML = '';
    loadHistPage();
  }

  // ── IntersectionObserver (scroll infinito) ──────────────
  function setupObserver() {
    const sentinel = $('estScrollSentinel');
    if (!sentinel) return;

    // Desconectar observador anterior (al reabrir la sección)
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }

    _observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadHistPage();
    }, { rootMargin: '120px' });

    _observer.observe(sentinel);
  }

  // ── Toggle ascendente / descendente ────────────────────
  function _applyToggleLabel() {
    const btn = $('estToggleOrden');
    if (!btn) return;
    btn.innerHTML = _ascending
      ? `<i data-lucide="arrow-up"   style="width:14px;height:14px;" aria-hidden="true"></i> Menor a mayor`
      : `<i data-lucide="arrow-down" style="width:14px;height:14px;" aria-hidden="true"></i> Mayor a menor`;
    window.IconRegistry?.init();
  }

  function toggleOrden() {
    _ascending = !_ascending;
    _applyToggleLabel();
    resetHistorial();
  }

  // ── Etiqueta dinámica del mes ───────────────────────────
  function _setMesLabel() {
    const el = $('estMesLabel');
    if (el) el.textContent = mesActual();
  }

  // ── init() — llamado por init.js, adjunta listeners (1 vez) ─
  function init() {
    if (_listenersOk) return;
    $('estToggleOrden')?.addEventListener('click', toggleOrden);
    _listenersOk = true;
    console.log('[Estadisticas] listeners registrados');
  }

  // ── inicializar() — llamado por navigation.js al abrir la sección ─
  function inicializar() {
    init();           // Idempotente — adjunta listeners si aún no están
    _setMesLabel();   // Actualiza "junio 2026" etc.
    loadTop10();      // Recarga Top 10 cada vez que se abre
    resetHistorial(); // Reinicia historial (pág 0, lista vacía)
    setupObserver();  // Reconecta IntersectionObserver
  }

  return { init, inicializar };
})();

window.EstadisticasManager = EstadisticasManager;
console.log('📊 estadisticas.js cargado');
