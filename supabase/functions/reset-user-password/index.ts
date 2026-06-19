/**
 * Edge Function: reset-user-password
 * ──────────────────────────────────────────────────────────────────────────────
 * Genera un recovery link y lo envía via Brevo HTTP API v3.
 * Llamado desde el panel admin para resetear la contraseña de un alumno/editor.
 *
 * Endpoint: POST /functions/v1/reset-user-password
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Body:
 *   { email: string }
 *
 * Respuesta exitosa (200):
 *   { success: true, message: string, messageId: string }
 *
 * Respuesta de error:
 *   { success: false, error: string, code: string }
 *
 * Códigos de error:
 *   INVALID_EMAIL   — email inválido o faltante
 *   UNAUTHORIZED    — token inválido o ausente (401)
 *   CONFIG_ERROR    — BREVO_API_KEY no configurado (500)
 *   LINK_ERROR      — Supabase no pudo generar el recovery link (400)
 *   BREVO_ERROR     — Brevo API rechazó el envío (500)
 *   INTERNAL_ERROR  — error no capturado (500)
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

function ok(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}
function fail(body: object, status = 400): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── HTML del email de reset ───────────────────────────────────────────────────
function buildResetHtml(nombre: string, email: string, resetLink: string): string {
  const displayName = nombre || email.split('@')[0];
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña — Catálogo UNAM/FAD</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#F4F6F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header azul UNAM -->
          <tr>
            <td style="background:#013B75;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;
                         letter-spacing:0.5px;">
                Catálogo de Obra Serigráfica
              </h1>
              <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">
                UNAM / Facultad de Artes y Diseño
              </p>
            </td>
          </tr>

          <!-- Barra dorada -->
          <tr>
            <td style="height:4px;background:#D9A500;"></td>
          </tr>

          <!-- Icono -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;
                          border-radius:50%;background:#EFF6FF;
                          line-height:56px;font-size:26px;text-align:center;">
                &#128273;
              </div>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:24px 40px 40px;">
              <h2 style="color:#013B75;margin:0 0 16px;font-size:18px;
                         text-align:center;">
                Restablecer contraseña
              </h2>
              <p style="color:#374151;margin:0 0 12px;line-height:1.6;">
                Hola, <strong>${displayName}</strong>:
              </p>
              <p style="color:#374151;margin:0 0 24px;line-height:1.6;">
                El administrador del Catálogo ha generado un enlace para que
                restablezca su contraseña de acceso al panel administrativo.
                Haz clic en el botón a continuación:
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:6px;background:#013B75;">
                    <a href="${resetLink}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;
                              text-decoration:none;font-size:15px;font-weight:600;
                              letter-spacing:0.3px;">
                      Restablecer mi contraseña &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="color:#013B75;font-size:12px;word-break:break-all;
                        margin:0 0 24px;">
                ${resetLink}
              </p>

              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">

              <!-- Aviso de seguridad -->
              <div style="background:#FEF3C7;border:1px solid #FDE68A;
                          border-radius:6px;padding:12px 16px;margin-bottom:16px;">
                <p style="color:#92400E;font-size:13px;margin:0;line-height:1.5;">
                  ⚠️ Este enlace es de <strong>un solo uso</strong>
                  y expira en <strong>24 horas</strong>.
                </p>
              </div>

              <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.5;">
                Si no solicitaste este cambio, puedes ignorar este email.
                Tu contraseña actual permanece sin cambios. Para soporte,
                contacta al administrador del catálogo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 40px;text-align:center;
                       border-top:1px solid #E5E7EB;">
              <p style="color:#9CA3AF;font-size:11px;margin:0;">
                © UNAM / Facultad de Artes y Diseño —
                Catálogo de Obra Serigráfica
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return fail(
      { success: false, error: 'Método no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' },
      405
    );
  }

  try {
    // ── 1. Parsear body ────────────────────────────────────────────────────────
    let body: { email?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail({ success: false, error: 'Body inválido. Se esperaba JSON.' });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail({
        success: false,
        error:   'Email inválido o faltante.',
        code:    'INVALID_EMAIL',
      });
    }

    console.log(`[reset-user-password] Solicitud para: ${email}`);

    // ── 2. Verificar sesión del caller (admin) ─────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return fail(
        { success: false, error: 'No autorizado. Token requerido.', code: 'UNAUTHORIZED' },
        401
      );
    }

    const callerToken    = authHeader.replace('Bearer ', '').trim();
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

    console.log(`[reset-user-password] Caller verificado: ${callerUser.email}`);

    // ── 3. Leer BREVO_API_KEY ──────────────────────────────────────────────────
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';
    if (!brevoApiKey) {
      console.error('[reset-user-password] BREVO_API_KEY no configurada');
      return fail(
        { success: false, error: 'Servicio de email no configurado (BREVO_API_KEY).', code: 'CONFIG_ERROR' },
        500
      );
    }

    // ── 4. Cliente admin (service_role) ───────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/';

    // ── 4b. Verificar rol del caller; super_editor solo puede resetear 'editor' ─
    const { data: callerRow } = await supabaseAdmin
      .from('usuarios_admin')
      .select('rol')
      .eq('id', callerUser.id)
      .single();

    if (callerRow?.rol === 'super_editor') {
      const { data: targetRow } = await supabaseAdmin
        .from('usuarios_admin')
        .select('rol')
        .eq('email', email)
        .single();

      if (targetRow && (targetRow.rol === 'admin' || targetRow.rol === 'super_editor')) {
        return fail({
          success: false,
          error:   'Solo puedes resetear contraseñas de usuarios con rol editor.',
          code:    'INSUFFICIENT_ROLE',
        }, 403);
      }
    }

    // ── 5. Buscar nombre del usuario en usuarios_admin ─────────────────────────
    const { data: usuarioData } = await supabaseAdmin
      .from('usuarios_admin')
      .select('nombre')
      .eq('email', email)
      .single();

    const nombre = (usuarioData as { nombre?: string } | null)?.nombre ?? '';
    console.log(`[reset-user-password] Nombre encontrado: "${nombre}"`);

    // ── 6. Generar recovery link ───────────────────────────────────────────────
    console.log(`[reset-user-password] Generando recovery link para: ${email}`);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo: siteUrl },
    });

    if (linkError) {
      console.error('[reset-user-password] generateLink error:', linkError);
      return fail(
        { success: false, error: linkError.message, code: 'LINK_ERROR' },
        400
      );
    }

    const resetLink = (linkData as { properties?: { action_link?: string } })
      ?.properties?.action_link ?? siteUrl;

    console.log(`[reset-user-password] Recovery link generado. Llamando Brevo API para: ${email}`);

    // ── 7. Enviar via Brevo HTTP API v3 ────────────────────────────────────────
    const htmlContent = buildResetHtml(nombre, email, resetLink);

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: {
        'api-key':      brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'Catálogo UNAM/FAD', email: 'egodiseno@gmail.com' },
        to:          [{ email }],
        subject:     'Restablece tu contraseña — Catálogo de Obra Serigráfica UNAM',
        htmlContent,
      }),
    });

    const brevoBody = await brevoRes.json().catch(() => ({})) as Record<string, unknown>;

    console.log(`[reset-user-password] Brevo API status: ${brevoRes.status}`);
    console.log(`[reset-user-password] Brevo API response:`, JSON.stringify(brevoBody));

    if (!brevoRes.ok) {
      console.error('[reset-user-password] Brevo API error:', brevoBody);
      return fail(
        {
          success: false,
          error:   (brevoBody.message as string) ?? `Brevo respondió ${brevoRes.status}`,
          code:    'BREVO_ERROR',
        },
        500
      );
    }

    const messageId = (brevoBody.messageId as string) ?? '';
    console.log(`[reset-user-password] ✓ Email enviado. messageId: ${messageId}`);

    return ok({
      success:   true,
      message:   `Se ha enviado un enlace de restablecimiento a ${email}.`,
      messageId,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[reset-user-password] Unhandled error:', err);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
