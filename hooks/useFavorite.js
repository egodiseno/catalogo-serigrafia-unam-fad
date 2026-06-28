'use client';
// hooks/useFavorite.js
// Hook reutilizable para leer y alternar el estado de favorito de una obra.
// Réplica del módulo Favoritos de public-catalog.js / public-detail.js:
//   - sessionId anónimo persistido en localStorage bajo la clave 'catalogo_session_id'
//   - Actualización optimista: el estado UI cambia de inmediato; Supabase se actualiza en background
//   - Rollback silencioso si la operación Supabase falla

import { useState, useEffect, useCallback } from 'react';
import { getFavorites, addFavorite, removeFavorite } from '@/lib/supabase/api';

const SESSION_KEY = 'catalogo_session_id';

function getSessionId() {
  let id = null;
  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {
    // localStorage no disponible (SSR, modo privado sin permisos, etc.)
  }
  if (!id) {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch { /* silencioso */ }
  }
  return id;
}

/**
 * @param {string|null} workId — UUID de la obra
 * @returns {{ isFav: boolean, toggle: () => void }}
 */
export function useFavorite(workId) {
  const [isFav, setIsFav] = useState(false);

  // Carga el estado inicial desde Supabase al montar
  useEffect(() => {
    if (!workId) return;
    const sessionId = getSessionId();
    getFavorites(sessionId)
      .then((ids) => setIsFav(ids.includes(workId)))
      .catch(() => { /* falla silenciosamente */ });
  }, [workId]);

  // Actualización optimista con rollback en caso de error
  const toggle = useCallback(() => {
    if (!workId) return;
    const sessionId = getSessionId();

    setIsFav((prev) => {
      const next = !prev;
      if (next) {
        addFavorite(sessionId, workId).catch(() => setIsFav(false));
      } else {
        removeFavorite(sessionId, workId).catch(() => setIsFav(true));
      }
      return next;
    });
  }, [workId]);

  return { isFav, toggle };
}
