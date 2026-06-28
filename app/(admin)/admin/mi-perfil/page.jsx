'use client';

/**
 * app/(admin)/admin/mi-perfil/page.jsx
 *
 * Mi Perfil — Client Component.
 * Tres secciones en .profile-grid (3 columnas):
 *   Col 1 — Datos personales: avatar, nombre editable, email, rol
 *   Col 2 — Cambiar contraseña: 3 campos con toggle de visibilidad
 *   Col 3 — MFA: activar (QR + código) / desactivar (ConfirmModal)
 *
 * Auth: createClient().auth.getUser() → usuarios_admin lookup (NO useAuth)
 * CSS: únicamente selectores verificados en styles/admin.css
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ConfirmModal from '@/components/admin/ConfirmModal';
import {
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldOff,
  X,
  Check,
  KeyRound,
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

function getRolStyle(rol) {
  switch (rol) {
    case 'admin':        return { background: '#013B75', color: '#fff' };
    case 'super_editor': return { background: '#7C3AED', color: '#fff' };
    case 'editor':       return { background: '#059669', color: '#fff' };
    default:             return { background: '#6B7280', color: '#fff' };
  }
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

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function MiPerfilPage() {
  const router  = useRouter();
  const client  = createClient();

  /* ── Auth + perfil ────────────────────────────────────────── */
  const [authUser, setAuthUser] = useState(null);   // auth.users row
  const [perfil,   setPerfil]   = useState(null);   // usuarios_admin row
  const [loading,  setLoading]  = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (!user || error) { router.replace('/login'); return; }

      const { data: adminRow } = await client
        .from('usuarios_admin')
        .select('id, nombre, email, rol, estado')
        .eq('id', user.id)
        .single();

      if (!adminRow) { router.replace('/login'); return; }

      setAuthUser(user);
      setPerfil(adminRow);
      setNombre(adminRow.nombre ?? '');
      setAuthReady(true);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Section 1: Datos personales ─────────────────────────── */
  const [nombre,      setNombre]      = useState('');
  const [saving,      setSaving]      = useState(false);
  const [savedDatos,  setSavedDatos]  = useState(false);
  const [errorDatos,  setErrorDatos]  = useState(null);

  const handleSaveDatos = async () => {
    if (!perfil) return;
    const trimmed = nombre.trim();
    if (trimmed === (perfil.nombre ?? '').trim()) return; // sin cambios reales

    setSaving(true);
    setErrorDatos(null);
    setSavedDatos(false);
    try {
      const { error: err } = await client
        .from('usuarios_admin')
        .update({ nombre: trimmed || null })
        .eq('id', perfil.id);

      if (err) throw err;
      setPerfil(prev => ({ ...prev, nombre: trimmed || null }));
      setSavedDatos(true);
      setTimeout(() => setSavedDatos(false), 3000);
    } catch (err) {
      setErrorDatos(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Section 2: Cambiar contraseña ───────────────────────── */
  const [currentPass,  setCurrentPass]  = useState('');
  const [newPass,      setNewPass]      = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');
  const [passErrors,   setPassErrors]   = useState({});
  const [savingPass,   setSavingPass]   = useState(false);
  const [passMsg,      setPassMsg]      = useState(null);   // { type: 'ok'|'err', text }

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!currentPass)           errs.current  = 'Ingresa tu contraseña actual.';
    if (newPass.length < 8)     errs.new      = 'Mínimo 8 caracteres.';
    if (newPass !== confirmPass) errs.confirm  = 'Las contraseñas no coinciden.';
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
      setPassMsg({ type: 'err', text: err.message });
    } finally {
      setSavingPass(false);
    }
  };

  /* ─── Section 3: MFA ──────────────────────────────────────── */
  const [mfaLoading,   setMfaLoading]   = useState(true);
  const [activeFactor, setActiveFactor] = useState(null);  // factor | null
  const [enrollData,   setEnrollData]   = useState(null);  // { id, qr_code, secret }
  const [mfaCode,      setMfaCode]      = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaError,     setMfaError]     = useState(null);
  const [mfaSuccess,   setMfaSuccess]   = useState(null);
  const [showUnenroll, setShowUnenroll] = useState(false);

  const loadMfa = useCallback(async () => {
    setMfaLoading(true);
    try {
      const { data } = await client.auth.mfa.listFactors();
      const verified = data?.totp?.find(f => f.status === 'verified') ?? null;
      setActiveFactor(verified);
    } catch { /* ignore */ }
    setMfaLoading(false);
  }, [client]);

  useEffect(() => {
    if (authReady) loadMfa();
  }, [authReady, loadMfa]);

  const handleEnroll = async () => {
    setMfaError(null);
    setMfaSuccess(null);
    setEnrollData(null);
    setMfaCode('');
    try {
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnrollData({
        id:      data.id,
        qr_code: data.totp.qr_code,
        secret:  data.totp.secret,
      });
    } catch (err) {
      setMfaError(err.message);
    }
  };

  const handleVerifyEnroll = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      setMfaError('Ingresa el código de 6 dígitos.');
      return;
    }
    setMfaVerifying(true);
    setMfaError(null);
    try {
      /* Challenge */
      const { data: challenge, error: chalErr } = await client.auth.mfa.challenge({
        factorId: enrollData.id,
      });
      if (chalErr) throw chalErr;

      /* Verify */
      const { error: verErr } = await client.auth.mfa.verify({
        factorId:    enrollData.id,
        challengeId: challenge.id,
        code:        mfaCode,
      });
      if (verErr) throw verErr;

      setEnrollData(null);
      setMfaCode('');
      setMfaSuccess('MFA activado correctamente.');
      loadMfa();
    } catch (err) {
      setMfaError(err.message || 'Código incorrecto. Inténtalo de nuevo.');
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleCancelEnroll = async () => {
    /* Unenroll the unverified factor to clean up */
    if (enrollData?.id) {
      await client.auth.mfa.unenroll({ factorId: enrollData.id }).catch(() => {});
    }
    setEnrollData(null);
    setMfaCode('');
    setMfaError(null);
  };

  /* handleUnenroll: llamado por ConfirmModal.onConfirm.
     Si lanza, ConfirmModal queda abierto (busy=false) y muestra el error.
     Si resuelve, ConfirmModal se oculta; el estado mfaSuccess se muestra en col-3. */
  const handleUnenroll = async () => {
    if (!activeFactor) return;
    setMfaError(null);
    const { error } = await client.auth.mfa.unenroll({ factorId: activeFactor.id });
    if (error) throw error;
    setActiveFactor(null);
    setMfaSuccess('MFA desactivado correctamente.');
  };

  /* ─── Render ───────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="Cargando…" />
      </div>
    );
  }

  const initial  = getInitial(perfil?.nombre, perfil?.email);
  const hayDatosChange = nombre.trim() !== (perfil?.nombre ?? '').trim();

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2>Mi Perfil</h2>
          <p>Datos personales, seguridad y autenticación de dos factores</p>
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

            {/* Email — solo lectura */}
            <div className="profile-row">
              <span className="profile-label">Email</span>
              <span>{perfil?.email ?? '—'}</span>
            </div>

            {/* Rol — solo lectura con badge */}
            <div className="profile-row">
              <span className="profile-label">Rol</span>
              <span
                className="badge"
                style={{ ...getRolStyle(perfil?.rol), padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}
              >
                {getRolLabel(perfil?.rol)}
              </span>
            </div>
          </div>

          {errorDatos && (
            <div className="alert alert-error" role="alert" style={{ fontSize: '0.8125rem' }}>
              {errorDatos}
            </div>
          )}

          {savedDatos && (
            <div style={{ color: 'var(--color-success, #059669)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Check size={14} aria-hidden="true" /> Cambios guardados
            </div>
          )}

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

        {/* ══ COL 2 — Cambiar contraseña ═══════════════════ */}
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
                  : <><KeyRound size={15} aria-hidden="true" /> Actualizar contraseña</>}
              </button>
            </div>
          </form>
        </div>

        {/* ══ COL 3 — Autenticación de dos factores ════════ */}
        <div className="profile-column column-contrasena">
          <h3 className="column-title">Autenticación de dos factores</h3>

          {mfaLoading && (
            <div className="page-loading" style={{ minHeight: '80px' }}>
              <div className="spinner" aria-label="Cargando estado MFA…" />
            </div>
          )}

          {!mfaLoading && (
            <>
              {/* Error / éxito MFA */}
              {mfaError && (
                <div className="alert alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                  {mfaError}
                </div>
              )}
              {mfaSuccess && (
                <div className="alert alert-success" role="alert" style={{ marginBottom: '0.75rem' }}>
                  {mfaSuccess}
                </div>
              )}

              {/* ── MFA ACTIVO ───────────────────────────── */}
              {activeFactor && !enrollData && (
                <div style={{ textAlign: 'center' }}>
                  <div className="mfa-icon">
                    <ShieldCheck size={28} aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                    La autenticación de dos factores está <strong style={{ color: 'var(--color-success, #059669)' }}>activa</strong>.
                  </p>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setShowUnenroll(true)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <ShieldOff size={15} aria-hidden="true" />
                    Desactivar MFA
                  </button>
                </div>
              )}

              {/* ── MFA INACTIVO — sin enroll en curso ───── */}
              {!activeFactor && !enrollData && (
                <div style={{ textAlign: 'center' }}>
                  <div className="mfa-icon" style={{ background: 'var(--color-surface-alt, #F4F7FC)', color: 'var(--color-text-muted)' }}>
                    <ShieldOff size={28} aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                    La autenticación de dos factores está <strong>inactiva</strong>.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleEnroll}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <ShieldCheck size={15} aria-hidden="true" />
                    Activar MFA
                  </button>
                </div>
              )}

              {/* ── ENROLL EN CURSO: QR + código ─────────── */}
              {enrollData && (
                <form onSubmit={handleVerifyEnroll}>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.):
                  </p>

                  {/* QR Code */}
                  <div className="mfa-qr-container">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrollData.qr_code}
                      alt="Código QR para MFA"
                      width={180}
                      height={180}
                    />
                  </div>

                  {/* Código base32 manual */}
                  <details className="mfa-secret-details">
                    <summary>¿No puedes escanear? Ingresa el código manualmente</summary>
                    <code className="mfa-secret-code">{enrollData.secret}</code>
                  </details>

                  {/* Campo código 6 dígitos */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="mfa-code">
                      Código de verificación (6 dígitos)
                    </label>
                    <input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className="mfa-code-input"
                      value={mfaCode}
                      onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      disabled={mfaVerifying}
                      autoComplete="one-time-code"
                      aria-label="Código de verificación MFA"
                    />
                  </div>

                  <div className="profile-form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEnroll}
                      disabled={mfaVerifying}
                    >
                      <X size={14} aria-hidden="true" /> Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={mfaVerifying || mfaCode.length !== 6}
                    >
                      {mfaVerifying
                        ? <><div className="spinner spinner--sm" aria-hidden="true" /> Verificando…</>
                        : <><Check size={14} aria-hidden="true" /> Confirmar</>}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* ConfirmModal para desactivar MFA */}
      {showUnenroll && (
        <ConfirmModal
          title="Desactivar MFA"
          message="¿Estás seguro de que quieres desactivar la autenticación de dos factores? Tu cuenta quedará menos protegida."
          confirmLabel="Sí, desactivar"
          confirmVariant="danger"
          onConfirm={handleUnenroll}
          onCancel={() => setShowUnenroll(false)}
        />
      )}
    </div>
  );
}
