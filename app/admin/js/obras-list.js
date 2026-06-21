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
  const PAGE_SIZE        = 10;
  const MOBILE_PAGE_SIZE = 5;

  // ── Estado interno ────────────────────────────────────
  let mobileVisible = MOBILE_PAGE_SIZE;   // cuántas cards muestra en mobile

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
      state.obras    = [];
      state.offset   = 0;
      mobileVisible  = MOBILE_PAGE_SIZE;   // reiniciar paginación mobile
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Cargando…</td></tr>';
    }

    try {
      // Ordenamiento dinámico (sort-manager)
      const _sort = window.sortManager?.getSort('obras-table') ?? { field: 'created_at', direction: 'desc' };

      let query = client
        .from('obras')
        .select(
          'id, titulo, artista, año, estado, created_at, descripcion, motivo_reapertura, snapshot_publicado,' +
          'tecnicas(nombre),' +
          'imagenes(id, url_storage, principal, pendiente_borrado),' +
          'obra_tags(tags(id, nombre))',
          { count: 'exact' }
        )
        .order(_sort.field, { ascending: _sort.direction === 'asc' })
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

      // ── FILTRO POR ROL ──────────────────────────────────
      const rolActual   = window.usuarioActual?.rol || 'editor';
      const emailActual = window.usuarioActual?.email;
      if (rolActual === 'editor' && emailActual) {
        // EDITOR: solo ve sus propias obras (artista = su email)
        query = query.eq('artista', emailActual);
        console.log(`[Obras] EDITOR ${emailActual} — filtrando por artista`);
      }
      // ADMIN / SUPER_EDITOR: sin filtro adicional

      const { data, count, error } = await query;

      if (error) throw error;

      state.obras  = reset ? (data ?? []) : [...state.obras, ...(data ?? [])];
      state.total  = count ?? 0;
      state.offset = state.obras.length;

      renderTabla();
      renderContador();
      toggleLoadMore();
      actualizarIndicadorFiltro();

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

      // Botón de revisión de cambios — solo para obras En Revisión reaperturadas
      // (tienen motivo_reapertura, a diferencia de obras nuevas en primer envío)
      const btnDiff = (obra.estado === 'En Revisión' && obra.motivo_reapertura)
        ? `<button class="btn btn-sm btn-diff btn-diff-revision"
                   data-id="${obra.id}" title="Ver cambios pendientes de revisión">
            <i data-lucide="message-square" style="width:14px;height:14px;" aria-hidden="true"></i>
          </button>`
        : '';

      return `
        <tr data-id="${obra.id}">
          <td class="td-thumb">${thumb}</td>
          <td>${escHtml(obra.titulo)}</td>
          <td>${escHtml(obra.artista)}</td>
          <td>${obra.año ?? '—'}</td>
          <td>${escHtml(tecnica)}</td>
          <td class="tags-cell">${tagsHtml}</td>
          <td><span class="badge ${badgeCls(obra.estado)}">${obra.estado}</span></td>
          <td class="actions-cell">
            <div class="action-buttons">
              ${btnDiff}
              <button class="btn btn-sm btn-secondary btn-edit"
                      data-id="${obra.id}" title="Editar">
                <i data-lucide="pen" style="width:14px;height:14px;" aria-hidden="true"></i>
              </button>
              <button class="btn btn-sm btn-danger btn-delete btn--icon-only"
                      data-id="${obra.id}"
                      data-titulo="${escAttr(obra.titulo)}"
                      data-permiso="obras.borrar" title="Eliminar">
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
    // Botón de diff de revisión (obras En Revisión reaperturadas)
    tbody.querySelectorAll('.btn-diff-revision').forEach(btn => {
      btn.addEventListener('click', () => abrirModalRevision(btn.dataset.id));
    });
    // Renderizar iconos Lucide inyectados en el innerHTML dinámico
    window.IconRegistry?.init();

    // Aplicar permisos sobre los botones recién renderizados
    if (typeof inicializarPermisos === 'function') inicializarPermisos();

    // ── Vista mobile: aplicar cards + paginación ────────
    if (window.innerWidth < 1024) applyMobileView();
  }

  // ── Mobile: cards + "Ver más" ─────────────────────────
  function applyMobileView() {
    const rows = Array.from(tbody.querySelectorAll('tr[data-id]'));
    if (rows.length === 0) return;

    // Mostrar / ocultar rows según mobileVisible
    rows.forEach((row, i) => {
      row.style.display = i < mobileVisible ? '' : 'none';
    });

    // Crear el botón "Ver más" si no existe
    let btn = document.getElementById('btnVerMasObras');
    if (!btn) {
      btn = document.createElement('button');
      btn.id        = 'btnVerMasObras';
      btn.className = 'btn-ver-mas-obras';

      // Insertar después de .table-wrapper
      const tableWrapper = document.querySelector('#obrasSection .table-wrapper')
                        ?? tbody.closest('.table-wrapper');
      tableWrapper
        ? tableWrapper.insertAdjacentElement('afterend', btn)
        : tbody.parentElement.appendChild(btn);

      btn.addEventListener('click', () => {
        mobileVisible += MOBILE_PAGE_SIZE;
        const currentRows = Array.from(tbody.querySelectorAll('tr[data-id]'));

        currentRows.forEach((row, i) => {
          row.style.display = i < mobileVisible ? '' : 'none';
        });

        // Si hemos mostrado todos los cargados y aún hay más en DB → pedir al servidor
        if (mobileVisible >= currentRows.length && currentRows.length < state.total) {
          loadObras(false);   // renderTabla() re-llamará applyMobileView()
        } else {
          syncBtnVerMas(btn, currentRows.length);
        }
      });
    }

    syncBtnVerMas(btn, rows.length);
  }

  function syncBtnVerMas(btn, loadedCount) {
    const shownCount  = Math.min(mobileVisible, loadedCount);
    const remaining   = state.total - shownCount;
    const hasMore     = remaining > 0;
    const nextBatch   = Math.min(MOBILE_PAGE_SIZE, remaining);

    btn.classList.toggle('hidden', !hasMore);
    if (hasMore) btn.textContent = `Ver más (${nextBatch})`;
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
    // ── Guard de rol (defense-in-depth) ──────────────────
    const rolActual = window.getRolActual?.() ?? 'editor';
    if (rolActual === 'editor') {
      // EDITOR solo puede eliminar sus propias obras
      const obra        = state.obras.find(o => String(o.id) === String(id));
      const emailActual = window.usuarioActual?.email ?? '';
      if (!obra || obra.artista !== emailActual) {
        window.ErrorHandler?.showToast('Solo puedes eliminar tus propias obras.', 'error');
        return;
      }
    }

    const doDelete = async () => {
      try {
        const { error } = await client.from('obras').delete().eq('id', id);
        if (error) throw error;

        window.auditLogger?.borrarObra(id, titulo);

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

  // ── Modal de revisión de cambios ──────────────────────
  // Abre #revisarCambiosModal para obras En Revisión reaperturadas.
  // Muestra motivo_reapertura + diff entre snapshot_publicado y valores actuales.
  // Aprobar: publica la obra con snapshot actualizado + borra imágenes pendientes.
  // Rechazar: restaura valores del snapshot + desmarca imágenes + guarda motivo.
  function abrirModalRevision(obraId) {
    const obra = state.obras.find(o => String(o.id) === String(obraId));
    if (!obra) return;

    const modal       = document.getElementById('revisarCambiosModal');
    const body        = document.getElementById('revisarCambiosModalBody');
    const closeBtn    = document.getElementById('revisarCambiosModalCloseBtn');
    const cancelBtn   = document.getElementById('revisarCambiosModalCancelBtn');
    const aprobarBtn  = document.getElementById('revisarCambiosModalAprobarBtn');
    const rechazarBtn = document.getElementById('revisarCambiosModalRechazarBtn');

    if (!modal || !body) {
      console.error('[obras-list] #revisarCambiosModal no encontrado en el DOM');
      return;
    }

    // ── Render contenido del diff ─────────────────────────
    const _renderDiff = () => {
      const motivo = obra.motivo_reapertura ?? '';
      body.innerHTML = `
        <div class="diff-motivo">
          <p class="diff-motivo-label">Motivo de reapertura indicado por el editor</p>
          <blockquote class="diff-motivo-texto">${escHtml(motivo)}</blockquote>
        </div>
        <div class="diff-contenido">
          <h4 class="diff-section-title">Cambios respecto a la versión publicada</h4>
          ${generarDiff(obra)}
        </div>`;
      window.IconRegistry?.init();
    };

    _renderDiff();

    // AbortController — limpia todos los listeners al cerrar
    const ac     = new AbortController();
    const signal = ac.signal;

    const _close = () => {
      modal.style.display = 'none';
      ac.abort();
    };

    closeBtn?.addEventListener('click',  _close, { signal });
    cancelBtn?.addEventListener('click', _close, { signal });
    modal.addEventListener('click', e => { if (e.target === modal) _close(); }, { signal });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') _close(); }, { signal });

    // ── Aprobar ───────────────────────────────────────────
    aprobarBtn?.addEventListener('click', async () => {
      aprobarBtn.disabled    = true;
      aprobarBtn.textContent = 'Aprobando…';
      rechazarBtn.disabled   = true;
      console.log('[obras-list] Iniciando aprobación — obra:', obra.id, obra.titulo);

      try {
        await ejecutarAprobacion(obra);
        _close();
        window.ErrorHandler?.showToast(`"${escHtml(obra.titulo)}" aprobada y publicada.`, 'success');
        loadObras(true);
      } catch (err) {
        console.error('[obras-list] ejecutarAprobacion error:', err);
        window.ErrorHandler?.showToast('No se pudo aprobar la obra. Revisa la consola.', 'error');
        aprobarBtn.disabled    = false;
        aprobarBtn.textContent = 'Aprobar';
        rechazarBtn.disabled   = false;
      }
    }, { signal });

    // ── Rechazar — dos fases: mostrar campo → confirmar ──
    // Fase 1: muestra textarea de motivo en el body (sin cerrar modal).
    // Fase 2: con motivo válido, ejecuta el rechazo.
    let _rechazandoActivo = false;

    rechazarBtn?.addEventListener('click', async () => {

      if (!_rechazandoActivo) {
        // ── FASE 1: mostrar formulario de motivo ────────────
        _rechazandoActivo       = true;
        rechazarBtn.disabled    = true;
        rechazarBtn.textContent = 'Confirmar rechazo';
        aprobarBtn.disabled     = true;

        const formDiv = document.createElement('div');
        formDiv.className = 'diff-rechazo-form';
        formDiv.id        = 'rechazarForm';
        formDiv.innerHTML = `
          <h4 class="diff-section-title diff-section-title--rechazar">Motivo de rechazo</h4>
          <p class="diff-rechazo-hint">El editor verá este motivo al revisar la obra devuelta. Sé claro y constructivo.</p>
          <textarea id="rechazarMotivoInput" class="form-textarea" rows="3" maxlength="1000"
            placeholder="Describe qué debe corregir el editor antes de que la obra pueda aprobarse…"></textarea>
          <div class="diff-rechazo-footer">
            <span id="rechazarMotivoCharCount" class="field-hint">0 / 1000</span>
            <button type="button" class="btn btn-ghost btn-sm" id="rechazarCancelarBtn">Cancelar rechazo</button>
          </div>`;
        body.appendChild(formDiv);
        body.scrollTop = body.scrollHeight;

        const textarea  = formDiv.querySelector('#rechazarMotivoInput');
        const charCount = formDiv.querySelector('#rechazarMotivoCharCount');
        const volverBtn = formDiv.querySelector('#rechazarCancelarBtn');

        textarea.addEventListener('input', () => {
          const n = textarea.value.length;
          charCount.textContent = `${n} / 1000`;
          rechazarBtn.disabled  = n === 0;
        }, { signal });

        volverBtn?.addEventListener('click', () => {
          _rechazandoActivo       = false;
          rechazarBtn.textContent = 'Rechazar';
          rechazarBtn.disabled    = false;
          aprobarBtn.disabled     = false;
          formDiv.remove();
        }, { signal });

        textarea.focus();
        return;
      }

      // ── FASE 2: ejecutar rechazo con el motivo escrito ──
      const textarea = document.getElementById('rechazarMotivoInput');
      const motivo   = textarea?.value.trim() ?? '';
      if (!motivo) return;

      rechazarBtn.disabled    = true;
      rechazarBtn.textContent = 'Rechazando…';
      console.log('[obras-list] Iniciando rechazo — obra:', obra.id, obra.titulo, '| motivo:', motivo);

      try {
        await ejecutarRechazo(obra, motivo);
        _close();
        window.ErrorHandler?.showToast(`Cambios rechazados. "${escHtml(obra.titulo)}" vuelve a la versión publicada.`, 'success');
        loadObras(true);
      } catch (err) {
        console.error('[obras-list] ejecutarRechazo error:', err);
        window.ErrorHandler?.showToast('No se pudo rechazar la obra. Revisa la consola.', 'error');
        rechazarBtn.disabled    = false;
        rechazarBtn.textContent = 'Confirmar rechazo';
      }
    }, { signal });

    modal.style.display = 'flex';
    window.IconRegistry?.init();
  }

  // Genera el HTML del diff entre snapshot_publicado y los valores actuales de la obra.
  // Solo muestra campos donde hay diferencia real.
  // Cubre: título, año, técnica, descripción, tags, imágenes.
  function generarDiff(obra) {
    const snap = obra.snapshot_publicado;
    if (!snap) {
      return '<p class="diff-sin-cambios">No hay snapshot disponible — esta obra aún no tiene una versión publicada registrada.</p>';
    }

    const campos = [];

    // Título
    if ((snap.titulo ?? '') !== (obra.titulo ?? '')) {
      campos.push({ label: 'Título', antes: snap.titulo || '—', despues: obra.titulo || '—' });
    }

    // Año
    if (String(snap.año ?? '') !== String(obra.año ?? '')) {
      campos.push({ label: 'Año', antes: snap.año ?? '—', despues: obra.año ?? '—' });
    }

    // Técnica (el snapshot guarda el nombre; la obra carga la relación tecnicas)
    const tecActual = obra.tecnicas?.nombre ?? '';
    const tecSnap   = snap.tecnica ?? snap.tecnica_nombre ?? '';
    if (tecSnap !== tecActual) {
      campos.push({ label: 'Técnica', antes: tecSnap || '—', despues: tecActual || '—' });
    }

    // Descripción
    const descActual = (obra.descripcion ?? '').trim();
    const descSnap   = (snap.descripcion ?? '').trim();
    if (descSnap !== descActual) {
      campos.push({ label: 'Descripción', antes: descSnap || '—', despues: descActual || '—', multilinea: true });
    }

    // Tags (comparar listas ordenadas de nombres)
    const tagsActual = (obra.obra_tags ?? [])
      .map(ot => ot.tags?.nombre).filter(Boolean).sort().join(', ');
    const tagsSnap   = (snap.tags ?? []).slice().sort().join(', ');
    if (tagsSnap !== tagsActual) {
      campos.push({ label: 'Tags', antes: tagsSnap || '—', despues: tagsActual || '—' });
    }

    // ── HTML de campos de texto ───────────────────────────
    let html = '';

    if (campos.length > 0) {
      html += '<div class="diff-campos">';
      html += campos.map(c => `
        <div class="diff-campo">
          <div class="diff-campo-label">${escHtml(c.label)}</div>
          <div class="diff-valores">
            <div class="diff-valor diff-valor--antes">
              <span class="diff-tag diff-tag--antes">Antes</span>
              ${c.multilinea
                ? `<pre class="diff-texto">${escHtml(String(c.antes))}</pre>`
                : `<span class="diff-texto">${escHtml(String(c.antes))}</span>`}
            </div>
            <div class="diff-valor diff-valor--despues">
              <span class="diff-tag diff-tag--despues">Ahora</span>
              ${c.multilinea
                ? `<pre class="diff-texto">${escHtml(String(c.despues))}</pre>`
                : `<span class="diff-texto">${escHtml(String(c.despues))}</span>`}
            </div>
          </div>
        </div>`).join('');
      html += '</div>';
    }

    // ── Imágenes ──────────────────────────────────────────
    // Nuevas: presentes en imagenes[] pero NO en el snapshot y no marcadas para borrar
    // Para borrar: marcadas con pendiente_borrado = true
    const snapImgUrls = (snap.imagenes ?? []).map(si =>
      typeof si === 'string' ? si : (si.url_storage ?? si.url ?? '')
    ).filter(Boolean);

    const imgNuevas   = (obra.imagenes ?? []).filter(img =>
      img.url_storage && !snapImgUrls.includes(img.url_storage) && !img.pendiente_borrado
    );
    const imgBorradas = (obra.imagenes ?? []).filter(img => img.pendiente_borrado);

    if (imgNuevas.length > 0 || imgBorradas.length > 0) {
      html += '<div class="diff-imagenes">';
      html += '<h4 class="diff-section-title diff-section-title--imagenes">Imágenes</h4>';

      if (imgNuevas.length > 0) {
        html += `<p class="diff-img-label diff-img-label--nueva">
                   <i data-lucide="image-plus" style="width:14px;height:14px;vertical-align:-2px;" aria-hidden="true"></i>
                   Imágenes nuevas (${imgNuevas.length})
                 </p>`;
        html += '<div class="diff-img-grid">';
        imgNuevas.forEach(img => {
          html += `<div class="diff-img-item diff-img-item--nueva">
            <img src="${escAttr(img.url_storage)}" alt="Nueva imagen" class="diff-img-thumb">
            ${img.principal ? '<span class="diff-img-badge">Principal</span>' : ''}
          </div>`;
        });
        html += '</div>';
      }

      if (imgBorradas.length > 0) {
        html += `<p class="diff-img-label diff-img-label--borrar">
                   <i data-lucide="image-off" style="width:14px;height:14px;vertical-align:-2px;" aria-hidden="true"></i>
                   Marcadas para eliminar (${imgBorradas.length})
                 </p>`;
        html += '<div class="diff-img-grid">';
        imgBorradas.forEach(img => {
          html += `<div class="diff-img-item diff-img-item--borrar">
            <img src="${escAttr(img.url_storage)}" alt="Imagen a eliminar" class="diff-img-thumb">
          </div>`;
        });
        html += '</div>';
      }

      html += '</div>';
    }

    if (!html) {
      html = '<p class="diff-sin-cambios">Sin cambios detectados en los campos comparados.</p>';
    }

    return html;
  }

  // ── Construir objeto snapshot a partir de los datos de la obra ────────────
  // Usa los valores actuales del objeto obra (desde state.obras).
  // Excluye imágenes marcadas como pendiente_borrado.
  function construirSnapshot(obra) {
    return {
      titulo:      obra.titulo      ?? '',
      artista:     obra.artista     ?? '',
      año:         obra.año         ?? null,
      tecnica:     obra.tecnicas?.nombre ?? '',
      descripcion: obra.descripcion ?? '',
      tags:        (obra.obra_tags ?? []).map(ot => ot.tags?.nombre).filter(Boolean),
      imagenes:    (obra.imagenes  ?? [])
        .filter(img => !img.pendiente_borrado)
        .map(img => ({ url_storage: img.url_storage, principal: img.principal ?? false })),
    };
  }

  // ── Borrar una imagen físicamente de Storage + su registro en imagenes ────
  // Mismo patrón que deleteObraImage() en obras-form.js.
  // Lanza error si el borrado de DB falla; solo advierte si falla Storage.
  async function borrarImagenFisicaYDB(imgId, imgUrl) {
    const { error: dbErr } = await client.from('imagenes').delete().eq('id', imgId);
    if (dbErr) throw dbErr;

    if (imgUrl) {
      const storagePath = imgUrl.split('/artworks/')[1];
      if (storagePath) {
        const delResult = await window.StorageModule?.deleteImage(storagePath);
        if (delResult?.success) {
          console.log('[obras-list] Imagen eliminada de Storage:', storagePath);
        } else {
          console.warn('[obras-list] No se pudo eliminar de Storage (archivo huérfano):', delResult?.error);
        }
      }
    }
  }

  // ── Ejecutar aprobación de obra reabierta (Parte B) ───────────────────────
  // 1. Cambia estado → Publicado, visible_publico → true, guarda snapshot actualizado,
  //    limpia motivo_reapertura y motivo_rechazo.
  // 2. Borra físicamente las imágenes con pendiente_borrado = true.
  // 3. Registra en Logs de Auditoría.
  async function ejecutarAprobacion(obra) {
    const snap = construirSnapshot(obra);

    // Imágenes pendientes de borrado — capturar ANTES del UPDATE
    const imgsPendientes = (obra.imagenes ?? []).filter(img => img.pendiente_borrado);

    // 1. Actualizar obra
    const { data: filas, error: updErr } = await client
      .from('obras')
      .update({
        estado:             'Publicado',
        visible_publico:    true,
        snapshot_publicado: snap,
        motivo_reapertura:  null,
        motivo_rechazo:     null,
      })
      .eq('id', obra.id)
      .select('id');

    if (updErr) throw updErr;
    if (!filas?.length) throw new Error('UPDATE no afectó ninguna fila — posible bloqueo RLS');

    // 2. Borrar imágenes pendientes (física + DB)
    for (const img of imgsPendientes) {
      try {
        await borrarImagenFisicaYDB(img.id, img.url_storage);
      } catch (imgErr) {
        // No detener la aprobación si falla el borrado de una imagen
        console.warn('[obras-list] ejecutarAprobacion — error borrando imagen:', img.id, imgErr);
      }
    }

    // 3. Audit log
    window.auditLogger?.editarObra(obra.id, obra.titulo);
    console.log(
      '[obras-list] Obra aprobada:', obra.id, obra.titulo,
      '| snapshot actualizado | imágenes borradas:', imgsPendientes.length,
      '| usuario:', window.usuarioActual?.email
    );
  }

  // ── Ejecutar rechazo de obra reabierta (Parte C) ──────────────────────────
  // 1. Restaura campos de texto desde snapshot_publicado (titulo, artista, año,
  //    tecnica_id, descripcion).
  // 2. Restaura tags desde snapshot (borra actuales + re-inserta).
  // 3. Desmarca imágenes pendientes_borrado (vuelven a false).
  // 4. Cambia estado → Publicado; guarda motivo_rechazo; limpia motivo_reapertura.
  // 5. Registra en Logs de Auditoría.
  async function ejecutarRechazo(obra, motivo) {
    const snap = obra.snapshot_publicado;
    if (!snap) throw new Error('No hay snapshot disponible para restaurar');

    // 1a. Lookup tecnica_id desde el nombre guardado en el snapshot
    let tecnicaId = null;
    if (snap.tecnica) {
      const { data: tecData, error: tecErr } = await client
        .from('tecnicas')
        .select('id')
        .eq('nombre', snap.tecnica)
        .maybeSingle();
      if (tecErr) throw tecErr;
      tecnicaId = tecData?.id ?? null;
    }

    // 1b. Restaurar campos principales + cambiar estado + guardar motivo
    const { data: filas, error: updErr } = await client
      .from('obras')
      .update({
        titulo:            snap.titulo      ?? obra.titulo,
        artista:           snap.artista     ?? obra.artista,
        año:               snap.año         ?? obra.año,
        descripcion:       snap.descripcion || null,
        tecnica_id:        tecnicaId,
        estado:            'Publicado',
        motivo_rechazo:    motivo,
        motivo_reapertura: null,
        // visible_publico: NO se modifica (obra ya era pública)
      })
      .eq('id', obra.id)
      .select('id');

    if (updErr) throw updErr;
    if (!filas?.length) throw new Error('UPDATE no afectó ninguna fila — posible bloqueo RLS');

    // 2. Restaurar tags: eliminar actuales y re-insertar los del snapshot
    const { error: delTagsErr } = await client
      .from('obra_tags')
      .delete()
      .eq('obra_id', obra.id);
    if (delTagsErr) throw delTagsErr;

    if (snap.tags && snap.tags.length > 0) {
      const { data: tagData, error: tagLookupErr } = await client
        .from('tags')
        .select('id, nombre')
        .in('nombre', snap.tags);
      if (tagLookupErr) throw tagLookupErr;

      if (tagData && tagData.length > 0) {
        const { error: insTagsErr } = await client
          .from('obra_tags')
          .insert(tagData.map(t => ({ obra_id: obra.id, tag_id: t.id })));
        if (insTagsErr) throw insTagsErr;
      }
    }

    // 3. Desmarcar imágenes pendientes_borrado (restaurar al estado normal)
    await client
      .from('imagenes')
      .update({ pendiente_borrado: false })
      .eq('obra_id', obra.id)
      .eq('pendiente_borrado', true);

    // 4. Audit log
    window.auditLogger?.editarObra(obra.id, obra.titulo);
    console.log(
      '[obras-list] Obra rechazada:', obra.id, obra.titulo,
      '| campos restaurados al snapshot | motivo:', motivo,
      '| usuario:', window.usuarioActual?.email
    );
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

  // ── Indicador de filtro por rol ───────────────────────
  function actualizarIndicadorFiltro() {
    const indicador = document.getElementById('filterIndicator');
    if (!indicador) return;

    const rolActual = window.usuarioActual?.rol || 'editor';

    if (rolActual === 'editor') {
      const totalText = state.total === 1 ? '1 obra' : `${state.total} obras`;
      indicador.textContent  = `👤 Mostrando solo tus obras — ${totalText}`;
      indicador.style.display = 'block';
    } else {
      indicador.style.display = 'none';
    }
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

  // Mapeo explícito estado → clase CSS de badge
  // (el texto del estado usa mayúsculas y tilde; las clases CSS usan minúsculas sin tilde)
  function badgeCls(estado) {
    const map = {
      'Publicado':   'badge-publicado',
      'Borrador':    'badge-borrador',
      'En Revisión': 'badge-revision',
      'Archivado':   'badge-archivado',
    };
    return map[estado] || 'badge-borrador';
  }

  // ── Escuchar eventos ──────────────────────────────────
  document.addEventListener('obras:refresh', () => loadObras(true));

  // Refrescar el filtro de técnicas cuando se crea/elimina una
  document.addEventListener('tecnicas:updated', loadTecnicasFilter);

  // ── Registrar tabla en sortManager + dropdown ──────────
  window.sortManager?.registerTable('obras-table', [
    { label: 'Más recientes', field: 'created_at' },
    { label: 'Título A–Z',    field: 'titulo'     },
    { label: 'Año',           field: 'año'        },
    { label: 'Artista',       field: 'artista'    },
    { label: 'Estado',        field: 'estado'     },
  ]);   // default: created_at desc  (mantiene comportamiento actual)
  window.sortManager?.mountDropdown('obras-table', () => loadObras(true));

  // ── Carga inicial ─────────────────────────────────────
  loadTecnicasFilter();   // ISSUE-08: poblar el select de técnicas
  loadObras(true);

  console.log('🎨 obras-list.js cargado');
});
