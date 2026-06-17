/**
 * Edge Function: save-registro-alumno
 * ──────────────────────────────────────────────────────────────────────────────
 * Recibe la solicitud de registro de un alumno desde el formulario público
 * (app/registro.html) y la guarda en registro_alumnos con estado
 * 'pendiente_validacion'. No requiere sesión del caller.
 *
 * Endpoint: POST /functions/v1/save-registro-alumno
 *
 * Body:
 *   {
 *     email:           string   // requerido
 *     nombre:          string   // requerido, mín. 3 caracteres
 *     numero_cuenta:   string   // requerido, exactamente 9 dígitos
 *     telefono?:       string   // opcional
 *     tiene_whatsapp?: boolean  // opcional, default false
 *   }
 *
 * Respuesta exitosa (200):
 *   { success: true, id: string, message: "Registro enviado" }
 *
 * Respuesta de error (4xx):
 *   { success: false, error: string, code: string }
 *
 * Códigos de error:
 *   INVALID_JSON       — body no es JSON válido
 *   MISSING_FIELDS     — faltan campos requeridos
 *   INVALID_EMAIL      — formato de email inválido
 *   INVALID_NOMBRE     — nombre muy corto (< 3 chars)
 *   INVALID_NUMERO     — numero_cuenta no es exactamente 9 dígitos
 *   REGISTRO_CERRADO   — registro_activo = false o fuera de fechas
 *   DUPLICATE_EMAIL    — email ya existe en registro_alumnos
 *   DUPLICATE_CUENTA   — numero_cuenta ya existe en registro_alumnos
 *   DB_ERROR           — error al insertar en BD
 *   INTERNAL_ERROR     — error no capturado
 *
 * Flujo:
 *   1. Validar body (campos y formatos)
 *   2. Leer registro_config → verificar registro abierto y fechas
 *   3. Verificar duplicados (email y numero_cuenta)
 *   4. INSERT en registro_alumnos
 *   5. Retornar { success: true, id }
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function fail(body: object, status = 400): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Regex ─────────────────────────────────────────────────────────────────────
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUENTA_RE = /^[0-9]{9}$/;

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // Preflight CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return fail({ success: false, error: 'Método no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  console.log('[save-registro-alumno] Iniciando...');

  try {
    // ── 1. Parsear body ────────────────────────────────────────────────────────
    let body: {
      email?:          unknown;
      nombre?:         unknown;
      numero_cuenta?:  unknown;
      telefono?:       unknown;
      tiene_whatsapp?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return fail({ success: false, error: 'Body inválido. Se esperaba JSON.', code: 'INVALID_JSON' });
    }

    const email          = typeof body.email         === 'string' ? body.email.trim().toLowerCase()  : '';
    const nombre         = typeof body.nombre        === 'string' ? body.nombre.trim()                : '';
    const numero_cuenta  = typeof body.numero_cuenta === 'string' ? body.numero_cuenta.trim()         : '';
    const telefono       = typeof body.telefono      === 'string' ? body.telefono.trim() || null       : null;
    const tiene_whatsapp = body.tiene_whatsapp === true;

    console.log('[save-registro-alumno] Body recibido:', { email, nombre, numero_cuenta });
    console.log(`[save-registro-alumno] Registro recibido: ${email}`);

    // ── 2. Validar campos requeridos ───────────────────────────────────────────
    if (!email || !nombre || !numero_cuenta) {
      return fail({
        success: false,
        error:   'Faltan campos requeridos: email, nombre, numero_cuenta.',
        code:    'MISSING_FIELDS',
      });
    }

    console.log('[save-registro-alumno] Validando email...');
    if (!EMAIL_RE.test(email)) {
      return fail({ success: false, error: 'Formato de email inválido.', code: 'INVALID_EMAIL' });
    }

    if (nombre.length < 3) {
      return fail({
        success: false,
        error:   'El nombre debe tener al menos 3 caracteres.',
        code:    'INVALID_NOMBRE',
      });
    }

    console.log('[save-registro-alumno] Validando número...');
    if (!CUENTA_RE.test(numero_cuenta)) {
      return fail({
        success: false,
        error:   'El número de cuenta debe tener exactamente 9 dígitos numéricos.',
        code:    'INVALID_NUMERO',
      });
    }

    console.log(`[save-registro-alumno] Validaciones de formato OK — ${email}`);

    // ── 3. Cliente Supabase con service_role ───────────────────────────────────
    // Necesario para leer registro_config (RLS: solo admins) y para el INSERT.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 4. Verificar que el registro está abierto ──────────────────────────────
    console.log('[save-registro-alumno] Validando registro_config...');
    const { data: config, error: configErr } = await supabase
      .from('registro_config')
      .select('registro_activo, fecha_inicio, fecha_fin')
      .limit(1)
      .single();

    if (configErr) {
      console.error('[save-registro-alumno] ERROR:', configErr.message, configErr.details);
      return fail({
        success: false,
        error:   'No se pudo verificar el estado del registro.',
        code:    'DB_ERROR',
      }, 500);
    }

    if (!config?.registro_activo) {
      console.log(`[save-registro-alumno] Registro cerrado (registro_activo = false) — ${email}`);
      return fail({
        success: false,
        error:   'El registro de alumnos está cerrado en este momento.',
        code:    'REGISTRO_CERRADO',
      });
    }

    // Verificar fechas (si están configuradas)
    const hoy = new Date().toISOString().slice(0, 10);   // 'YYYY-MM-DD'

    if (config.fecha_inicio && hoy < config.fecha_inicio) {
      console.log(`[save-registro-alumno] Registro aún no inicia (hoy: ${hoy}, inicio: ${config.fecha_inicio}) — ${email}`);
      return fail({
        success: false,
        error:   `El registro abre el ${config.fecha_inicio}.`,
        code:    'REGISTRO_CERRADO',
      });
    }

    if (config.fecha_fin && hoy > config.fecha_fin) {
      console.log(`[save-registro-alumno] Registro ya cerró (hoy: ${hoy}, fin: ${config.fecha_fin}) — ${email}`);
      return fail({
        success: false,
        error:   `El período de registro cerró el ${config.fecha_fin}.`,
        code:    'REGISTRO_CERRADO',
      });
    }

    console.log(`[save-registro-alumno] Registro activo y en fechas — ${email}`);

    // ── 5. Verificar duplicados ────────────────────────────────────────────────
    const { data: existentes, error: dupErr } = await supabase
      .from('registro_alumnos')
      .select('email, numero_cuenta')
      .or(`email.eq.${email},numero_cuenta.eq.${numero_cuenta}`);

    if (dupErr) {
      console.error('[save-registro-alumno] ERROR:', dupErr.message, dupErr.details);
      return fail({
        success: false,
        error:   'Error al verificar duplicados.',
        code:    'DB_ERROR',
      }, 500);
    }

    if (existentes && existentes.length > 0) {
      const emailDup  = existentes.some((r: { email: string }) => r.email === email);
      const cuentaDup = existentes.some((r: { numero_cuenta: string }) => r.numero_cuenta === numero_cuenta);

      if (emailDup) {
        console.log(`[save-registro-alumno] Email duplicado: ${email}`);
        return fail({
          success: false,
          error:   'Este email ya tiene un registro enviado.',
          code:    'DUPLICATE_EMAIL',
        }, 409);
      }

      if (cuentaDup) {
        console.log(`[save-registro-alumno] Número de cuenta duplicado: ${numero_cuenta} (solicitado por ${email})`);
        return fail({
          success: false,
          error:   'Este número de cuenta ya tiene un registro enviado.',
          code:    'DUPLICATE_CUENTA',
        }, 409);
      }
    }

    console.log(`[save-registro-alumno] Sin duplicados — procediendo a insertar: ${email}`);

    // ── 6. INSERT en registro_alumnos ──────────────────────────────────────────
    console.log('[save-registro-alumno] Insertando en registro_alumnos...');
    const { data: inserted, error: insertErr } = await supabase
      .from('registro_alumnos')
      .insert([{
        email,
        nombre,
        numero_cuenta,
        telefono,
        tiene_whatsapp,
        estado:          'pendiente_validacion',
        fecha_registro:  new Date().toISOString(),
      }])
      .select('id')
      .single();

    if (insertErr) {
      // Capturar duplicados a nivel DB (por si la verificación previa tuvo race condition)
      const isDup = insertErr.code === '23505';   // unique_violation PostgreSQL
      if (isDup) {
        const esEmail = insertErr.message?.includes('email');
        console.log(`[save-registro-alumno] Duplicado en INSERT (race condition) — ${email}`);
        return fail({
          success: false,
          error:   esEmail
            ? 'Este email ya tiene un registro enviado.'
            : 'Este número de cuenta ya tiene un registro enviado.',
          code:    esEmail ? 'DUPLICATE_EMAIL' : 'DUPLICATE_CUENTA',
        }, 409);
      }

      console.error('[save-registro-alumno] ERROR:', insertErr.message, insertErr.details);
      return fail({
        success: false,
        error:   `Error al guardar el registro: ${insertErr.message}`,
        code:    'DB_ERROR',
      }, 500);
    }

    const id = inserted?.id;
    console.log('[save-registro-alumno] ✓ Insertado con ID:', id);
    console.log(`[save-registro-alumno] ✓ Insertado en BD: ${id} — ${email}`);

    // ── 7. Respuesta exitosa ───────────────────────────────────────────────────
    console.log('[save-registro-alumno] ✓ Completado exitosamente');
    return ok({
      success: true,
      id,
      message: 'Registro enviado. Recibirás una notificación cuando se active tu cuenta.',
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    const details = err instanceof Error ? (err as Record<string, unknown>).details : undefined;
    console.error('[save-registro-alumno] ERROR:', message, details);
    console.error('[save-registro-alumno] Unhandled error:', err);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
