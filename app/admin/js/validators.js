/**
 * Validators Module
 * Validación centralizada de datos
 */

const Validators = (() => {
  /**
   * Validar nombre (genérico)
   */
  function validateName(name, fieldName = 'Nombre', minLength = 2, maxLength = 100) {
    if (!name || typeof name !== 'string') {
      throw new Error(`${fieldName} debe ser un texto válido`);
    }

    const trimmed = name.trim();

    if (trimmed.length < minLength) {
      throw new Error(`${fieldName} debe tener mínimo ${minLength} caracteres`);
    }

    if (trimmed.length > maxLength) {
      throw new Error(`${fieldName} máximo ${maxLength} caracteres`);
    }

    return true;
  }

  /**
   * Validar email
   */
  function validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Email debe ser un texto válido');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      throw new Error('Email inválido');
    }

    return true;
  }

  /**
   * Validar slug
   */
  function validateSlug(slug) {
    if (!slug || typeof slug !== 'string') {
      throw new Error('Slug debe ser un texto válido');
    }

    const slugRegex = /^[a-z0-9-]+$/;

    if (!slugRegex.test(slug)) {
      throw new Error('Slug solo puede contener letras minúsculas, números y guiones');
    }

    if (slug.length < 2 || slug.length > 100) {
      throw new Error('Slug debe tener entre 2 y 100 caracteres');
    }

    return true;
  }

  /**
   * Validar descripción (texto largo)
   */
  function validateDescription(description, fieldName = 'Descripción', maxLength = 1000) {
    if (typeof description !== 'string') {
      throw new Error(`${fieldName} debe ser un texto válido`);
    }

    if (description.length > maxLength) {
      throw new Error(`${fieldName} máximo ${maxLength} caracteres`);
    }

    return true;
  }

  /**
   * Validar Técnica
   */
  function validateTecnica(data) {
    if (!data) {
      throw new Error('Datos requeridos');
    }

    // Nombre
    validateName(data.nombre, 'Nombre', 2, 100);

    // Descripción (opcional)
    if (data.descripcion) {
      validateDescription(data.descripcion, 'Descripción', 1000);
    }

    return true;
  }

  /**
   * Validar Tag
   */
  function validateTag(data) {
    if (!data) {
      throw new Error('Datos requeridos');
    }

    // Nombre
    validateName(data.nombre, 'Nombre', 2, 50);

    // Slug (requerido)
    if (!data.slug) {
      throw new Error('Slug es requerido');
    }

    validateSlug(data.slug);

    return true;
  }

  /**
   * Validar Usuario
   */
  function validateUser(data) {
    if (!data) {
      throw new Error('Datos requeridos');
    }

    // Email
    validateEmail(data.email);

    // Rol (debe ser uno de estos)
    const validRoles = ['admin', 'editor', 'viewer'];
    if (!data.rol || !validRoles.includes(data.rol)) {
      throw new Error(`Rol debe ser: ${validRoles.join(', ')}`);
    }

    return true;
  }

  /**
   * Validar Obra (básico)
   */
  function validateObra(data) {
    if (!data) {
      throw new Error('Datos requeridos');
    }

    // Título
    validateName(data.titulo, 'Título', 3, 200);

    // Artista
    validateName(data.artista, 'Artista', 2, 100);

    // Año (debe ser número entre 1900 y próximo año)
    const year = parseInt(data.año);
    const currentYear = new Date().getFullYear();

    if (isNaN(year) || year < 1900 || year > currentYear + 1) {
      throw new Error(`Año debe estar entre 1900 y ${currentYear}`);
    }

    // Descripción (opcional)
    if (data.descripcion) {
      validateDescription(data.descripcion, 'Descripción', 5000);
    }

    return true;
  }

  /**
   * Sanitizar HTML (prevenir XSS)
   */
  function sanitizeHTML(html) {
    if (typeof html !== 'string') {
      return '';
    }

    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Validar y sanitizar en un paso
   */
  function validateAndSanitize(data, validator) {
    // Primero validar
    validator(data);

    // Luego sanitizar strings
    const sanitized = { ...data };
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeHTML(value);
      }
    }

    return sanitized;
  }

  return {
    validateName,
    validateEmail,
    validateSlug,
    validateDescription,
    validateTecnica,
    validateTag,
    validateUser,
    validateObra,
    sanitizeHTML,
    validateAndSanitize
  };
})();

window.Validators = Validators;
console.log('✅ Validators loaded');
