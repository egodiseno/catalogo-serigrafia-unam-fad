/**
 * Edge Function: validate-registro
 * ──────────────────────────────────────────────────────────────────────────────
 * Activa una solicitud de alumno pendiente:
 *   1. Lee registro_alumnos y verifica estado = 'pendiente_validacion'
 *   2. Crea cuenta en auth.users (email confirmado automáticamente)
 *   3. Inserta en usuarios_admin (rol: 'editor')
 *   4. Actualiza registro_alumnos → estado: 'activo', user_id, fecha_activacion
 *   5. Llama a send-welcome-email (no bloqueante)
 *
 * Endpoint: POST /functions/v1/validate-registro
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>   // sesión del admin caller
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     id:        string   // UUID del registro en registro_alumnos (requerido)
 *     password?: string   // opcional — si omitido, se genera automáticamente
 *   }
 *
 * Respuesta exitosa (200):
 *   { success: true, userId: string, password?: string, message: string }
 *   (password solo se incluye cuando fue auto-generada)
 *
 * Respuesta de error (4xx / 5xx):
 *   { success: false, error: string, code: string }
 *
 * Códigos de error:
 *   INVALID_JSON         — body no es JSON válido
 *   MISSING_FIELDS       — falta id en el body
 *   UNAUTHORIZED         — sin token o token inválido (401)
 *   RECORD_NOT_FOUND     — no existe registro con ese id (400)
 *   YA_VALIDADO          — estado ≠ 'pendiente_validacion' (409)
 *   EMAIL_EXISTS_IN_AUTH — email ya tiene cuenta en auth.users (409)
 *   AUTH_ERROR           — error al crear usuario Auth (500)
 *   DB_ERROR             — error al insertar/actualizar en BD (500)
 *   INTERNAL_ERROR       — error no capturado (500)
 *
 * Rollback:
 *   Si INSERT en usuarios_admin falla → se elimina el usuario de auth.users.
 *   Si UPDATE en registro_alumnos falla → se reporta el error pero NO se revierte
 *   el usuario ya creado (para evitar perder datos; el admin puede corregirlo).
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

// ── Generar contraseña aleatoria segura (16 chars) ────────────────────────────
function generatePassword(): string {
  const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  for (let i = 0; i < 16; i++) {
    pwd += pool[Math.floor(Math.random() * pool.length)];
  }
  return pwd;
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
    let body: { id?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail({ success: false, error: 'Body inválido. Se esperaba JSON.', code: 'INVALID_JSON' });
    }

    const registroId    = typeof body.id       === 'string' ? body.id.trim()       : '';
    const inputPassword = typeof body.password === 'string' ? body.password.trim() : '';

    if (!registroId) {
      return fail({
        success: false,
        error:   'Campo requerido: id.',
        code:    'MISSING_FIELDS',
      });
    }

    // ── 2. Verificar sesión del caller (admin) ─────────────────────────────────
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
      .select('id, email, nombre, numero_cuenta, estado')
      .eq('id', registroId)
      .single();

    if (fetchErr || !registro) {
      console.error('[validate-registro] Registro no encontrado:', registroId, fetchErr);
      return fail({
        success: false,
        error:   'Registro no encontrado.',
        code:    'RECORD_NOT_FOUND',
      }, 400);
    }

    const { email, nombre, estado } = registro as {
      email:         string;
      nombre:        string;
      numero_cuenta: string;
      estado:        string;
    };

    console.log(`[validate-registro] Activando: ${email}`);

    // ── 5. Verificar estado ────────────────────────────────────────────────────
    if (estado !== 'pendiente_validacion') {
      console.log(`[validate-registro] Estado incorrecto (${estado}) — ${email}`);
      return fail({
        success: false,
        error:   `Este registro ya fue procesado (estado actual: ${estado}).`,
        code:    'YA_VALIDADO',
      }, 409);
    }

    // ── 6. Determinar contraseña ───────────────────────────────────────────────
    // Si viene una contraseña válida (≥ 8 chars) la usamos; si no, generamos una.
    const passwordWasGenerated = !inputPassword || inputPassword.length < 8;
    const passwordToUse        = passwordWasGenerated ? generatePassword() : inputPassword;

    // ── 7. Crear usuario en auth.users ─────────────────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password:      passwordToUse,
      email_confirm: true,   // el alumno ya validó el email al registrarse
    });

    if (authError) {
      const isAlreadyExists =
        authError.message?.toLowerCase().includes('already') ||
        authError.message?.toLowerCase().includes('duplicate') ||
        (authError as { status?: number }).status === 422;

      console.error(`[validate-registro] Error creando usuario Auth (${email}):`, authError);
      return fail({
        success: false,
        error:   isAlreadyExists
          ? `El email "${email}" ya tiene una cuenta de acceso.`
          : `Error al crear cuenta: ${authError.message}`,
        code:    isAlreadyExists ? 'EMAIL_EXISTS_IN_AUTH' : 'AUTH_ERROR',
      }, isAlreadyExists ? 409 : 500);
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.error('[validate-registro] authData.user.id vacío');
      return fail(
        { success: false, error: 'No se pudo obtener el ID del usuario creado.', code: 'AUTH_ERROR' },
        500
      );
    }

    console.log(`[validate-registro] Usuario creado en auth: ${userId}`);

    // ── 8. INSERT en usuarios_admin ────────────────────────────────────────────
    const { error: insertErr } = await supabaseAdmin
      .from('usuarios_admin')
      .insert([{
        id:     userId,
        email,
        nombre: nombre?.trim() || null,
        rol:    'editor',    // los alumnos del catálogo acceden como 'editor'
        estado: 'activo',
      }]);

    if (insertErr) {
      // Rollback: eliminar usuario de auth para no dejar datos huérfanos
      console.error(
        `[validate-registro] Error en INSERT usuarios_admin, rollback auth user ${userId}:`,
        insertErr
      );
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return fail({
        success: false,
        error:   `Error al crear perfil de usuario: ${insertErr.message}`,
        code:    'DB_ERROR',
      }, 500);
    }

    console.log(`[validate-registro] Insertado en usuarios_admin: ${userId}`);

    // ── 9. UPDATE registro_alumnos ─────────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('registro_alumnos')
      .update({
        estado:           'activo',
        user_id:          userId,
        fecha_activacion: new Date().toISOString(),
      })
      .eq('id', registroId);

    if (updateErr) {
      // El usuario ya existe en auth y usuarios_admin.
      // Solo reportamos el error — no revertimos para evitar perder el usuario ya creado.
      // El admin puede corregirlo con una actualización manual.
      console.error(
        `[validate-registro] Error actualizando registro_alumnos (${registroId}):`,
        updateErr
      );
      return fail({
        success: false,
        error:   `Usuario creado pero no se pudo actualizar el registro: ${updateErr.message}`,
        code:    'DB_ERROR',
      }, 500);
    }

    console.log(
      `[validate-registro] registro_alumnos actualizado — estado: activo, user_id: ${userId}`
    );

    // ── 10. Enviar email de bienvenida (no bloqueante) ─────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')      ?? '';
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const welcomeUrl  = `${supabaseUrl}/functions/v1/send-welcome-email`;

    try {
      console.log(`[validate-registro] Enviando email de bienvenida a: ${email}`);
      const welcomeRes = await fetch(welcomeUrl, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${callerToken}`,   // reenviar token del admin caller
          'apikey':        anonKey,
        },
        body: JSON.stringify({ email, nombre, rol: 'editor' }),
      });

      if (!welcomeRes.ok) {
        const errText = await welcomeRes.text();
        console.warn(
          `[validate-registro] send-welcome-email respondió ${welcomeRes.status}:`,
          errText
        );
      } else {
        console.log(`[validate-registro] Email de bienvenida enviado a: ${email}`);
      }
    } catch (emailErr) {
      // Fallo de email no cancela el registro — solo se loguea
      console.error(`[validate-registro] Error al enviar email (no bloqueante):`, emailErr);
    }

    // ── 11. Respuesta exitosa ──────────────────────────────────────────────────
    const responseBody: Record<string, unknown> = {
      success: true,
      userId,
      message: 'Usuario activado y email de bienvenida enviado.',
    };

    // Incluir la contraseña SOLO cuando fue auto-generada
    // (el admin la necesita para comunicársela al alumno si el email falla)
    if (passwordWasGenerated) {
      responseBody.password = passwordToUse;
    }

    return ok(responseBody);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[validate-registro] Unhandled error:', err);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
