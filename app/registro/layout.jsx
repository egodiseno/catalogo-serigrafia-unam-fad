// app/registro/layout.jsx — Layout anidado para /registro
// Server Component (sin 'use client').
//
// En Next.js App Router los layouts anidados se renderizan DENTRO del layout
// raíz, no en su lugar. El <Header> y <Footer> de app/layout.jsx siguen
// montándose en el árbol de componentes. La única forma de suprimirlos sin
// tocar app/layout.jsx es via CSS declarado aquí.
//
// Al ser Server Component, el <style> se emite una sola vez en el HTML
// generado por el servidor → sin riesgo de hydration mismatch.
// Los selectores apuntan a las clases raíz reales del Header (.site-header)
// y del Footer (.site-footer) definidas en globals.css.

export const metadata = {
  title:       'Registro de Alumnos | Catálogo de Obra Serigráfica — FAD UNAM',
  description: 'Formulario de auto-registro para alumnos del Taller de Serigrafía de la Facultad de Artes y Diseño, UNAM.',
};

export default function RegistroLayout({ children }) {
  return (
    <>
      {/*
       * Ocultar header, footer y skip-link globales.
       * La página /registro es pantalla completa (igual que registro.html
       * en la versión VanillaJS, que no incluye la navegación del catálogo).
       */}
      <style>{`
        .site-header,
        .site-footer,
        .skip-link { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
