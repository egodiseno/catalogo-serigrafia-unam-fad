'use client';

/**
 * app/(admin)/admin/obras/page.jsx — /admin/obras (Gestionar Obras)
 *
 * Client Component. Auth obtenida directamente con createClient().auth.getUser()
 * del singleton lib/supabase/client.js — sin useAuth (evita GoTrueClient duplicado),
 * mismo patrón que app/(admin)/admin/page.jsx.
 *
 * Columnas verificadas contra supabase/migrations/ y obras-list.js (VanillaJS):
 *   obras:    id, titulo, artista, año, estado, updated_at, tecnica_id, descripcion,
 *             visible_publico, motivo_reapertura, snapshot_publicado
 *   tecnicas: id, nombre   ·   imagenes: id, url_storage, principal, pendiente_borrado
 *   obra_tags:tag_id → tags(id, nombre)
 *
 * Clases CSS: solo las verificadas en styles/admin.css (grep PASO 0).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import ObraForm from '@/components/admin/ObraForm';
import DiffModal from '@/components/admin/DiffModal';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { Plus, Pencil, Trash2, MessageSquare, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;
const ESTADOS = ['Borrador', 'Publicado', 'En Revisión', 'Archivado'];

const BADGE_CLS = {
  Publicado: 'badge-publicado',
  Borrador: 'badge-borrador',
  'En Revisión': 'badge-revision',
  Archivado: 'badge-archivado',
};

// Nested select reutilizado para tabla + DiffModal
const OBRA_SELECT =
  'id, titulo, artista, año, estado, updated_at, descripcion, tecnica_id, ' +
  'visible_publico, motivo_reapertura, snapshot_publicado, ' +
  'tecnicas(nombre), ' +
  'imagenes(id, url_storage, principal, orden, pendiente_borrado), ' +
  'obra_tags(tag_id, tags(id, nombre))';

export default function ObrasPage() {
  const client = createClient();

  // ── Usuario / permisos ──────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null); // { email, rol }
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  // ── Datos ────────────────────────────────────────────────────────────────
  const [obras, setObras] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Filtros ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [tecnicaFilter, setTecnicaFilter] = useState('');
  const [tecnicas, setTecnicas] = useState([]);

  // ── Modales ──────────────────────────────────────────────────────────────
  const [formObra, setFormObra] = useState(undefined); // undefined=cerrado, null=nueva, obj=editar
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [diffObra, setDiffObra] = useState(null);

  const userResolved = useRef(false);

  // ── Resolver usuario (rol + email) ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user) {
          setLoadError(true);
          setLoading(false);
          return;
        }
        const { data: adminUser, error: adminErr } = await client
          .from('usuarios_admin')
          .select('rol, email')
          .eq('email', data.user.email)
          .single();
        if (adminErr || !adminUser) {
          setLoadError(true);
          setLoading(false);
          return;
        }
        setCurrentUser({ email: adminUser.email, rol: adminUser.rol });
      } catch (err) {
        console.error('[Obras] getUser:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Leer query params (?nueva=1, ?estado=...) una vez ────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const estadoQ = params.get('estado');
    if (estadoQ && ESTADOS.includes(estadoQ)) setEstadoFilter(estadoQ);
    if (params.get('nueva') === '1') setFormObra(null);
  }, []);

  // ── Cargar técnicas para el dropdown ─────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const { data } = await client.from('tecnicas').select('id, nombre').order('nombre');
      setTecnicas(data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // ── Debounce búsqueda 300 ms ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Resetear a página 1 cuando cambian filtros
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, estadoFilter, tecnicaFilter]);

  // ── Cargar obras ─────────────────────────────────────────────────────────
  const loadObras = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      let query = client
        .from('obras')
        .select(OBRA_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })   // igual que VanillaJS obras-list.js
        .range(offset, offset + PAGE_SIZE - 1);

      if (debouncedSearch) query = query.ilike('titulo', `%${debouncedSearch}%`);
      if (estadoFilter) query = query.eq('estado', estadoFilter);
      if (tecnicaFilter) query = query.eq('tecnica_id', tecnicaFilter);

      // Editor: solo ve sus propias obras (artista = su email)
      if (currentUser.rol === 'editor') query = query.eq('artista', currentUser.email);

      const { data, count, error } = await query;
      if (error) throw error;

      setObras(data ?? []);
      setTotal(count ?? 0);
    } catch (err) {
      console.error('[Obras] loadObras:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser, page, debouncedSearch, estadoFilter, tecnicaFilter]);

  useEffect(() => {
    loadObras();
  }, [loadObras]);

  // ── Eliminar obra ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await client.from('obras').delete().eq('id', deleteTarget.id);
    if (error) {
      console.error('[Obras] delete:', error);
      throw error; // ConfirmModal mantiene el modal abierto si lanza
    }
    setDeleteTarget(null);
    loadObras();
  };

  // ── Paginación ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const desde = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2>Gestionar Obras</h2>
          <p>Administra las obras del catálogo</p>
        </div>
        {tienePermiso('obras.crear') && (
          <button
            type="button"
            className="btn btn-primary"
            id="newObraBtn"
            onClick={() => setFormObra(null)}
          >
            <Plus size={16} aria-hidden="true" /> Nueva Obra
          </button>
        )}
      </div>

      {/* Barra de filtros */}
      <div className="filter-bar">
        <div className="search-field" style={{ flex: 1, minWidth: 200 }}>
          <Search className="search-field__icon" size={15} aria-hidden="true" />
          <input
            className="search-field__input"
            type="search"
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar obras por título"
          />
        </div>
        <select
          className="select-input"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">— Todos los estados —</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="select-input"
          value={tecnicaFilter}
          onChange={(e) => setTecnicaFilter(e.target.value)}
          aria-label="Filtrar por técnica"
        >
          <option value="">— Todas las técnicas —</option>
          {tecnicas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="table-wrapper">
        <table className="obras-table" aria-label="Tabla de obras">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Título</th>
              <th>Artista</th>
              <th>Técnica</th>
              <th>Tags</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  Cargando…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  Error al cargar obras.
                </td>
              </tr>
            ) : obras.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  No hay obras con ese criterio.
                </td>
              </tr>
            ) : (
              obras.map((obra) => {
                const imgUrl =
                  obra.imagenes?.find((i) => i.principal)?.url_storage ??
                  obra.imagenes?.[0]?.url_storage;
                const tagNames = (obra.obra_tags ?? [])
                  .map((ot) => ot.tags?.nombre)
                  .filter(Boolean);
                const esReapertura = obra.estado === 'En Revisión' && obra.motivo_reapertura;
                return (
                  <tr key={obra.id}>
                    <td className="td-thumb">
                      {imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl} alt="" className="obra-thumb" />
                      ) : (
                        <span className="no-thumb">—</span>
                      )}
                    </td>
                    <td>{obra.titulo || '—'}</td>
                    <td>{obra.artista || '—'}</td>
                    <td>{obra.tecnicas?.nombre ?? '—'}</td>
                    <td className="tags-cell">
                      {tagNames.length > 0
                        ? tagNames.map((name, i) => (
                            <span key={i} className="tag-badge">{name}</span>
                          ))
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${BADGE_CLS[obra.estado] || 'badge-borrador'}`}>
                        {obra.estado}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        {esReapertura && (
                          <button
                            type="button"
                            className="btn btn-sm btn-diff btn--icon-only"
                            onClick={() => setDiffObra(obra)}
                            title="Ver cambios pendientes de revisión"
                            aria-label="Ver cambios pendientes de revisión"
                          >
                            <MessageSquare size={14} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary btn--icon-only"
                          onClick={() => setFormObra(obra)}
                          title="Editar"
                          aria-label="Editar obra"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        {tienePermiso('obras.borrar') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger btn--icon-only"
                            onClick={() => setDeleteTarget(obra)}
                            title="Eliminar"
                            aria-label="Eliminar obra"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: contador + paginación */}
      {!loading && !loadError && total > 0 && (
        <div className="usuarios-table-footer">
          <span className="table-counter">
            Mostrando {desde}-{hasta} de {total} obra{total !== 1 ? 's' : ''}
          </span>
          {totalPages > 1 && (
            <div className="table-pagination">
              <button
                type="button"
                className={`pagination-btn${page <= 1 ? ' pagination-btn--disabled' : ''}`}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <span className="pagination-ellipsis">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className={`pagination-btn${page >= totalPages ? ' pagination-btn--disabled' : ''}`}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal formulario (nueva o editar) */}
      {formObra !== undefined && currentUser && (
        <ObraForm
          obra={formObra}
          userRol={currentUser.rol}
          userEmail={currentUser.email}
          onClose={() => setFormObra(undefined)}
          onSaved={() => loadObras()}
        />
      )}

      {/* Modal eliminar */}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar obra?"
          message={`Se eliminará "${deleteTarget.titulo}". Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Modal diff (reaperturas) */}
      {diffObra && (
        <DiffModal
          obra={diffObra}
          onClose={() => setDiffObra(null)}
          onApproved={() => loadObras()}
          onRejected={() => loadObras()}
        />
      )}
    </div>
  );
}
