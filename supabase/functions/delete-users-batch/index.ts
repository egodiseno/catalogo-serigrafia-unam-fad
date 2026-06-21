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
 *   { success: true, deleted_count: 2, borradores_eliminados: 1, not_found: [], message: "..." }
 *
 * borradores_eliminados — número de obras en estado "Borrador" eliminadas como parte
 *   de la limpieza automática previa al borrado de los usuarios del lote.
 *   Solo se eliminan obras propias del usuario en ese estado; cualquier obra en otro
 *   estado (En Revisión, Publicado, Archivado) no se toca.
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

    // ── 3. Verificar que el caller es ADMIN o SUPER_EDITOR ──────────────────
    const { data: callerRow, error: callerErr } = await supabaseAdmin
      .from('usuarios_admin')
      .select('email, rol')
      .eq('id', caller.id)
      .single();

    if (callerErr || !callerRow) {
      return jsonError({ success: false, error: 'No tienes permisos para esta acción.', code: 'FORBIDDEN' }, 403);
    }

    if (callerRow.rol !== 'admin' && callerRow.rol !== 'super_editor') {
      return jsonError({
        success: false,
        error:   `No tienes permisos para borrar usuarios. Tu rol: ${callerRow.rol}.`,
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

    // ── 4b. Guard: super_editor solo puede borrar usuarios con rol 'editor' ──
    if (callerRow.rol === 'super_editor') {
      const { data: targets4b } = await supabaseAdmin
        .from('usuarios_admin')
        .select('email, rol')
        .in('email', emailList);

      const forbidden = (targets4b ?? []).filter(
        (u: { email: string; rol: string }) => u.rol === 'admin' || u.rol === 'super_editor'
      );
      if (forbidden.length > 0) {
        return jsonError({
          success: false,
          error:   'Solo puedes eliminar usuarios con rol editor.',
          code:    'INSUFFICIENT_ROLE',
        }, 403);
      }
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

    // ── 6b. Limpiar obras en Borrador de los usuarios a eliminar ────────────
    // DEBE ejecutarse ANTES de borrar de usuarios_admin, ya que la FK entre
    // usuarios_admin y obras pone editor_id = NULL automáticamente al borrar
    // el usuario, perdiendo la posibilidad de identificar las obras huérfanas.
    //
    // Solo se tocan obras con estado = 'Borrador'. Obras en cualquier otro
    // estado (En Revisión, Publicado, Archivado) no se modifican — solo
    // perderán la referencia al editor, lo cual es aceptable.
    let borradores_eliminados = 0;

    for (const target of targets as Array<{ id: string; email: string }>) {
      // Buscar todas las obras propias del usuario en estado Borrador
      const { data: obrasBorrador, error: obrasErr } = await supabaseAdmin
        .from('obras')
        .select('id')
        .eq('editor_id', target.id)
        .eq('estado', 'Borrador');

      if (obrasErr) {
        console.error(
          `[delete-users-batch] Error buscando Borradores de ${target.email}:`,
          obrasErr.message
        );
        continue; // No detener el lote — seguir con el siguiente usuario
      }

      if (!obrasBorrador || obrasBorrador.length === 0) {
        console.log(`[delete-users-batch] Sin obras en Borrador para ${target.email}`);
        continue;
      }

      console.log(
        `[delete-users-batch] ${obrasBorrador.length} obra(s) en Borrador ` +
        `a limpiar para ${target.email}`
      );

      for (const obra of obrasBorrador as Array<{ id: string }>) {
        // 1. Obtener imágenes asociadas a esta obra
        const { data: imagenes, error: imgFetchErr } = await supabaseAdmin
          .from('imagenes')
          .select('id, url_storage')
          .eq('obra_id', obra.id);

        if (imgFetchErr) {
          console.error(
            `[delete-users-batch] Error obteniendo imágenes de obra ${obra.id}:`,
            imgFetchErr.message
          );
          // Continuar e intentar borrar la obra de todas formas
        }

        // 2. Eliminar cada imagen (Storage físico + registro DB)
        for (const img of (imagenes ?? []) as Array<{ id: string; url_storage: string }>) {
          // 2a. Borrar archivo físico del bucket 'artworks'
          const storagePath = img.url_storage?.split('/artworks/')?.[1];
          if (storagePath) {
            const { error: storageErr } = await supabaseAdmin.storage
              .from('artworks')
              .remove([storagePath]);
            if (storageErr) {
              // Registrar pero no detener — puede quedar huérfano en Storage
              console.error(
                `[delete-users-batch] ⚠ Storage — no se pudo borrar ${storagePath}:`,
                storageErr.message
              );
            } else {
              console.log(`[delete-users-batch] ✓ Storage eliminado: ${storagePath}`);
            }
          } else {
            console.warn(
              `[delete-users-batch] ⚠ Path de Storage no extraíble — ` +
              `imagen ${img.id}: ${img.url_storage}`
            );
          }

          // 2b. Borrar registro de la tabla imagenes
          const { error: imgDelErr } = await supabaseAdmin
            .from('imagenes')
            .delete()
            .eq('id', img.id);
          if (imgDelErr) {
            console.error(
              `[delete-users-batch] ⚠ Error eliminando registro imagenes ${img.id}:`,
              imgDelErr.message
            );
            // No detener
          }
        }

        // 3. Borrar el registro de la obra
        const { error: obraDelErr } = await supabaseAdmin
          .from('obras')
          .delete()
          .eq('id', obra.id);

        if (obraDelErr) {
          console.error(
            `[delete-users-batch] ✗ Error eliminando obra en Borrador ${obra.id}:`,
            obraDelErr.message
          );
          // No contabilizar como eliminada
        } else {
          borradores_eliminados++;
          console.log(
            `[delete-users-batch] ✓ Obra en Borrador eliminada: ${obra.id} ` +
            `(editor: ${target.email})`
          );
        }
      }
    }

    if (borradores_eliminados > 0) {
      console.log(
        `[delete-users-batch] Limpieza: ${borradores_eliminados} ` +
        `obra${borradores_eliminados !== 1 ? 's en Borrador eliminadas' : ' en Borrador eliminada'}`
      );
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
      success:               true,
      deleted_count,
      borradores_eliminados,
      not_found:     notFound.length   > 0 ? notFound    : undefined,
      auth_errors:   auth_errors.length > 0 ? auth_errors : undefined,
      message:       `${deleted_count} usuario${deleted_count !== 1 ? 's eliminados' : ' eliminado'} correctamente.` +
                     (borradores_eliminados > 0
                       ? ` ${borradores_eliminados} obra${borradores_eliminados !== 1 ? 's en Borrador eliminadas' : ' en Borrador eliminada'} (limpieza automática).`
                       : ''),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[delete-users-batch] Unhandled error:', err);
    return jsonError({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
