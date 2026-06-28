'use client';
// components/public/VisitRecorder.jsx
// Componente sin render que registra la visita a una obra en obra_visitas.
// Fire-and-forget: igual que api.recordVisit(...).catch(() => {}) en public-detail.js.
// No bloquea el renderizado ni muestra nada al usuario.

import { useEffect } from 'react';
import { recordVisit } from '@/lib/supabase/api';

/**
 * @param {{ workId: string }} props
 */
export default function VisitRecorder({ workId }) {
  useEffect(() => {
    if (!workId) return;
    recordVisit(workId).catch(() => { /* silencioso */ });
  }, [workId]);

  return null;
}
