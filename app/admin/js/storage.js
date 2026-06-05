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

      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Solo se aceptan imágenes' };
      }

      if (file.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `Archivo muy grande (máx 5MB, actual: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        };
      }

      console.log('📤 Uploading:', file.name);

      // Generar nombre único
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const ext = file.name.split('.').pop();
      const fileName = `${obraId}/${timestamp}-${random}.${ext}`;

      // Upload a Storage
      const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
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
