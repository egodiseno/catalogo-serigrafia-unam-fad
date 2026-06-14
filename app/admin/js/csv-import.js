/**
 * csv-import.js — Importación masiva de usuarios desde CSV
 * PASO 3: CSV Import
 *
 * Formato CSV esperado (primera fila = cabecera):
 *   email,nombre,rol
 *   usuario@unam.mx,Ana García,editor
 *
 * Roles válidos: admin | super_editor | editor
 *
 * Depende de: config.js, toast-notifications.js, error-handler.js, modals.js
 * Expone:     window.csvImportManager
 */

const CSVImportManager = (() => {
  const client        = window.supabase_client;
  const VALID_ROLES   = ['admin', 'super_editor', 'editor'];
  const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ══════════════════════════════════════════════════════════
  // PARSER CSV
  // ══════════════════════════════════════════════════════════

  /**
   * Parsea texto CSV con soporte para:
   *  - Comillas ("campo con, coma")
   *  - Comillas dobles escapadas ("campo ""con"" comillas")
   *  - CRLF y LF
   * @returns {{ headers: string[], rows: Object[] }}
   */
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      .filter(l => l.trim().length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };

    function parseLine(line) {
      const fields = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
          else { quoted = !quoted; }
        } else if (ch === ',' && !quoted) {
          fields.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur.trim());
      return fields;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
    const rows    = lines.slice(1).map(line => {
      const vals = parseLine(line);
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });

    return { headers, rows };
  }

  // ══════════════════════════════════════════════════════════
  // VALIDACIÓN POR FILA
  // ══════════════════════════════════════════════════════════

  /**
   * @returns {{
   *   csvRow: number,   // número de fila en el CSV (base 2: 1=header)
   *   email: string,
   *   nombre: string,
   *   rol: string,
   *   errors: string[],
   *   valid: boolean
   * }}
   */
  function validateRow(row, index) {
    const email  = String(row.email  ?? '').trim();
    const nombre = String(row.nombre ?? '').trim();
    const rol    = String(row.rol    ?? '').trim().toLowerCase();
    const errors = [];

    if (!email)                    errors.push('email vacío');
    else if (!EMAIL_RE.test(email)) errors.push(`email inválido ("${email}")`);

    if (!nombre) errors.push('nombre vacío');

    if (!rol)                         errors.push('rol vacío');
    else if (!VALID_ROLES.includes(rol)) errors.push(`rol "${rol}" inválido (válidos: ${VALID_ROLES.join(', ')})`);

    return { csvRow: index + 2, email, nombre, rol, errors, valid: errors.length === 0 };
  }

  // ══════════════════════════════════════════════════════════
  // MODAL PREVIEW
  // ══════════════════════════════════════════════════════════

  function showPreviewModal(validRows, invalidRows, existingEmails, onConfirm) {
    const container = document.getElementById('modalContainer');
    if (!container) {
      console.error('❌ CSVImport: #modalContainer no encontrado');
      return;
    }

    const toCreate = validRows.filter(r => !existingEmails.has(r.email.toLowerCase()));
    const toUpdate = validRows.filter(r =>  existingEmails.has(r.email.toLowerCase()));
    const modalId  = `modal-csv-${Date.now()}`;

    // ── Helpers ──────────────────────────────────────────────
    const rowsHtml = (rows, tipo) => rows.map(r => `
      <tr>
        <td class="csv-col-email">${escHtml(r.email)}</td>
        <td class="csv-col-nombre">${escHtml(r.nombre)}</td>
        <td class="csv-col-rol"><span class="badge badge-${escHtml(r.rol)}">${escHtml(r.rol)}</span></td>
        <td class="csv-col-accion">
          <span class="csv-action csv-action--${tipo}">${tipo === 'crear' ? 'Crear' : 'Actualizar'}</span>
        </td>
      </tr>`).join('');

    const errorsHtml = invalidRows.length > 0 ? `
      <details class="csv-errors">
        <summary>
          <span class="csv-badge csv-badge--error">${invalidRows.length} fila${invalidRows.length > 1 ? 's' : ''} con error — se omitirán</span>
        </summary>
        <ul class="csv-error-list">
          ${invalidRows.map(r => `<li><strong>Fila ${r.csvRow}:</strong> ${escHtml(r.errors.join(' · '))}</li>`).join('')}
        </ul>
      </details>` : '';

    const tableHtml = validRows.length > 0 ? `
      <div class="table-wrapper csv-table-wrapper">
        <table class="csv-preview-table">
          <thead>
            <tr>
              <th class="csv-col-email">Email</th>
              <th class="csv-col-nombre">Nombre</th>
              <th class="csv-col-rol">Rol</th>
              <th class="csv-col-accion">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml(toCreate, 'crear')}
            ${rowsHtml(toUpdate, 'actualizar')}
          </tbody>
        </table>
      </div>` : `<p class="csv-empty">No hay filas válidas para importar.</p>`;

    const html = `
      <div class="modal-overlay" id="${modalId}" role="dialog" aria-modal="true" aria-labelledby="${modalId}-title">
        <div class="modal-dialog modal-dialog--lg">

          <div class="modal-header">
            <h2 id="${modalId}-title">Vista previa — Importar usuarios</h2>
            <button type="button" class="modal-close btn btn-ghost" aria-label="Cerrar">
              <i data-lucide="x" style="width:16px;height:16px;" aria-hidden="true"></i>
            </button>
          </div>

          <div class="modal-body csv-preview-body">
            <div class="csv-summary">
              ${toCreate.length > 0 ? `<span class="csv-badge csv-badge--crear">${toCreate.length} a crear</span>` : ''}
              ${toUpdate.length > 0 ? `<span class="csv-badge csv-badge--actualizar">${toUpdate.length} a actualizar</span>` : ''}
              ${invalidRows.length > 0 ? `<span class="csv-badge csv-badge--error">${invalidRows.length} con error</span>` : ''}
            </div>
            ${errorsHtml}
            ${tableHtml}
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary csv-cancel-btn">Cancelar</button>
            ${validRows.length > 0
              ? `<button type="button" class="btn btn-primary csv-confirm-btn">Confirmar importación</button>`
              : ''}
          </div>

        </div>
      </div>`;

    container.innerHTML = html;
    window.IconRegistry?.init();

    const modal      = document.getElementById(modalId);
    const confirmBtn = modal.querySelector('.csv-confirm-btn');
    const cancelBtn  = modal.querySelector('.csv-cancel-btn');
    const closeBtn   = modal.querySelector('.modal-close');
    modal.style.display = 'flex';

    function closeModal() {
      modal.style.display = 'none';
      setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn?.addEventListener('click', async () => {
      confirmBtn.disabled     = true;
      confirmBtn.textContent  = 'Importando…';
      await onConfirm(toCreate, toUpdate);
      closeModal();
    });

    const escHandler = e => {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ══════════════════════════════════════════════════════════
  // OPERACIONES SUPABASE
  // ══════════════════════════════════════════════════════════

  /** Contraseña temporal aleatoria de 16 caracteres */
  function tempPassword() {
    const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 16; i++) pwd += pool[Math.floor(Math.random() * pool.length)];
    return pwd;
  }

  async function crearUsuario(row, accessToken) {
    const SUPABASE_URL  = window.supabaseConfig?.url     ?? 'https://kfvjansfmhamkrnbxmgp.supabase.co';
    const ANON_KEY      = window.supabaseConfig?.anonKey ?? '';
    const FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/create-admin-user`;

    let res;
    try {
      res = await fetch(FUNCTION_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({
          email:    row.email,
          password: tempPassword(),
          nombre:   row.nombre,
          rol:      row.rol,
        }),
      });
    } catch (netErr) {
      throw new Error(`Red: ${netErr.message}`);
    }

    let result;
    try { result = await res.json(); } catch { throw new Error(`Respuesta inválida (HTTP ${res.status})`); }

    if (!res.ok || !result.success) {
      throw new Error(result.error ?? `Error ${res.status}`);
    }
    return result;
  }

  async function actualizarUsuario(row) {
    const { error } = await client
      .from('usuarios_admin')
      .update({ nombre: row.nombre, rol: row.rol })
      .eq('email', row.email);
    if (error) throw error;
  }

  // ══════════════════════════════════════════════════════════
  // PUNTO DE ENTRADA PÚBLICO
  // ══════════════════════════════════════════════════════════

  async function importarUsuarios(file) {
    if (!file) return;

    // 1. Leer texto del archivo
    let text;
    try {
      text = await file.text();
    } catch {
      window.ErrorHandler?.showToast('No se pudo leer el archivo.', 'error');
      return;
    }

    // 2. Parsear
    const { headers, rows } = parseCSV(text);

    const required = ['email', 'nombre', 'rol'];
    const missing  = required.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      window.ErrorHandler?.showToast(
        `CSV inválido: falta${missing.length > 1 ? 'n' : ''} la${missing.length > 1 ? 's' : ''} columna${missing.length > 1 ? 's' : ''} "${missing.join('", "')}"`,
        'error'
      );
      return;
    }

    if (rows.length === 0) {
      window.ErrorHandler?.showToast('El archivo CSV no tiene filas de datos.', 'warning');
      return;
    }

    // 3. Validar filas
    const validated  = rows.map((row, i) => validateRow(row, i));
    const validRows  = validated.filter(r => r.valid);
    const invalidRows = validated.filter(r => !r.valid);

    // 4. Consultar existentes en Supabase
    let existingEmails = new Set();
    if (validRows.length > 0) {
      const emails = validRows.map(r => r.email.toLowerCase());
      const { data: found } = await client
        .from('usuarios_admin')
        .select('email')
        .in('email', emails);
      existingEmails = new Set((found ?? []).map(u => u.email.toLowerCase()));
    }

    // 5. Mostrar modal de preview
    showPreviewModal(validRows, invalidRows, existingEmails, async (toCreate, toUpdate) => {
      // 6. Obtener sesión activa
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        window.ErrorHandler?.showToast('Sesión expirada. Inicia sesión nuevamente.', 'error');
        return;
      }

      // 7. Procesar en secuencia
      let creados    = 0;
      let actualizados = 0;
      const errores  = [];

      for (const row of toCreate) {
        try {
          await crearUsuario(row, accessToken);
          window.auditLogger?.crearUsuario(row.email);
          creados++;
        } catch (e) {
          console.error('[CSVImport] crear:', row.email, e);
          errores.push(`${row.email}: ${e.message}`);
        }
      }

      for (const row of toUpdate) {
        try {
          await actualizarUsuario(row);
          window.auditLogger?.editarUsuario(row.email);
          actualizados++;
        } catch (e) {
          console.error('[CSVImport] actualizar:', row.email, e);
          errores.push(`${row.email}: ${e.message}`);
        }
      }

      // 8. Resultados
      const parts = [];
      if (creados     > 0) parts.push(`${creados} usuario${creados > 1 ? 's' : ''} importado${creados > 1 ? 's' : ''}`);
      if (actualizados > 0) parts.push(`${actualizados} actualizado${actualizados > 1 ? 's' : ''}`);

      if (parts.length > 0) {
        window.ErrorHandler?.showToast(parts.join(', '), 'success');
        document.dispatchEvent(new CustomEvent('usuarios:updated'));
      }

      if (errores.length > 0) {
        const msg = errores.length === 1
          ? `1 fila con error: ${errores[0]}`
          : `${errores.length} filas con error`;
        window.ErrorHandler?.showToast(msg, 'warning');
        console.warn('[CSVImport] Errores de importación:', errores);
      }

      if (parts.length === 0 && errores.length === 0) {
        window.ErrorHandler?.showToast('No se realizaron cambios.', 'info');
      }
    });
  }

  // ── Utilidad ──────────────────────────────────────────────
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { importarUsuarios };
})();

window.csvImportManager = CSVImportManager;
console.log('📥 CSVImportManager listo');
