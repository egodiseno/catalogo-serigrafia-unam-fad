# Catálogo Digital de Obra Serigráfica — Prototipo 1 público esencial

Prototipo navegable, estático y verificable para el **Catálogo Digital de Obra Serigráfica — UNAM / FAD / Taller de Serigrafía**.

Este paquete corresponde al cierre del **Prototipo 1 — Público esencial**. Su objetivo es validar la experiencia pública principal antes de una futura migración a una arquitectura productiva con Next.js, Tailwind y Supabase.

## Alcance del Prototipo 1

Incluye las pantallas públicas esenciales:

- Inicio.
- Catálogo general con búsqueda, filtros, chips y carga por bloques.
- Ficha pública de una obra representativa.
- Visor simple de imagen principal.
- Bloque de compartir enlace de ficha.
- Archivo por año.
- Vista representativa por técnica.
- Vista representativa por serie.
- Acerca del catálogo.
- Página 404 pública.

El prototipo valida el flujo central:

```text
explorar → filtrar → abrir obra → observar con detalle → compartir enlace → volver sin perderse
```

## Fuera de alcance

Este prototipo no incluye:

- backend;
- Supabase;
- Auth;
- Storage;
- panel administrativo;
- edición de obras;
- carga real de imágenes;
- páginas individuales para todas las obras;
- vistas completas para todas las técnicas o series;
- descarga de imágenes;
- comentarios públicos;
- favoritos;
- compra, precio, carrito o patrones ecommerce.

## Stack usado

- HTML estático.
- CSS propio con tokens visuales del sistema.
- Tailwind CSS vía CDN para apoyo utilitario.
- JavaScript modular ligero.
- JSON local para dataset mock/controlado.

## Cómo abrir el prototipo localmente

La forma recomendada es usar un servidor local desde la carpeta raíz del proyecto:

```bash
cd prototipo-publico
python3 -m http.server 8000
```

Después abrir:

```text
http://localhost:8000/index.html
```

También puede usarse cualquier servidor local equivalente, por ejemplo Live Server de VS Code.

## Nota sobre `fetch()` y `file://`

Varias vistas cargan archivos JSON mediante `fetch()`:

- `catalogo.html`
- `archivo.html`
- `tecnica-serigrafia-experimental.html`
- `serie-archivo-grafico.html`

Si el prototipo se abre directamente con `file://`, algunos navegadores pueden bloquear la lectura de JSON local. En ese caso, usar servidor local.

## Estructura general de carpetas

```text
/prototipo-publico/
  index.html
  catalogo.html
  archivo.html
  obra-memoria-del-taller.html
  tecnica-serigrafia-experimental.html
  serie-archivo-grafico.html
  acerca.html
  404.html

  README.md
  ROUTES.md
  QA-CHECKLIST.md
  HANDOFF-NOTES.md

  /assets/
    /brand/
    /icons/
    /mock/
      /artworks/
      /placeholders/

  /css/
    styles.css

  /data/
    artworks.json
    years.json
    techniques.json
    series.json
    tags.json

  /js/
    main.js
    drawer.js
    filters.js
    archive.js
    technique-view.js
    series-view.js
    image-viewer.js
    share-panel.js
```

## Dataset mock/controlado

El prototipo usa un dataset simulado y controlado para validación UX/UI:

```text
/data/artworks.json
```

El dataset contiene 24 obras publicadas. Solo una obra tiene ficha individual disponible mediante `detailUrl`.

Este dataset no debe interpretarse como registro institucional definitivo.

## Imágenes locales

Las cards y la ficha esperan imágenes locales en:

```text
/assets/mock/artworks/
```

Ejemplo:

```text
assets/mock/artworks/obra-01-main.jpg
```

Si las imágenes no existen físicamente en esa carpeta, el navegador mostrará errores 404 de assets, aunque la estructura del prototipo sea correcta.

## Publicación estática

El prototipo puede publicarse como sitio estático en Netlify, Vercel u otro hosting de archivos estáticos.

Para 404 real, configurar el hosting para servir:

```text
404.html
```

como página de error.

## Próximos pasos sugeridos

1. Revisión visual final en navegador local o Netlify.
2. Validación responsive en desktop, 480px y 360px.
3. Cierre de aprobación del Prototipo 1 público esencial.
4. Preparación del Prototipo 2 admin.
5. Migración futura a Next.js + Tailwind + Supabase.
