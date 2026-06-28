'use client';

/**
 * app/(admin)/admin/mi-perfil/page.jsx
 *
 * Mi Perfil — Client Component.
 * Layout tres columnas (replicando profile.js + layout VanillaJS):
 *
 *   Col 1 — .column-datos   : avatar, nombre (editable), numero_cuenta (editor),
 *                              email (read-only), rol (badge), miembro desde, estado
 *                              + botón "Guardar cambios" abajo
 *   Col 2 — .column-acciones: "Acciones rápidas" (.quick-actions-container)
 *                              Contenido varía por rol (replicando profile.js)
 *   Col 3 — .column-contrasena: "Cambiar contraseña" (3 campos + botón guardar)
 *
 * MFA: no presente en profile.js VanillaJS → no se muestra en ningún rol.
 *
 * Auth: createClient().auth.getUser() → usuarios_admin lookup (NO useAuth)
 * CSS: únicamente selectores verificados en styles/admin.css
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Save,
  Eye,
  EyeOff,
  KeyRound,
  Check,
  LayoutGrid,
  PlusCircle,
  UserPlus,
  Activity,
  Tag,
  Brush,
} from 'lucide-react';

/* ─── Helpers ─────────────────────────────────────────────────────── */
function getInitial(nombre, email) {
  const src = nombre?.trim() || email || '?';
  return src[0].toUpperCase();
}

function getRolLabel(rol) {
  switch (rol) {
    case 'admin':        return 'Administrador';
    case 'super_editor': return 'Super Editor';
    case 'editor':       return 'Editor';
    default:             return rol ?? '—';
  }
}

function getRolBadgeStyle(rol) {
  switch (rol) {
    case 'admin':        return { background: '#013B75', color: '#fff' };
    case 'super_editor': return { background: '#7C3AED', color: '#fff' };
    case 'editor':       return { background: '#059669', color: '#fff' };
    default:             return { background: '#6B7280', color: '#fff' };
  }
}

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/* ─── PasswordField con toggle ────────────────────────────────────── */
function PasswordField({ id, label, value, onChange, disabled, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="password-toggle-wrapper">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`search-input${error ? ' input--error' : ''}`}
          value={value}
          onChange={onChange}
          disabled={disabled}
          autoComplete={autoComplete ?? 'current-password'}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          tabIndex={-1}
        >
          {show
            ? <EyeOff size={16} aria-hidden="true" />
            : <Eye    size={16} aria-hidden="true" />}
        </button>
      </div>
      {error && <span className="field-error" style={{ display: 'block' }}>{error}</span>}
    </div>
  );
}

/* ─── Definición de acciones rápidas por rol (replicando profile.js) ── */
const QUICK_ACTIONS = {
  admin: [
    { label: 'Nueva Obra',     Icon: PlusCircle, href: '/admin/obras',     hint: 'Agregar obra al catálogo',   highlight: false },
    { label: 'Nuevo Usuario',  Icon: UserPlus,   href: '/admin/usuarios',  hint: 'Crear cuenta de usuario',   highlight: false },
    { label: 'Ver Logs',       Icon: Activity,   href: '/admin/logs',      hint: 'Auditoría del sistema',     highlight: false },
    { label: 'Gestionar Tags', Icon: Tag,        href: '/admin/tags',      hint: 'Administrar etiquetas',     highlight: false },
  ],
  super_editor: [
    { label: 'Nueva Obra',      Icon: PlusCircle, href: '/admin/obras',     hint: 'Agregar obra al catálogo',    highlight: false },
    { label: 'Nuevo Usuario',   Icon: UserPlus,   href: '/admin/usuarios',  hint: 'Crear cuenta de usuario',    highlight: false },
    { label: 'Gestionar Tags',  Icon: Tag,        href: '/admin/tags',      hint: 'Administrar etiquetas',      highlight: false },
    { label: 'Técnicas',        Icon: Brush,      href: '/admin/tecnicas',  hint: 'Administrar técnicas',       highlight: false },
  ],
  editor: [
    { label: 'Mi Portafolio', Icon: LayoutGrid,  href: '/admin/mi-portafolio', hint: 'Ver mis obras',              highlight: false },
    { label: 'Nueva Obra',    Icon: PlusCircle,  href: '/admin/mi-portafolio', hint: 'Agregar obra al catálogo',   highlight: true  },
  ],
};

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function MiPerfilPage() {
  const router = useRouter();
  const client = createClient();

  /* ── Auth + perfil ────────────────────────────────────────── */
  const [authUser,  setAuthUser]  = useState(null);
  const [perfil,    setPerfil]    = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (!user || error) { router.replace('/login'); return; }

      const { data: adminRow } = await client
        .from('usuarios_admin')
        .select('id, nombre, email, rol, estado, numero_cuenta, created_at')
        .eq('id', user.id)
        .single();

      if (!adminRow) { router.replace('/login'); return; }

      setAuthUser(user);
      setPerfil(adminRow);
      setNombre(adminRow.nombre ?? '');
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Col 1: Datos personales ──────────────────────────────── */
  const [nombre,     setNombre]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [savedOk,    setSavedOk]    = useState(false);
  const [errorDatos, setErrorDatos] = useState(null);

  const handleSaveDatos = async () => {
    if (!perfil) return;
    const trimmed = nombre.trim();
    if (trimmed === (perfil.nombre ?? '').trim()) return; // sin cambios reales

    setSaving(true);
    setErrorDatos(null);
    setSavedOk(false);
    try {
      const { error: err } = await client
        .from('usuarios_admin')
        .update({ nombre: trimmed || null })
        .eq('id', perfil.id);

      if (err) throw err;
      setPerfil(prev => ({ ...prev, nombre: trimmed || null }));
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      setErrorDatos(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Col 3: Cambiar contraseña ────────────────────────────── */
  const [currentPass, setCurrentPass] = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passErrors,  setPassErrors]  = useState({});
  const [savingPass,  setSavingPass]  = useState(false);
  const [passMsg,     setPassMsg]     = useState(null);  // { type: 'ok'|'err', text }

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!currentPass)            errs.current  = 'Ingresa tu contraseña actual.';
    if (newPass.length < 8)      errs.new      = 'Mínimo 8 caracteres.';
    if (newPass === currentPass && newPass) errs.new = 'Debe ser diferente a la contraseña actual.';
    if (newPass !== confirmPass)  errs.confirm  = 'Las contraseñas no coinciden.';
    if (Object.keys(errs).length) { setPassErrors(errs); return; }
    setPassErrors({});

    setSavingPass(true);
    setPassMsg(null);
    try {
      /* Verificar contraseña actual re-autenticando */
      const { error: signInErr } = await client.auth.signInWithPassword({
        email:    perfil.email,
        password: currentPass,
      });
      if (signInErr) {
        setPassErrors({ current: 'Contraseña actual incorrecta.' });
        setSavingPass(false);
        return;
      }

      /* Cambiar contraseña */
      const { error: updErr } = await client.auth.updateUser({ password: newPass });
      if (updErr) throw updErr;

      setPassMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err) {
      setPassMsg({ type: 'err', text: err.message ?? 'No se pudo cambiar la contraseña.' });
    } finally {
      setSavingPass(false);
    }
  };

  /* ─── Render ───────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="Cargando…" />
      </div>
    );
  }

  const initial         = getInitial(perfil?.nombre, perfil?.email);
  const hayDatosChange  = nombre.trim() !== (perfil?.nombre ?? '').trim();
  const esEditor        = perfil?.rol === 'editor';
  const quickActions    = QUICK_ACTIONS[perfil?.rol] ?? QUICK_ACTIONS.editor;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2>Mi Perfil</h2>
          <p>Datos personales y configuración de tu cuenta</p>
        </div>
      </div>

      <div className="profile-grid">

        {/* ══ COL 1 — Datos personales ══════════════════════ */}
        <div className="profile-column column-datos">

          {/* Avatar */}
          <div className="avatar-circle" aria-hidden="true">
            {initial}
          </div>

          <div className="profile-info">
            {/* Nombre editable */}
            <div className="profile-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span className="profile-label">Nombre</span>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                disabled={saving}
                placeholder="Tu nombre completo"
                aria-label="Nombre completo"
              />
            </div>

            {/* Número de cuenta — solo visible para editor */}
            {esEditor && (
              <div className="profile-row">
                <span className="profile-label">Nº de cuenta</span>
                <span>{perfil?.numero_cuenta || '—'}</span>
              </div>
            )}

            {/* Email — solo lectura */}
            <div className="profile-row">
              <span className="profile-label">Email</span>
              <span>{perfil?.email ?? '—'}</span>
            </div>

            {/* Rol */}
            <div className="profile-row">
              <span className="profile-label">Rol</span>
              <span
                className="badge"
                style={{
                  ...getRolBadgeStyle(perfil?.rol),
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {getRolLabel(perfil?.rol)}
              </span>
            </div>

            {/* Miembro desde */}
            <div className="profile-row">
              <span className="profile-label">Miembro desde</span>
              <span>{formatFecha(perfil?.created_at)}</span>
            </div>

            {/* Estado */}
            <div className="profile-row">
              <span className="profile-label">Estado</span>
              <span className={`badge ${perfil?.estado === 'activo' ? 'badge-publicado' : 'badge-borrador'}`}>
                {perfil?.estado === 'activo' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Feedback guardar */}
          {errorDatos && (
            <div className="alert alert-error" role="alert" style={{ fontSize: '0.8125rem' }}>
              {errorDatos}
            </div>
          )}
          {savedOk && (
            <div style={{ color: 'var(--color-success, #059669)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Check size={14} aria-hidden="true" /> Cambios guardados
            </div>
          )}

          {/* Botón guardar */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveDatos}
            disabled={saving || !hayDatosChange}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {saving
              ? <><div className="spinner spinner--sm" aria-hidden="true" /> Guardando…</>
              : <><Save size={15} aria-hidden="true" /> Guardar cambios</>}
          </button>
        </div>

        {/* ══ COL 2 — Acciones rápidas ══════════════════════ */}
        <div className="profile-column column-acciones">
          <h3 className="column-title">Acciones rápidas</h3>

          <div className="quick-actions-container">
            {quickActions.map(({ label, Icon, href, hint, highlight }) => (
              <Link
                key={label}
                href={href}
                className={`action-btn${highlight ? ' action-btn--highlight' : ''}`}
                title={hint}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ══ COL 3 — Cambiar contraseña ════════════════════ */}
        <div className="profile-column column-contrasena">
          <h3 className="column-title">Cambiar contraseña</h3>

          <form onSubmit={handleChangePassword} noValidate>
            <PasswordField
              id="pass-current"
              label="Contraseña actual"
              value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              disabled={savingPass}
              error={passErrors.current}
              autoComplete="current-password"
            />

            <PasswordField
              id="pass-new"
              label="Nueva contraseña"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              disabled={savingPass}
              error={passErrors.new}
              autoComplete="new-password"
            />

            <PasswordField
              id="pass-confirm"
              label="Confirmar nueva contraseña"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              disabled={savingPass}
              error={passErrors.confirm}
              autoComplete="new-password"
            />

            {passMsg && (
              <div
                className={`alert ${passMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}
                role="alert"
                style={{ marginBottom: '0.75rem' }}
              >
                {passMsg.text}
              </div>
            )}

            <div className="profile-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingPass}
              >
                {savingPass
                  ? <><div className="spinner spinner--sm" aria-hidden="true" /> Guardando…</>
                  : <><KeyRound size={15} aria-hidden="true" /> Guardar contraseña</>}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
