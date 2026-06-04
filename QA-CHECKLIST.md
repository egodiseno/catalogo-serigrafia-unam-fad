# QA-CHECKLIST — Prototipo 1 público esencial

Checklist final para revisar el prototipo antes de compartirlo con cliente/equipo o publicarlo en hosting estático.

## 1. Arranque local

- [ ] Abrir el proyecto desde servidor local, no desde `file://`.
- [ ] Confirmar que `index.html` carga correctamente.
- [ ] Confirmar que no hay errores JS bloqueantes en consola.
- [ ] Confirmar que los JSON cargan por `fetch()`.

## 2. Navegación pública global

Verificar en todas las páginas:

- [ ] Inicio → `index.html`.
- [ ] Catálogo → `index.html`.
- [ ] Archivo por año → `archivo.html`.
- [ ] Técnicas → `tecnica-serigrafia-experimental.html`.
- [ ] Series → `serie-archivo-grafico.html`.
- [ ] Acerca → `acerca.html`.
- [ ] El menú mobile abre y cierra correctamente.
- [ ] Escape cierra el menú mobile.
- [ ] No hay enlaces rotos visibles.

## 3. Catálogo general

En `index.html`:

- [ ] Se muestran 12 obras iniciales.
- [ ] El texto de progreso indica `Mostrando 12 de 24 obras`.
- [ ] El botón `Cargar más obras` muestra el segundo bloque.
- [ ] La búsqueda funciona por título, autor/a, año, técnica, serie, tags y datos disponibles.
- [ ] Los filtros de año, técnica, serie y tag funcionan.
- [ ] Los chips aparecen al filtrar.
- [ ] Los chips se pueden remover.
- [ ] `Limpiar filtros` reinicia la vista.
- [ ] Una sola card muestra `Ver ficha`.
- [ ] Las demás cards muestran `Ficha reservada`.
- [ ] Las imágenes cargan desde `/assets/mock/artworks/` si existen localmente.
- [ ] Sin resultados muestra estado vacío claro.

## 4. Ficha pública

En `obra-memoria-del-taller.html`:

- [ ] La ficha carga correctamente.
- [ ] El breadcrumb es claro.
- [ ] La imagen principal se muestra si existe el asset local.
- [ ] La ficha técnica muestra autor/a, año, técnica, serie, medidas y edición/tiraje.
- [ ] El botón `Volver al catálogo` funciona.
- [ ] No hay precio, compra, carrito, favoritos ni descarga.

## 5. Visor de imagen

En la ficha:

- [ ] `Ver imagen ampliada` abre el visor.
- [ ] El visor muestra la imagen principal.
- [ ] El botón de cerrar funciona.
- [ ] Escape cierra el visor.
- [ ] Click en overlay cierra el visor.
- [ ] El foco vuelve al botón activador.
- [ ] No hay zoom complejo ni galería avanzada.

## 6. Compartir obra

En la ficha:

- [ ] El bloque `Compartir obra` es visible.
- [ ] `Copiar enlace` copia la URL de la ficha.
- [ ] WhatsApp abre con URL de ficha.
- [ ] Correo abre con URL de ficha.
- [ ] SMS abre con URL de ficha.
- [ ] No se comparte la ruta directa de imagen.
- [ ] No se ofrece descarga de imagen.

## 7. Archivo por año

En `archivo.html`:

- [ ] Se muestran los años 2024, 2023, 2022 y 2021.
- [ ] Cada año muestra conteo de obras.
- [ ] Cada año muestra técnicas presentes.
- [ ] Cada año muestra series presentes.
- [ ] Cada card enlaza a `index.html?year=YYYY`.
- [ ] El catálogo abre con filtro de año activo.

## 8. Vista por técnica

En `tecnica-serigrafia-experimental.html`:

- [ ] Se muestra la técnica `Serigrafía experimental`.
- [ ] Se renderizan obras asociadas a esa técnica.
- [ ] El resumen documental muestra obras, años, series y tags frecuentes.
- [ ] El CTA al catálogo filtrado funciona.
- [ ] Solo la obra con `detailUrl` enlaza a ficha.
- [ ] No se crean vistas adicionales de técnica.

## 9. Vista por serie

En `serie-archivo-grafico.html`:

- [ ] Se muestra la serie `Archivo gráfico`.
- [ ] Se renderizan obras asociadas a esa serie.
- [ ] El resumen documental muestra obras, años, técnicas y tags frecuentes.
- [ ] El CTA al catálogo filtrado funciona.
- [ ] Solo la obra con `detailUrl` enlaza a ficha.
- [ ] No se crean vistas adicionales de serie.

## 10. Acerca del catálogo

En `acerca.html`:

- [ ] Explica qué es el catálogo.
- [ ] Explica organización por año, técnica, serie y tags.
- [ ] Explica criterios de consulta.
- [ ] Explica restricciones de imagen, derechos y descarga.
- [ ] Aclara que el dataset es mock/controlado.

## 11. Página 404

En `404.html`:

- [ ] Muestra mensaje de página no encontrada.
- [ ] Ofrece rutas de recuperación.
- [ ] Enlaza a Inicio, Catálogo, Archivo, Técnicas, Series y Acerca.
- [ ] Mantiene tono sobrio e institucional.

## 12. Accesibilidad básica

- [ ] Existe skip link en páginas públicas.
- [ ] El foco visible se mantiene en botones, links, inputs, selects y chips.
- [ ] No hay `aria-disabled` en enlaces funcionales.
- [ ] No hay `aria-pressed` falso en controles no funcionales.
- [ ] Los estados dinámicos tienen `aria-live` cuando aplica.
- [ ] Drawer/visor devuelven foco al activador.
- [ ] Escape cierra menú mobile, drawer y visor cuando aplica.
- [ ] El sitio puede usarse con teclado.

## 13. Responsive

Validar manualmente:

- [ ] Desktop.
- [ ] 480px.
- [ ] 360px.
- [ ] Menú mobile.
- [ ] Drawer de filtros.
- [ ] Cards del catálogo.
- [ ] Ficha de obra.
- [ ] Visor de imagen.
- [ ] Bloque de compartir.
- [ ] Cards de año, técnica y serie.
- [ ] Textos largos de Acerca.

## 14. Restricciones de alcance

Confirmar que no existe:

- [ ] Backend.
- [ ] Supabase.
- [ ] Auth.
- [ ] Storage.
- [ ] Admin.
- [ ] Compra.
- [ ] Precio.
- [ ] Carrito.
- [ ] Favoritos.
- [ ] Descarga de imagen.
- [ ] Comentarios públicos.
- [ ] Obras destacadas o ranking.
