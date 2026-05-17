# AGENTS.md

## Proyecto

Catálogo Digital de Obra Serigráfica — UNAM / FAD / Taller de Serigrafía.

Este proyecto es un catálogo digital académico/cultural para exhibición y consulta de obra serigráfica. No es ecommerce, no es galería comercial, no es red social y no es dashboard SaaS.

## Dirección visual obligatoria

Mantener siempre:

- Sistema visual aprobado: Opción A + C — Editorial sobria + Archivo visual refinado.
- Tono sobrio, institucional, claro y editorial.
- Fondo claro.
- Azul profundo institucional como acento principal.
- UI limpia que acompañe la obra sin competir con ella.
- Estructura de catálogo cultural/académico.

## Prohibido

No agregar:

- precios;
- carrito;
- favoritos comerciales;
- comentarios públicos;
- calificaciones;
- botones de compra;
- descarga directa de imagen;
- patrones ecommerce;
- dashboard comercial tipo SaaS;
- datos inventados;
- obras inventadas;
- autores inventados;
- archivos JSON falsos;
- logos institucionales recreados si no existen físicamente.

## Reglas de implementación

- No rehacer el proyecto desde cero.
- No hacer refactors globales sin autorización.
- No cambiar arquitectura sin permiso.
- No modificar archivos fuera del alcance indicado.
- No crear componentes nuevos si puede ajustarse el existente.
- Hacer cambios mínimos, localizados y verificables.
- Mantener compatibilidad con HTML/CSS/JS estático y Tailwind CDN mientras no se indique migración.
- No migrar a Next.js, Supabase, backend, Auth ni Storage sin instrucción explícita.

## Flujo obligatorio antes de editar

Antes de modificar archivos:

1. Leer los archivos relevantes.
2. Identificar el fragmento exacto a modificar.
3. Explicar qué archivos serán tocados.
4. Confirmar que el cambio es mínimo.
5. Aplicar solo el ajuste solicitado.
6. Reportar archivos modificados.
7. Indicar cómo verificar en navegador.

## Estructura actual

- app/index.html
- app/catalogo.html
- app/css/styles.css
- app/js/
- app/data/
- app/assets/
- netlify.toml

## Deploy

El sitio se despliega en Netlify desde GitHub.

Configuración:

- Branch: main
- Build command: vacío
- Publish directory: app

## Accesibilidad

Mantener lógica WCAG 2.2 AA siempre que sea posible:

- contraste suficiente;
- foco visible;
- navegación por teclado;
- labels claros;
- no depender solo del color;
- textos alternativos para imágenes.

## Git

Antes de cambios importantes, revisar:

git status

Después de cambios, reportar:

- archivos modificados;
- resumen del cambio;
- riesgos potenciales;
- pasos de verificación.
