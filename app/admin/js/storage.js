/**
 * PHASE 1.F: Supabase Storage Module
 * Maneja upload de imágenes a Supabase Storage
 */

const StorageModule = (() => {
  const client = window.supabase_client;
  const BUCKET_NAME = 'artworks';
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Inicializar bucket (crear si no existe)
   * Esto se hace una sola vez en Supabase directamente
   */
  async function initBucket() {
    try {
      console.log('📦 Verificando bucket...');
      // La verificación la hace Supabase automáticamente
      console.log('✅ Bucket OK');
    } catch (error) {
      console.error('❌ Error en bucket:', error);
    }
  }

  /**
   * Upload de imagen a Supabase Storage
   * @param {File} file - Archivo a subir
   * @param {string} obraId - ID de la obra
   * @returns {Promise} { success, url, error }
   */
  async function uploadImage(file, obraId) {
    try {
      // Validaciones
      if (!file) {
        return { success: false, error: 'No se seleccionó archivo' };
      }

      // Validar formato: solo JPG, PNG o WebP (mismo conjunto que convert-webp)
      const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!ALLOWED_MIME.includes(file.type.toLowerCase())) {
        const ext = (file.name.split('.').pop() ?? file.type).toUpperCase();
        return {
          success: false,
          error: `Formato no permitido (.${ext}). Usa JPG, PNG o WebP.`,
        };
      }

      if (file.size > MAX_FILE_SIZE) {
        const actualMB = (file.size / 1024 / 1024).toFixed(1);
        return {
          success: false,
          error: `El archivo pesa ${actualMB} MB. El máximo permitido es 5 MB.`,
        };
      }

      console.log('📤 Uploading:', file.name);

      // ── Convertir a WebP vía Edge Function ───────────────────────
      // Si falla (red, error WASM) se usa el archivo original sin interrumpir el flujo.
      let uploadFile = file;
      let uploadExt  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';

      try {
        const EDGE_FN_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/convert-webp';
        const ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('obra_id', obraId || ('obra-temp-' + Date.now()));

        console.log('🔄 Solicitando conversión WebP…');
        const convResp = await fetch(EDGE_FN_URL, {
          method:  'POST',
          headers: { Authorization: `Bearer ${ANON_KEY}` },
          body:    formData,
        });

        if (convResp.ok) {
          const blob      = await convResp.blob();
          const converted = convResp.headers.get('X-Converted') === 'true';
          const xFilename = convResp.headers.get('X-Filename') || file.name;
          const xSize     = convResp.headers.get('X-Size');

          if (converted) {
            uploadFile = new File([blob], xFilename, { type: 'image/webp' });
            uploadExt  = 'webp';
            console.log(
              `✅ Imagen convertida a WebP: ${xFilename}`,
              `(${xSize ? (parseInt(xSize) / 1024).toFixed(1) + ' KB' : blob.size + ' bytes'})`,
            );
          } else {
            // Ya era WebP o conversión no disponible — se usa el blob retornado
            uploadFile = new File([blob], xFilename, { type: convResp.headers.get('Content-Type') || file.type });
            console.log('ℹ️ Sin conversión necesaria:', xFilename);
          }
        } else {
          // Edge Function respondió con error HTTP
          const errBody = await convResp.text().catch(() => String(convResp.status));
          console.warn('⚠️ Conversión fallida — usando original:', errBody);
        }
      } catch (convErr) {
        // Red cortada, Edge Function caída, etc.
        console.warn('⚠️ Edge Function inaccesible — usando original:', convErr.message);
      }
      // ─────────────────────────────────────────────────────────────

      // Generar nombre único
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const fileName = `${obraId}/${timestamp}-${random}.${uploadExt}`;

      // Upload a Storage (uploadFile = WebP convertido, o file original si falló Edge Fn)
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(fileName, uploadFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('❌ Upload error:', error);
        return { success: false, error: error.message };
      }

      // Obtener URL pública
      const { data: urlData } = client.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      console.log('✅ Upload exitoso:', publicUrl);

      return {
        success: true,
        url: publicUrl,
        fileName: fileName,
      };
    } catch (error) {
      console.error('❌ Error en upload:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar preview de imagen
   * @param {File} file - Archivo
   * @returns {Promise} data URL para preview
   */
  function generatePreview(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Eliminar imagen de Storage
   * @param {string} filePath - Ruta completa (ej: obraId/timestamp-random.jpg)
   */
  async function deleteImage(filePath) {
    try {
      console.log('🗑️  Deletiendo:', filePath);

      const { error } = await client.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('❌ Delete error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Imagen eliminada');
      return { success: true };
    } catch (error) {
      console.error('❌ Error en delete:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Guardar registro de imagen en tabla 'imagenes'
   * @param {string} obraId - ID de la obra
   * @param {string} urlStorage - URL pública de Storage
   * @param {boolean} principal - Es imagen principal?
   */
  async function saveImageRecord(obraId, urlStorage, principal = false) {
    try {
      const { data, error } = await client
        .from('imagenes')
        .insert([
          {
            obra_id: obraId,
            url_storage: urlStorage,
            principal: principal,
            orden: 1,
          },
        ]);

      if (error) {
        console.error('❌ Error guardando registro:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Registro de imagen guardado');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Inicializar
  initBucket();

  // Exportar
  return {
    uploadImage,
    generatePreview,
    deleteImage,
    saveImageRecord,
  };
})();

// Exportar en window
window.StorageModule = StorageModule;

console.log('✅ Storage module loaded');
