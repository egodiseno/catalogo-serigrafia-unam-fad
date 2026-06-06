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

    if (id) {
      modalTitle.textContent = 'Editar Obra';
      saveBtn.textContent    = 'Guardar cambios';
      await loadObraToEdit(id);
    } else {
      modalTitle.textContent = 'Nueva Obra';
      saveBtn.textContent    = 'Guardar obra';
    }

    modal.style.display = 'flex';
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

      fId.value          = data.id;
      fTitulo.value      = data.titulo      ?? '';
      fArtista.value     = data.artista     ?? '';
      fAno.value         = data.año         ?? '';
      fEstado.value      = data.estado      ?? 'borrador';
      fTecnica.value     = data.tecnica_id  ?? '';
      fDescripcion.value = data.descripcion ?? '';

      // Poblar tags seleccionados (ISSUE-03)
      window.TagsInObra?.reset();
      (tagsRes.data ?? []).forEach(row => {
        if (row.tags) window.TagsInObra?.addTag(row.tags.id, row.tags.nombre);
      });

    } catch (err) {
      console.error('loadObraToEdit:', err);
      showAlert('No se pudo cargar la obra.', 'error');
    }
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

    const payload = {
      titulo,
      artista,
      año,
      estado:      fEstado.value             || 'borrador',
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
      } else {
        const { data, error } = await client.from('obras').insert(payload).select('id').single();
        if (error) throw error;
        obraId = data.id;
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

      showAlert(editId ? 'Obra actualizada correctamente.' : 'Obra creada correctamente.', 'success');

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
    window.MultiImageUpload?.reset();
    window.TagsInObra?.reset();
    hideAlert();
    hideInlineTecnica();
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

  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });

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
