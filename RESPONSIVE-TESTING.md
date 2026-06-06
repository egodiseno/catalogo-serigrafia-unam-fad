# RESPONSIVE TESTING CHECKLIST

## DESKTOP (≥ 1024px)

```
Layout:
□ Sidebar a la izquierda (fija)
□ Contenido principal a la derecha
□ Header con logo + nav horizontal
□ Stats en grid 4-columnas

Tablas:
□ Todas las columnas visibles
□ Thumbnails de obras (44×44)
□ Sin scroll horizontal

Modales:
□ Centrado, max-width: 560px
□ Inputs con padding normal
□ Botones en fila (Cancelar | Guardar)

Formulario de obra:
□ form-row en 2 columnas (Año / Estado)
□ Inline técnica funciona
□ Tag search + dropdown
```

## TABLET (768px)

```
Layout:
□ Sidebar arriba (horizontal, scroll horizontal en nav-items)
□ Contenido debajo
□ Sin scroll horizontal en contenido principal

Stats:
□ Grid 2-columnas

Tablas:
□ Fuente más pequeña (var(--font-size-sm))
□ Padding reducido
□ Scroll horizontal vía .table-wrapper si necesario

Modales:
□ max-width: calc(100vw - spacing-2xl)
□ form-row: 1 columna
□ Botones: min-height 44px (touch target)

Filtros (obras):
□ Apilados verticalmente (flex-direction: column)
```

## MOBILE (375px / iPhone SE)

```
Layout:
□ Single column, sin overflow horizontal
□ Padding 6–8px en overlays
□ content-area padding: var(--spacing-lg)

Tablas:
□ Scroll horizontal dentro de .table-wrapper
□ Fuente 12px
□ Botones de acciones compactos pero clickeables

Modales:
□ max-width: calc(100vw - 12px)
□ max-height: 95vh
□ modal-body scrolleable
□ Footer: botones apilados, 100% ancho, 48px alto

Inputs:
□ font-size: 1rem (prevenir zoom automático en iOS)
□ width: 100%

Botones globales:
□ min-height: 48px (touch target iOS)
□ Botones de acciones en tabla: compactos, NO 100% ancho

Tags:
□ Dropdown máx 160px alto con scroll
□ Chips con wrap normal

Dashboard:
□ Botón "+ Nueva Obra" visible y clickeable
□ Stats en grid 1-columna
```

## CROSS-BROWSER

```
□ Chrome (desktop + DevTools mobile)
□ Firefox
□ Safari
□ Edge
□ Mobile Safari (iOS) — zoom prevention en inputs ✓
□ Chrome Mobile (Android)
```

## ESPECÍFICOS ADMIN

```
Tabla obras (7 columnas):
□ Desktop: todas visibles incluyendo thumbnail
□ Tablet: scroll horizontal si no caben
□ Mobile: scroll horizontal, thumbnail puede quedar fuera

Modales de CRUD (ModalManager):
□ Tags: 1 campo, modal simple
□ Técnicas: 2 campos, modal simple
□ Usuarios: formulario con rol/estado

Formulario de obra (custom modal):
□ Muchos campos → modal-body scrolleable en mobile
□ Inline técnica: stack en mobile (inline-create-wrapper)
□ Tag search: dropdown limited a 160px

Filtros obras:
□ 768px: flex column, items stretch
□ 375px: input font-size 1rem
```

## CÓMO TESTEAR

1. Abrir `http://localhost/admin/` (o tu Local URL)
2. `F12` → Toggle device toolbar (`Ctrl+Shift+M`)
3. Dispositivos a probar:
   - iPhone SE (375×667)
   - iPhone 12 Pro (390×844)
   - iPad (768×1024)
   - Desktop (1440×900)
4. Para cada breakpoint: verificar tablas, modales, formularios y navegación
5. Probar tap targets: ningún botón menor a 44×44px
6. Verificar que no hay scroll horizontal en el contenedor principal

## ESTADO

```
✅ Desktop (≥ 1024px)   — CSS base
✅ Tablet (768px)        — bloque existente + complemento
✅ Mobile (480px)        — bloque existente + complemento modal
✅ Mobile S (375px)      — bloque nuevo
```
