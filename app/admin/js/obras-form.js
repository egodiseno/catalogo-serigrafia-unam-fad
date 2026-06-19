/**
 * obras-form.js — Modal para crear / editar obras en Supabase
 * Fase 1.E
 * SPRINT1: ISSUE-02 (inline técnica), ISSUE-03 (cargar tags al editar)
 *
 * Depende de: config.js (window.supabase_client)
 * Expone:     window.obrasForm.open(id?)
 */

document.addEventListener('DOMContentLoaded', () => {
  const client = window.supabase_client;

  // ── Referencias DOM ───────────────────────────────────
  const modal       = document.getElementById('obraModal');
  const form        = document.getElementById('obraForm');
  const modalTitle  = document.getElementById('modalTitle');
  const closeBtn    = document.getElementById('modalCloseBtn');
  const cancelBtn   = document.getElementById('modalCancelBtn');
  const saveBtn     = document.getElementById('modalSaveBtn');
  const formAlert   = document.getElementById('formAlert');

  const fId          = document.getElementById('fId');
  const fTitulo      = document.getElementById('fTitulo');
  const fArtista     = document.getElementById('fArtista');
  const fAno         = document.getElementById('fAno');
  const fEstado      = document.getElementById('fEstado');
  const fTecnica     = document.getElementById('fTecnica');
  const fDescripcion = document.getElementById('fDescripcion');

  // ── Inline técnica (ISSUE-02) ─────────────────────────
  const btnNuevaTecnicaInline   = document.getElementById('btnNuevaTecnicaInline');
  const inlineTecnicaForm       = document.getElementById('inlineTecnicaForm');
  const inlineTecnicaInput      = document.getElementById('inlineTecnicaInput');
  const btnConfirmTecnicaInline = document.getElementById('btnConfirmTecnicaInline');
  const btnCancelTecnicaInline  = document.getElementById('btnCancelTecnicaInline');

  if (!modal) return;

  // ── Abrir modal ───────────────────────────────────────
  async function open(id = null) {
    resetForm();
    await loadTecnicas();

    const existingSection = document.getElementById('existingImagesSection');
    const rolActual       = window.usuarioActual?.rol || 'editor';

    // ── Estado: opciones según rol (ANTES de loadObraToEdit) ──
    if (rolActual === 'editor') {
      // EDITOR: solo Borrador y En Revisión
      fEstado.innerHTML = `
        <option value="Borrador">Borrador</option>
        <option value="En Revisión">En Revisión</option>
      `;
    } else {
      // ADMIN / SUPER_EDITOR: todas las opciones
      fEstado.innerHTML = `
        <option value="Borrador">Borrador</option>
        <option value="Publicado">Publicado</option>
        <option value="En Revisión">En Revisión</option>
        <option value="Archivado">Archivado</option>
      `;
    }
    fEstado.disabled = false;
    fEstado.title    = '';

    if (id) {
      modalTitle.textContent = 'Editar Obra';
      saveBtn.textContent    = 'Guardar cambios';
      if (existingSection) existingSection.style.display = 'block';
      const loaded = await loadObraToEdit(id);   // establece fEstado.value = data.estado
      if (!loaded) return;                        // EDITOR sin permiso — toast ya mostrado
      loadObraImages(id);                         // sin await: carga en paralelo
    } else {
      modalTitle.textContent = 'Nueva Obra';
      saveBtn.textContent    = 'Guardar obra';
      if (existingSection) existingSection.style.display = 'none';
      // Default para obra nueva
      fEstado.value = rolActual === 'editor' ? 'En Revisión' : 'Borrador';
    }

    // ── Artista: readonly para EDITOR ────────────────────
    if (rolActual === 'editor') {
      if (!id) {
        // Nueva obra: autocargar nombre/email del usuario activo
        fArtista.value = window.usuarioActual?.nombre?.trim()
                       || window.usuarioActual?.email?.trim()
                       || '';
      }
      fArtista.readOnly = true;
      fArtista.classList.add('field--readonly');
      fArtista.title    = 'El artista se asigna automáticamente';
    } else {
      fArtista.readOnly = false;
      fArtista.classList.remove('field--readonly');
      fArtista.title    = '';
    }

    // ── Botones crear: según rol ───────────────────────────
    // "+ Nueva técnica": solo ADMIN y SUPER_EDITOR
    if (btnNuevaTecnicaInline) {
      btnNuevaTecnicaInline.style.display = rolActual === 'editor' ? 'none' : '';
    }
    // "+ Nuevo tag": solo ADMIN y SUPER_EDITOR
    window.TagsInObra?.setAllowCreate(rolActual !== 'editor');

    modal.style.display = 'flex';
    window.IconRegistry?.init();
    fTitulo.focus();
  }

  // ── Cerrar modal ──────────────────────────────────────
  function close() {
    modal.style.display = 'none';
    resetForm();
    hideInlineTecnica();
  }

  // ── Cargar técnicas en el dropdown ────────────────────
  async function loadTecnicas() {
    try {
      const { data, error } = await client
        .from('tecnicas')
        .select('id, nombre')
        .order('nombre');

      if (error) throw error;

      fTecnica.innerHTML = '<option value="">— Sin técnica —</option>';
      (data ?? []).forEach(t => {
        const opt = document.createElement('option');
        opt.value       = t.id;
        opt.textContent = t.nombre;
        fTecnica.appendChild(opt);
      });
    } catch (err) {
      console.error('loadTecnicas:', err);
    }
  }

  // ── Cargar obra para editar ───────────────────────────
  async function loadObraToEdit(id) {
    try {
      // Obra + tags existentes en paralelo (ISSUE-03)
      const [obraRes, tagsRes] = await Promise.all([
        client.from('obras').select('*').eq('id', id).single(),
        client.from('obra_tags').select('tag_id, tags(id, nombre)').eq('obra_id', id)
      ]);

      if (obraRes.error) throw obraRes.error;
      const data = obraRes.data;
      if (!data) throw new Error('Obra no encontrada');

      // ── VALIDACIÓN POR ROL ──────────────────────────────
      const rolActual    = window.usuarioActual?.rol    || 'editor';
      const emailActual  = window.usuarioActual?.email  || '';
      const nombreActual = (window.usuarioActual?.nombre || '').trim();
      // Obras antiguas almacenan el email en artista; obras nuevas almacenan el nombre.
      // El check acepta ambos para no bloquear el acceso tras la migración.
      const esPropia = data.artista === emailActual
                    || (nombreActual && data.artista === nombreActual);
      if (rolActual === 'editor' && !esPropia) {
        window.toast?.error('No tienes permiso para editar esta obra.');
        console.warn(`[Seguridad] EDITOR ${emailActual} intentó editar obra de ${data.artista}`);
        return null;
      }

      fId.value          = data.id;
      fTitulo.value      = data.titulo      ?? '';
      fArtista.value     = data.artista     ?? '';
      fAno.value         = data.año         ?? '';
      fEstado.value      = data.estado      ?? 'Borrador';
      fTecnica.value     = data.tecnica_id  ?? '';
      fDescripcion.value = data.descripcion ?? '';

      // Poblar tags seleccionados (ISSUE-03)
      window.TagsInObra?.reset();
      (tagsRes.data ?? []).forEach(row => {
        if (row.tags) window.TagsInObra?.addTag(row.tags.id, row.tags.nombre);
      });

      return data;   // ✅ devolver datos para que open() pueda verificar el resultado

    } catch (err) {
      console.error('loadObraToEdit:', err);
      showAlert('No se pudo cargar la obra.', 'error');
      return null;
    }
  }

  // ── Imágenes existentes (al editar) ──────────────────

  /** Escapa atributos HTML dentro de obras-form */
  function escAttrF(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Carga las imágenes guardadas en la tabla `imagenes` para una obra
   * y las renderiza en #existingImagesList.
   */
  async function loadObraImages(obraId) {
    const container = document.getElementById('existingImagesList');
    if (!container) return;

    container.innerHTML = '<p class="field-hint">Cargando imágenes…</p>';

    try {
      const { data, error } = await client
        .from('imagenes')
        .select('id, url_storage, principal, orden')
        .eq('obra_id', obraId)
        .order('orden', { ascending: true, nullsFirst: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = '<p class="field-hint">Sin imágenes guardadas.</p>';
        return;
      }

      container.innerHTML = data.map(img => `
        <div class="existing-image-item" data-img-id="${escAttrF(img.id)}">
          <img src="${escAttrF(img.url_storage)}"
               alt="Imagen de la obra"
               class="existing-thumb"
               data-src="${escAttrF(img.url_storage)}">
          ${img.principal ? '<span class="badge-principal">Principal</span>' : ''}
          <button type="button"
                  class="btn-del-img image-item-delete"
                  data-img-id="${escAttrF(img.id)}"
                  aria-label="Eliminar imagen">
            <i data-lucide="trash-2" style="width:13px;height:13px;" aria-hidden="true"></i>
            Eliminar
          </button>
        </div>
      `).join('');

      // Click en thumbnail → preview grande
      container.querySelectorAll('.existing-thumb').forEach(thumb => {
        thumb.addEventListener('click', () =>
          window.ModalManager?.openImagePreview(thumb.dataset.src)
        );
      });

      // Eliminar imagen con confirmación
      container.querySelectorAll('.btn-del-img').forEach(btn => {
        btn.addEventListener('click', () => deleteObraImage(btn.dataset.imgId, obraId));
      });
      window.IconRegistry?.init();

    } catch (err) {
      console.error('loadObraImages:', err);
      container.innerHTML =
        '<p class="field-hint" style="color:var(--color-danger,#dc2626)">Error al cargar imágenes.</p>';
    }
  }

  /**
   * Confirma y elimina un registro de la tabla `imagenes`.
   * Recarga la lista tras borrar.
   */
  function deleteObraImage(imgId, obraId) {
    window.ModalManager?.openConfirm({
      title:       '¿Eliminar imagen?',
      message:     'La imagen se eliminará del catálogo. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText:  'Cancelar',
      onConfirm:   async () => {
        try {
          const { error } = await client.from('imagenes').delete().eq('id', imgId);
          if (error) throw error;
          window.ErrorHandler?.showToast('Imagen eliminada', 'success');
          loadObraImages(obraId);
        } catch (err) {
          console.error('deleteObraImage:', err);
          window.ErrorHandler?.showToast('Error al eliminar la imagen', 'error');
        }
      },
    });
  }

  // ── Guardar obra (INSERT o UPDATE) ───────────────────
  async function saveObra() {
    hideAlert();

    const titulo  = fTitulo.value.trim();
    const artista = fArtista.value.trim();
    const año     = fAno.value ? parseInt(fAno.value, 10) : null;

    if (!titulo)  { showAlert('El título es obligatorio.', 'error'); fTitulo.focus();  return; }
    if (!artista) { showAlert('El artista es obligatorio.', 'error'); fArtista.focus(); return; }
    if (año !== null && (año < 1800 || año > 2100)) {
      showAlert('El año debe estar entre 1800 y 2100.', 'error');
      fAno.focus();
      return;
    }

    // ── Validar máximo de tags ────────────────────────────
    const tagsSelec = window.TagsInObra?.getTags() ?? [];
    if (tagsSelec.length > 3) {
      showAlert(`Máximo 3 tags por obra. Tienes ${tagsSelec.length} seleccionados.`, 'error');
      return;
    }

    // ── Validar máximo de imágenes (nuevas + ya guardadas) ──
    const nuevasImgs    = window.MultiImageUpload?.getImages()?.length ?? 0;
    const existingImgs  = document.querySelectorAll('#existingImagesList .existing-image-item').length;
    const totalImgs     = nuevasImgs + existingImgs;
    if (totalImgs > 4) {
      showAlert(
        `Máximo 4 imágenes por obra. Tienes ${totalImgs} (${existingImgs} guardada${existingImgs !== 1 ? 's' : ''} + ${nuevasImgs} nueva${nuevasImgs !== 1 ? 's' : ''}).`,
        'error'
      );
      return;
    }

    // ── Estado: EDITOR solo puede guardar Borrador o En Revisión ──
    const rolGuardar       = window.usuarioActual?.rol || 'editor';
    const estadoSelec      = fEstado.value || 'Borrador';
    const estadoPermitidos = ['Borrador', 'En Revisión'];
    const payload = {
      titulo,
      artista,
      año,
      estado:      rolGuardar === 'editor'
                     ? (estadoPermitidos.includes(estadoSelec) ? estadoSelec : 'En Revisión')
                     : estadoSelec,
      tecnica_id:  fTecnica.value            || null,
      descripcion: fDescripcion.value.trim() || null,
    };

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Guardando…';

    try {
      const editId = fId.value;
      let obraId   = editId;

      if (editId) {
        const { error } = await client.from('obras').update(payload).eq('id', editId);
        if (error) throw error;
        window.auditLogger?.editarObra(editId, titulo);
      } else {
        const { data, error } = await client.from('obras').insert(payload).select('id').single();
        if (error) throw error;
        obraId = data.id;
        window.auditLogger?.crearObra(obraId, titulo);
      }

      // ── Upload multi-imagen ───────────────────────────
      const multi = window.MultiImageUpload;
      if (multi) {
        const imgs = multi.getImages();
        if (imgs.length > 0) {
          saveBtn.textContent = `Subiendo ${imgs.length} imagen${imgs.length > 1 ? 'es' : ''}…`;
          const uploadResult = await multi.uploadAll(obraId);
          if (uploadResult.success && uploadResult.urls.length > 0) {
            await multi.saveAllImageRecords(obraId, uploadResult.urls);
          } else if (!uploadResult.success) {
            showAlert(`Obra guardada, pero las imágenes fallaron: ${uploadResult.error}`, 'error');
            setTimeout(() => { close(); document.dispatchEvent(new CustomEvent('obras:refresh')); }, 1800);
            return;
          }
        }
      }

      // ── Guardar tags N:M — siempre (ISSUE-03) ────────
      const tags = window.TagsInObra;
      if (tags) {
        await tags.saveTags(obraId);
      }

      // ── Toast contextual según estado y operación ─────────
      if (editId) {
        showAlert('Obra actualizada correctamente.', 'success');
        window.toast?.success('Obra actualizada correctamente');
      } else {
        const estadoFinal = payload.estado;
        if (estadoFinal === 'En Revisión') {
          showAlert('Obra enviada a revisión correctamente.', 'success');
          window.toast?.success('Obra enviada — pendiente de revisión');
        } else if (estadoFinal === 'Borrador') {
          showAlert('Borrador guardado correctamente.', 'success');
          window.toast?.success('Borrador guardado');
        } else {
          showAlert('Obra creada correctamente.', 'success');
          window.toast?.success('Obra creada correctamente');
        }
      }

      setTimeout(() => {
        close();
        document.dispatchEvent(new CustomEvent('obras:refresh'));
      }, 800);

    } catch (err) {
      console.error('saveObra:', err);
      const msg = err.message?.includes('violates')
        ? 'Error de validación en la base de datos.'
        : 'No se pudo guardar la obra. Inténtalo de nuevo.';
      showAlert(msg, 'error');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = fId.value ? 'Guardar cambios' : 'Guardar obra';
    }
  }

  // ── Técnica inline (ISSUE-02) ─────────────────────────
  function showInlineTecnica() {
    if (inlineTecnicaForm)       inlineTecnicaForm.style.display       = 'flex';
    if (btnNuevaTecnicaInline)   btnNuevaTecnicaInline.style.display   = 'none';
    if (inlineTecnicaInput) { inlineTecnicaInput.value = ''; inlineTecnicaInput.focus(); }
  }

  function hideInlineTecnica() {
    if (inlineTecnicaForm)     inlineTecnicaForm.style.display   = 'none';
    if (btnNuevaTecnicaInline) btnNuevaTecnicaInline.style.display = '';
    if (inlineTecnicaInput)    inlineTecnicaInput.value = '';
    // NTH-02: devolver foco al select cuando se cancela (solo si el modal sigue abierto)
    if (fTecnica && modal?.style.display === 'flex') fTecnica.focus();
  }

  async function confirmCreateTecnica() {
    const nombre = inlineTecnicaInput?.value.trim();
    if (!nombre) {
      window.ErrorHandler?.showToast('Escribe el nombre de la técnica', 'warning');
      inlineTecnicaInput?.focus();
      return;
    }

    const slug = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-');

    try {
      const { data, error } = await client
        .from('tecnicas')
        .insert([{ nombre, slug }])
        .select('id, nombre')
        .single();

      if (error) throw error;

      // Agregar al dropdown y seleccionarla
      const opt = document.createElement('option');
      opt.value       = data.id;
      opt.textContent = data.nombre;
      fTecnica.appendChild(opt);
      fTecnica.value = data.id;

      hideInlineTecnica();
      window.ErrorHandler?.showToast(`Técnica "${data.nombre}" creada y seleccionada`, 'success');
      window.auditLogger?.crearTecnica(data.id, data.nombre);
      document.dispatchEvent(new CustomEvent('tecnicas:updated'));

    } catch (err) {
      console.error('confirmCreateTecnica:', err);
      window.ErrorHandler?.showToast('No se pudo crear la técnica', 'error');
    }
  }

  if (btnNuevaTecnicaInline)   btnNuevaTecnicaInline.addEventListener('click',   showInlineTecnica);
  if (btnCancelTecnicaInline)  btnCancelTecnicaInline.addEventListener('click',  hideInlineTecnica);
  if (btnConfirmTecnicaInline) btnConfirmTecnicaInline.addEventListener('click', confirmCreateTecnica);
  if (inlineTecnicaInput) {
    inlineTecnicaInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); confirmCreateTecnica(); }
      if (e.key === 'Escape') hideInlineTecnica();
    });
  }

  // ── Resetear formulario ───────────────────────────────
  function resetForm() {
    form.reset();
    fId.value = '';
    if (fEstado)  { fEstado.disabled  = false; fEstado.title  = ''; }
    if (fArtista) {
      fArtista.readOnly = false;
      fArtista.title    = '';
      fArtista.classList.remove('field--readonly');
    }
    window.MultiImageUpload?.reset();
    window.TagsInObra?.reset();
    hideAlert();
    hideInlineTecnica();
    // Cerrar formulario inline de tags si estaba abierto
    const inlineTagForm = document.getElementById('inlineTagForm');
    if (inlineTagForm) inlineTagForm.style.display = 'none';
    const inlineTagInput = document.getElementById('inlineTagInput');
    if (inlineTagInput) inlineTagInput.value = '';
    const existingSection = document.getElementById('existingImagesSection');
    if (existingSection) existingSection.style.display = 'none';
    const existingList = document.getElementById('existingImagesList');
    if (existingList) existingList.innerHTML = '';
  }

  // ── Alertas del modal ─────────────────────────────────
  function showAlert(msg, type = 'error') {
    formAlert.textContent   = msg;
    formAlert.className     = `form-alert ${type}`;
    formAlert.style.display = 'block';
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    formAlert.style.display = 'none';
    formAlert.textContent   = '';
    formAlert.className     = 'form-alert';
  }

  // ── Eventos del modal ─────────────────────────────────
  closeBtn  && closeBtn.addEventListener('click',  close);
  cancelBtn && cancelBtn.addEventListener('click', close);
  saveBtn   && saveBtn.addEventListener('click',   saveObra);

  // No cerrar al clicar fuera: el modal de obra tiene muchos campos
  // y un click accidental destruiría el trabajo del usuario.
  // ESC sigue funcionando (ver listener keydown abajo).

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      close();
      return;
    }
    // ISSUE-12: Ctrl+S / Cmd+S guarda el modal si está abierto
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && modal.style.display === 'flex') {
      e.preventDefault();
      saveObra();
    }
  });

  // ── API pública ───────────────────────────────────────
  window.obrasForm = { open, close };

  console.log('✏️ obras-form.js cargado');
});
