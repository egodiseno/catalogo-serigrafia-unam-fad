# 💾 Cómo usar DataCache

## Básico

### Guardar en caché

```javascript
DataCache.set('tecnicas', [
  { id: 1, nombre: 'Serigrafía' },
  { id: 2, nombre: 'Litografía' }
]);
```

### Obtener del caché

```javascript
const tecnicas = DataCache.get('tecnicas');
if (tecnicas) {
  console.log('✅ Encontrado en caché:', tecnicas);
} else {
  console.log('📭 No está en caché');
}
```

## Avanzado: getOrFetch

La forma recomendada para simplificar el código:

```javascript
async function loadTecnicas() {
  return await DataCache.getOrFetch(
    'tecnicas',
    async () => {
      const { data, error } = await client
        .from('tecnicas')
        .select()
        .order('nombre');
      
      if (error) throw error;
      return data;
    },
    10 * 60 * 1000  // TTL: 10 minutos
  );
}

// Uso
const tecnicas = await loadTecnicas(); // De DB la 1ª vez
const tecnicas2 = await loadTecnicas(); // Del caché la 2ª vez
```

## Invalidar

Cuando creas un nuevo registro, invalidar el caché:

```javascript
onSave: async (data) => {
  const { error } = await client
    .from('tecnicas')
    .insert([data]);
  
  if (error) throw error;
  
  // Invalidar caché
  DataCache.invalidate('tecnicas');
  
  // Próxima carga será de DB
  await loadTecnicas();
}
```

## Estado del caché

Ver qué hay en el caché:

```javascript
const status = DataCache.getStatus();
console.log(status);

// Output:
// {
//   tecnicas: { isExpired: false, ttlRemaining: 599000, ... },
//   tags: { isExpired: true, ... }
// }
```

## Limpiar todo

```javascript
DataCache.clear(); // Elimina todos los elementos
```

---

**TTLs recomendados:**
- Datos que cambian frecuentemente: 2 minutos
- Datos estáticos: 10-30 minutos
- Datos muy grandes: 1-5 minutos
