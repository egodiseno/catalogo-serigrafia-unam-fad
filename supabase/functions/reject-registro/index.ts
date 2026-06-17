/**
 * Edge Function: reject-registro
 * ──────────────────────────────────────────────────────────────────────────────
 * Rechaza una solicitud de registro de alumno pendiente.
 *
 * Endpoint: POST /functions/v1/reject-registro
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>   // sesión del admin caller
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     id:          string   // UUID del registro en registro_alumnos (requerido)
 *     notas_admin: string   // motivo del rechazo (requerido, mín. 1 char)
 *   }
 *
 * Respuesta exitosa (200):
 *   { success: true, message: "Registro rechazado" }
 *
 * Respuesta de error (4xx / 5xx):
 *   { success: false, error: string, code: string }
 *
 * Códigos de error:
 *   INVALID_JSON      — body no es JSON válido
 *   MISSING_FIELDS    — falta id o notas_admin en el body (400)
 *   UNAUTHORIZED      — sin token o token inválido (401)
 *   RECORD_NOT_FOUND  — no existe registro con ese id (400)
 *   YA_PROCESADO      — estado ≠ 'pendiente_validacion' (409)
 *   DB_ERROR          — error al actualizar en BD (500)
 *   INTERNAL_ERROR    — error no capturado (500)
 *
 * Nota: NO envía email al alumno rechazado.
 *       Las notas se guardan en registro_alumnos.notas_admin para referencia.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // Preflight CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return fail(
      { success: false, error: 'Método no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' },
      405
    );
  }

  try {
    // ── 1. Parsear body ────────────────────────────────────────────────────────
    let body: { id?: unknown; notas_admin?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail({
        success: false,
        error:   'Body inválido. Se esperaba JSON.',
        code:    'INVALID_JSON',
      });
    }

    const registroId  = typeof body.id          === 'string' ? body.id.trim()          : '';
    const notasAdmin  = typeof body.notas_admin === 'string' ? body.notas_admin.trim() : '';

    if (!registroId || !notasAdmin) {
      return fail({
        success: false,
        error:   'Campos requeridos: id, notas_admin.',
        code:    'MISSING_FIELDS',
      });
    }

    // ── 2. Verificar sesión del caller ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return fail(
        { success: false, error: 'No autorizado. Token requerido.', code: 'UNAUTHORIZED' },
        401
      );
    }

    const callerToken = authHeader.replace('Bearer ', '').trim();

    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL')      ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${callerToken}` } },
        auth:   { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user: callerUser }, error: callerError } = await supabaseCaller.auth.getUser();
    if (callerError || !callerUser) {
      return fail(
        { success: false, error: 'Token inválido o sesión expirada.', code: 'UNAUTHORIZED' },
        401
      );
    }

    // ── 3. Cliente admin con service_role ─────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 4. Leer registro_alumnos ───────────────────────────────────────────────
    const { data: registro, error: fetchErr } = await supabaseAdmin
      .from('registro_alumnos')
      .select('id, email, nombre, estado')
      .eq('id', registroId)
      .single();

    if (fetchErr || !registro) {
      console.error('[reject-registro] Registro no encontrado:', registroId, fetchErr);
      return fail({
        success: false,
        error:   'Registro no encontrado.',
        code:    'RECORD_NOT_FOUND',
      }, 400);
    }

    const { email, estado } = registro as { email: string; nombre: string; estado: string };

    console.log(`[reject-registro] Rechazando: ${email}`);
    console.log(`[reject-registro] Notas: ${notasAdmin}`);

    // ── 5. Verificar estado ────────────────────────────────────────────────────
    if (estado !== 'pendiente_validacion') {
      console.log(`[reject-registro] Estado incorrecto (${estado}) — ${email}`);
      return fail({
        success: false,
        error:   `Este registro ya fue procesado (estado actual: ${estado}).`,
        code:    'YA_PROCESADO',
      }, 409);
    }

    // ── 6. UPDATE registro_alumnos ─────────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('registro_alumnos')
      .update({
        estado:           'rechazado',
        notas_admin:      notasAdmin,
        fecha_activacion: null,          // nunca se activó
      })
      .eq('id', registroId);

    if (updateErr) {
      console.error(`[reject-registro] Error actualizando registro_alumnos (${registroId}):`, updateErr);
      return fail({
        success: false,
        error:   `Error al rechazar el registro: ${updateErr.message}`,
        code:    'DB_ERROR',
      }, 500);
    }

    console.log(`[reject-registro] Rechazado exitosamente: ${email}`);

    // ── 7. Respuesta exitosa ───────────────────────────────────────────────────
    return ok({
      success: true,
      message: 'Registro rechazado.',
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[reject-registro] Unhandled error:', err);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
