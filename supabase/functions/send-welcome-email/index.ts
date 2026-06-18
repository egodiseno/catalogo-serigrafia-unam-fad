/**
 * Edge Function: send-welcome-email
 * ──────────────────────────────────────────────────────────────────────────────
 * Envía email de bienvenida a un nuevo usuario admin via Brevo HTTP API v3.
 * Genera un recovery link para que el usuario establezca su contraseña.
 *
 * Endpoint: POST /functions/v1/send-welcome-email
 *
 * Body:
 *   { email: string, nombre?: string, rol?: string }
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>
 *   apikey: <supabase_anon_key>
 *
 * Respuesta exitosa (200):
 *   { success: true, method: 'brevo-api', messageId: string }
 *
 * Respuesta de error:
 *   { success: false, error: string, code?: string }
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

// ── HTML del email de bienvenida ──────────────────────────────────────────────
function buildWelcomeHtml(nombre: string, email: string, rol: string, setupLink: string): string {
  const displayName = nombre || email.split('@')[0];
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido al Catálogo — UNAM/FAD</title>
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

          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#013B75;margin:0 0 16px;font-size:18px;">
                Hola, ${displayName} 👋
              </h2>
              <p style="color:#374151;margin:0 0 16px;line-height:1.6;">
                Se ha creado una cuenta de acceso al <strong>Panel Administrativo</strong>
                del Catálogo Digital de Obra Serigráfica con el rol de
                <strong style="color:#013B75;">${rol}</strong>.
              </p>
              <p style="color:#374151;margin:0 0 24px;line-height:1.6;">
                Para establecer tu contraseña y activar tu cuenta, haz clic en el
                botón a continuación:
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:6px;background:#013B75;">
                    <a href="${setupLink}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;
                              text-decoration:none;font-size:15px;font-weight:600;
                              letter-spacing:0.3px;">
                      Establecer mi contraseña →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">
                Si el botón no funciona, copia y pega este link en tu navegador:
              </p>
              <p style="color:#013B75;font-size:12px;word-break:break-all;
                        margin:0 0 24px;">
                ${setupLink}
              </p>

              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">

              <p style="color:#9CA3AF;font-size:12px;margin:0;">
                Este link es válido por <strong>24 horas</strong>. Si no solicitaste
                este acceso, ignora este email. Para soporte, contacta al administrador
                del catálogo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 40px;text-align:center;
                       border-top:1px solid #E5E7EB;">
              <p style="color:#9CA3AF;font-size:11px;margin:0;">
                © UNAM / Facultad de Artes y Diseño —
                Panel Admin del Catálogo de Obra Serigráfica
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

// ── Handler ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return fail({ success: false, error: 'Método no permitido. Usa POST.' }, 405);
  }

  try {
    // ── 1. Parsear body ────────────────────────────────────────────────────────
    let body: { email?: string; nombre?: string; rol?: string };
    try {
      body = await req.json();
    } catch {
      return fail({ success: false, error: 'Body inválido. Se esperaba JSON.' });
    }

    const { email, nombre = '', rol = 'editor' } = body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail({
        success: false,
        error:   'Email inválido o faltante.',
        code:    'INVALID_EMAIL',
      });
    }

    // ── 2. Verificar sesión del caller ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return fail({ success: false, error: 'No autorizado.' }, 401);
    }

    const callerToken   = authHeader.replace('Bearer ', '').trim();
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
      return fail({ success: false, error: 'Token inválido o sesión expirada.' }, 401);
    }

    console.log(`[send-welcome-email] Caller verificado: ${callerUser.email}`);

    // ── 3. Leer BREVO_API_KEY ──────────────────────────────────────────────────
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';
    if (!brevoApiKey) {
      console.error('[send-welcome-email] BREVO_API_KEY no configurada');
      return fail({
        success: false,
        error:   'Servicio de email no configurado (BREVO_API_KEY).',
        code:    'CONFIG_ERROR',
      }, 500);
    }

    // ── 4. Cliente admin ───────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/';

    // ── 5. Generar recovery link ───────────────────────────────────────────────
    console.log(`[send-welcome-email] Generando recovery link para: ${email}`);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo: siteUrl },
    });

    if (linkError) {
      console.error('[send-welcome-email] generateLink error:', linkError);
      return fail({
        success: false,
        error:   linkError.message,
        code:    'LINK_ERROR',
      }, 400);
    }

    const setupLink = (linkData as { properties?: { action_link?: string } })
      ?.properties?.action_link ?? siteUrl;

    console.log(`[send-welcome-email] Recovery link generado. Llamando Brevo API para: ${email}`);

    // ── 6. Enviar via Brevo HTTP API v3 ────────────────────────────────────────
    const htmlContent = buildWelcomeHtml(nombre, email, rol, setupLink);

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: {
        'api-key':      brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'Catálogo UNAM/FAD', email: 'egodiseno@gmail.com' },
        to:          [{ email }],
        subject:     'Bienvenido al Panel Admin — Catálogo de Obra Serigráfica UNAM',
        htmlContent,
      }),
    });

    const brevoBody = await brevoRes.json().catch(() => ({})) as Record<string, unknown>;

    console.log(`[send-welcome-email] Brevo API status: ${brevoRes.status}`);
    console.log(`[send-welcome-email] Brevo API response:`, JSON.stringify(brevoBody));

    if (!brevoRes.ok) {
      console.error('[send-welcome-email] Brevo API error:', brevoBody);
      return fail({
        success: false,
        error:   (brevoBody.message as string) ?? `Brevo respondió ${brevoRes.status}`,
        code:    'BREVO_ERROR',
      }, 500);
    }

    const messageId = (brevoBody.messageId as string) ?? '';
    console.log(`[send-welcome-email] ✓ Email enviado. messageId: ${messageId}`);

    return ok({ success: true, method: 'brevo-api', messageId });

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error interno del servidor.';
    console.error('[send-welcome-email] Unhandled error:', e);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
