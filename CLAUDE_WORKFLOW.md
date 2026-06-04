# Claude PRO Workflow — Catálogo Digital de Obra Serigráfica

## Módulo 1: Auditoría y Refactorización

### Sesión 1: Consolidación de JavaScript
**Fecha:** 25/05/2026
**Modelo:** Opus 4.7
**Objetivo:** Eliminar duplicación en js/ y crear módulo compartido

#### Hallazgos principales
- technique-view.js ≈ series-view.js (95% idénticos)
- renderArtworkCard triplicado en 4 módulos
- helpers (normalizeText, escapeHtml, etc.) cuadruplicados

#### Plan de ejecución
1. Crear js/shared.js con helpers y renderArtworkCard
2. Refactorizar technique-view.js → collection-view.js (parametrizado)
3. Eliminar series-view.js (se fusiona en collection-view.js)
4. Verificar que todas las páginas siguen funcionando

#### Estimación
- Tiempo: 2-3 horas
- Líneas eliminadas: ~370
- Riesgo: BAJO

#### Resultado
✅ shared.js creado (82 líneas, 8 helpers genéricos)
✅ filters.js refactorizado (eliminadas 75 líneas de duplicación)
✅ index.html actualizado (carga shared.js antes de filters.js)
✅ Pruebas en navegador: TODO FUNCIONA (grid, filtros, chips, estados)

Líneas de código eliminadas: 75
Helpers consolidados: 8
Tiempo real: ~45 minutos
Riesgo ejecutado: BAJO ✓

#### Lecciones aprendidas

1. **Refactorización de closures**
   - setStatus original referenciaba 'elements' del IIFE
   - Solución: parametrizar como setViewStatus(elements, status)
   - Lección: cuando extraes helpers que cierren sobre estado, hazlos explícitos

2. **Scripts clásicos vs. modules**
   - En <script> clásico, const a nivel superior son globales compartidas
   - Así filters.js resuelve normalizeText sin prefijo (viene de shared.js)
   - En type="module", esto no funcionaría → necesitarías window.CatalogUtils.normalizeText
   - Decisión: mantener clásico ahora, documentar para futura migración a Next.js

3. **Orden de carga importa**
   - <script src="js/shared.js" defer></script> debe ir ANTES de filters.js
   - defer asegura ejecución en orden, no en paralelo
   - Sin esto, filters.js intentaría usar CatalogUtils antes de que exista

4. **Validación es insuficiente**
   - node --check solo verifica sintaxis
   - El runtime en navegador es la prueba real
   - Siempre prueba en navegador después de refactorización

#### Notas técnicas

- shared.js: 82 líneas, expone window.CatalogUtils
- setViewStatus es la única firma que cambió (recibe elements como parámetro)
- mapArtwork no fue migrado (difiere entre módulos, se hará en siguiente iteración)
- Próximo: refactorizar technique-view.js y series-view.js (95% idénticos)

#### Commits sugeridos
1. Create: app/js/shared.js
2. Update: app/js/filters.js (elimina helpers duplicados)
3. Update: app/index.html (carga shared.js)

### Sesión 2: Consolidación de Vistas (Technique + Series)

#### Objetivo
Colapsar technique-view.js y series-view.js (95% idénticos) en un único collection-view.js parametrizado.

#### Hallazgos
- 205 líneas cada uno
- Solo ~15 líneas diferían (atributos, nombres, lógica de match)
- El resto era copia literal (helpers + renderArtworkCard)

#### Ejecución
1. Creado collection-view.js (267 líneas, parametrizado por data-collection-kind)
2. Definido CONFIG para mapear kind → campos específicos
3. Actualizado tecnica-serigrafia-experimental.html (data-collection-* + shared.js + collection-view.js)
4. Actualizado serie-archivo-grafico.html (data-collection-* + shared.js + collection-view.js)
5. Verificado en navegador: ambas vistas funcionan correctamente
6. Eliminado technique-view.js y series-view.js (ahora huérfanos)
7. Actualizada documentación (index.html, README.md, HANDOFF-NOTES.md, CLAUDE.md)

#### Resultado
✅ Líneas eliminadas: ~410 (los 2 archivos completos)
✅ Código consolidado en 1 archivo parametrizado
✅ Cero cambios visuales, 100% funcionalidad preservada
✅ Páginas testeadas en navegador: OK

#### Lecciones aprendidas

1. **Parametrización con data-attributes**
   - Los data-* se leen en JS y mapean a configuración interna
   - Permite un único archivo servir múltiples vistas
   - Lección: cuando tienes 95% duplicación, busca siempre el parámetro que diferencia

2. **Fallback de helpers vs. migración completa**
   - renderArtworkCard aún no está en shared.js (fallback inline temporal)
   - Esto permite que collection-view.js funcione hoy sin bloquear el refactor
   - Lección: migración en fases es mejor que todo-o-nada

3. **Documentación viva**
   - El diagrama en index.html es visible al usuario
   - Actualizarlo es crítico, no opcional
   - Lección: docs no son post-it, son parte del producto

4. **Arquitectura parametrizable escala**
   - Si añadieras una vista por "año", solo necesitarías un data-collection-kind="year" nuevo en CONFIG
   - Cero duplicación de código
   - Lección: invertir tiempo en parametrización ahora ahorra mucho después

#### Notas técnicas

- collection-view.js recibe kind, slug, name vía data-collection-* del HTML
- CONFIG mapea kind → primaryField, primarySlugField, secondaryAxis, labels
- matchesPrimary(artwork, kind, slug, name) es la función genérica que reemplaza matchesTechnique/matchesSeries
- Fallback de renderArtworkCard: líneas ~230-260 (temporal, a eliminar cuando renderArtworkCard → shared.js)

#### Próximos pasos recomendados
1. Migrar renderArtworkCard a shared.js (elimina fallback)
2. Migrar archive.js a CatalogUtils (mismo patrón)
3. Considerar si renderArtworkCard debería parametrizarse también para Next.js

#### Commits sugeridos
1. Create: app/js/collection-view.js
2. Update: app/tecnica-serigrafia-experimental.html (data-collection-*)
3. Update: app/serie-archivo-grafico.html (data-collection-*)
4. Delete: app/js/technique-view.js, app/js/series-view.js
5. Update: app/js/shared.js (comentario corrector)
6. Update: index.html, README.md, HANDOFF-NOTES.md, CLAUDE.md (documentación)


### Sesión 3: Consolidación de renderArtworkCard y helpers finales

#### Objetivo
Eliminar la triplicación de renderArtworkCard (vivía en filters.js, collection-view.js y archive.js).
Centralizar en shared.js como función canónica.

#### Ejecución
1. Creado getArtworkHref(artwork) en shared.js (resuelve alias: detailUrl → detail_url → urlFicha)
2. Creado renderArtworkCard canónico en shared.js (usa CatalogUtils.escapeHtml + getArtworkHref)
3. Eliminada copia en filters.js (líneas 260–297)
4. Eliminado fallback en collection-view.js (líneas ~132–170)
5. Eliminado código muerto: getArtworkDetailHref en filters.js
6. Actualizado filters.js y collection-view.js para usar CatalogUtils.renderArtworkCard
7. Verificado en navegador: index.html, tecnica-serigrafia-experimental.html, serie-archivo-grafico.html → TODO OK

#### Resultado
✅ Líneas eliminadas: ~75 (2 copias + fallback + código muerto)
✅ CatalogUtils ahora expone 10 utilidades (8 helpers + getArtworkHref + renderArtworkCard)
✅ renderArtworkCard existe en UN solo lugar
✅ Cero cambios visuales

#### Lecciones aprendidas

1. **Detectar dependencias ocultas**
   - getArtworkDetailHref parecía compartible pero solo lo usaba renderArtworkCard
   - Cuando mueves una función, mapea todas sus dependencias
   - Lección: no es suficiente mover; hay que refactorizar las dependencias

2. **Alias de URL como patrón**
   - getArtworkHref resuelve 3 variantes: detailUrl, detail_url, urlFicha
   - Es un patrón común en sistemas legacy (diferentes fuentes de datos)
   - Lección: centralizar la resolución de alias evita bugs de deriva

3. **Guard de null es fundamental**
   - El guard (artwork &&) en getArtworkHref protege contra null/undefined
   - Sin él, se lanzaría TypeError si un módulo pasa datos inválidos
   - Lección: siempre hacer funciones defensivas, especialmente cuando son compartidas

#### Notas técnicas

- shared.js ahora: 10 utilidades + 127 líneas
- filters.js: -38 líneas (renderArtworkCard) -4 líneas (getArtworkDetailHref) = -42 total
- collection-view.js: -39 líneas (fallback eliminado)
- Reducción neta: ~75 líneas

#### Pendientes futuros
1. archive.js aún tiene sus propias copias de helpers (renderYearCard distinto)
2. archive.js no usa CatalogUtils aún
3. Si el proyecto escala, considerar migración a type="module" para mejor encapsulación

#### Commits sugeridos
1. Update: app/js/shared.js (getArtworkHref + renderArtworkCard)
2. Update: app/js/filters.js (elimina renderArtworkCard + getArtworkDetailHref, usa CatalogUtils)
3. Update: app/js/collection-view.js (elimina fallback, usa CatalogUtils)

### Sesión 4: Rediseño Visual — Mockups + Tokens

#### Objetivo
Definir dirección visual moderna UNAM-aligned sin cambiar código original.

#### Ejecución
1. Investigado identidad UNAM (colores oficiales azul #013b75 + oro #d9a500)
2. Creado 2 mockups HTML independientes (minimalista + editorial)
3. Seleccionado mix ganador: layout minimalista + colores editorial + header editorial
4. Creado mockup3-final.html (aprobado por cliente visual)
5. Iniciado CAPA 1 (tokens CSS) — colores + tipografía + escala

#### Estado actual
✅ mockup3-final.html listo para referencia
✅ CAPA 1 tokens definidos (azul #013b75, oro #d9a500, Inter/Lora)
✅ Cero cambios de render aún (excepto azul, sutil)
⏳ CAPA 2 pendiente: cablear tipografía + shadows + motion

#### Próximos pasos
1. /clear (ahorrar tokens)
2. CAPA 2: aplicar escala tipográfica a selectores
3. CAPA 3: iconos SVG
4. CAPA 4: ajustes quirúrgicos
5. Implementar en código original


### Sesión 4: Rediseño Visual — Mockup3 + Design System

#### Objetivo
Aplicar dirección visual moderna UNAM-aligned (mockup3-final.html) a styles.css sin cambiar HTML/JS.

#### Ejecución
1. Investigado identidad UNAM (colores oficiales azul #013b75 + oro #d9a500)
2. Creado 2 mockups HTML (minimalista + editorial)
3. Seleccionado mix: layout minimalista + colores editorial + header editorial
4. Creado mockup3-final.html (aprobado visualmente)
5. Aplicado CAPA 1 (tokens CSS): colores + tipografía + escala
6. Aplicado CAPA 2 (componentes CSS):
   - Header: brand-mark círculo + border dorado, nav-link subrayado oro animado (::after scaleX)
   - Botones: primary/secondary con estados hover/active
   - Cards: .artwork-card* con hover elevación + sombra
   - Footer: .footer-heading dorado
   - Glass morphism: backdrop-filter blur en header

#### Decisiones
- Mantener Tailwind CDN (eliminar sería 2-3 sesiones de bajo ROI; nativo en Next.js)
- Protocolo CSS: [VERIFICADO] antes de cada instrucción para evitar desajustes selector/HTML
- Estructura HTML/JS intacta (solo CSS)

#### Estado actual
✅ Público moderno (header, botones, cards, footer parcial)
⏳ Hero (requiere HTML)
⏳ Footer 4 columnas (requiere HTML)
⏳ Admin (próxima sesión)
✅ Mockup3 como referencia visual (no código de producción)

#### Lecciones
1. Validar selectores reales vs. mockup antes de instrucciones
2. Media queries mobile-first (min-width, no max-width)
3. Cascada CSS: inyección Tailwind al final sobrescribe links anteriores
4. Estructura HTML de producción ≠ Mockup (compromiso: retheme sobre selectores reales)

#### Próximos pasos
1. Hero: tipografía clamp() responsiva + énfasis azul en palabra (requiere HTML)
2. Footer: 4 columnas + redes sociales (requiere HTML)
3. Admin: rediseño completo (paleta nueva + componentes)
4. Commit GitHub documentado

