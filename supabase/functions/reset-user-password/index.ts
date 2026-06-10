/**
 * Edge Function: reset-user-password
 * ──────────────────────────────────────────────────────────────────────────────
 * Envía un email de recuperación de contraseña a un usuario admin.
 * Solo puede llamarse desde un admin autenticado.
 *
 * Endpoint: POST /functions/v1/reset-user-password
 *
 * Body:
 *   { email: string }
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Respuesta exitosa (200):
 *   { success: true, message: string }
 *
 * Respuesta de error:
 *   { success: false, error: string, code?: string }
 *
 * ⚠️  Por qué resetPasswordForEmail() y no generateLink():
 *   generateLink({ type: 'recovery' }) solo GENERA el link en el servidor —
 *   NO envía el email. Es responsabilidad del llamador enviarlo (ej: via Resend).
 *   resetPasswordForEmail() SÍ envía el email automáticamente usando el
 *   proveedor de email configurado en el proyecto Supabase.
 *
 * Variables auto-inyectadas por Supabase:
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *
 * Secret opcional:
 *   SITE_URL  — URL del admin panel (default: http://localhost:8000/app/admin/index.html)
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function ok(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function fail(body: object, status = 400): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Handler ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return fail({ success: false, error: 'Método no permitido. Usa POST.' }, 405);
  }

  try {
    // ── Leer variables de entorno ─────────────────────────────────────────────
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')      ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnon) {
      console.error('[reset-user-password] Variables de entorno faltantes (SUPABASE_URL / SUPABASE_ANON_KEY)');
      return fail(
        { success: false, error: 'Configuración del servidor incompleta.', code: 'CONFIG_ERROR' },
        500
      );
    }

    // ── Parsear body ──────────────────────────────────────────────────────────
    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return fail({ success: false, error: 'Body inválido. Se esperaba JSON.' });
    }

    const { email } = body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail({ success: false, error: 'Email inválido o faltante.', code: 'INVALID_EMAIL' });
    }

    // ── Verificar sesión del caller ───────────────────────────────────────────
    // Solo admins autenticados pueden invocar esta función
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return fail({ success: false, error: 'No autorizado. Token requerido.' }, 401);
    }

    const callerToken    = authHeader.replace('Bearer ', '').trim();
    const supabaseCaller = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
      auth:   { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: callerError } = await supabaseCaller.auth.getUser();
    if (callerError || !callerUser) {
      return fail({ success: false, error: 'Token inválido o sesión expirada.' }, 401);
    }

    // ── Enviar email de recuperación ──────────────────────────────────────────
    // resetPasswordForEmail() SÍ envía el email automáticamente.
    // El link en el email redirigirá a redirectTo con #access_token=...&type=recovery
    // que auth.js detecta para mostrar el formulario de nueva contraseña.
    const redirectTo = Deno.env.get('SITE_URL')
      ?? 'http://localhost:8000/app/admin/index.html';

    // Cliente anon (sin service role) — resetPasswordForEmail lo requiere
    const supabaseAnonClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: resetError } = await supabaseAnonClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      console.error('[reset-user-password] resetPasswordForEmail error:', resetError.message);
      return fail(
        { success: false, error: resetError.message, code: 'RESET_ERROR' },
        400
      );
    }

    // Supabase envía el email aunque el usuario no exista (por seguridad no revela existencia)
    console.log(`[reset-user-password] ✓ Email de recuperación enviado a ${email} (iniciado por ${callerUser.email})`);

    return ok({
      success: true,
      message: `Se ha enviado un link de restablecimiento a ${email}.`,
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error interno del servidor.';
    console.error('[reset-user-password] Unhandled error:', e);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
