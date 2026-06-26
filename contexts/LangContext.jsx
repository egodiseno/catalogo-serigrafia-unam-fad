'use client';
// contexts/LangContext.jsx
// Contexto de idioma ES/EN — equivalente funcional de i18n.js vanilla

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Diccionario de valores dinámicos (técnicas y tags provenientes de Supabase)
const TRANSLATIONS = {
  // Técnicas
  'Serigrafía manual':  { en: 'Manual Printmaking' },
  'Serigrafía digital': { en: 'Digital Printmaking' },
  'Litografía':         { en: 'Lithography' },
  'Xilografía':         { en: 'Woodcut' },
  'Aguafuerte':         { en: 'Etching' },
  'Aguatinta':          { en: 'Aquatint' },
  'Linografía':         { en: 'Linocut' },
  'Monotipo':           { en: 'Monotype' },
  'Fotograbado':        { en: 'Photogravure' },
  // Tags
  'Abstracto':          { en: 'Abstract' },
  'Figurativo':         { en: 'Figurative' },
  'Vintage':            { en: 'Vintage' },
  'Paisaje':            { en: 'Landscape' },
  'Retrato':            { en: 'Portrait' },
  'Geométrico':         { en: 'Geometric' },
  'Urbano':             { en: 'Urban' },
  'Naturaleza':         { en: 'Nature' },
  'Expresionista':      { en: 'Expressionist' },
  'Pop Art':            { en: 'Pop Art' },
  'Minimalista':        { en: 'Minimalist' },
  'Experimental':       { en: 'Experimental' },
  'Color':              { en: 'Color' },
};

const LangContext = createContext({
  lang: 'es',
  setLang: () => {},
  t: (x) => x,
});

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('es');

  // Leer idioma guardado en localStorage (solo en cliente)
  useEffect(() => {
    const stored = localStorage.getItem('lang') || 'es';
    setLangState(stored);
    document.documentElement.lang = stored;
  }, []);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
  }, []);

  // Traducir valores dinámicos de Supabase (técnicas, tags)
  const t = useCallback(
    (text) => {
      if (!text || lang === 'es') return text;
      return TRANSLATIONS[text]?.en ?? text;
    },
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
