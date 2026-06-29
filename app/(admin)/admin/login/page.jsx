'use client';

/**
 * app/(admin)/admin/login/page.jsx — /admin/login
 *
 * Client Component. Replica el flujo de auth.js + MFA de la versión VanillaJS:
 *   A. Login normal → signInWithPassword → checkMFARequired (AAL level)
 *   B. MFA Verificar → usuario con TOTP enrollado → ingresa código → dashboard
 *   C. MFA Enroll   → usuario sin factor TOTP → QR + código → dashboard
 *   D. Forgot       → ingresa email → Edge Function envía email con link
 *   E. Reset        → llega con ?reset_token= → ingresa nueva contraseña
 *
 * Clases: solo selectores reales de styles/admin.css
 *   .login-container, .login-box, .login-header, .login-logos,
 *   .login-logo--unam, .login-logo--fad, .login-logos-sep, .login-form, .login-footer
 *
 * Mensajes de error: traducción exacta de translateAuthError / translateMFAError en auth.js
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ShieldCheck, ShieldPlus, LogIn, AlertCircle, KeyRound, LockKeyhole } from 'lucide-react';

// ── Testing bypass ────────────────────────────────────────────────────────────
// Cuando NEXT_PUBLIC_SKIP_MFA=true en .env.local, el paso de MFA se omite.
// NUNCA configurar esta variable en Netlify ni en ningún entorno de producción.
// Para activar: agregar NEXT_PUBLIC_SKIP_MFA=true a .env.local y reiniciar el servidor.
const SKIP_MFA = process.env.NEXT_PUBLIC_SKIP_MFA === 'true';

// ── Supabase Edge Function base URL ──────────────────────────────────────────
const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ── Errores en español (translateAuthError de auth.js) ──────────────────────
const AUTH_ERRORS = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed':       'Confirma tu email antes de ingresar.',
  'Too many requests':         'Demasiados intentos. Espera unos minutos.',
  'User not found':            'No existe una cuenta con ese email.',
};
function translateAuthError(msg) {
  return AUTH_ERRORS[msg] ?? msg;
}

// ── Errores MFA en español (translateMFAError de auth.js) ───────────────────
function translateMFAError(msg) {
  if (!msg) return 'Código inválido. Intenta de nuevo.';
  const lc = msg.toLowerCase();
  if (lc.includes('invalid') || lc.includes('incorrect') || lc.includes('wrong'))
    return 'Código incorrecto. Verifica el código en tu app.';
  if (lc.includes('expired'))
    return 'El código ha expirado. Genera uno nuevo en tu app.';
  if (lc.includes('already') || lc.includes('enrolled'))
    return 'Este factor ya está registrado.';
  return msg;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // ── Estado del formulario ────────────────────────────────────────────────
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // ── Estado MFA ───────────────────────────────────────────────────────────
  const [mfaStep,     setMfaStep]     = useState(null); // null | 'verify' | 'enroll' | 'forgot' | 'reset'
  const [mfaCode,     setMfaCode]     = useState('');
  const [mfaError,    setMfaError]    = useState('');
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaQR,       setMfaQR]       = useState('');
  const [mfaSecret,   setMfaSecret]   = useState('');

  // ── Estado recuperación de contraseña (Paso A — forgot) ─────────────────
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError,   setForgotError]   = useState('');

  // ── Estado nueva contraseña (Paso B — reset) ─────────────────────────────
  const [resetToken,           setResetToken]           = useState('');
  const [resetNewPassword,     setResetNewPassword]     = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading,         setResetLoading]         = useState(false);
  const [resetError,           setResetError]           = useState('');
  const [resetSuccess,         setResetSuccess]         = useState(false);
  const [showResetPass,        setShowResetPass]        = useState(false);

  // ── Detectar ?reset_token= en la URL al montar ───────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setMfaStep('reset');
    }
  }, []);

  // ── Verificar si el usuario existe y está activo en usuarios_admin ───────
  async function verificarUsuarioAdmin() {
    const { data: adminUser } = await supabase
      .from('usuarios_admin')
      .select('rol, nombre, estado')
      .eq('email', email.trim())
      .single();

    if (!adminUser || adminUser.estado !== 'activo') {
      await supabase.auth.signOut();
      setError('Usuario no autorizado. Contacta al administrador.');
      return false;
    }
    return true;
  }

  // ── checkMFARequired (replica checkMFARequired de auth.js) ──────────────
  async function checkMFARequired() {
    const { data: aalData, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (!aalError && aalData?.currentLevel === 'aal2') return 'none';

    const { data: factorsData, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError) throw new Error('Error al verificar MFA. Intenta de nuevo.');

    const totpFactors = factorsData?.totp ?? [];
    if (totpFactors.length > 0) {
      return { action: 'verify', factorId: totpFactors[0].id };
    } else {
      return { action: 'enroll' };
    }
  }

  // ── Iniciar MFA Enroll ────────────────────────────────────────────────────
  async function startMFAEnroll() {
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType:   'totp',
      issuer:       'Catálogo Serigráfica UNAM',
      friendlyName: 'Admin Panel',
    });
    if (enrollError) throw enrollError;
    setMfaFactorId(data.id);
    setMfaQR(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setMfaStep('enroll');
  }

  // ── SUBMIT LOGIN ─────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    email.trim(),
        password,
      });

      if (signInError) {
        setError(translateAuthError(signInError.message || 'Credenciales incorrectas.'));
        return;
      }

      // TESTING: MFA desactivado globalmente.
      if (SKIP_MFA) {
        const ok = await verificarUsuarioAdmin();
        if (ok) router.push('/admin');
        return;
      }

      let mfaResult;
      try {
        mfaResult = await checkMFARequired();
      } catch (mfaCheckErr) {
        setError(mfaCheckErr.message || 'Error al verificar MFA. Intenta de nuevo.');
        await supabase.auth.signOut();
        return;
      }

      if (mfaResult === 'none' || mfaResult?.action === undefined) {
        const ok = await verificarUsuarioAdmin();
        if (ok) router.push('/admin');
        return;
      }

      if (mfaResult.action === 'verify') {
        setMfaFactorId(mfaResult.factorId);
        setMfaStep('verify');
        return;
      }

      if (mfaResult.action === 'enroll') {
        try {
          await startMFAEnroll();
        } catch (enrollErr) {
          setError('Error al configurar MFA: ' + (enrollErr.message || ''));
          await supabase.auth.signOut();
        }
        return;
      }

    } catch (err) {
      setError('Error de conexión. Verifica tu red.');
    } finally {
      setLoading(false);
    }
  }

  // ── SUBMIT MFA VERIFY ────────────────────────────────────────────────────
  async function handleMFAVerify(e) {
    e.preventDefault();
    setMfaError('');

    const code = mfaCode.replace(/\s/g, '');
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setMfaError('Ingresa los 6 dígitos del código.');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code,
      });

      if (verifyError) {
        setMfaError(translateMFAError(verifyError.message));
        return;
      }

      const ok = await verificarUsuarioAdmin();
      if (ok) router.push('/admin');

    } catch (err) {
      setMfaError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ── SUBMIT MFA ENROLL ────────────────────────────────────────────────────
  async function handleMFAEnroll(e) {
    e.preventDefault();
    setMfaError('');

    const code = mfaCode.replace(/\s/g, '');
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setMfaError('Ingresa los 6 dígitos del código generado por la app.');
      return;
    }

    setLoading(true);
    try {
      const { error: enrollVerifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code,
      });

      if (enrollVerifyError) {
        setMfaError(translateMFAError(enrollVerifyError.message));
        return;
      }

      const ok = await verificarUsuarioAdmin();
      if (ok) router.push('/admin');

    } catch (err) {
      setMfaError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ── Cancelar MFA ─────────────────────────────────────────────────────────
  async function handleMFACancel() {
    if (mfaStep === 'enroll' && mfaFactorId) {
      try { await supabase.auth.mfa.unenroll({ factorId: mfaFactorId }); } catch {}
    }
    setMfaStep(null);
    setMfaCode('');
    setMfaError('');
    setMfaFactorId(null);
    setMfaQR('');
    setMfaSecret('');
    await supabase.auth.signOut();
  }

  // ── FORGOT PASSWORD (Paso A) ──────────────────────────────────────────────
  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError('Ingresa tu correo electrónico.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/reset-user-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body:    JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgotError(data.error || 'No se pudo enviar el email. Intenta de nuevo.');
        return;
      }
      setForgotSuccess(true);
    } catch {
      setForgotError('Error de conexión. Verifica tu red.');
    } finally {
      setForgotLoading(false);
    }
  }

  // ── RESET PASSWORD (Paso B) ───────────────────────────────────────────────
  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError('');

    if (resetNewPassword.length < 8) {
      setResetError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Las contraseñas no coinciden.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/reset-user-password/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body:    JSON.stringify({ token: resetToken, new_password: resetNewPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(data.error || 'El enlace es inválido o ha expirado. Solicita uno nuevo.');
        return;
      }
      setResetSuccess(true);
    } catch {
      setResetError('Error de conexión. Verifica tu red.');
    } finally {
      setResetLoading(false);
    }
  }

  // ── Helpers de estilo reutilizables ──────────────────────────────────────
  const alertStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#FEF2F2', border: '1px solid #FECACA',
    borderRadius: 8, padding: '10px 14px',
    color: 'var(--color-error)', fontSize: 14, marginBottom: 16,
  };
  const successAlertStyle = {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: '#F0FDF4', border: '1px solid #BBF7D0',
    borderRadius: 8, padding: '12px 14px',
    color: '#166534', fontSize: 14, marginBottom: 16,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="login-container">
      <div className="login-box">

        {/* Logos */}
        <div className="login-header">
          <div className="login-logos">
            <img src="/logos/UNAM.svg" alt="UNAM" className="login-logo--unam" width="50" height="35" />
            <div className="login-logos-sep" aria-hidden="true" />
            <img src="/logos/FAD.svg"  alt="FAD"  className="login-logo--fad"  width="64" height="35" />
          </div>
          <h1>Catálogo Serigráfica</h1>
          <p>Panel de administración UNAM / FAD</p>
        </div>

        {/* ── Pantalla 1: Login ─────────────────────────────────────────── */}
        {mfaStep === null && (
          <form className="login-form" onSubmit={handleLogin} noValidate>

            {error && (
              <div role="alert" style={alertStyle}>
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="loginEmail" className="form-label">Correo electrónico</label>
              <input
                id="loginEmail"
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="admin@ejemplo.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="loginPassword" className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="loginPassword"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--color-text-muted)',
                    display: 'flex', padding: 4,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            >
              {loading ? 'Ingresando…' : <><LogIn size={16} aria-hidden="true" /> Ingresar</>}
            </button>

            <button
              type="button"
              onClick={() => { setForgotEmail(email); setMfaStep('forgot'); }}
              style={{
                display: 'block', width: '100%', marginTop: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center',
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        {/* ── Pantalla 2: MFA Verificar ─────────────────────────────────── */}
        {mfaStep === 'verify' && (
          <form className="login-form" onSubmit={handleMFAVerify} noValidate>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <ShieldCheck size={40} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              <h2 style={{ marginTop: 10, fontSize: 18, fontWeight: 600 }}>Verificación en dos pasos</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 6 }}>
                Ingresa el código de 6 dígitos de tu app autenticadora.
              </p>
            </div>

            {mfaError && <div role="alert" style={alertStyle}><AlertCircle size={16} aria-hidden="true" />{mfaError}</div>}

            <div className="form-group">
              <label htmlFor="mfaCodeInput" className="form-label">Código de verificación</label>
              <input
                id="mfaCodeInput"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="form-input"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
                required
                disabled={loading}
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 20 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={handleMFACancel} disabled={loading} style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? 'Verificando…' : 'Verificar'}
              </button>
            </div>
          </form>
        )}

        {/* ── Pantalla 3: MFA Enroll ────────────────────────────────────── */}
        {mfaStep === 'enroll' && (
          <form className="login-form" onSubmit={handleMFAEnroll} noValidate>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <ShieldPlus size={40} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              <h2 style={{ marginTop: 10, fontSize: 18, fontWeight: 600 }}>Configurar verificación en dos pasos</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 6 }}>
                Escanea el código QR con Google Authenticator, Authy o similar.
              </p>
            </div>

            {mfaQR && (
              <div style={{ textAlign: 'center', margin: '12px 0' }}>
                <img
                  src={mfaQR}
                  alt="Código QR para autenticación de dos factores"
                  style={{ width: 180, height: 180, border: '1px solid var(--color-border)', borderRadius: 8 }}
                />
                {mfaSecret && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, wordBreak: 'break-all' }}>
                    Código manual: <code style={{ userSelect: 'all' }}>{mfaSecret}</code>
                  </p>
                )}
              </div>
            )}

            {mfaError && <div role="alert" style={alertStyle}><AlertCircle size={16} aria-hidden="true" />{mfaError}</div>}

            <div className="form-group">
              <label htmlFor="mfaEnrollCodeInput" className="form-label">Código de la app autenticadora</label>
              <input
                id="mfaEnrollCodeInput"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="form-input"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
                required
                disabled={loading}
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 20 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={handleMFACancel} disabled={loading} style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? 'Activando…' : 'Activar y continuar'}
              </button>
            </div>
          </form>
        )}

        {/* ── Pantalla 4: Forgot password ───────────────────────────────── */}
        {mfaStep === 'forgot' && (
          <div className="login-form">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <KeyRound size={40} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              <h2 style={{ marginTop: 10, fontSize: 18, fontWeight: 600 }}>Recuperar contraseña</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 6 }}>
                Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
              </p>
            </div>

            {forgotSuccess ? (
              <>
                <div style={successAlertStyle}>
                  <span>✓</span>
                  <span>
                    Email enviado a <strong>{forgotEmail}</strong>. Revisa tu bandeja de entrada
                    (y la carpeta de spam) y haz clic en el enlace para crear tu nueva contraseña.
                    El enlace expira en 30 minutos.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setMfaStep(null); setForgotSuccess(false); setForgotError(''); setForgotEmail(''); }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Volver al inicio de sesión
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword} noValidate>
                {forgotError && (
                  <div role="alert" style={alertStyle}>
                    <AlertCircle size={16} aria-hidden="true" />
                    {forgotError}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="forgotEmailInput" className="form-label">Correo electrónico</label>
                  <input
                    id="forgotEmailInput"
                    type="email"
                    className="form-input"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="admin@ejemplo.com"
                    required
                    autoFocus
                    disabled={forgotLoading}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setMfaStep(null); setForgotError(''); }}
                    disabled={forgotLoading}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading}
                    style={{ flex: 2, justifyContent: 'center' }}
                  >
                    {forgotLoading ? 'Enviando…' : 'Enviar instrucciones'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Pantalla 5: Reset password ────────────────────────────────── */}
        {mfaStep === 'reset' && (
          <div className="login-form">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <LockKeyhole size={40} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              <h2 style={{ marginTop: 10, fontSize: 18, fontWeight: 600 }}>Nueva contraseña</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 6 }}>
                Elige una contraseña segura de al menos 8 caracteres.
              </p>
            </div>

            {resetSuccess ? (
              <>
                <div style={successAlertStyle}>
                  <span>✓</span>
                  <span>Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    window.history.replaceState({}, '', window.location.pathname);
                    setMfaStep(null);
                    setResetToken('');
                    setResetNewPassword('');
                    setResetConfirmPassword('');
                    setResetSuccess(false);
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Ir al inicio de sesión
                </button>
              </>
            ) : (
              <form onSubmit={handleResetPassword} noValidate>
                {resetError && (
                  <div role="alert" style={alertStyle}>
                    <AlertCircle size={16} aria-hidden="true" />
                    {resetError}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="resetNewPass" className="form-label">Nueva contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="resetNewPass"
                      type={showResetPass ? 'text' : 'password'}
                      className="form-input"
                      value={resetNewPassword}
                      onChange={e => setResetNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      required
                      autoFocus
                      disabled={resetLoading}
                      style={{ paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPass(v => !v)}
                      aria-label={showResetPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--color-text-muted)',
                        display: 'flex', padding: 4,
                      }}
                    >
                      {showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="resetConfirmPass" className="form-label">Confirmar contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="resetConfirmPass"
                      type={showResetPass ? 'text' : 'password'}
                      className="form-input"
                      value={resetConfirmPassword}
                      onChange={e => setResetConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Repite la contraseña"
                      required
                      disabled={resetLoading}
                      style={{ paddingRight: 42 }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resetLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {resetLoading ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p>Catálogo Digital de Obra Serigráfica · UNAM / FAD</p>
        </div>
      </div>
    </div>
  );
}
