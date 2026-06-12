// supabase/functions/convert-webp/index.ts
// Edge Function: valida imágenes y convierte a WebP (Deno runtime, sin Node)
//
// Librería: imagemagick_deno (WASM bundleado inline — sin fetch externo)
// Referencia oficial Supabase: https://supabase.com/docs/guides/functions/examples/image-resizing
//
// POST multipart/form-data
//   file      : File  — imagen (jpeg | png | webp)
//   obra_id   : string (opcional) — para naming semántico
//
// Respuesta OK:  { success: true, filename, size, converted }
// Respuesta ERR: { success: false, error }

import {
  ImageMagick,
  initialize,
  MagickFormat,
} from 'https://deno.land/x/imagemagick_deno@0.0.27/mod.ts';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES     = 50 * 1024 * 1024; // 50 MB

// ─────────────────────────────────────────────────────────
// Entry point — Deno.serve (Supabase Edge Runtime)
// ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {

  // ── CORS preflight ────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return jsonError('Método no permitido. Usar POST.', 405);
  }

  try {
    // ── Leer FormData ─────────────────────────────────
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError('Body inválido. Se esperaba multipart/form-data.', 400);
    }

    const file   = form.get('file')    as File   | null;
    const obraId = form.get('obra_id') as string | null;

    // ── Validar: archivo presente ─────────────────────
    if (!file || !(file instanceof File)) {
      return jsonError('Campo "file" requerido y debe ser un archivo.', 400);
    }

    // ── Validar: tipo MIME ────────────────────────────
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return jsonError(
        `Tipo no permitido: "${mimeType}". Válidos: jpeg, png, webp.`,
        400,
      );
    }

    // ── Validar: tamaño ───────────────────────────────
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return jsonError(`Archivo demasiado grande: ${mb} MB. Máximo: 50 MB.`, 400);
    }

    console.log(
      `📥 Procesando: ${file.name} | ${mimeType} | ` +
      `${(file.size / 1024).toFixed(1)} KB | obra_id: ${obraId ?? '—'}`,
    );

    // ── Leer bytes ────────────────────────────────────
    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);

    // Si ya es WebP, retornar sin conversión
    if (mimeType === 'image/webp') {
      console.log('✅ Ya es WebP — sin conversión necesaria');
      const filename = buildFilename(file.name, obraId, 'webp');
      return jsonOk({ filename, size: bytes.byteLength, converted: false });
    }

    // ── Intentar conversión a WebP ────────────────────
    const result = await convertToWebP(bytes, file.name, obraId);

    if (result.converted) {
      console.log(
        `✅ Convertido a WebP: ${result.filename} ` +
        `(${(result.data.byteLength / 1024).toFixed(1)} KB)`,
      );
    } else {
      console.warn(`⚠️ Conversión no disponible — retornando original: ${result.filename}`);
    }

    return jsonOk({
      filename:  result.filename,
      size:      result.data.byteLength,
      converted: result.converted,
      ...(result.converted ? {} : {
        warning: 'Conversión WebP no disponible. Se almacenará imagen original.',
      }),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Error en convert-webp:', err);
    return jsonError(`Error interno: ${msg}`, 500);
  }
});

// ─────────────────────────────────────────────────────────
// convertToWebP
// imagemagick_deno: WASM bundleado inline (sin fetch externo).
// Mismo patrón usado en los ejemplos oficiales de Supabase.
// Fallback a original si ImageMagick falla.
// ─────────────────────────────────────────────────────────
async function convertToWebP(
  input: Uint8Array,
  originalName: string,
  obraId: string | null,
): Promise<{ converted: boolean; data: Uint8Array; filename: string }> {

  const webpFilename = buildFilename(originalName, obraId, 'webp');

  try {
    console.log('🔄 Iniciando conversión WASM (ImageMagick)…');

    // Inicializar WASM — idempotente, seguro llamar múltiples veces
    await initialize();

    let webpBytes: Uint8Array | null = null;

    ImageMagick.read(input, (img) => {
      img.write((data) => {
        webpBytes = new Uint8Array(data);
      }, MagickFormat.WebP);
    });

    if (!webpBytes || (webpBytes as Uint8Array).byteLength === 0) {
      throw new Error('ImageMagick devolvió bytes vacíos');
    }

    return { converted: true, data: webpBytes, filename: webpFilename };

  } catch (magickErr) {
    // ImageMagick falló — retornar imagen original con nombre seguro
    const reason = magickErr instanceof Error ? magickErr.message : String(magickErr);
    console.warn('⚠️ ImageMagick falló:', reason);

    const ext             = originalName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fallbackFilename = buildFilename(originalName, obraId, ext);
    return { converted: false, data: input, filename: fallbackFilename };
  }
}

// ─────────────────────────────────────────────────────────
// buildFilename
// Genera nombre de archivo seguro con timestamp para S3/Storage.
//   obra_id  → "viento-azul-1718200000000.webp"
//   sin id   → "imagen-1718200000000.webp"
// ─────────────────────────────────────────────────────────
function buildFilename(
  original: string,
  obraId: string | null,
  ext: string,
): string {
  const ts   = Date.now();
  const base = (obraId ?? original)
    .replace(/\.[^.]+$/, '')          // quitar extensión
    .normalize('NFD')                  // descomponer acentos
    .replace(/[̀-ͯ]/g, '')  // eliminar diacríticos
    .replace(/[^a-zA-Z0-9]+/g, '-')  // solo alfanumérico
    .replace(/^-+|-+$/g, '')          // limpiar extremos
    .toLowerCase()
    .slice(0, 40);

  return `${base || 'obra'}-${ts}.${ext}`;
}

// ─────────────────────────────────────────────────────────
// Helpers de respuesta
// ─────────────────────────────────────────────────────────
function jsonOk(body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ success: true, ...body }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
  );
}

function jsonError(error: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
  );
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
