'use client';
// app/registro/page.jsx
// Página Registro — Client Component
// Réplica exacta del formulario de registro.html.
//
// Flujo:
//   1. Al montar: consulta tabla `registro_config` via Supabase JS
//   2. _estaAbierto(data) → decide si mostrar pantalla abierta o cerrada
//   3. Lógica de fechas expiradas: si fecha_fin ya pasó → ocultar "Próximo período"
//      y mostrar "Las fechas del próximo período se anunciarán próximamente."
//   4. Submit → llama Edge Function save-registro-alumno via fetch
//   5. Errores conocidos: DUPLICATE_EMAIL, DUPLICATE_CUENTA, REGISTRO_CERRADO
//
// No usa styles/globals.css para los estilos de la card; los estilos específicos
// de esta pantalla (variables, .cerrada-*, .reg-*) se inyectan inline para
// mantener el look original sin contaminar el design system público.

import { useState, useEffect } from 'react';
import { getRegistroConfig } from '@/lib/supabase/api';

// ── Constantes ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUENTA_RE = /^[0-9]{9}$/;

// ── Helpers de fecha ──────────────────────────────────────────────────────────
/** YYYY-MM-DD local del navegador (idéntico al de registro.html) */
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function estaAbierto(data) {
  if (!data?.registro_activo) return false;
  const hoy = hoyISO();
  if (data.fecha_inicio && hoy < data.fecha_inicio) return false;
  if (data.fecha_fin    && hoy > data.fecha_fin)    return false;
  return true;
}

function fmtFecha(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
}

// ── Validaciones ──────────────────────────────────────────────────────────────
const validate = {
  email:  (v) => !v ? { ok: false, msg: 'El email es obligatorio' }
               : !EMAIL_RE.test(v) ? { ok: false, msg: 'Formato de email inválido' }
               : { ok: true },
  nombre: (v) => !v ? { ok: false, msg: 'El nombre es obligatorio' }
               : v.length < 3 ? { ok: false, msg: 'Ingresa tu nombre completo' }
               : { ok: true },
  cuenta: (v) => !v ? { ok: false, msg: 'El número de cuenta es obligatorio' }
               : !CUENTA_RE.test(v) ? { ok: false, msg: 'Debe tener exactamente 9 dígitos numéricos' }
               : { ok: true },
};

// ── CSS específico de la pantalla de registro ─────────────────────────────────
// Extraído a constante de módulo para reutilizarlo tanto en el early-return
// (SSR / pre-mount) como en el render principal, sin duplicar la cadena.
const REGISTRO_STYLES = `
  :root {
    --reg-blue:#013B75; --reg-blue-dark:#002A55; --reg-blue-light:#EEF4FB;
    --reg-gold:#D9A500; --reg-gold-light:#FFF8E1; --reg-surface:#fff;
    --reg-bg:#F4F6F9; --reg-text:#1F2937; --reg-muted:#6B7280;
    --reg-border:#E5E7EB; --reg-success:#059669; --reg-error:#DC2626;
    --reg-radius:10px; --reg-radius-sm:6px;
  }
  #registro-page { min-height: calc(100dvh - 140px); background: var(--reg-bg); }
  .reg-skeleton { display:flex; align-items:center; justify-content:center; min-height:60vh; }
  .reg-skeleton__dot { width:10px; height:10px; border-radius:50%; background:var(--reg-blue); animation:dotPulse 1.2s ease-in-out infinite; margin:0 4px; }
  .reg-skeleton__dot:nth-child(2){ animation-delay:.2s; }
  .reg-skeleton__dot:nth-child(3){ animation-delay:.4s; }
  @keyframes dotPulse { 0%,80%,100%{ transform:scale(.6); opacity:.4; } 40%{ transform:scale(1); opacity:1; } }
  #pantalla-cerrada { display:flex; min-height:60vh; background:linear-gradient(145deg,var(--reg-blue) 0%,var(--reg-blue-dark) 60%,#001A3A 100%); align-items:center; justify-content:center; padding:2rem 1rem; }
  .cerrada-card { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.15); border-radius:16px; padding:3rem 2.5rem; max-width:520px; width:100%; text-align:center; backdrop-filter:blur(8px); }
  .cerrada-logos { display:flex; align-items:center; justify-content:center; gap:.75rem; background:rgba(255,255,255,.92); border-radius:999px; padding:.7rem 1.5rem; margin:0 auto 1.5rem; width:fit-content; }
  .cerrada-logo--unam { width:42px; height:auto; }
  .cerrada-logo--fad  { width:54px; height:auto; }
  .cerrada-logos-sep  { width:1px; height:22px; background:rgba(1,59,117,.25); flex-shrink:0; display:block; }
  .cerrada-card h1 { font-family:'Lora',serif; font-size:2rem; font-weight:700; color:#fff; margin:0 0 1rem; }
  .cerrada-card p  { color:rgba(255,255,255,.8); font-size:1rem; line-height:1.65; margin:0 0 1.5rem; }
  .cerrada-fechas { display:inline-flex; align-items:center; gap:.5rem; background:rgba(217,165,0,.15); border:1px solid rgba(217,165,0,.4); border-radius:999px; padding:.45rem 1.25rem; font-size:.875rem; font-weight:600; color:var(--reg-gold); margin-bottom:2rem; }
  .cerrada-fechas-label { opacity:.8; font-weight:400; }
  .cerrada-proximo-aviso { font-size:.9rem; opacity:.85; margin-bottom:2rem; }
  .btn-catalogo-ghost { display:inline-flex; align-items:center; gap:.5rem; padding:.75rem 1.75rem; border:2px solid rgba(255,255,255,.4); border-radius:var(--reg-radius-sm); color:#fff; font-size:.9rem; font-weight:600; text-decoration:none; transition:border-color 200ms,background 200ms; }
  .btn-catalogo-ghost:hover { border-color:var(--reg-gold); background:rgba(217,165,0,.12); }
  #pantalla-abierta { display:flex; min-height:60vh; align-items:flex-start; justify-content:center; padding:3rem 1rem 4rem; }
  .reg-card { background:var(--reg-surface); border:1px solid var(--reg-border); border-radius:16px; box-shadow:0 4px 24px rgba(1,59,117,.08); width:100%; max-width:500px; overflow:hidden; }
  .reg-card__logos { display:flex; align-items:center; justify-content:center; gap:1rem; padding:1.5rem 2rem 1.25rem; background:#fff; }
  .reg-logo--unam { width:50px; height:auto; }
  .reg-logo--fad  { width:64px; height:auto; }
  .reg-logos-sep  { width:1px; height:28px; background:var(--reg-border); flex-shrink:0; display:block; }
  .reg-card__header { background:var(--reg-blue); padding:2rem 2rem 1.5rem; text-align:center; }
  .reg-badge { display:inline-block; background:rgba(217,165,0,.2); border:1px solid rgba(217,165,0,.5); border-radius:999px; padding:.25rem .875rem; font-size:.75rem; font-weight:600; color:var(--reg-gold); letter-spacing:.06em; text-transform:uppercase; margin-bottom:.875rem; }
  .reg-card__header h1 { font-family:'Lora',serif; font-size:1.5rem; font-weight:700; color:#fff; margin:0 0 .5rem; line-height:1.25; }
  .reg-card__header p  { color:rgba(255,255,255,.75); font-size:.875rem; margin:0; line-height:1.5; }
  .reg-card__stripe { height:4px; background:linear-gradient(90deg,var(--reg-gold),#F5C842); }
  .reg-card__body { padding:2rem; }
  .reg-periodo { display:flex; align-items:center; gap:.5rem; background:var(--reg-blue-light); border:1px solid rgba(1,59,117,.15); border-radius:var(--reg-radius-sm); padding:.6rem .875rem; font-size:.8rem; color:var(--reg-blue); font-weight:500; margin-bottom:1.5rem; }
  .reg-periodo span { opacity:.75; font-weight:400; }
  .reg-field { margin-bottom:1.125rem; }
  .reg-field label { display:block; font-size:.8rem; font-weight:600; color:var(--reg-text); margin-bottom:.35rem; letter-spacing:.01em; }
  .reg-field label .req { color:var(--reg-error); margin-left:2px; }
  .reg-input { display:block; width:100%; height:42px; padding:0 .875rem; border:1.5px solid var(--reg-border); border-radius:var(--reg-radius-sm); background:var(--reg-surface); color:var(--reg-text); font-family:inherit; font-size:.9rem; transition:border-color 180ms,box-shadow 180ms; outline:none; box-sizing:border-box; }
  .reg-input::placeholder { color:#9CA3AF; }
  .reg-input:hover  { border-color:#9CA3AF; }
  .reg-input:focus  { border-color:var(--reg-blue); box-shadow:0 0 0 3px rgba(1,59,117,.10); }
  .reg-input.error  { border-color:var(--reg-error); background:rgba(220,38,38,.02); }
  .reg-input.error:focus { box-shadow:0 0 0 3px rgba(220,38,38,.10); }
  .reg-input.success { border-color:var(--reg-success); }
  .reg-hint { display:none; font-size:.75rem; margin-top:.3rem; line-height:1.4; }
  .reg-hint.error { display:block; color:var(--reg-error); }
  .reg-divider { border:none; border-top:1px solid var(--reg-border); margin:1.5rem 0 1.25rem; }
  .reg-btn-primary { display:flex; align-items:center; justify-content:center; gap:.5rem; width:100%; height:44px; background:var(--reg-blue); color:#fff; border:none; border-radius:var(--reg-radius-sm); font-family:inherit; font-size:.9rem; font-weight:600; cursor:pointer; transition:background 200ms,box-shadow 200ms,transform 150ms; margin-bottom:.75rem; }
  .reg-btn-primary:hover:not(:disabled) { background:var(--reg-blue-dark); box-shadow:0 4px 14px rgba(1,59,117,.25); transform:translateY(-1px); }
  .reg-btn-primary:disabled { opacity:.65; cursor:not-allowed; }
  #msg-exito { display:none; background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #6EE7B7; border-radius:var(--reg-radius); padding:1.25rem 1.5rem; text-align:center; margin-top:1rem; }
  #msg-exito.visible { display:block; }
  .msg-exito__icono  { font-size:2rem; margin-bottom:.5rem; display:block; }
  .msg-exito__titulo { font-size:1rem; font-weight:700; color:#065F46; margin:0 0 .35rem; }
  .msg-exito__texto  { font-size:.85rem; color:#047857; margin:0; line-height:1.5; }
  .btn-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }
  @keyframes spin { to { transform:rotate(360deg); } }
  #reg-toast-container { position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999; display:flex; flex-direction:column; gap:.5rem; }
  .reg-toast { display:flex; align-items:center; gap:.6rem; padding:.75rem 1.125rem; border-radius:var(--reg-radius-sm); font-size:.875rem; font-weight:500; box-shadow:0 4px 16px rgba(0,0,0,.12); animation:toastIn 250ms ease; max-width:320px; }
  .reg-toast--success { background:#065F46; color:#fff; }
  .reg-toast--error   { background:#991B1B; color:#fff; }
  .reg-toast--info    { background:var(--reg-blue); color:#fff; }
  @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @media (max-width:540px) {
    .reg-card__body,.reg-card__header { padding:1.5rem 1.25rem; }
    .reg-card__logos { padding:1.25rem 1.25rem 1rem; }
    .cerrada-card { padding:2rem 1.5rem; }
  }
`;

// ── Componente principal ──────────────────────────────────────────────────────
export default function RegistroPage() {
  // mounted: false durante SSR y la primera hidratación del cliente.
  // Garantiza que servidor y cliente emitan HTML idéntico (solo el skeleton)
  // antes de que cualquier código que use new Date(), localStorage o window corra.
  const [mounted, setMounted] = useState(false);

  // Estado de pantalla: 'loading' | 'cerrada' | 'abierta'
  const [screen, setScreen] = useState('loading');

  // Datos de configuración
  const [config, setConfig] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Campos del formulario
  const [email,  setEmail]  = useState('');
  const [nombre, setNombre] = useState('');
  const [cuenta, setCuenta] = useState('');

  // Errores inline por campo
  const [errors, setErrors] = useState({ email: null, nombre: null, cuenta: null });

  // Estado del botón
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);

  // ── Montar + cargar configuración ─────────────────────────────────────────
  // setMounted(true) se ejecuta primero: garantiza que el hydration check de
  // React vea el mismo skeleton en servidor y cliente antes de cualquier
  // código que use new Date() u otras APIs exclusivas del navegador.
  useEffect(() => {
    setMounted(true);
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadConfig() {
    try {
      // Usa getRegistroConfig() de lib/supabase/api.js, que reutiliza el
      // singleton de @supabase/supabase-js — evita crear una tercera
      // instancia de GoTrueClient en la página.
      const data = await getRegistroConfig();
      if (!data) throw new Error('Sin datos de configuración');
      setConfig(data);
      setScreen(estaAbierto(data) ? 'abierta' : 'cerrada');
    } catch (err) {
      console.error('[registro] cargarConfig error:', err);
      setScreen('cerrada');
      addToast('No se pudo verificar el estado del registro', 'error');
    }
  }

  // ── Toast helpers ──────────────────────────────────────────────────────────
  function addToast(msg, tipo = 'info') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4350);
  }

  // ── Validación inline ──────────────────────────────────────────────────────
  function touch(field, value) {
    const r = validate[field](value);
    setErrors((prev) => ({ ...prev, [field]: r.ok ? null : r.msg }));
  }

  function clearError(field) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    const vEmail  = validate.email(email);
    const vNombre = validate.nombre(nombre);
    const vCuenta = validate.cuenta(cuenta);

    setErrors({
      email:  vEmail.ok  ? null : vEmail.msg,
      nombre: vNombre.ok ? null : vNombre.msg,
      cuenta: vCuenta.ok ? null : vCuenta.msg,
    });

    if (!vEmail.ok || !vNombre.ok || !vCuenta.ok) {
      addToast('Corrige los campos marcados en rojo', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-registro-alumno`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ email: email.toLowerCase(), nombre, numero_cuenta: cuenta }),
      });

      let result;
      try { result = await res.json(); }
      catch { throw new Error(`Error del servidor (HTTP ${res.status})`); }

      if (!res.ok || !result.success) {
        if (result.code === 'DUPLICATE_EMAIL') {
          setErrors((prev) => ({ ...prev, email: 'Este email ya está registrado' }));
          addToast('Este email ya está registrado', 'error');
        } else if (result.code === 'DUPLICATE_CUENTA') {
          setErrors((prev) => ({ ...prev, cuenta: 'Este número de cuenta ya está registrado' }));
          addToast('Este número de cuenta ya está registrado', 'error');
        } else if (result.code === 'REGISTRO_CERRADO') {
          addToast('El registro está cerrado en este momento', 'error');
          setScreen('cerrada');
        } else {
          throw new Error(result.error ?? 'Error desconocido');
        }
        return;
      }

      // Éxito
      setSuccess(true);
      addToast('¡Registro enviado con éxito!', 'success');
    } catch (err) {
      console.error('[registro] submit error:', err);
      addToast(err.message || 'No se pudo enviar el registro. Intenta nuevamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render según pantalla ──────────────────────────────────────────────────
  // Antes del montaje (SSR + hidratación inicial): skeleton estático idéntico
  // en servidor y cliente → sin riesgo de mismatch por new Date() o localStorage.
  if (!mounted) {
    return (
      <>
        <style>{REGISTRO_STYLES}</style>
        <div id="registro-page">
          <div className="reg-skeleton" aria-label="Cargando…">
            <div className="reg-skeleton__dot" />
            <div className="reg-skeleton__dot" />
            <div className="reg-skeleton__dot" />
          </div>
        </div>
      </>
    );
  }

  // A partir de aquí, new Date() solo corre en el cliente → sin hydration error.
  const hoy = hoyISO();
  const fechasExpiradas    = config?.fecha_fin    && config.fecha_fin    < hoy;
  const tieneFechasFuturas = config?.fecha_inicio && config.fecha_inicio >= hoy;

  return (
    <>
      {/* Estilos específicos de registro (igual que en registro.html) */}
      <style>{REGISTRO_STYLES}</style>

      <div id="registro-page">
        {/* ── Cargando ─────────────────────────────────────────────────── */}
        {screen === 'loading' && (
          <div className="reg-skeleton">
            <div className="reg-skeleton__dot" />
            <div className="reg-skeleton__dot" />
            <div className="reg-skeleton__dot" />
          </div>
        )}

        {/* ── Pantalla cerrada ─────────────────────────────────────────── */}
        {screen === 'cerrada' && (
          <div id="pantalla-cerrada">
            <div className="cerrada-card">
              <div className="cerrada-logos" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/UNAM.svg" alt="UNAM" className="cerrada-logo--unam" />
                <span className="cerrada-logos-sep" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/FAD.svg"  alt="FAD"  className="cerrada-logo--fad"  />
              </div>

              <h1>Registro Cerrado</h1>
              <p>
                El período de registro para acceder al Catálogo Digital de Obra
                Serigráfica está temporalmente cerrado. Regresa en las fechas indicadas.
              </p>

              {/* Lógica de fechas corregida:
                  - Si las fechas de fin ya expiraron → NO mostrar las fechas; mostrar aviso genérico
                  - Si hay fechas futuras → mostrar "Próximo período: inicio al fin"
                  - Si no hay fechas configuradas → no mostrar nada */}
              {config?.fecha_inicio && config?.fecha_fin ? (
                fechasExpiradas ? (
                  // Fechas expiradas: aviso genérico
                  <p className="cerrada-proximo-aviso">
                    Las fechas del próximo período se anunciarán próximamente.
                  </p>
                ) : (
                  // Fechas futuras o vigentes
                  <div className="cerrada-fechas">
                    <span className="cerrada-fechas-label">Próximo período:</span>
                    <span>
                      {fmtFecha(config.fecha_inicio)} al {fmtFecha(config.fecha_fin)}
                    </span>
                  </div>
                )
              ) : null}

              <br />
              <a href="/" className="btn-catalogo-ghost">← Ver el Catálogo</a>
            </div>
          </div>
        )}

        {/* ── Pantalla abierta ─────────────────────────────────────────── */}
        {screen === 'abierta' && (
          <div id="pantalla-abierta">
            <div className="reg-card">

              {/* Logos */}
              <div className="reg-card__logos" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/UNAM.svg" alt="UNAM" className="reg-logo--unam" />
                <span className="reg-logos-sep" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/FAD.svg"  alt="FAD"  className="reg-logo--fad"  />
              </div>

              {/* Header */}
              <div className="reg-card__header">
                <h1>Registro de Alumnos</h1>
                <p>Completa tu registro para acceder al catálogo digital</p>
              </div>
              <div className="reg-card__stripe" />

              {/* Body */}
              <div className="reg-card__body">

                {/* Período activo */}
                <div className="reg-periodo">
                  📅 <span>Registro abierto:</span>
                  <strong>
                    {config?.fecha_inicio && config?.fecha_fin
                      ? `${fmtFecha(config.fecha_inicio)} al ${fmtFecha(config.fecha_fin)}`
                      : 'período abierto'}
                  </strong>
                </div>

                {/* Formulario */}
                <form id="form-registro" onSubmit={handleSubmit} noValidate>

                  {/* Email */}
                  <div className="reg-field">
                    <label htmlFor="reg-email">
                      Correo electrónico <span className="req">*</span>
                    </label>
                    <input
                      type="email"
                      id="reg-email"
                      name="email"
                      className={`reg-input${errors.email ? ' error' : email && !errors.email ? ' success' : ''}`}
                      placeholder="tu@correo.unam.mx"
                      autoComplete="email"
                      value={email}
                      required
                      disabled={success}
                      onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                      onBlur={(e)   => touch('email', e.target.value.trim())}
                    />
                    {errors.email && (
                      <span className="reg-hint error">{errors.email}</span>
                    )}
                  </div>

                  {/* Nombre */}
                  <div className="reg-field">
                    <label htmlFor="reg-nombre">
                      Nombre completo <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      id="reg-nombre"
                      name="nombre"
                      className={`reg-input${errors.nombre ? ' error' : nombre && !errors.nombre ? ' success' : ''}`}
                      placeholder="Nombre Apellido Apellido"
                      autoComplete="name"
                      value={nombre}
                      required
                      disabled={success}
                      onChange={(e) => { setNombre(e.target.value); clearError('nombre'); }}
                      onBlur={(e)   => touch('nombre', e.target.value.trim())}
                    />
                    {errors.nombre && (
                      <span className="reg-hint error">{errors.nombre}</span>
                    )}
                  </div>

                  {/* Número de cuenta */}
                  <div className="reg-field">
                    <label htmlFor="reg-cuenta">
                      Número de cuenta <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      id="reg-cuenta"
                      name="numero_cuenta"
                      className={`reg-input${errors.cuenta ? ' error' : cuenta && !errors.cuenta ? ' success' : ''}`}
                      placeholder="123456789"
                      maxLength={9}
                      inputMode="numeric"
                      pattern="[0-9]{9}"
                      value={cuenta}
                      required
                      disabled={success}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setCuenta(v);
                        clearError('cuenta');
                      }}
                      onBlur={(e) => touch('cuenta', e.target.value.trim())}
                    />
                    {errors.cuenta && (
                      <span className="reg-hint error">{errors.cuenta}</span>
                    )}
                  </div>

                  <hr className="reg-divider" />

                  {/* Submit */}
                  <button
                    type="submit"
                    id="btn-registrar"
                    className="reg-btn-primary"
                    disabled={submitting || success}
                  >
                    {submitting ? (
                      <>
                        <span className="btn-spinner" />
                        Registrando…
                      </>
                    ) : success ? (
                      '✓ Registro enviado'
                    ) : (
                      'Registrarse'
                    )}
                  </button>

                  {/* Mensaje de éxito */}
                  {success && (
                    <div id="msg-exito" className="visible">
                      <span className="msg-exito__icono">✅</span>
                      <p className="msg-exito__titulo">¡Registro enviado!</p>
                      <p className="msg-exito__texto">
                        Recibirás un email cuando tu cuenta sea activada por el
                        administrador. Esto puede tomar 1–2 días hábiles.
                      </p>
                    </div>
                  )}

                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toasts */}
      <div id="reg-toast-container" aria-live="assertive" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`reg-toast reg-toast--${t.tipo}`}>
            {t.tipo === 'success' ? '✓' : t.tipo === 'error' ? '✗' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
