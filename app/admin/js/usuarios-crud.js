/**
 * usuarios-crud.js — CRUD de Usuarios Admin
 *
 * SPRINT 1: búsqueda, filtros, paginación dinámica, contador
 * SPRINT 2: batch delete (BD + Auth via Edge Function), exportar CSV, confirmación delete
 * SPRINT 3: avatar con inicial, sort por columna, nombre en edit modal
 *
 * Depende de: config.js, modals.js, error-handler.js
 * Expone:     window.UsuariosCRUD
 *
 * ──────────────────────────────────────────────────────────────────
 * Arquitectura de datos:
 *   loadUsuarios()  → fetch completo → usuariosData[]
 *   _apply()        → filter + sort  → filteredData[]
 *   _renderPage()   → slice page     → tbody
 * ──────────────────────────────────────────────────────────────────
 */

const UsuariosCRUD = (() => {
  const client = window.supabase_client;

  // ── State ──────────────────────────────────────────────────────
  let usuariosData  = [];   // cache completo desde Supabase
  let filteredData  = [];   // tras búsqueda + filtros + sort
  let currentPage   = 1;
  let rowsPerPage   = 10;
  let sortField     = 'email';
  let sortDir       = 'asc';
  let selectedIds   = new Set();
  let searchTimer   = null;

  // Avatar: color por rol
  const ROL_COLOR = {
    admin:        '#dc2626',   // rojo
    super_editor: '#7c3aed',   // violeta
    editor:       '#013B75',   // azul institucional
  };

  // ══════════════════════════════════════════════════════════════
  // FETCH DESDE SUPABASE
  // ══════════════════════════════════════════════════════════════

  async function loadUsuarios() {
    const tbody = document.getElementById('usuariosList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Cargando…</td></tr>';
    selectedIds.clear();
    _updateBatchButton();

    try {
      const { data, error } = await client
        .from('usuarios_admin')
        .select('id, email, nombre, numero_cuenta, rol, estado')
        .order('email', { ascending: true });

      if (error) throw error;

      usuariosData = data ?? [];
      _apply(true);

    } catch (err) {
      console.error('[UsuariosCRUD] loadUsuarios:', err);
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Error al cargar usuarios.</td></tr>';
      window.ErrorHandler?.showToast('Error al cargar usuarios', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FILTRAR + SORT + PAGINAR
  // ══════════════════════════════════════════════════════════════

  function _apply(resetPage = true) {
    const q      = (document.getElementById('inputBuscarUsuario')?.value ?? '').toLowerCase().trim();
    const rolFil = document.getElementById('filterRol')?.value   ?? '';
    const estFil = document.getElementById('filterEstado')?.value ?? '';

    filteredData = usuariosData.filter(u => {
      // Texto libre: email o nombre
      if (q) {
        const inEmail  = (u.email  ?? '').toLowerCase().includes(q);
        const inNombre = (u.nombre ?? '').toLowerCase().includes(q);
        if (!inEmail && !inNombre) return false;
      }
      // Filtro rol exacto
      if (rolFil && u.rol !== rolFil) return false;
      // Filtro estado: 'activo' / 'inactivo'
      if (estFil) {
        if (estFil === 'activo'   &&  !u.estado) return false;
        if (estFil === 'inactivo' && !!u.estado) return false;
      }
      return true;
    });

    // Ordenar
    filteredData = _sort(filteredData);

    if (resetPage) currentPage = 1;
    _renderPage();
    _renderPagination();
    _updateCounter();
  }

  function _sort(arr) {
    return [...arr].sort((a, b) => {
      let va = a[sortField] ?? '';
      let vb = b[sortField] ?? '';
      if (typeof va === 'boolean') va = va ? 'activo' : 'inactivo';
      if (typeof vb === 'boolean') vb = vb ? 'activo' : 'inactivo';
      const cmp = String(va).toLowerCase().localeCompare(String(vb).toLowerCase(), 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // RENDERIZADO
  // ══════════════════════════════════════════════════════════════

  function _renderPage() {
    const tbody = document.getElementById('usuariosList');
    if (!tbody) return;

    const start = (currentPage - 1) * rowsPerPage;
    const page  = filteredData.slice(start, start + rowsPerPage);

    if (page.length === 0) {
      const noData = usuariosData.length === 0;
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
        ${noData
          ? 'Sin usuarios. <a href="#" class="cta-link" onclick="window.UsuariosCRUD?.openCreateModal(); return false">Invitar primero →</a>'
          : 'Sin resultados para los filtros actuales.'}
      </td></tr>`;
      const all = document.getElementById('selectAllUsers');
      if (all) { all.checked = false; all.indeterminate = false; }
      return;
    }

    tbody.innerHTML = page.map(u => _buildRow(u)).join('');

    // Event listeners de fila
    tbody.querySelectorAll('[data-edit-id]').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId)));

    tbody.querySelectorAll('[data-reset-email]').forEach(btn =>
      btn.addEventListener('click', () => resetPasswordUsuario(btn.dataset.resetEmail)));

    tbody.querySelectorAll('[data-del-id]').forEach(btn =>
      btn.addEventListener('click', () => deleteUsuario(btn.dataset.delId, btn.dataset.delEmail)));

    tbody.querySelectorAll('.select-user').forEach(cb => {
      // Restaurar estado si ya estaba seleccionado
      if (selectedIds.has(cb.dataset.userId)) cb.checked = true;
      cb.addEventListener('change', () => {
        const id = cb.dataset.userId;
        cb.checked ? selectedIds.add(id) : selectedIds.delete(id);
        _updateBatchButton();
        _syncSelectAll();
      });
    });

    window.IconRegistry?.init();
    if (typeof inicializarPermisos === 'function') inicializarPermisos();
    _syncSelectAll();
  }

  /** Construye el HTML de una fila */
  function _buildRow(u) {
    const color   = ROL_COLOR[u.rol] ?? '#6b7280';
    // Initial: primer char de nombre (limpio), si no del email
    const nombre  = (u.nombre ?? '').trim();
    const initCh  = (nombre[0] ?? u.email?.[0] ?? '?').toUpperCase();

    // Nombre visible: ignorar "-" (guión suelto) como placeholder de BD
    const nombreOk   = nombre && nombre !== '-';
    const nombreText = nombreOk
      ? escapeHtml(nombre)
      : '<span class="text-muted">—</span>';

    return `
      <tr data-row-id="${u.id}">
        <td class="td-checkbox">
          <input type="checkbox" class="select-user"
                 data-user-id="${u.id}"
                 data-email="${escapeHtml(u.email)}"
                 aria-label="Seleccionar ${escapeHtml(u.email)}">
        </td>
        <td class="td-email-cell">
          <span class="row-avatar" style="background:${color};" aria-hidden="true">${initCh}</span>
          <span>${escapeHtml(u.email)}</span>
        </td>
        <td>${nombreText}</td>
        <td class="td-cuenta">
          ${u.numero_cuenta ? `<code class="cuenta-code">${escapeHtml(String(u.numero_cuenta))}</code>` : '<span class="text-muted">—</span>'}
        </td>
        <td><span class="badge badge-${escapeHtml(u.rol)}">${escapeHtml(u.rol)}</span></td>
        <td>
          <span class="badge ${u.estado ? 'badge-publicado' : 'badge-archivado'}">
            ${u.estado ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="actions-cell">
          <div class="action-buttons">
            <button class="btn btn-sm btn-secondary"
                    data-edit-id="${u.id}" title="Editar usuario">
              <i data-lucide="pen" style="width:14px;height:14px;" aria-hidden="true"></i> Editar
            </button>
            <button class="btn btn-sm btn-secondary"
                    data-reset-email="${escapeHtml(u.email)}" title="Resetear contraseña">
              <i data-lucide="key-round" style="width:14px;height:14px;" aria-hidden="true"></i> Resetear
            </button>
            <button class="btn btn-sm btn-danger btn--icon-only"
                    data-del-id="${u.id}"
                    data-del-email="${escapeHtml(u.email)}"
                    data-permiso="usuarios.borrar" title="Eliminar usuario">
              <i data-lucide="trash-2" style="width:14px;height:14px;" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  // ══════════════════════════════════════════════════════════════
  // PAGINACIÓN
  // ══════════════════════════════════════════════════════════════

  function _renderPagination() {
    const nav   = document.getElementById('usuariosPaginacion');
    if (!nav) return;

    const total = Math.ceil(filteredData.length / rowsPerPage);

    if (total <= 1) { nav.innerHTML = ''; return; }

    const mkBtn = (label, page, disabled = false, active = false) => {
      const cls = ['pagination-btn',
        active   ? 'pagination-btn--active'   : '',
        disabled ? 'pagination-btn--disabled' : '',
      ].filter(Boolean).join(' ');
      return disabled
        ? `<span class="${cls}" aria-disabled="true">${label}</span>`
        : `<button type="button" class="${cls}" data-page="${page}">${label}</button>`;
    };

    const parts = [];
    parts.push(mkBtn('‹', currentPage - 1, currentPage === 1));

    const lo = Math.max(1, currentPage - 2);
    const hi = Math.min(total, currentPage + 2);

    if (lo > 1) { parts.push(mkBtn('1', 1)); if (lo > 2) parts.push('<span class="pagination-ellipsis">…</span>'); }
    for (let p = lo; p <= hi; p++) parts.push(mkBtn(p, p, false, p === currentPage));
    if (hi < total) { if (hi < total - 1) parts.push('<span class="pagination-ellipsis">…</span>'); parts.push(mkBtn(total, total)); }

    parts.push(mkBtn('›', currentPage + 1, currentPage === total));

    nav.innerHTML = parts.join('');
    nav.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = Number(btn.dataset.page);
        _renderPage();
        _renderPagination();
        _updateCounter();
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // CONTADOR + BATCH + SELECT-ALL
  // ══════════════════════════════════════════════════════════════

  function _updateCounter() {
    const el = document.getElementById('usuariosCounter');
    if (!el) return;
    const total = filteredData.length;
    if (total === 0) { el.textContent = 'Sin resultados'; return; }
    const from = (currentPage - 1) * rowsPerPage + 1;
    const to   = Math.min(currentPage * rowsPerPage, total);
    el.textContent = `Mostrando ${from}–${to} de ${total} usuario${total !== 1 ? 's' : ''}`;
  }

  function _updateBatchButton() {
    const btn = document.getElementById('btnBorrarSeleccionados');
    if (!btn) return;
    const n = selectedIds.size;
    btn.style.display = n > 0 ? '' : 'none';
    btn.innerHTML = `<i data-lucide="trash-2" style="width:14px;height:14px;" aria-hidden="true"></i>
      Borrar ${n} seleccionado${n !== 1 ? 's' : ''}`;
    window.IconRegistry?.init();
  }

  function _syncSelectAll() {
    const all = document.getElementById('selectAllUsers');
    if (!all) return;
    const start   = (currentPage - 1) * rowsPerPage;
    const pageIds = filteredData.slice(start, start + rowsPerPage).map(u => u.id);
    const allSel  = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const someSel = pageIds.some(id => selectedIds.has(id));
    all.checked       = allSel;
    all.indeterminate = !allSel && someSel;
  }

  // ══════════════════════════════════════════════════════════════
  // SORT POR COLUMNA
  // ══════════════════════════════════════════════════════════════

  function _toggleSort(field) {
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDir   = 'asc';
    }
    _refreshSortHeaders();
    _apply(false);
  }

  function _refreshSortHeaders() {
    document.querySelectorAll('.sortable-col').forEach(th => {
      const col = th.dataset.sortCol;
      th.classList.toggle('sortable-col--asc',  col === sortField && sortDir === 'asc');
      th.classList.toggle('sortable-col--desc', col === sortField && sortDir === 'desc');
      th.setAttribute('aria-sort',
        col !== sortField ? 'none' : sortDir === 'asc' ? 'ascending' : 'descending');
    });
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER — llamar delete-users-batch Edge Function
  // ══════════════════════════════════════════════════════════════

  /**
   * Llama a la Edge Function delete-users-batch que elimina usuarios
   * de AMBAS tablas: usuarios_admin Y auth.users (requiere service_role_key en el servidor).
   *
   * @param {string[]} emails — lista de emails a eliminar
   * @returns {Promise<{success:true, deleted_count:number, not_found?:string[], auth_errors?:Array, message:string}>}
   * @throws {Error} si la red falla, la respuesta no es JSON, o la función devuelve success=false
   */
  async function _callDeleteBatch(emails) {
    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');

    const FUNCTION_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/delete-users-batch';
    const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

    let response;
    try {
      response = await fetch(FUNCTION_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({ emails }),
      });
    } catch (netErr) {
      throw new Error(`Error de red al eliminar usuario(s): ${netErr.message}`);
    }

    let result;
    try { result = await response.json(); }
    catch { throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}).`); }

    if (!response.ok || !result.success)
      throw new Error(result.error ?? `Error ${response.status} al eliminar usuario(s).`);

    // Advertir en consola si algún Auth delete falló (el registro de BD ya se borró)
    if (result.auth_errors?.length) {
      console.warn('[UsuariosCRUD] Algunos usuarios se borraron de la BD pero su cuenta Auth no pudo eliminarse:', result.auth_errors);
    }

    return result;
  }

  // ══════════════════════════════════════════════════════════════
  // BATCH DELETE
  // ══════════════════════════════════════════════════════════════

  async function batchDeleteSelected() {
    if (selectedIds.size === 0) return;

    const emailActual = window.usuarioActual?.email ?? '';
    const rolActual   = window.getRolActual?.() ?? 'editor';
    const toDelete    = usuariosData.filter(u => selectedIds.has(u.id));

    // Guard: no auto-borrar
    if (toDelete.find(u => u.email === emailActual)) {
      window.ErrorHandler?.showToast('No puedes borrar tu propia cuenta', 'error');
      return;
    }
    // Guard: super_editor no puede borrar admins
    if (rolActual === 'super_editor' && toDelete.find(u => u.rol === 'admin')) {
      window.ErrorHandler?.showToast('No puedes eliminar cuentas de administrador.', 'error');
      return;
    }
    // Guard: no eliminar el último admin
    const todosAdmins = usuariosData.filter(u => u.rol === 'admin');
    const borrAdmins  = toDelete.filter(u => u.rol === 'admin');
    if (borrAdmins.length >= todosAdmins.length) {
      window.ErrorHandler?.showToast('No se puede eliminar el último administrador.', 'error');
      return;
    }

    const n = toDelete.length;
    window.ModalManager.openConfirm({
      title:       `¿Borrar ${n} usuario${n !== 1 ? 's' : ''}?`,
      message:     `Esta acción eliminará ${n} usuario${n !== 1 ? 's' : ''} permanentemente (BD + cuenta Auth) y no se puede deshacer.`,
      confirmText: `Borrar ${n}`,
      cancelText:  'Cancelar',
      tipo:        'danger',
      onConfirm:   async () => {
        try {
          const emails = toDelete.map(u => u.email);
          const result = await _callDeleteBatch(emails);
          selectedIds.clear();
          window.ErrorHandler?.showToast(
            result.message ?? `${n} usuario${n !== 1 ? 's eliminados' : ' eliminado'}`,
            'success'
          );
          document.dispatchEvent(new CustomEvent('usuarios:updated'));
        } catch (err) {
          console.error('[UsuariosCRUD] batchDelete:', err);
          window.ErrorHandler?.showToast(err.message || 'No se pudieron eliminar los usuarios.', 'error');
        }
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // EXPORTAR CSV
  // ══════════════════════════════════════════════════════════════

  function exportCSV() {
    if (filteredData.length === 0) {
      window.ErrorHandler?.showToast('No hay usuarios para exportar', 'warning');
      return;
    }

    const headers = ['email', 'nombre', 'numero_cuenta', 'rol', 'estado', 'id'];
    const rows    = filteredData.map(u => [
      u.email          ?? '',
      (u.nombre ?? '').replace(/^-$/, ''),  // limpiar guión suelto
      u.numero_cuenta  ?? '',
      u.rol            ?? '',
      u.estado  ? 'activo' : 'inactivo',
      u.id             ?? '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `usuarios-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);

    window.ErrorHandler?.showToast(
      `CSV exportado — ${filteredData.length} usuario${filteredData.length !== 1 ? 's' : ''}`,
      'success'
    );
  }

  // ══════════════════════════════════════════════════════════════
  // MODALES — EDICIÓN
  // ══════════════════════════════════════════════════════════════

  function openEditModal(id) {
    const u = usuariosData.find(u => u.id === id);
    if (!u) {
      window.ErrorHandler?.showToast('Usuario no encontrado', 'error');
      return;
    }
    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    // Limpiar guión suelto antes de mostrar
    const nombreActual = (u.nombre ?? '') === '-' ? '' : (u.nombre ?? '');

    window.ModalManager.open({
      title: `Editar: ${u.email}`,
      fields: [
        {
          name:         'nombre',
          label:        'Nombre',
          type:         'text',
          required:     false,
          defaultValue: nombreActual,
        },
        {
          name:         'rol',
          label:        'Rol',
          type:         'select',
          required:     true,
          defaultValue: u.rol,
          options: [
            { value: 'admin',        label: 'Admin'        },
            { value: 'super_editor', label: 'Super Editor' },
            { value: 'editor',       label: 'Editor'       },
          ],
        },
        {
          name:         'estado',
          label:        'Estado',
          type:         'select',
          required:     true,
          defaultValue: String(u.estado),
          options: [
            { value: 'true',  label: 'Activo'   },
            { value: 'false', label: 'Inactivo' },
          ],
        },
      ],
      onSave: async (data) => {
        const estado = data.estado === 'true' || data.estado === true;
        const nombre = (data.nombre ?? '').trim() || null;

        const { error } = await client
          .from('usuarios_admin')
          .update({ rol: data.rol, estado, nombre })
          .eq('id', id);

        if (error) throw error;

        window.auditLogger?.editarUsuario(u.email);
        window.ErrorHandler?.showToast('Usuario actualizado', 'success');
        document.dispatchEvent(new CustomEvent('usuarios:updated'));
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MODALES — CREACIÓN
  // ══════════════════════════════════════════════════════════════

  function openCreateModal() {
    if (!window.ModalManager) {
      window.ErrorHandler?.showToast('Error interno: módulo de modal no disponible', 'error');
      return;
    }

    window.ModalManager.open({
      title: 'Nuevo Usuario Admin',
      fields: [
        { name: 'nombre',   label: 'Nombre',     type: 'text',     required: true  },
        { name: 'email',    label: 'Email',      type: 'email',    required: true  },
        { name: 'password', label: 'Contraseña', type: 'password', required: true  },
        {
          name: 'rol', label: 'Rol', type: 'select', required: true,
          options: [
            { value: 'admin',        label: 'Administrador' },
            { value: 'super_editor', label: 'Super Editor'  },
            { value: 'editor',       label: 'Editor'        },
          ],
        },
      ],
      onSave: async (data) => {
        try {
          if (!data.nombre?.trim()) throw new Error('El nombre es obligatorio.');
          const VALID_ROLES = ['admin', 'super_editor', 'editor'];
          if (!VALID_ROLES.includes(data.rol))
            throw new Error(`Rol no permitido: "${data.rol}".`);

          const { data: sessionData } = await client.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          if (!accessToken) throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');

          const FUNCTION_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/create-admin-user';
          const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

          let response;
          try {
            response = await fetch(FUNCTION_URL, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey':        ANON_KEY,
              },
              body: JSON.stringify({
                email:    data.email,
                password: data.password,
                nombre:   data.nombre.trim(),
                rol:      data.rol,
              }),
            });
          } catch (networkErr) {
            throw new Error(`Error de red: ${networkErr.message}`);
          }

          let result;
          try { result = await response.json(); }
          catch { throw new Error(`Respuesta inválida (HTTP ${response.status}).`); }

          if (!response.ok || !result.success)
            throw new Error(result.error ?? `Error ${response.status} al crear el usuario.`);

          window.auditLogger?.crearUsuario(result.email ?? data.email);
          window.ErrorHandler?.showToast(
            `Usuario ${result.email} creado y activado correctamente.`, 'success');
          document.dispatchEvent(new CustomEvent('usuarios:updated'));

          // Welcome email (no bloquea si falla)
          try {
            const wUrl = `${SUPABASE_URL}/functions/v1/send-welcome-email`;
            const wRes = await fetch(wUrl, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': ANON_KEY },
              body:    JSON.stringify({ email: data.email, nombre: data.nombre.trim(), rol: data.rol }),
            });
            const wData = await wRes.json().catch(() => ({}));
            if (wRes.ok && wData.success)
              window.ErrorHandler?.showToast(`Email de bienvenida enviado a ${data.email}`, 'success', 'mail-check');
          } catch (_) { /* no crítico */ }

        } catch (err) {
          const t = document.getElementById('errorTitle');
          const d = document.getElementById('errorDetail');
          const m = document.getElementById('errorMessage');
          if (t) t.textContent = 'Error al crear usuario';
          if (d) d.textContent = err.message;
          if (m) m.style.display = 'flex';
          return false;  // mantener modal abierto
        }
      },
    });

    setupPasswordToggle();
  }

  // ══════════════════════════════════════════════════════════════
  // ELIMINAR USUARIO (individual)
  // ══════════════════════════════════════════════════════════════

  async function deleteUsuario(id, email) {
    const rolActual   = window.getRolActual?.() ?? 'editor';
    const emailActual = window.usuarioActual?.email ?? '';
    const target      = usuariosData.find(u => u.id === id);

    if (rolActual === 'editor') {
      window.ErrorHandler?.showToast('No tienes acceso a esta función.', 'error');
      return;
    }
    if (emailActual && target?.email === emailActual) {
      window.ErrorHandler?.showToast('No puedes eliminar tu propia cuenta.', 'error');
      return;
    }
    if (rolActual === 'super_editor' && target?.rol === 'admin') {
      window.ErrorHandler?.showToast('No puedes eliminar cuentas de administrador.', 'error');
      return;
    }
    const admins = usuariosData.filter(u => u.rol === 'admin');
    if (target?.rol === 'admin' && admins.length <= 1) {
      window.ErrorHandler?.showToast('No se puede eliminar el último administrador.', 'error');
      return;
    }

    const nombreDisplay = (target?.nombre?.trim() && target.nombre !== '-')
      ? target.nombre : email;

    window.ModalManager.openConfirm({
      title:       '¿Eliminar usuario?',
      message:     `Se eliminará a "${nombreDisplay}" (${email}). Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText:  'Cancelar',
      tipo:        'danger',
      onConfirm:   async () => _doDelete(id, email),
    });
  }

  async function _doDelete(id, email) {
    try {
      // Edge Function elimina de usuarios_admin Y auth.users (requiere service_role en el servidor)
      await _callDeleteBatch([email]);
      selectedIds.delete(id);
      window.auditLogger?.borrarUsuario(email);
      window.ErrorHandler?.showToast(`Usuario "${email}" eliminado`, 'success');
      document.dispatchEvent(new CustomEvent('usuarios:updated'));
    } catch (err) {
      console.error('[UsuariosCRUD] _doDelete:', err);
      window.ErrorHandler?.showToast(err.message || 'No se pudo eliminar el usuario.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // RESET PASSWORD
  // ══════════════════════════════════════════════════════════════

  async function resetPasswordUsuario(email) {
    window.ModalManager.openConfirm({
      title:       'Resetear contraseña',
      message:     `Se enviará un link de restablecimiento a "${email}". El usuario deberá revisar su bandeja de entrada.`,
      confirmText: 'Enviar link',
      cancelText:  'Cancelar',
      onConfirm:   async () => _doReset(email),
    });
  }

  async function _doReset(email) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');

      const FUNCTION_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/reset-user-password';
      const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

      let response;
      try {
        response = await fetch(FUNCTION_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': ANON_KEY },
          body:    JSON.stringify({ email }),
        });
      } catch (netErr) { throw new Error(`Error de red: ${netErr.message}`); }

      let result;
      try { result = await response.json(); }
      catch { throw new Error(`Respuesta inválida (HTTP ${response.status}).`); }

      if (!response.ok || !result.success) throw new Error(result.error ?? `Error ${response.status}.`);

      window.ErrorHandler?.showToast(`Link de restablecimiento enviado a ${email}`, 'success', 'mail-check');
    } catch (err) {
      console.error('[UsuariosCRUD] _doReset:', err);
      window.ErrorHandler?.showToast(err.message || 'No se pudo enviar el link.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setupPasswordToggle() {
    const input = document.querySelector('.modal-form input[type="password"]');
    if (!input || input.dataset.toggleDone) return;
    input.dataset.toggleDone = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'password-toggle-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle-btn';
    btn.setAttribute('aria-label', 'Mostrar contraseña');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<i data-lucide="eye" style="width:16px;height:16px;" aria-hidden="true"></i>';
    wrapper.appendChild(btn);
    window.IconRegistry?.init();

    btn.addEventListener('click', () => {
      const vis  = input.type === 'text';
      input.type = vis ? 'password' : 'text';
      const icon = vis ? 'eye' : 'eye-off';
      btn.innerHTML = `<i data-lucide="${icon}" style="width:16px;height:16px;" aria-hidden="true"></i>`;
      window.IconRegistry?.init();
      btn.setAttribute('aria-label',   vis ? 'Mostrar contraseña' : 'Ocultar contraseña');
      btn.setAttribute('aria-pressed', String(!vis));
    });
  }

  // ══════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    // Botones de cabecera
    document.getElementById('newUsuarioBtn')
      ?.addEventListener('click', e => { e.preventDefault(); openCreateModal(); });

    document.getElementById('btnExportarUsuarios')
      ?.addEventListener('click', exportCSV);

    // CSV import
    const csvBtn  = document.getElementById('csvImportBtn');
    const csvFile = document.getElementById('csvImportFile');
    if (csvBtn && csvFile) {
      csvBtn.addEventListener('click', () => csvFile.click());
      csvFile.addEventListener('change', () => {
        const f = csvFile.files?.[0];
        if (f) { window.csvImportManager?.importarUsuarios(f); csvFile.value = ''; }
      });
    }

    // Búsqueda (debounce 300 ms)
    document.getElementById('inputBuscarUsuario')
      ?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => _apply(true), 300);
      });

    // Filtros dropdown
    document.getElementById('filterRol')
      ?.addEventListener('change', () => _apply(true));
    document.getElementById('filterEstado')
      ?.addEventListener('change', () => _apply(true));

    // Limpiar filtros
    document.getElementById('btnLimpiarFiltros')
      ?.addEventListener('click', () => {
        const i = document.getElementById('inputBuscarUsuario');
        const r = document.getElementById('filterRol');
        const e = document.getElementById('filterEstado');
        if (i) i.value = '';
        if (r) r.value = '';
        if (e) e.value = '';
        _apply(true);
      });

    // Filas por página
    document.getElementById('selectRowsPerPage')
      ?.addEventListener('change', ev => {
        rowsPerPage = parseInt(ev.target.value) || 10;
        _apply(true);
      });

    // Select-All (delegado en document para sobrevivir re-renders)
    document.addEventListener('change', e => {
      if (e.target?.id !== 'selectAllUsers') return;
      const checked = e.target.checked;
      const start   = (currentPage - 1) * rowsPerPage;
      const pageIds = filteredData.slice(start, start + rowsPerPage).map(u => u.id);
      pageIds.forEach(id => checked ? selectedIds.add(id) : selectedIds.delete(id));
      document.querySelectorAll('.select-user').forEach(cb => {
        if (pageIds.includes(cb.dataset.userId)) cb.checked = checked;
      });
      _updateBatchButton();
    });

    // Batch delete
    document.getElementById('btnBorrarSeleccionados')
      ?.addEventListener('click', batchDeleteSelected);

    // Sort por columna (delegado)
    document.addEventListener('click', e => {
      const th = e.target.closest('.sortable-col');
      if (!th) return;
      const table = document.getElementById('usuariosTable');
      if (!table?.contains(th)) return;
      _toggleSort(th.dataset.sortCol);
    });

    // Reload tras cambios externos
    document.addEventListener('usuarios:updated', loadUsuarios);

    // Cargar al navegar a la sección
    document.querySelectorAll('[data-section="usuarios"]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(loadUsuarios, 60));
    });

    // Sort manager (compatibilidad con otras tablas)
    window.sortManager?.registerTable('usuarios-table', [
      { label: 'Email A–Z', field: 'email' },
      { label: 'Rol',       field: 'rol'   },
    ], { field: 'email', direction: 'asc' });

    console.log('👥 UsuariosCRUD listo (Sprint 1+2)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    openCreateModal,
    openEditModal,
    deleteUsuario,
    loadUsuarios,
    resetPasswordUsuario,
    exportCSV,
    batchDeleteSelected,
  };
})();

window.UsuariosCRUD = UsuariosCRUD;
