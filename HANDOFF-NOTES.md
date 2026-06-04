# HANDOFF-NOTES — Prototipo 1 público esencial

Notas técnicas y operativas para entregar, revisar o migrar el prototipo.

## Estado del paquete

Este paquete corresponde al cierre de **Entrega 12 — Handoff final y paquete de cierre**.

El prototipo público esencial queda estable para revisión externa y publicación estática.

## Principio visual vigente

La dirección visual aprobada se mantiene como:

```text
Opción A + C — Editorial sobria + Archivo visual refinado
```

Criterios visibles:

- fondo claro cálido/editorial;
- azul institucional profundo como acento;
- texto principal en azul casi negro;
- bordes finos gris azulados;
- radios moderados;
- sombras mínimas;
- tono institucional y no comercial;
- UI subordinada a la obra.

## Componentes públicos incluidos

- PublicHeader.
- PublicFooter.
- Menú mobile público.
- Catálogo general.
- SearchBar.
- FilterPanelDesktop.
- FilterDrawerMobile.
- FilterChip.
- ClearFilterActions.
- ArtworkGrid.
- ArtworkCard.
- LoadMoreButton.
- Estados loading, empty y error.
- Ficha pública de obra.
- Visor simple de imagen.
- SharePanel de enlace.
- Cards de año.
- Vista por técnica.
- Vista por serie.
- Página Acerca.
- Página 404.

## Dataset

Archivo principal:

```text
/data/artworks.json
```

Resumen:

- 24 obras publicadas.
- 1 ficha individual activa mediante `detailUrl`.
- 4 años.
- 3 técnicas.
- 3 series reales.
- 30 tags.

`Sin serie` funciona como label visible, no como taxonomía real ni ruta pública.

## Imágenes

Las rutas de imagen se leen desde `mainImage`:

```json
"mainImage": "assets/mock/artworks/obra-01-main.jpg"
```

Las imágenes deben existir físicamente en:

```text
/assets/mock/artworks/
```

No se debe ofrecer descarga directa de imagen en el Prototipo 1.

## JavaScript

| Archivo | Responsabilidad |
|---|---|
| `main.js` | Menú mobile público. |
| `drawer.js` | Drawer mobile de filtros. |
| `filters.js` | Catálogo general, búsqueda, filtros, chips, carga por bloques y filtros iniciales por URL. |
| `archive.js` | Archivo por año desde dataset. |
| `collection-view.js` | Vista representativa por técnica o serie (parametrizada por `data-collection-kind`). |
| `shared.js` | Helpers genéricos compartidos (`window.CatalogUtils`). |
| `image-viewer.js` | Visor simple de imagen en ficha. |
| `share-panel.js` | Compartir URL de ficha. |

## Consideraciones para Netlify/Vercel

- Publicar la carpeta `prototipo-publico` como raíz del sitio.
- Confirmar que los archivos JSON se sirvan con MIME correcto.
- Confirmar que las rutas relativas funcionen sin base path adicional.
- Configurar `404.html` como página de error.

## Consideraciones para futura migración a Next.js

Sugerencia de mapeo:

| Prototipo estático | Next.js futuro |
|---|---|
| `index.html` | `/` |
| `index.html` | `/catalogo` |
| `archivo.html` | `/archivo` |
| `obra-memoria-del-taller.html` | `/obra/[slug]` |
| `tecnica-serigrafia-experimental.html` | `/tecnicas/[slug]` |
| `serie-archivo-grafico.html` | `/series/[slug]` |
| `acerca.html` | `/acerca` |
| `404.html` | `not-found.tsx` o equivalente |

## Consideraciones para futura migración a Supabase

Tablas sugeridas para futuro Prototipo 2/producción:

- `artworks`
- `years`
- `techniques`
- `series`
- `tags`
- `artwork_tags`
- `artwork_images`
- `profiles` / `admin_users`

Campos clave que ya aparecen en el dataset mock:

- `id`
- `title`
- `slug`
- `author`
- `year`
- `technique`
- `techniqueSlug`
- `series`
- `seriesSlug`
- `seriesLabel`
- `tags`
- `dimensions`
- `edition`
- `description`
- `credits`
- `mainImage`
- `publicationStatus`
- `relatedArtworkIds`
- `detailUrl` solo como recurso de prototipo

## Lo que no debe migrarse literalmente

- `detailUrl` como lógica productiva definitiva.
- Rutas HTML estáticas.
- Dataset mock como verdad institucional.
- Textos que identifiquen el sitio como prototipo.
- Placeholders institucionales temporales.

## Reglas de continuidad

Para futuras fases:

- No introducir ecommerce.
- No agregar descarga directa de imagen sin decisión institucional.
- No convertir tags en navegación principal pública si no se aprueba.
- No usar obras destacadas, rankings o jerarquías curatoriales no justificadas.
- Mantener año, técnica y serie como criterios principales.
- Mantener accesibilidad de teclado y foco visible.

## Riesgos conocidos

- Si se abre con `file://`, `fetch()` puede fallar.
- Si faltan imágenes en `/assets/mock/artworks/`, habrá 404 de assets.
- Si el hosting usa subcarpetas, puede requerir ajuste de rutas relativas.
- `navigator.clipboard` puede requerir HTTPS; existe fallback de copia.
- El 404 requiere configuración del hosting para funcionar automáticamente.

## Cierre operativo

El Prototipo 1 público esencial queda listo para:

- revisión externa;
- publicación estática;
- walkthrough con cliente/equipo;
- preparación del Prototipo 2 admin;
- migración posterior a stack productivo.
