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
// CSS: todos los estilos específicos de esta pantalla (--reg-*, .cerrada-*, .reg-*)
// viven en styles/globals.css bajo la sección "=== Registro público ===".

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
      <div id="registro-page">
        <div className="reg-skeleton" aria-label="Cargando…">
          <div className="reg-skeleton__dot" />
          <div className="reg-skeleton__dot" />
          <div className="reg-skeleton__dot" />
        </div>
      </div>
    );
  }

  // A partir de aquí, new Date() solo corre en el cliente → sin hydration error.
  const hoy = hoyISO();
  const fechasExpiradas    = config?.fecha_fin    && config.fecha_fin    < hoy;
  const tieneFechasFuturas = config?.fecha_inicio && config.fecha_inicio >= hoy;

  return (
    <>
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
