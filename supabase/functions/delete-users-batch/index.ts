/**
 * Edge Function: delete-users-batch
 * ──────────────────────────────────────────────────────────────────────────────
 * Elimina usuarios de forma segura desde el servidor usando service_role_key:
 *   1. Verifica que el caller tiene sesión activa y rol = 'admin'
 *   2. Aplica guards (no self-delete, no último admin)
 *   3. DELETE FROM usuarios_admin WHERE email IN (...)
 *   4. Elimina cada usuario de auth.users via supabaseAdmin.auth.admin.deleteUser()
 *
 * Endpoint: POST /functions/v1/delete-users-batch
 *
 * Body:
 *   { "emails": ["user1@ejemplo.com", "user2@ejemplo.com"] }
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Respuesta exitosa (200):
 *   { success: true, deleted_count: 2, not_found: [], message: "..." }
 *
 * Respuesta de error (4xx / 5xx):
 *   { success: false, error: string, code?: string }
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonOk(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}
function jsonError(body: object, status = 400): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonError({ success: false, error: 'Método no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    // ── 1. Parsear body ─────────────────────────────────────────────────────
    let body: { emails?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonError({ success: false, error: 'Body inválido. Se esperaba JSON.', code: 'INVALID_JSON' });
    }

    const { emails } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return jsonError({
        success: false,
        error:   'El campo "emails" debe ser un array no vacío.',
        code:    'INVALID_EMAILS',
      });
    }

    // Validar que cada elemento sea un string con @
    if (!(emails as unknown[]).every(e => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) {
      return jsonError({
        success: false,
        error:   'Todos los elementos de "emails" deben ser cadenas de email válidas.',
        code:    'INVALID_EMAIL_FORMAT',
      });
    }

    const emailList = emails as string[];

    // ── 2. Verificar sesión del caller ──────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonError({ success: false, error: 'Token de autorización requerido.', code: 'NO_AUTH' }, 401);
    }

    const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
    const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')         ?? '';
    const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('[delete-users-batch] Faltan env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
      return jsonError({ success: false, error: 'Configuración del servidor incompleta.', code: 'CONFIG_ERROR' }, 500);
    }

    // Cliente con la sesión del caller → para verificar su identidad
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      return jsonError({ success: false, error: 'Sesión inválida o expirada.', code: 'INVALID_SESSION' }, 401);
    }

    // Cliente con service_role_key → para operaciones privilegiadas
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 3. Verificar que el caller es ADMIN ─────────────────────────────────
    const { data: callerRow, error: callerErr } = await supabaseAdmin
      .from('usuarios_admin')
      .select('email, rol')
      .eq('id', caller.id)
      .single();

    if (callerErr || !callerRow) {
      return jsonError({ success: false, error: 'No tienes permisos para esta acción.', code: 'FORBIDDEN' }, 403);
    }

    if (callerRow.rol !== 'admin') {
      return jsonError({
        success: false,
        error:   `Solo los administradores pueden borrar usuarios en lote. Tu rol: ${callerRow.rol}.`,
        code:    'INSUFFICIENT_ROLE',
      }, 403);
    }

    // ── 4. Guard: no auto-borrar ─────────────────────────────────────────────
    if (emailList.includes(callerRow.email)) {
      return jsonError({
        success: false,
        error:   'No puedes eliminar tu propia cuenta.',
        code:    'SELF_DELETE',
      });
    }

    // ── 5. Guard: no eliminar el último admin ────────────────────────────────
    const { data: allAdmins } = await supabaseAdmin
      .from('usuarios_admin')
      .select('email')
      .eq('rol', 'admin');

    const adminEmails     = (allAdmins ?? []).map((a: { email: string }) => a.email);
    const deletingAdmins  = emailList.filter(e => adminEmails.includes(e));
    const remainingAdmins = adminEmails.filter(e => !emailList.includes(e));

    if (deletingAdmins.length > 0 && remainingAdmins.length === 0) {
      return jsonError({
        success: false,
        error:   'No se puede eliminar al último administrador.',
        code:    'LAST_ADMIN',
      });
    }

    // ── 6. Obtener registros a borrar (necesitamos los IDs para Auth) ────────
    const { data: targets, error: fetchErr } = await supabaseAdmin
      .from('usuarios_admin')
      .select('id, email')
      .in('email', emailList);

    if (fetchErr) {
      console.error('[delete-users-batch] Error al buscar usuarios:', fetchErr);
      return jsonError({
        success: false,
        error:   `Error al consultar usuarios: ${fetchErr.message}`,
        code:    'FETCH_ERROR',
      }, 500);
    }

    if (!targets || targets.length === 0) {
      return jsonOk({
        success:       true,
        deleted_count: 0,
        not_found:     emailList,
        message:       'Ningún usuario encontrado con esos emails.',
      });
    }

    const foundEmails = targets.map((u: { email: string }) => u.email);
    const notFound    = emailList.filter(e => !foundEmails.includes(e));

    if (notFound.length > 0) {
      console.warn('[delete-users-batch] Emails no encontrados en usuarios_admin:', notFound);
    }

    // ── 7. DELETE FROM usuarios_admin ────────────────────────────────────────
    const { error: dbDeleteErr } = await supabaseAdmin
      .from('usuarios_admin')
      .delete()
      .in('email', foundEmails);

    if (dbDeleteErr) {
      console.error('[delete-users-batch] Error al eliminar de usuarios_admin:', dbDeleteErr);
      return jsonError({
        success: false,
        error:   `Error al eliminar de la base de datos: ${dbDeleteErr.message}`,
        code:    'DB_DELETE_ERROR',
      }, 500);
    }

    // ── 8. DELETE FROM auth.users (por UUID) ─────────────────────────────────
    const authResults: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const target of targets as Array<{ id: string; email: string }>) {
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(target.id);
      if (authDelErr) {
        console.error(`[delete-users-batch] ✗ Auth delete failed — ${target.email}:`, authDelErr.message);
        authResults.push({ email: target.email, success: false, error: authDelErr.message });
      } else {
        console.log(`[delete-users-batch] ✓ Eliminado — ${target.email} (id: ${target.id})`);
        authResults.push({ email: target.email, success: true });
      }
    }

    const deleted_count = authResults.filter(r => r.success).length;
    const auth_errors   = authResults.filter(r => !r.success);

    console.log(
      `[delete-users-batch] Resumen: ${deleted_count}/${targets.length} eliminados ` +
      `por ${callerRow.email} — ${new Date().toISOString()}`
    );

    return jsonOk({
      success:       true,
      deleted_count,
      not_found:     notFound.length > 0 ? notFound     : undefined,
      auth_errors:   auth_errors.length  > 0 ? auth_errors : undefined,
      message:       `${deleted_count} usuario${deleted_count !== 1 ? 's eliminados' : ' eliminado'} correctamente.`,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[delete-users-batch] Unhandled error:', err);
    return jsonError({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
