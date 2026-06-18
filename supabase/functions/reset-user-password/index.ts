/**
 * Edge Function: reset-user-password
 * ──────────────────────────────────────────────────────────────────────────────
 * Genera un recovery link para un usuario existente y lo envía por Resend.
 * Llamado desde el panel admin para resetear la contraseña de un alumno/editor.
 *
 * Endpoint: POST /functions/v1/reset-user-password
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>   // sesión del admin caller
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Body:
 *   { email: string }
 *
 * Respuesta exitosa (200):
 *   { success: true, message: string }
 *
 * Respuesta de error:
 *   { success: false, error: string, code: string }
 *
 * Códigos de error:
 *   INVALID_EMAIL   — email inválido o faltante
 *   UNAUTHORIZED    — token inválido o ausente
 *   CONFIG_ERROR    — RESEND_API_KEY no configurado
 *   LINK_ERROR      — Supabase no pudo generar el recovery link
 *   RESEND_ERROR    — Resend rechazó el envío
 *   INTERNAL_ERROR  — error no capturado
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer       from 'npm:nodemailer@6';

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
  <title>Restablecer Contrasena — Catalogo UNAM/FAD</title>
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
                Catalogo de Obra Serigrafica
              </h1>
              <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">
                UNAM / Facultad de Artes y Diseno
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
                Restablecer contrasena
              </h2>
              <p style="color:#374151;margin:0 0 12px;line-height:1.6;">
                Hola, <strong>${displayName}</strong>:
              </p>
              <p style="color:#374151;margin:0 0 24px;line-height:1.6;">
                El administrador del Catalogo ha generado un enlace para que
                restablezca su contrasena de acceso al panel administrativo.
                Haz clic en el boton a continuacion:
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
                      Restablecer mi contrasena &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">
                Si el boton no funciona, copia y pega este enlace en tu navegador:
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
                  &#9888;&#65039; Este enlace es de <strong>un solo uso</strong>
                  y expira en <strong>24 horas</strong>.
                </p>
              </div>

              <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.5;">
                Si no solicitaste este cambio, puedes ignorar este email.
                Tu contrasena actual permanece sin cambios. Para soporte,
                contacta al administrador del catalogo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 40px;text-align:center;
                       border-top:1px solid #E5E7EB;">
              <p style="color:#9CA3AF;font-size:11px;margin:0;">
                &copy; UNAM / Facultad de Artes y Diseno &mdash;
                Catalogo de Obra Serigrafica
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
      { success: false, error: 'Metodo no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' },
      405
    );
  }

  try {
    // ── 1. Parsear body ────────────────────────────────────────────────────────
    let body: { email?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail({ success: false, error: 'Body invalido. Se esperaba JSON.' });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail({ success: false, error: 'Email invalido o faltante.', code: 'INVALID_EMAIL' });
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
        { success: false, error: 'Token invalido o sesion expirada.', code: 'UNAUTHORIZED' },
        401
      );
    }

    console.log(`[reset-user-password] Caller verificado: ${callerUser.email}`);

    // ── 3. Credenciales SMTP Brevo ─────────────────────────────────────────────
    const smtpHost = Deno.env.get('BREVO_SMTP_HOST') ?? '';
    const smtpPort = parseInt(Deno.env.get('BREVO_SMTP_PORT') ?? '587');
    const smtpUser = Deno.env.get('BREVO_SMTP_USER') ?? '';
    const smtpPass = Deno.env.get('BREVO_SMTP_PASS') ?? '';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('[reset-user-password] Credenciales SMTP Brevo no configuradas');
      return fail(
        { success: false, error: 'Servicio de email no configurado.', code: 'CONFIG_ERROR' },
        500
      );
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:8000/app/admin/index.html';

    // ── 4. Cliente admin (service_role) ───────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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

    console.log(`[reset-user-password] Recovery link generado. Enviando via SMTP Brevo a: ${email}`);

    // ── 7. Enviar email via SMTP Brevo ─────────────────────────────────────────
    const htmlBody    = buildResetHtml(nombre, email, resetLink);
    const transporter = nodemailer.createTransport({
      host:   smtpHost,
      port:   smtpPort,
      secure: false,   // STARTTLS en puerto 587
      auth:   { user: smtpUser, pass: smtpPass },
    });

    try {
      await transporter.sendMail({
        from:    'Catalogo UNAM/FAD <af249a001@smtp-brevo.com>',
        to:      email,
        subject: 'Restablece tu contrasena — Catalogo de Obra Serigrafica UNAM',
        html:    htmlBody,
      });
    } catch (smtpErr) {
      const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      console.error('[reset-user-password] SMTP error:', msg);
      return fail(
        { success: false, error: `Error SMTP: ${msg}`, code: 'SMTP_ERROR' },
        500
      );
    }

    console.log(`[reset-user-password] ✓ Email de reset enviado a: ${email}`);
    return ok({
      success: true,
      message: `Se ha enviado un enlace de restablecimiento a ${email}.`,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[reset-user-password] Unhandled error:', err);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
