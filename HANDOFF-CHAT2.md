# HANDOFF CHAT 2 — Ficha Detalle + Galería

## Estado Actual
- ✅ Chat 1 completado: Grid + Filtros + I18n + UX Premium
- ✅ Repo limpio (debug scripts eliminados)
- ✅ Todos los cambios pusheados a main
- ✅ GitHub: egodiseno/catalogo-serigrafia-unam-fad
- ✅ 1 obra publicada en Supabase para testing ("Viento Azul")

## Stack
```
Static HTML + CSS + Vanilla JS ES Modules
Supabase JS v2 (CDN): kfvjansfmhamkrnbxmgp.supabase.co
ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE
Lucide Icons CDN: window.lucide.createIcons()
Deploy: Netlify (push a main = auto-deploy)
Dev: python -m http.server 8000 desde app/
```

## Estructura Actual del Repo
```
app/
├── index.html          ← Catálogo público (COMPLETO)
├── css/styles.css      ← Design system (~900 líneas)
└── js/
    ├── api-client.js   ← Supabase queries (getWorkById existe)
    ├── public-catalog.js  ← Grid + filtros + i18n
    └── i18n.js         ← Toggle ES/EN

.env                    ← ANON_KEY + SERVICE_ROLE_KEY (no commitear)
```

## Schema Supabase (Verificado)
```
obras:     id(uuid), titulo, artista, año, tecnica_id, descripcion, estado, created_at
imagenes:  id, obra_id, url_storage, principal(boolean), orden
obra_tags: obra_id, tag_id
tecnicas:  id, nombre, slug
tags:      id, nombre, slug
```

## api-client.js ya tiene `getWorkById(id)` listo:
```javascript
async getWorkById(id) {
  const { data, error } = await supabase
    .from('obras')
    .select(`id, titulo, artista, año, descripcion,
             tecnica:tecnica_id(id, nombre, slug),
             tags:obra_tags(tag:tag_id(id, nombre, slug)),
             imagenes(id, url_storage, principal, orden)`)
    .eq('id', id)
    .eq('estado', 'publicado')
    .single();
  return { data, error };
}
```

## Link de card: `href="obra.html?id=${work.id}"`

---

## Objetivos Chat 2

### FASE 1: `obra.html` — Ficha Detalle
- Lee `?id=<uuid>` de la URL
- Llama `api.getWorkById(id)`
- Layout: imagen principal grande (izq) + metadata (der)
- Breadcrumb: Catálogo → Obra
- Botón "← Volver al catálogo" (con history.back o href index.html)
- i18n: etiquetas ES/EN (Artista/Artist, Año/Year, etc.)
- Empty/error state si id inválido

### FASE 2: Galería
- Imagen principal clickable → lightbox fullscreen
- Miniaturas debajo → click cambia imagen principal
- Navegación: prev/next buttons (Lucide ChevronLeft/Right)
- Teclado: flechas + ESC cierra lightbox
- Touch swipe en mobile
- Dot pagination

### FASE 3: Edge Function (opcional)
- `supabase/functions/convert-webp/index.ts`
- Comprime imágenes al subir en admin
- Trigger: POST desde admin upload handler

---

## Archivos a Crear
```
app/obra.html              ← Ficha detalle (nueva)
app/js/public-detail.js   ← Lógica: cargar obra por ?id
app/js/gallery.js         ← Carrusel + lightbox
supabase/functions/convert-webp/index.ts  ← Edge Fn (opcional)
```

## Archivos a Modificar
```
app/css/styles.css        ← Añadir estilos ficha + galería
app/js/i18n.js            ← Añadir keys nuevas si hace falta
```

## Commits Recientes
```
368f955  CLEANUP: debug script eliminado + validación rol usuarios-crud
0d7e3cf  docs: ESTADO-CHAT1-FINAL.md — resumen completo y handoff para Chat 2
232316b  FASE 2: Catálogo público Grid + Filtros premium
```

## Prompt de Apertura para Chat 2
```
Proyecto: Catálogo Digital Obra Serigráfica — UNAM/FAD
Chat 1 completo. Repo: egodiseno/catalogo-serigrafia-unam-fad (branch main)
Ver HANDOFF-CHAT2.md para contexto completo.

TAREA INMEDIATA: Crear obra.html (ficha detalle de obra individual)
- URL: obra.html?id=<uuid>
- Usar api.getWorkById(id) que ya existe en api-client.js
- Layout 2 columnas: imagen grande | metadata
- Galería con miniaturas si hay más de 1 imagen
- Botón volver, breadcrumb, i18n ES/EN
- Mobile: columna única, imagen arriba
```
