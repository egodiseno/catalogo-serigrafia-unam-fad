// supabase/functions/convert-webp/index.ts
// Edge Function: valida imágenes y convierte a WebP (Deno runtime, sin Node)
//
// Librería: @jsquash (jpeg / png / webp) — ES Modules puros, WASM bundleado inline,
//           sin require(), sin Web Cache API — compatible con Supabase Edge Functions.
//
// POST multipart/form-data
//   file      : File  — imagen (jpeg | png | webp)
//   obra_id   : string (opcional) — para naming semántico
//
// Respuesta OK:  { success: true, filename, size, converted }
// Respuesta ERR: { success: false, error }

import { decode as decodeJpeg } from 'npm:@jsquash/jpeg';
import { decode as decodePng  } from 'npm:@jsquash/png';
import { encode as encodeWebP } from 'npm:@jsquash/webp';

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

    // Si ya es WebP, retornar bytes directamente sin conversión
    if (mimeType === 'image/webp') {
      console.log('✅ Ya es WebP — sin conversión necesaria');
      const filename = buildFilename(file.name, obraId, 'webp');
      return binaryResponse(bytes, 'image/webp', filename, false);
    }

    // ── Intentar conversión a WebP ────────────────────
    const result = await convertToWebP(bytes, file.name, obraId, mimeType);

    if (result.converted) {
      console.log(
        `✅ Convertido a WebP: ${result.filename} ` +
        `(${(result.data.byteLength / 1024).toFixed(1)} KB)`,
      );
    } else {
      console.warn(`⚠️ Conversión no disponible — retornando original: ${result.filename}`);
    }

    // Retornar bytes (WebP convertido o imagen original como fallback)
    const contentType = result.converted ? 'image/webp' : mimeType;
    return binaryResponse(result.data, contentType, result.filename, result.converted);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Error en convert-webp:', err);
    return jsonError(`Error interno: ${msg}`, 500);
  }
});

// ─────────────────────────────────────────────────────────
// convertToWebP
// @jsquash: decode JPEG/PNG → ImageData, luego encode → WebP.
// ES Modules puros: sin require(), sin Web Cache API.
// Fallback al original si cualquier paso falla.
// ─────────────────────────────────────────────────────────
async function convertToWebP(
  input: Uint8Array,
  originalName: string,
  obraId: string | null,
  mimeType: string,
): Promise<{ converted: boolean; data: Uint8Array; filename: string }> {

  const webpFilename = buildFilename(originalName, obraId, 'webp');

  try {
    console.log('🔄 Iniciando conversión a WebP (@jsquash)…');

    // Paso 1 — Decodificar JPEG o PNG → ImageData (RGBA plano)
    const isJpeg   = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
    const imageData = isJpeg
      ? await decodeJpeg(input.buffer as ArrayBuffer)
      : await decodePng(input.buffer as ArrayBuffer);

    // Paso 2 — Codificar ImageData → WebP (calidad 80)
    const webpBuffer = await encodeWebP(imageData, { quality: 80 });
    const webpBytes  = new Uint8Array(webpBuffer);

    if (webpBytes.byteLength === 0) {
      throw new Error('@jsquash devolvió bytes vacíos');
    }

    // ── Comparar tamaños: conservar el archivo más liviano ────────────
    if (webpBytes.byteLength >= input.byteLength) {
      const webpKB  = (webpBytes.byteLength  / 1024).toFixed(1);
      const origKB  = (input.byteLength      / 1024).toFixed(1);
      console.log(
        `ℹ️ WebP (${webpKB} KB) ≥ original (${origKB} KB) — conservando original`,
      );
      const ext              = originalName.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fallbackFilename = buildFilename(originalName, obraId, ext);
      return { converted: false, data: input, filename: fallbackFilename };
    }
    // ─────────────────────────────────────────────────────────────────

    return { converted: true, data: webpBytes, filename: webpFilename };

  } catch (convErr) {
    // Conversión fallida — retornar imagen original con nombre seguro
    const reason = convErr instanceof Error ? convErr.message : String(convErr);
    console.warn('⚠️ Conversión fallida:', reason);

    const ext              = originalName.split('.').pop()?.toLowerCase() ?? 'jpg';
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

/**
 * Respuesta binaria: retorna los bytes de la imagen con metadata en headers.
 * El cliente lee:
 *   X-Filename  → nombre seguro sugerido para Storage
 *   X-Converted → "true" | "false"
 *   X-Size      → tamaño en bytes
 */
function binaryResponse(
  data: Uint8Array,
  contentType: string,
  filename: string,
  converted: boolean,
): Response {
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type':   contentType,
      'X-Filename':     filename,
      'X-Converted':    String(converted),
      'X-Size':         String(data.byteLength),
      ...corsHeaders(),
      // Exponer headers custom al cliente (necesario para CORS cross-origin)
      'Access-Control-Expose-Headers': 'X-Filename, X-Converted, X-Size',
    },
  });
}

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
