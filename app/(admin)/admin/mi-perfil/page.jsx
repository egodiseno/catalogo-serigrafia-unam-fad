'use client';

/**
 * app/(admin)/admin/mi-perfil/page.jsx
 *
 * Mi Perfil — Client Component. Layout tres columnas (replicando profile.js VanillaJS):
 *
 *   Col 1 — .column-datos   : avatar, nombre (TEXTO ESTÁTICO — no editable),
 *                              numero_cuenta (solo editor), email, rol, miembro desde, estado
 *   Col 2 — .column-acciones: "Acciones rápidas" por rol
 *                              editor: Mi Portafolio + Nueva Obra (?nueva=1)
 *   Col 3 — .column-contrasena: "Cambiar contraseña" con barra de fortaleza
 *                                y lista de requisitos premium
 *
 * Auth: createClient().auth.getUser() → usuarios_admin lookup (NO useAuth)
 * CSS: únicamente selectores verificados en styles/admin.css
 *      + .password-strength-bar / .password-strength-fill / .password-requirements
 *        añadidos a admin.css
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Eye,
  EyeOff,
  KeyRound,
  Check,
  X,
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

/* ─── Password strength ───────────────────────────────────────────── */
const REQS = [
  { key: 'length',   label: 'Mínimo 8 caracteres',            test: (p) => p.length >= 8 },
  { key: 'upper',    label: 'Al menos una mayúscula',          test: (p) => /[A-Z]/.test(p) },
  { key: 'number',   label: 'Al menos un número',             test: (p) => /[0-9]/.test(p) },
  { key: 'special',  label: 'Al menos un carácter especial',  test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password) {
  if (!password) return 0;
  return REQS.filter(r => r.test(password)).length;
}

const STRENGTH_META = {
  0: null,
  1: { label: 'Débil',   cls: 'debil'   },
  2: { label: 'Regular', cls: 'regular' },
  3: { label: 'Buena',   cls: 'buena'   },
  4: { label: 'Fuerte',  cls: 'fuerte'  },
};

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
          {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {error && <span className="field-error" style={{ display: 'block' }}>{error}</span>}
    </div>
  );
}

/* ─── Acciones rápidas por rol (replicando profile.js VanillaJS) ──── */
// Para editor "Nueva Obra" abre /admin/mi-portafolio?nueva=1
const QUICK_ACTIONS = {
  admin: [
    { label: 'Nueva Obra',     Icon: PlusCircle, href: '/admin/obras',     hint: 'Agregar obra al catálogo' },
    { label: 'Nuevo Usuario',  Icon: UserPlus,   href: '/admin/usuarios',  hint: 'Crear cuenta de usuario' },
    { label: 'Ver Logs',       Icon: Activity,   href: '/admin/logs',      hint: 'Auditoría del sistema' },
    { label: 'Gestionar Tags', Icon: Tag,        href: '/admin/tags',      hint: 'Administrar etiquetas' },
  ],
  super_editor: [
    { label: 'Nueva Obra',      Icon: PlusCircle, href: '/admin/obras',     hint: 'Agregar obra al catálogo' },
    { label: 'Nuevo Usuario',   Icon: UserPlus,   href: '/admin/usuarios',  hint: 'Crear cuenta de usuario' },
    { label: 'Gestionar Tags',  Icon: Tag,        href: '/admin/tags',      hint: 'Administrar etiquetas' },
    { label: 'Técnicas',        Icon: Brush,      href: '/admin/tecnicas',  hint: 'Administrar técnicas' },
  ],
  editor: [
    { label: 'Mi Portafolio', Icon: LayoutGrid, href: '/admin/mi-portafolio',      hint: 'Ver mis obras',            highlight: false },
    { label: 'Nueva Obra',    Icon: PlusCircle, href: '/admin/mi-portafolio?nueva=1', hint: 'Agregar obra al catálogo', highlight: true  },
  ],
};

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function MiPerfilPage() {
  const router = useRouter();
  const client = createClient();

  /* ── Auth + perfil ────────────────────────────────────────── */
  const [perfil,  setPerfil]  = useState(null);
  const [loading, setLoading] = useState(true);

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
      setPerfil(adminRow);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Col 3: Cambiar contraseña ────────────────────────────── */
  const [currentPass, setCurrentPass] = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passErrors,  setPassErrors]  = useState({});
  const [savingPass,  setSavingPass]  = useState(false);
  const [passMsg,     setPassMsg]     = useState(null);  // { type: 'ok'|'err', text }

  // Strength computed
  const strength     = getStrength(newPass);
  const reqsMet      = REQS.map(r => r.test(newPass));
  const allReqsMet   = reqsMet.every(Boolean);
  const passwordsMatch = newPass.length > 0 && newPass === confirmPass;
  const canSubmit    = allReqsMet && passwordsMatch && currentPass.length > 0;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!currentPass)   errs.current = 'Ingresa tu contraseña actual.';
    if (!allReqsMet)    errs.new     = 'La contraseña no cumple todos los requisitos.';
    if (!passwordsMatch) errs.confirm = 'Las contraseñas no coinciden.';
    if (Object.keys(errs).length) { setPassErrors(errs); return; }
    setPassErrors({});

    setSavingPass(true);
    setPassMsg(null);
    try {
      const { error: signInErr } = await client.auth.signInWithPassword({
        email:    perfil.email,
        password: currentPass,
      });
      if (signInErr) {
        setPassErrors({ current: 'Contraseña actual incorrecta.' });
        setSavingPass(false);
        return;
      }

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

  const initial      = getInitial(perfil?.nombre, perfil?.email);
  const esEditor     = perfil?.rol === 'editor';
  const quickActions = QUICK_ACTIONS[perfil?.rol] ?? QUICK_ACTIONS.editor;
  const strengthMeta = STRENGTH_META[strength];

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2>Mi Perfil</h2>
          <p>Datos personales y configuración de tu cuenta</p>
        </div>
      </div>

      <div className="profile-grid">

        {/* ══ COL 1 — Datos personales (solo lectura) ═══════ */}
        <div className="profile-column column-datos">

          {/* Avatar */}
          <div className="avatar-circle" aria-hidden="true">
            {initial}
          </div>

          <div className="profile-info">
            {/* Nombre — TEXTO ESTÁTICO (no editable) */}
            <div className="profile-row">
              <span className="profile-label">Nombre</span>
              <span>{perfil?.nombre || '—'}</span>
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

            {/* Nueva contraseña + barra de fortaleza + requisitos */}
            <div className="form-group">
              <label className="form-label" htmlFor="pass-new">
                Nueva contraseña
              </label>
              <div className="password-toggle-wrapper">
                <PasswordInputInner
                  id="pass-new"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  disabled={savingPass}
                  error={passErrors.new}
                />
              </div>

              {/* Barra de fortaleza */}
              {newPass.length > 0 && (
                <>
                  <div className="password-strength-bar" role="progressbar" aria-valuenow={strength} aria-valuemax={4}>
                    <div
                      className={`password-strength-fill${strengthMeta ? ` password-strength-fill--${strengthMeta.cls}` : ''}`}
                    />
                  </div>
                  {strengthMeta && (
                    <span className={`password-strength-label password-strength-label--${strengthMeta.cls}`}>
                      {strengthMeta.label}
                    </span>
                  )}
                </>
              )}

              {passErrors.new && (
                <span className="field-error" style={{ display: 'block' }}>{passErrors.new}</span>
              )}

              {/* Lista de requisitos */}
              <ul className="password-requirements" aria-label="Requisitos de contraseña">
                {REQS.map((req, i) => (
                  <li
                    key={req.key}
                    className={`password-req${reqsMet[i] ? ' password-req--ok' : ''}`}
                  >
                    {reqsMet[i]
                      ? <Check size={13} className="password-req__icon" aria-hidden="true" />
                      : <X     size={13} className="password-req__icon" style={{ color: '#ef4444' }} aria-hidden="true" />}
                    {req.label}
                  </li>
                ))}
              </ul>
            </div>

            <PasswordField
              id="pass-confirm"
              label="Confirmar nueva contraseña"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              disabled={savingPass}
              error={passErrors.confirm}
              autoComplete="new-password"
            />

            {/* Indicador de coincidencia */}
            {confirmPass.length > 0 && (
              <p style={{ fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '0.75rem', color: passwordsMatch ? '#16a34a' : '#ef4444' }}>
                {passwordsMatch
                  ? <><Check size={12} aria-hidden="true" /> Las contraseñas coinciden</>
                  : <><X size={12} aria-hidden="true" /> Las contraseñas no coinciden</>}
              </p>
            )}

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
                disabled={savingPass || !canSubmit}
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

/* ─── Input de nueva contraseña con toggle interno ────────────────── */
function PasswordInputInner({ id, value, onChange, disabled, error }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`search-input${error ? ' input--error' : ''}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </>
  );
}
