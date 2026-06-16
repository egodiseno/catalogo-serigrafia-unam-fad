/**
 * Edge Function: create-admin-user
 * ──────────────────────────────────────────────────────────────────────────────
 * Crea un usuario admin de forma segura usando la service_role_key en el
 * servidor. Nunca expone la service key al frontend.
 *
 * Endpoint: POST /functions/v1/create-admin-user
 *
 * Body:
 *   { email: string, password: string, rol: 'admin' | 'editor' | 'viewer' }
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Respuesta exitosa (200):
 *   { success: true, userId: string, email: string }
 *
 * Respuesta de error (4xx / 5xx):
 *   { success: false, error: string, code?: string }
 *
 * Flujo:
 *   1. Verificar método POST + CORS preflight
 *   2. Validar campos del body
 *   3. Verificar que el caller tiene sesión activa
 *   4. Crear usuario en Supabase Auth (email_confirm: true)
 *   5. Insertar en tabla usuarios_admin { id, email, rol, estado: 'activo' }
 *   6. Si el INSERT falla → rollback: eliminar usuario de Auth
 *   7. Retornar resultado
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }         from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS headers ────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
};

// ── Tipos ────────────────────────────────────────────────────────────────────
type Rol = 'admin' | 'editor' | 'viewer';

interface RequestBody {
  email:    string;
  password: string;
  rol:      Rol;
  nombre?:  string;   // opcional — se guarda en usuarios_admin.nombre
}

interface SuccessResponse {
  success: true;
  userId:  string;
  email:   string;
}

interface ErrorResponse {
  success: false;
  error:   string;
  code?:   string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function jsonOk(body: SuccessResponse): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

function jsonError(body: ErrorResponse, status = 400): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Handler principal ────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // 1. Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // 2. Solo POST
  if (req.method !== 'POST') {
    return jsonError({ success: false, error: 'Método no permitido. Usa POST.' }, 405);
  }

  try {
    // 3. Parsear y validar body ─────────────────────────────────────────────
    let body: Partial<RequestBody>;
    try {
      body = await req.json();
    } catch {
      return jsonError({ success: false, error: 'Body inválido. Se esperaba JSON.' });
    }

    const { email, password, rol, nombre } = body;

    if (!email || !password || !rol) {
      return jsonError({
        success: false,
        error:   'Faltan campos requeridos.',
        code:    'MISSING_FIELDS',
      });
    }

    // Validar formato email básico
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError({ success: false, error: 'Formato de email inválido.', code: 'INVALID_EMAIL' });
    }

    // Validar contraseña mínima
    if (password.length < 8) {
      return jsonError({
        success: false,
        error:   'La contraseña debe tener al menos 8 caracteres.',
        code:    'WEAK_PASSWORD',
      });
    }

    // Validar rol
    const VALID_ROLES: Rol[] = ['admin', 'editor', 'viewer'];
    if (!VALID_ROLES.includes(rol as Rol)) {
      return jsonError({
        success: false,
        error:   `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}.`,
        code:    'INVALID_ROL',
      });
    }

    // 4. Verificar que el caller tiene sesión activa ────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError({ success: false, error: 'No autorizado. Token requerido.' }, 401);
    }

    const callerToken = authHeader.replace('Bearer ', '').trim();

    // Cliente con el token del caller (anon key + JWT) para verificar sesión
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
      return jsonError({ success: false, error: 'Token inválido o sesión expirada.' }, 401);
    }

    // 5. Cliente admin con service_role_key ────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // 6. Crear usuario en Supabase Auth ────────────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,          // auto-confirmar → sin email pendiente
    });

    if (authError) {
      // Códigos comunes de Supabase Auth
      const isAlreadyExists = authError.message?.toLowerCase().includes('already') ||
                              authError.message?.toLowerCase().includes('duplicate');
      return jsonError(
        {
          success: false,
          error:   isAlreadyExists
            ? `El email "${email}" ya está registrado.`
            : authError.message,
          code: isAlreadyExists ? 'EMAIL_EXISTS' : 'AUTH_ERROR',
        },
        isAlreadyExists ? 409 : 400
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      return jsonError(
        { success: false, error: 'No se pudo obtener el ID del usuario creado.', code: 'NO_USER_ID' },
        500
      );
    }

    // 7. Insertar en tabla usuarios_admin ──────────────────────────────────
    const { error: dbError } = await supabaseAdmin
      .from('usuarios_admin')
      .insert([{
        id:     userId,
        email,
        rol,
        nombre: nombre?.trim() || null,   // recibido del frontend; null limpia el DEFAULT '-'
        estado: 'activo',
      }]);

    if (dbError) {
      // Rollback: eliminar el usuario de Auth para no dejar datos huérfanos
      console.error(`[create-admin-user] DB insert failed. Rolling back Auth user ${userId}:`, dbError);
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return jsonError(
        {
          success: false,
          error:   `Error al guardar el usuario en la base de datos: ${dbError.message}`,
          code:    'DB_INSERT_FAILED',
        },
        500
      );
    }

    // 8. Éxito ─────────────────────────────────────────────────────────────
    console.log(`[create-admin-user] ✓ Usuario creado: ${email} (id: ${userId}, rol: ${rol})`);
    return jsonOk({ success: true, userId, email });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[create-admin-user] Unhandled error:', err);
    return jsonError({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
