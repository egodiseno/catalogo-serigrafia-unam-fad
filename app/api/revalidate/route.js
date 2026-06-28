// app/api/revalidate/route.js — On-Demand Revalidation endpoint
//
// Llamado por webhooks de Supabase cuando se publican, actualizan o archivan obras.
// Permite revalidar el catálogo y las páginas de detalle de forma inmediata,
// sin esperar al ciclo de ISR (60 s para catálogo, 3600 s para detalle de obra).
//
// ── Configuración del webhook en Supabase ───────────────────────────────────
//   Table: obras
//   Events: INSERT, UPDATE, DELETE
//   Webhook URL: https://<tu-dominio>/api/revalidate
//   Headers: { "Authorization": "Bearer <REVALIDATE_SECRET>" }
//
// ── Variable de entorno requerida ───────────────────────────────────────────
//   REVALIDATE_SECRET — secreto compartido con Supabase para autenticar el webhook.
//   Si no está definida, el endpoint acepta cualquier petición (solo en desarrollo).
//
// ── Payload esperado (Supabase webhook) ─────────────────────────────────────
//   { type: 'INSERT'|'UPDATE'|'DELETE', table: 'obras', record: {...}, old_record: {...} }

import { revalidatePath } from 'next/cache';
import { NextResponse }   from 'next/server';

const SECRET = process.env.REVALIDATE_SECRET;

export async function POST(request) {
  // 1. Verificar el token secreto (si está configurado)
  if (SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 2. Leer el body del webhook
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { table, record, old_record } = body;

  // 3. Determinar qué rutas revalidar
  const paths = [];

  // El catálogo principal siempre se revalida cuando cambia una obra
  paths.push('/');

  // Si la obra tiene slug, revalidar también su página de detalle
  if (table === 'obras' || record?.slug || old_record?.slug) {
    const slug = record?.slug || old_record?.slug;
    if (slug) {
      paths.push(`/obra/${slug}`);
    }
  }

  // 4. Ejecutar revalidaciones
  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    revalidated: true,
    paths,
    timestamp: new Date().toISOString(),
  });
}
