/**
 * Edge Function: save-registro-alumno — versión DEBUG mínima
 * Flujo: parsear body → validar → INSERT → responder
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Max-Age':       '86400',
};

serve(async (req) => {
  console.log('[1] Request recibida — método:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('[1b] Preflight CORS — respondiendo OK');
    return new Response('ok', { headers: CORS });
  }

  console.log('[2] Parseando body...');
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[2-ERR] Error parseando JSON:', e);
    return new Response(
      JSON.stringify({ success: false, error: 'Body JSON inválido', code: 'INVALID_JSON' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[3] Body parseado:', JSON.stringify(body));

  const email         = typeof body.email         === 'string' ? body.email.trim().toLowerCase() : '';
  const nombre        = typeof body.nombre        === 'string' ? body.nombre.trim()               : '';
  const numero_cuenta = typeof body.numero_cuenta === 'string' ? body.numero_cuenta.trim()        : '';
  const telefono      = typeof body.telefono      === 'string' ? body.telefono.trim() || null      : null;
  const tiene_whatsapp = body.tiene_whatsapp === true;

  console.log('[4] Campos extraídos:', { email, nombre, numero_cuenta, telefono, tiene_whatsapp });

  console.log('[5] Validando campos requeridos...');
  if (!email || !nombre || !numero_cuenta) {
    console.error('[5-ERR] Faltan campos requeridos');
    return new Response(
      JSON.stringify({ success: false, error: 'Faltan campos requeridos: email, nombre, numero_cuenta.', code: 'MISSING_FIELDS' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[6] Validando formato email...');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('[6-ERR] Email inválido:', email);
    return new Response(
      JSON.stringify({ success: false, error: 'Formato de email inválido.', code: 'INVALID_EMAIL' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[7] Validando número de cuenta...');
  if (!/^[0-9]{9}$/.test(numero_cuenta)) {
    console.error('[7-ERR] Número de cuenta inválido:', numero_cuenta);
    return new Response(
      JSON.stringify({ success: false, error: 'El número de cuenta debe tener exactamente 9 dígitos.', code: 'INVALID_NUMERO' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[8] Creando cliente Supabase...');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  console.log('[8b] Cliente creado. URL:', Deno.env.get('SUPABASE_URL'));

  // ── [8c] Guard de seguridad: verificar que el registro está abierto ──────────
  // Se consulta registro_config directamente — service_role omite RLS.
  // Condición combinada: registro_activo = true  Y  hoy dentro de [inicio, fin].
  //
  // NOTA DE SINCRONIZACIÓN: la misma lógica existe en registro.html (_estaAbierto).
  // Si se cambia cualquiera de los dos, actualizar el otro.
  //
  // Zona horaria: el servidor usa UTC; el frontend usa la hora local del alumno.
  // La diferencia máxima es ±12 h — aceptable para este proyecto. Si se requiere
  // precisión al minuto en el cierre, ajustar fecha_fin con un día de margen.
  console.log('[8c] Verificando estado del registro...');
  const { data: config, error: configError } = await supabase
    .from('registro_config')
    .select('registro_activo, fecha_inicio, fecha_fin')
    .limit(1)
    .single();

  if (configError || !config) {
    console.error('[8c-ERR] No se pudo leer registro_config:', configError?.message);
    return new Response(
      JSON.stringify({
        success: false,
        error:   'No se pudo verificar el estado del registro. Intenta más tarde.',
        code:    'CONFIG_ERROR',
      }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // Fecha de hoy en UTC (YYYY-MM-DD) — comparación string lexicográfica
  const hoyUTC = new Date().toISOString().split('T')[0];
  const estaAbierto =
    !!config.registro_activo &&
    (!config.fecha_inicio || hoyUTC >= config.fecha_inicio) &&
    (!config.fecha_fin    || hoyUTC <= config.fecha_fin);

  console.log(`[8c] registro_activo=${config.registro_activo}, fecha_inicio=${config.fecha_inicio}, fecha_fin=${config.fecha_fin}, hoyUTC=${hoyUTC}, estaAbierto=${estaAbierto}`);

  if (!estaAbierto) {
    return new Response(
      JSON.stringify({
        success: false,
        error:   'El período de registro no está activo actualmente.',
        code:    'REGISTRO_CERRADO',
      }),
      { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[9] Insertando en registro_alumnos...');
  const { data, error } = await supabase
    .from('registro_alumnos')
    .insert([{
      email,
      nombre,
      numero_cuenta,
      telefono,
      tiene_whatsapp,
      estado:         'pendiente_validacion',
      fecha_registro: new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (error) {
    console.error('[9-ERR] Error en INSERT:', error.message, '| code:', error.code, '| details:', error.details);
    const isDup = error.code === '23505';
    return new Response(
      JSON.stringify({
        success: false,
        error:   isDup ? 'Email o número de cuenta ya registrado.' : error.message,
        code:    isDup ? (error.message?.includes('email') ? 'DUPLICATE_EMAIL' : 'DUPLICATE_CUENTA') : 'DB_ERROR',
      }),
      { status: isDup ? 409 : 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[10] ✓ Insertado con ID:', data?.id);
  console.log('[11] ✓ Completado exitosamente');

  return new Response(
    JSON.stringify({
      success: true,
      id:      data?.id,
      message: 'Registro enviado. Recibirás una notificación cuando se active tu cuenta.',
    }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
