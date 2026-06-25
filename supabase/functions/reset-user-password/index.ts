/**
 * Edge Function: reset-user-password
 * ──────────────────────────────────────────────────────────────────────────────
 * Flujo de dos pasos para recuperación de contraseña self-service.
 * No requiere token de sesión del caller — el email / token son la credencial.
 *
 * ── PASO A ── POST /functions/v1/reset-user-password
 *   Body: { email: string }
 *   - Busca el usuario en usuarios_admin por email.
 *   - Genera un token seguro (crypto.randomUUID) y lo guarda en
 *     password_reset_tokens con expiración de 30 min.
 *   - Envía el link de reset por email vía Brevo HTTP API v3.
 *   - Siempre responde { success: true } para no revelar si el email existe.
 *
 * ── PASO B ── POST /functions/v1/reset-user-password/confirm
 *   Body: { token: string, new_password: string }
 *   - Valida el token (existe, no usado, no expirado).
 *   - Actualiza la contraseña del usuario via Supabase Auth admin API.
 *   - Marca el token como usado.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (automáticas en Supabase)
 *   SITE_URL      — URL del panel admin (ej: https://…netlify.app/admin/)
 *   BREVO_API_KEY — clave API de Brevo (Configuración → SMTP y API → Claves API)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_H = { ...CORS, 'Content-Type': 'application/json' };

function ok(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_H });
}
function fail(body: object, status = 400): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_H });
}

// ── Construir cliente admin (service_role) ────────────────────────────────────
function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
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

          <!-- Icono llave -->
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
                Recibimos una solicitud para restablecer la contraseña de acceso
                al panel administrativo del Catálogo. Haz clic en el botón
                a continuación para elegir una nueva contraseña:
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

              <!-- Aviso de expiración — 30 minutos -->
              <div style="background:#FEF3C7;border:1px solid #FDE68A;
                          border-radius:6px;padding:12px 16px;margin-bottom:16px;">
                <p style="color:#92400E;font-size:13px;margin:0;line-height:1.5;">
                  ⏱️ Este enlace es de <strong>un solo uso</strong>
                  y expira en <strong>30 minutos</strong>.
                  Después deberás solicitar uno nuevo.
                </p>
              </div>

              <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.5;">
                Si no solicitaste este cambio, puedes ignorar este email con
                seguridad. Tu contraseña actual permanece sin cambios.
                Para soporte, contacta al administrador del catálogo.
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

// ── Enviar email vía Brevo HTTP API v3 ───────────────────────────────────────
// Usa HTTP (no TCP/SMTP) — compatible con Supabase Edge Functions (Deno Deploy).
async function sendResetEmail(params: {
  to:        string;
  nombre:    string;
  resetLink: string;
}): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY') ?? '';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY no está configurado como secret de la Edge Function.');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'api-key':      apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: 'Catálogo UNAM/FAD', email: 'egodiseno@gmail.com' },
      to:          [{ email: params.to }],
      subject:     'Restablece tu contraseña — Catálogo de Obra Serigráfica UNAM',
      htmlContent: buildResetHtml(params.nombre, params.to, params.resetLink),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Brevo API error ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  }
}

// ── PASO A: Solicitar reset ───────────────────────────────────────────────────
async function handleRequestReset(req: Request): Promise<Response> {
  // 1. Parsear body
  let body: { email?: unknown };
  try { body = await req.json(); }
  catch {
    // Siempre responder éxito — no revelar nada
    return ok({ success: true, message: 'Si existe una cuenta con ese email, recibirás un enlace en los próximos minutos.' });
  }

  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : '';

  // Validación básica — si falla, responder éxito igual
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return ok({ success: true, message: 'Si existe una cuenta con ese email, recibirás un enlace en los próximos minutos.' });
  }

  console.log(`[reset/request] Solicitud para: ${email}`);

  const db = adminClient();

  // 2. Buscar usuario en usuarios_admin
  const { data: adminUser, error: lookupError } = await db
    .from('usuarios_admin')
    .select('id, nombre, email')
    .eq('email', email)
    .single();

  if (lookupError || !adminUser) {
    // No revelar si el email existe — responder éxito genérico
    console.log(`[reset/request] Email no encontrado en usuarios_admin: ${email}`);
    return ok({ success: true, message: 'Si existe una cuenta con ese email, recibirás un enlace en los próximos minutos.' });
  }

  // 3. Generar token seguro y calcullar expiración (30 min)
  const token     = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // 4. Guardar token en la tabla
  const { error: insertError } = await db
    .from('password_reset_tokens')
    .insert({ user_id: adminUser.id, token, expires_at: expiresAt });

  if (insertError) {
    console.error('[reset/request] Error insertando token:', insertError);
    return fail({ success: false, error: 'Error interno al generar el enlace.', code: 'DB_ERROR' }, 500);
  }

  // 5. Construir link de reset
  const rawSiteUrl = Deno.env.get('SITE_URL')
    ?? 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/';
  // Asegurar que apunte a index.html (no a la raíz desnuda)
  const adminUrl  = rawSiteUrl.endsWith('/')
    ? `${rawSiteUrl}index.html`
    : rawSiteUrl;
  const resetLink = `${adminUrl}?reset_token=${token}`;

  console.log(`[reset/request] Token generado para ${email}. Link: ${resetLink}`);

  // 6. Enviar email vía Brevo HTTP API v3
  try {
    await sendResetEmail({
      to:        email,
      nombre:    (adminUser as { nombre?: string }).nombre ?? '',
      resetLink,
    });
    console.log(`[reset/request] ✓ Email enviado a: ${email}`);
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error('[reset/request] Error al enviar email:', msg);
    // Limpiar token si el email no se pudo enviar
    await db.from('password_reset_tokens').delete().eq('token', token).catch(() => {});
    return fail({ success: false, error: `Error al enviar el email: ${msg}`, code: 'EMAIL_ERROR' }, 500);
  }

  return ok({
    success: true,
    message: 'Si existe una cuenta con ese email, recibirás un enlace en los próximos minutos.',
  });
}

// ── PASO B: Confirmar reset (validar token + actualizar contraseña) ────────────
async function handleConfirmReset(req: Request): Promise<Response> {
  let body: { token?: unknown; new_password?: unknown };
  try { body = await req.json(); }
  catch {
    return fail({ success: false, error: 'Body inválido. Se esperaba JSON.', code: 'INVALID_BODY' });
  }

  const token       = typeof body.token        === 'string' ? body.token.trim()        : '';
  const newPassword = typeof body.new_password === 'string' ? body.new_password        : '';

  if (!token) {
    return fail({ success: false, error: 'El token de reset es requerido.', code: 'MISSING_TOKEN' });
  }
  if (!newPassword || newPassword.length < 8) {
    return fail({ success: false, error: 'La contraseña debe tener al menos 8 caracteres.', code: 'INVALID_PASSWORD' });
  }

  const db = adminClient();

  // 1. Buscar token
  const { data: tokenRow, error: tokenError } = await db
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used')
    .eq('token', token)
    .single();

  if (tokenError || !tokenRow) {
    console.warn(`[reset/confirm] Token no encontrado: ${token.slice(0, 8)}…`);
    return fail({
      success: false,
      error:   'El enlace de restablecimiento no es válido o ya fue usado.',
      code:    'INVALID_TOKEN',
    });
  }

  // 2. Verificar que no esté usado
  if ((tokenRow as { used: boolean }).used) {
    return fail({
      success: false,
      error:   'Este enlace ya fue utilizado. Solicita uno nuevo desde el login.',
      code:    'TOKEN_USED',
    });
  }

  // 3. Verificar expiración (30 min)
  const expiresAt = new Date((tokenRow as { expires_at: string }).expires_at);
  if (expiresAt < new Date()) {
    return fail({
      success: false,
      error:   'El enlace ha expirado (validez de 30 minutos). Solicita uno nuevo desde el login.',
      code:    'TOKEN_EXPIRED',
    });
  }

  const userId = (tokenRow as { user_id: string }).user_id;

  // 4. Actualizar contraseña en Supabase Auth via service_role
  const { error: updateError } = await db.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    console.error('[reset/confirm] updateUserById error:', updateError);
    return fail({
      success: false,
      error:   `No se pudo actualizar la contraseña: ${updateError.message}`,
      code:    'UPDATE_ERROR',
    }, 500);
  }

  // 5. Marcar token como usado (idempotente — no falla si ya está usado)
  await db
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('token', token)
    .catch((e: unknown) => console.warn('[reset/confirm] Error marcando token como usado:', e));

  console.log(`[reset/confirm] ✓ Contraseña actualizada para user_id: ${userId}`);

  return ok({
    success: true,
    message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
  });
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req: Request) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return fail(
      { success: false, error: 'Método no permitido. Usa POST.', code: 'METHOD_NOT_ALLOWED' },
      405
    );
  }

  try {
    const url       = new URL(req.url);
    const isConfirm = url.pathname.endsWith('/confirm');

    if (isConfirm) {
      return await handleConfirmReset(req);
    } else {
      return await handleRequestReset(req);
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[reset-user-password] Unhandled error:', err);
    return fail({ success: false, error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
