# ✅ Cómo usar Validators

## Básico: Validar Técnica

```javascript
try {
  Validators.validateTecnica({
    nombre: 'Serigrafía',
    descripcion: 'Técnica de impresión'
  });
  console.log('✅ Datos válidos');
} catch (error) {
  ErrorHandler.showToast(error.message, 'error');
}
```

## En un CRUD

```javascript
onSave: async (data) => {
  try {
    // Validar
    Validators.validateTecnica(data);

    // Guardar en DB
    const { error } = await client
      .from('tecnicas')
      .insert([data]);

    if (error) throw error;

    ErrorHandler.showToast('✅ Técnica creada', 'success');
    DataCache.invalidate('tecnicas');
  } catch (error) {
    ErrorHandler.handle(error, 'CreateTecnica');
  }
}
```

## Validadores disponibles

### Genéricos

```javascript
Validators.validateName(name, fieldName, minLen, maxLen)
Validators.validateEmail(email)
Validators.validateSlug(slug)
Validators.validateDescription(text, fieldName, maxLen)
```

### Específicos

```javascript
Validators.validateTecnica(data)
Validators.validateTag(data)
Validators.validateUser(data)
Validators.validateObra(data)
```

### Utilidades

```javascript
// Sanitizar HTML (prevenir XSS)
const safe = Validators.sanitizeHTML(userInput);

// Validar y sanitizar en uno
const data = Validators.validateAndSanitize(
  formData,
  Validators.validateTecnica
);
```

---

**Nota:** Los validadores lanzan `Error` si algo está mal.  
Usa `try/catch` para capturar y mostrar al usuario.
