'use client';
// components/public/RelatedWorks.jsx
// Obras relacionadas — réplica de loadRelatedWorks() de public-detail.js
// Carga en el cliente obras con la misma técnica, excluye la obra actual,
// baraja y muestra hasta 4.
// Selectores CSS: .work-related, .work-related h2, .artwork-grid

import { useState, useEffect } from 'react';
import ArtworkCard from '@/components/public/ArtworkCard';
import { useLang } from '@/contexts/LangContext';
import { filterWorks, getFavorites } from '@/lib/supabase/api';

const SESSION_KEY = 'catalogo_session_id';
function getSessionId() {
  let id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch { /**/ }
  return id || '';
}

/**
 * @param {{
 *   currentWorkId: string,
 *   tecnicaId: string|null,
 *   tagIds: string[]
 * }} props
 */
export default function RelatedWorks({ currentWorkId, tecnicaId, tagIds = [] }) {
  const { lang, t } = useLang();
  const [works, setWorks]   = useState([]);
  const [favSet, setFavSet] = useState(new Set());

  // Carga favoritos para mostrar el estado inicial del corazón en las tarjetas
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    getFavorites(sessionId)
      .then((ids) => setFavSet(new Set(ids)))
      .catch(() => { /* silencioso */ });
  }, []);

  // Carga obras relacionadas al montar
  useEffect(() => {
    if (!tecnicaId) return;
    loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkId, tecnicaId]);

  async function loadRelated() {
    try {
      // Obtiene hasta 20 obras de la misma técnica
      const { data } = await filterWorks({ technique: tecnicaId }, 1, 20);
      if (!data) return;

      const tagIdSet = new Set(tagIds);

      // Excluye la obra actual y puntúa por tags compartidos
      const candidates = data
        .filter((obra) => obra.id !== currentWorkId)
        .map((obra) => {
          const obraTagIds = (obra.tags || [])
            .map((t) => t?.tag?.id)
            .filter(Boolean);
          const sharedTags = obraTagIds.filter((id) => tagIdSet.has(id)).length;
          return { obra, sharedTags };
        });

      // Baraja y prioriza obras con tags compartidos (igual que el original)
      const withTags    = candidates.filter((c) => c.sharedTags > 0).sort(() => Math.random() - 0.5);
      const withoutTags = candidates.filter((c) => c.sharedTags === 0).sort(() => Math.random() - 0.5);
      const sorted      = [...withTags, ...withoutTags].slice(0, 4).map((c) => c.obra);

      setWorks(sorted);
    } catch (err) {
      console.error('[RelatedWorks] Error cargando obras relacionadas:', err);
    }
  }

  function handleFav(id) {
    setFavSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (works.length === 0) return null;

  return (
    <section className="work-related">
      <h2>{lang === 'en' ? 'Related Works' : 'Obras relacionadas'}</h2>
      <ul className="artworks">
        {works.map((work) => (
          <ArtworkCard
            key={work.id}
            work={work}
            isFav={favSet.has(work.id)}
            onFav={handleFav}
            lang={lang}
            t={t}
          />
        ))}
      </ul>
    </section>
  );
}
