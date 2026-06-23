/**
 * Edge Function: notify-obra-approval
 * ──────────────────────────────────────────────────────────────────────────────
 * Envía un email al editor responsable de una obra cuando un admin/super_editor
 * la aprueba o rechaza en el flujo de revisión del panel administrativo.
 *
 * Endpoint: POST /functions/v1/notify-obra-approval
 *
 * Headers requeridos:
 *   Authorization: Bearer <session_access_token>   // sesión del admin caller
 *   apikey: <supabase_anon_key>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     obraId:    string                    // UUID de la obra (requerido)
 *     resultado: 'aprobado' | 'rechazado'  // resultado de la revisión (requerido)
 *     motivo?:   string                    // motivo de rechazo (requerido si rechazado)
 *   }
 *
 * Respuesta exitosa (200):
 *   { success: true, method: 'brevo-api', messageId: string }
 *
 * Respuesta de error:
 *   { success: false, error: string, code: string }
 *
 * Códigos de error:
 *   INVALID_JSON     — body no es JSON válido
 *   MISSING_FIELDS   — falta obraId o resultado (400)
 *   UNAUTHORIZED     — token inválido o ausente (401)
 *   OBRA_NOT_FOUND   — no existe obra con ese id (404)
 *   CONFIG_ERROR     — BREVO_API_KEY no configurado (500)
 *   BREVO_ERROR      — Brevo API rechazó el envío (500)
 *   INTERNAL_ERROR   — error no capturado (500)
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

// ── HTML del email de aprobación ──────────────────────────────────────────────
function buildEmailHtml(
  nombre:    string,
  titulo:    string,
  resultado: 'aprobado' | 'rechazado',
  motivo:    string,
  adminUrl:  string,
): string {
  const isAprobado   = resultado === 'aprobado';
  const displayName  = nombre || 'Editor';

  const headerBg   = isAprobado ? '#013B75' : '#013B75';
  const accentBg   = isAprobado ? '#10B981' : '#F59E0B';  // verde éxito / amarillo advertencia
  const titleEmoji = isAprobado ? '✅' : '📋';
  const tituloPrin = isAprobado
    ? `${titleEmoji} ¡Tu obra ha sido aprobada y publicada!`
    : `${titleEmoji} Revisión de cambios — se requieren ajustes`;

  const cuerpoMensaje = isAprobado
    ? `
      <p style="color:#374151;margin:0 0 16px;line-height:1.6;">
        Nos complace informarte que tu obra
        <strong style="color:#013B75;">"${escHtml(titulo)}"</strong>
        ha sido <strong style="color:#10B981;">aprobada</strong> por el equipo revisor
        y ya está disponible en el catálogo público.
      </p>
      <p style="color:#374151;margin:0 0 24px;line-height:1.6;">
        Puedes ingresar al panel administrativo para consultar el estado completo
        de tus obras y continuar contribuyendo al catálogo.
      </p>`
    : `
      <p style="color:#374151;margin:0 0 16px;line-height:1.6;">
        Los cambios que enviaste para revisión en la obra
        <strong style="color:#013B75;">"${escHtml(titulo)}"</strong>
        han sido <strong style="color:#D97706;">revisados</strong> y el equipo revisor
        ha solicitado algunos ajustes antes de aprobar la nueva versión.
      </p>
      <p style="color:#374151;margin:0 0 8px;line-height:1.6;">
        <strong>Observaciones del revisor:</strong>
      </p>
      <blockquote style="border-left:4px solid #F59E0B;margin:0 0 24px;padding:12px 16px;
                         background:#FFFBEB;border-radius:0 6px 6px 0;color:#374151;
                         font-style:italic;line-height:1.6;">
        ${escHtml(motivo) || 'Sin observaciones adicionales.'}
      </blockquote>
      <p style="color:#374151;margin:0 0 24px;line-height:1.6;">
        La obra mantiene su versión publicada anterior. Ingresa al panel administrativo,
        ve a <strong>Mi Portafolio</strong>, abre la obra y usa "Volver a borrador" para
        aplicar los cambios solicitados y volver a enviarla a revisión.
      </p>`;

  const ctaText = isAprobado ? 'Ver mis obras publicadas →' : 'Ir al panel y editar mi obra →';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isAprobado ? 'Obra aprobada' : 'Revisión de obra'} — Catálogo UNAM/FAD</title>
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
            <td style="background:${headerBg};padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;
                         letter-spacing:0.5px;">
                Catálogo de Obra Serigráfica
              </h1>
              <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">
                UNAM / Facultad de Artes y Diseño
              </p>
            </td>
          </tr>

          <!-- Barra de estado (verde o dorada) -->
          <tr>
            <td style="height:4px;background:${accentBg};"></td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#013B75;margin:0 0 20px;font-size:18px;line-height:1.4;">
                Hola, ${escHtml(displayName)} 👋
              </h2>

              <h3 style="color:${isAprobado ? '#10B981' : '#D97706'};margin:0 0 16px;
                          font-size:16px;font-weight:700;">
                ${tituloPrin}
              </h3>

              ${cuerpoMensaje}

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:6px;background:#013B75;">
                    <a href="${adminUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;
                              text-decoration:none;font-size:15px;font-weight:600;
                              letter-spacing:0.3px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="color:#013B75;font-size:12px;word-break:break-all;margin:0 0 24px;">
                ${adminUrl}
              </p>

              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">

              <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.5;">
                Este email fue generado automáticamente por el Panel Administrativo
                del Catálogo de Obra Serigráfica UNAM/FAD. Por favor, no respondas
                a este mensaje.
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

// Escape básico de HTML para contenido insertado en el template
function escHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // Preflight CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return fail(
      { success: false, error: 'Método no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' },
      405,
    );
  }

  try {
    // ── 1. Parsear body ──────────────────────────────────────────────────────
    let body: { obraId?: unknown; resultado?: unknown; motivo?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail({
        success: false,
        error:   'Body inválido. Se esperaba JSON.',
        code:    'INVALID_JSON',
      });
    }

    const obraId    = typeof body.obraId    === 'string' ? body.obraId.trim()    : '';
    const resultado = body.resultado === 'aprobado' || body.resultado === 'rechazado'
      ? (body.resultado as 'aprobado' | 'rechazado')
      : '';
    const motivo    = typeof body.motivo    === 'string' ? body.motivo.trim()    : '';

    if (!obraId || !resultado) {
      return fail({
        success: false,
        error:   'Campos requeridos: obraId, resultado ("aprobado" | "rechazado").',
        code:    'MISSING_FIELDS',
      });
    }

    // ── 2. Verificar sesión del caller ───────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return fail(
        { success: false, error: 'No autorizado. Token requerido.', code: 'UNAUTHORIZED' },
        401,
      );
    }

    const callerToken    = authHeader.replace('Bearer ', '').trim();
    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL')      ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${callerToken}` } },
        auth:   { autoRefreshToken: false, persistSession: false },
      },
    );

    const { data: { user: callerUser }, error: callerError } =
      await supabaseCaller.auth.getUser();

    if (callerError || !callerUser) {
      return fail(
        { success: false, error: 'Token inválido o sesión expirada.', code: 'UNAUTHORIZED' },
        401,
      );
    }

    console.log(`[notify-obra-approval] Caller verificado: ${callerUser.email}`);

    // ── 3. Cliente admin con service_role ────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── 4. Obtener obra (titulo + artista/email del editor) ──────────────────
    const { data: obra, error: obraErr } = await supabaseAdmin
      .from('obras')
      .select('id, titulo, artista')
      .eq('id', obraId)
      .single();

    if (obraErr || !obra) {
      console.error('[notify-obra-approval] Obra no encontrada:', obraId, obraErr);
      return fail({
        success: false,
        error:   `Obra no encontrada (id: ${obraId}).`,
        code:    'OBRA_NOT_FOUND',
      }, 404);
    }

    const editorEmail = (obra as { artista: string }).artista;
    const obraTitulo  = (obra as { titulo: string }).titulo;

    console.log(`[notify-obra-approval] Obra: "${obraTitulo}" | editor: ${editorEmail} | resultado: ${resultado}`);

    // ── 5. Obtener nombre del editor desde usuarios_admin ────────────────────
    const { data: editorRow } = await supabaseAdmin
      .from('usuarios_admin')
      .select('nombre')
      .eq('email', editorEmail)
      .maybeSingle();

    const editorNombre = (editorRow as { nombre?: string } | null)?.nombre
                      ?? editorEmail.split('@')[0];

    // ── 6. Verificar BREVO_API_KEY ───────────────────────────────────────────
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';
    if (!brevoApiKey) {
      console.error('[notify-obra-approval] BREVO_API_KEY no configurada');
      return fail({
        success: false,
        error:   'Servicio de email no configurado (BREVO_API_KEY faltante).',
        code:    'CONFIG_ERROR',
      }, 500);
    }

    // ── 7. Construir y enviar email via Brevo HTTP API v3 ────────────────────
    const adminUrl     = Deno.env.get('SITE_URL')
                      ?? 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/';
    const htmlContent  = buildEmailHtml(editorNombre, obraTitulo, resultado, motivo, adminUrl);
    const emailSubject = resultado === 'aprobado'
      ? `✅ Tu obra "${obraTitulo}" ha sido aprobada y publicada`
      : `📋 Revisión pendiente — "${obraTitulo}" requiere cambios`;

    console.log(`[notify-obra-approval] Enviando email a: ${editorEmail}`);

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: {
        'api-key':      brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'Catálogo UNAM/FAD', email: 'egodiseno@gmail.com' },
        to:          [{ email: editorEmail, name: editorNombre }],
        subject:     emailSubject,
        htmlContent,
      }),
    });

    const brevoBody = await brevoRes.json().catch(() => ({})) as Record<string, unknown>;

    console.log(`[notify-obra-approval] Brevo status: ${brevoRes.status}`, JSON.stringify(brevoBody));

    if (!brevoRes.ok) {
      console.error('[notify-obra-approval] Brevo API error:', brevoBody);
      return fail({
        success: false,
        error:   (brevoBody.message as string) ?? `Brevo respondió ${brevoRes.status}`,
        code:    'BREVO_ERROR',
      }, 500);
    }

    const messageId = (brevoBody.messageId as string) ?? '';
    console.log(`[notify-obra-approval] ✓ Email enviado. messageId: ${messageId}`);

    return ok({ success: true, method: 'brevo-api', messageId });

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error interno del servidor.';
    console.error('[notify-obra-approval] Unhandled error:', e);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
