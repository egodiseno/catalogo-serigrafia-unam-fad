/**
 * Data Cache Module
 * Caché en memoria con TTL (Time To Live)
 */

const DataCache = (() => {
  const cache = {};
  const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Guardar en caché con TTL
   */
  function set(key, value, ttl = DEFAULT_TTL) {
    if (!key) {
      console.error('❌ Cache: key requerida');
      return false;
    }

    cache[key] = {
      value,
      expires: Date.now() + ttl,
      createdAt: new Date().toISOString()
    };

    console.log(`💾 Cache SET: ${key} (TTL: ${ttl}ms)`);
    return true;
  }

  /**
   * Obtener del caché
   */
  function get(key) {
    if (!cache[key]) {
      console.log(`📭 Cache MISS: ${key} (no existe)`);
      return null;
    }

    const item = cache[key];

    // Verificar si expiró
    if (Date.now() > item.expires) {
      console.log(`⏰ Cache EXPIRED: ${key}`);
      delete cache[key];
      return null;
    }

    console.log(`✅ Cache HIT: ${key}`);
    return item.value;
  }

  /**
   * Invalidar caché
   */
  function invalidate(key) {
    if (cache[key]) {
      delete cache[key];
      console.log(`🔄 Cache INVALIDATED: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Limpiar todo caché
   */
  function clear() {
    const count = Object.keys(cache).length;
    Object.keys(cache).forEach(key => delete cache[key]);
    console.log(`🧹 Cache CLEARED: ${count} items`);
  }

  /**
   * Obtener estado del caché
   */
  function getStatus() {
    const status = {};
    
    for (const [key, item] of Object.entries(cache)) {
      const isExpired = Date.now() > item.expires;
      const ttlRemaining = item.expires - Date.now();
      
      status[key] = {
        isExpired,
        ttlRemaining,
        createdAt: item.createdAt,
        size: JSON.stringify(item.value).length
      };
    }

    return status;
  }

  /**
   * Función helper: obtener del caché o cargar
   */
  async function getOrFetch(key, fetchFn, ttl = DEFAULT_TTL) {
    // Intentar del caché
    let value = get(key);
    
    if (value !== null) {
      return value;
    }

    // Si no está en caché, fetchear
    console.log(`📥 Cache FETCH: ${key}`);
    
    try {
      value = await fetchFn();
      set(key, value, ttl);
      return value;
    } catch (error) {
      console.error(`❌ Cache FETCH ERROR: ${key}`, error);
      throw error;
    }
  }

  return { 
    set, 
    get, 
    invalidate, 
    clear, 
    getStatus,
    getOrFetch
  };
})();

window.DataCache = DataCache;
console.log('✅ DataCache loaded');
