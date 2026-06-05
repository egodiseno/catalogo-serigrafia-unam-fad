/**
 * obras-form.js — Modal para crear / editar obras en Supabase
 * Fase 1.E
 *
 * Depende de: config.js (window.supabase_client)
 * Expone:     window.obrasForm.open(id?)  — llamado desde obras-list.js
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

  // Campos del formulario
  const fId          = document.getElementById('fId');
  const fTitulo      = document.getElementById('fTitulo');
  const fArtista     = document.getElementById('fArtista');
  const fAno         = document.getElementById('fAno');
  const fEstado      = document.getElementById('fEstado');
  const fTecnica     = document.getElementById('fTecnica');
  const fDescripcion = document.getElementById('fDescripcion');

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
  }

  // ── Cargar técnicas en el dropdown ────────────────────
  async function loadTecnicas() {
    try {
      const { data, error } = await client
        .from('tecnicas')
        .select('id, nombre')
        .order('nombre');

      if (error) throw error;

      // Conservar la opción vacía y agregar las técnicas
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
      const { data, error } = await client
        .from('obras')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data)  throw new Error('Obra no encontrada');

      fId.value          = data.id;
      fTitulo.value      = data.titulo      ?? '';
      fArtista.value     = data.artista     ?? '';
      fAno.value         = data.año         ?? '';
      fEstado.value      = data.estado      ?? 'borrador';
      fTecnica.value     = data.tecnica_id  ?? '';
      fDescripcion.value = data.descripcion ?? '';

    } catch (err) {
      console.error('loadObraToEdit:', err);
      showAlert('No se pudo cargar la obra.', 'error');
    }
  }

  // ── Guardar obra (INSERT o UPDATE) ───────────────────
  async function saveObra() {
    hideAlert();

    // Validaciones
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
      año:         año,
      estado:      fEstado.value      || 'borrador',
      tecnica_id:  fTecnica.value     || null,
      descripcion: fDescripcion.value.trim() || null,
    };

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Guardando…';

    try {
      const id = fId.value;

      if (id) {
        // UPDATE
        const { error } = await client
          .from('obras')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        // INSERT
        const { error } = await client
          .from('obras')
          .insert(payload);
        if (error) throw error;
      }

      showAlert(id ? 'Obra actualizada correctamente.' : 'Obra creada correctamente.', 'success');

      // Refrescar la tabla de obras después de 800ms y cerrar
      setTimeout(() => {
        close();
        // Notificar a obras-list.js para recargar
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

  // ── Resetear formulario ───────────────────────────────
  function resetForm() {
    form.reset();
    fId.value = '';
    hideAlert();
  }

  // ── Alertas del modal ─────────────────────────────────
  function showAlert(msg, type = 'error') {
    formAlert.textContent    = msg;
    formAlert.className      = `form-alert ${type}`;
    formAlert.style.display  = 'block';
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

  // Cerrar al click en el overlay (fuera del dialog)
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display === 'flex') close();
  });

  // ── API pública ───────────────────────────────────────
  window.obrasForm = { open, close };

  console.log('✏️ obras-form.js cargado');
});
