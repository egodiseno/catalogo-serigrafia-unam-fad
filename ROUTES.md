# ROUTES — Prototipo 1 público esencial

Documento de rutas públicas del Catálogo Digital de Obra Serigráfica.

## Navegación pública global

Todas las páginas públicas deben sostener esta navegación:

```text
Inicio → index.html
Catálogo → index.html
Archivo por año → archivo.html
Técnicas → tecnica-serigrafia-experimental.html
Series → serie-archivo-grafico.html
Acerca → acerca.html
```

## Rutas públicas existentes

| Ruta | Pantalla | Estado | Descripción |
|---|---|---|---|
| `index.html` | Inicio | Implementada | Presenta el prototipo público, alcance y accesos principales. |
| `index.html` | Catálogo general | Implementada | Grid de obras, búsqueda, filtros, chips y botón `Cargar más obras`. |
| `archivo.html` | Archivo por año | Implementada | Agrupa obras por año/generación y enlaza al catálogo filtrado. |
| `obra-memoria-del-taller.html` | Ficha de obra | Implementada | Ficha individual representativa para `Memoria del taller`. |
| `tecnica-serigrafia-experimental.html` | Vista por técnica | Implementada | Vista representativa para `Serigrafía experimental`. |
| `serie-archivo-grafico.html` | Vista por serie | Implementada | Vista representativa para `Archivo gráfico`. |
| `acerca.html` | Acerca del catálogo | Implementada | Explica propósito, alcance, criterios documentales y restricciones. |
| `404.html` | Página no encontrada | Implementada | Recuperación ante rutas inexistentes o enlaces rotos. |

## Rutas con parámetros

Estas rutas no crean páginas nuevas. Aplican filtros al catálogo general.

| Ruta | Uso |
|---|---|
| `index.html?year=2024` | Catálogo filtrado por año. |
| `index.html?year=2023` | Catálogo filtrado por año. |
| `index.html?year=2022` | Catálogo filtrado por año. |
| `index.html?year=2021` | Catálogo filtrado por año. |
| `index.html?technique=Serigraf%C3%ADa%20experimental` | Catálogo filtrado por técnica. |
| `index.html?series=Archivo%20gr%C3%A1fico` | Catálogo filtrado por serie. |

## Ruta de ficha habilitada desde dataset

Solo una obra del dataset tiene ficha activa:

```json
{
  "id": "obra-01",
  "slug": "memoria-del-taller",
  "detailUrl": "obra-memoria-del-taller.html"
}
```

Las demás cards deben mostrar `Ficha reservada`.

## Rutas deliberadamente no creadas en Prototipo 1

No existen todavía:

```text
archivo-2024.html
archivo-2023.html
archivo-2022.html
archivo-2021.html
obra-*.html para el resto de obras
tecnica-*.html para el resto de técnicas
serie-*.html para el resto de series
admin.html
login.html
dashboard.html
```

## Comportamiento esperado del 404

El archivo `404.html` existe como página estática. Para que funcione automáticamente ante rutas inexistentes, debe configurarse en el hosting final.
