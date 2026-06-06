# UX IMPROVEMENTS — Testing Checklist

## 1. PROGRESO DE SUBIDA DE IMÁGENES

### Comportamiento esperado:
```
Si se sube 1 imagen:
  → No toast de progreso (innecesario)
  → Obra se guarda normalmente

Si se suben 2+ imágenes:
  → Toast "Subiendo imagen 1/3…" al subir la primera
  → Toast "Subiendo imagen 2/3…" al subir la segunda
  → Toast de éxito al final (de obras-form.js)

Si una imagen falla:
  → Toast de error con número de imagen
  → Obra guardada, imágenes pendientes NO guardadas
```

### Pasos de testing:
```
1. Nueva Obra → agregar 3 imágenes
2. Click "Guardar obra"
3. Observar toasts: "Subiendo imagen 1/3…", "2/3…", "3/3…"
4. Verificar que la obra aparece en la tabla con thumbnail
```

### Límite de 10 imágenes:
```
□ Agregar imagen #11 → botón se bloquea con toast "Máximo 10 imágenes permitidas"
□ El botón "+ Agregar imagen" queda bloqueado
□ La obra con 10 imágenes se guarda correctamente
```

---

## 2. TOGGLE CONTRASEÑA

### Comportamiento esperado:
```
INPUT Contraseña:
  □ Default: type="password" (texto oculto con puntos)
  □ Icono 👁️ a la derecha del input

AL HACER CLICK EN 👁️:
  □ type="text" (contraseña visible)
  □ Icono cambia a 🙈
  □ aria-pressed="true"

AL HACER CLICK OTRA VEZ:
  □ type="password" (oculta)
  □ Icono vuelve a 👁️
  □ aria-pressed="false"
```

### Pasos de testing:
```
1. Ir a Usuarios
2. Click "+ Nuevo Usuario"
3. Ver campo Contraseña → debe tener 👁️ a la derecha
4. Escribir contraseña → texto oculto con puntos
5. Click en 👁️ → contraseña visible, icono 🙈
6. Click en 🙈 → contraseña oculta, icono 👁️
7. Tab al botón ojo → tiene outline de foco
8. Enter → hace toggle (accesible por teclado)
```

### Accesibilidad:
```
□ Tab llega al botón ojo
□ Focus ring visible (outline azul)
□ Enter hace toggle
□ aria-label cambia: "Mostrar contraseña" / "Ocultar contraseña"
□ aria-pressed="false/true" refleja estado actual
```

---

## 3. ELIMINAR USUARIO (ahora con modal de confirmación)

### Comportamiento esperado:
```
Click 🗑️ en fila de usuario:
  □ Aparece modal de confirmación (no alert nativo)
  □ Título: "¿Eliminar usuario?"
  □ Mensaje: "Se eliminará email. Esta acción no se puede deshacer."
  □ Botones: [Cancelar] [Eliminar]
  □ Foco en [Cancelar] por defecto (más seguro)
  □ ESC cierra el modal
```

---

## 4. RESPONSIVE (toggle)

```
Mobile 375px:
□ Botón 👁️ es clickeable (touch target adecuado)
□ Input tiene padding-right para el botón
□ El botón no se superpone con el texto del input

Tablet 768px:
□ Todo funciona normal

Desktop:
□ Sin cambios visuales notables
```

---

## CHECKLIST FINAL

```
IMÁGENES:
□ Progreso visible al subir 2+ imágenes
□ Un solo toast por imagen (no spam)
□ Límite de 10 enforced en el botón

CONTRASEÑA:
□ Default: oculta (type="password")
□ Botón 👁️ visible en modal de crear usuario
□ Click alterna visible/oculta
□ Accesible (Tab + Enter, aria-label, aria-pressed)

DELETE USUARIO:
□ Modal de confirmación en lugar de alert nativo
□ Cancelar no elimina
□ Guard: no elimina último admin

CONSOLE:
□ Sin errores rojos
□ "✅ UsuariosCRUD listo" en log
□ Sin ReferenceError de handleImageFile u otros
```
