-- ============================================================
-- CATÁLOGO OBRA SERIGRÁFICA — FASE 0
-- Schema inicial · Supabase / PostgreSQL
-- ============================================================

-- ------------------------------------------------------------
-- 0. Extensión UUID (ya activa en Supabase, por si acaso)
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TÉCNICAS
-- (se crea antes que obras, que la referencia)
-- ============================================================
CREATE TABLE IF NOT EXISTS tecnicas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  slug        text        NOT NULL,
  descripcion text,

  CONSTRAINT tecnicas_nombre_unique UNIQUE (nombre),
  CONSTRAINT tecnicas_slug_unique   UNIQUE (slug),
  CONSTRAINT tecnicas_slug_format   CHECK  (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- ============================================================
-- 2. OBRAS
-- ============================================================
CREATE TABLE IF NOT EXISTS obras (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text        NOT NULL,
  artista     text        NOT NULL,
  año         smallint    CHECK (año BETWEEN 1800 AND 2100),
  tecnica_id  uuid        REFERENCES tecnicas(id) ON DELETE SET NULL,
  descripcion text,
  estado      text        NOT NULL DEFAULT 'borrador',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT obras_estado_values CHECK (estado IN ('borrador', 'publicado', 'archivado'))
);

-- Índices de obras
CREATE INDEX IF NOT EXISTS idx_obras_tecnica_id ON obras (tecnica_id);
CREATE INDEX IF NOT EXISTS idx_obras_estado     ON obras (estado);
CREATE INDEX IF NOT EXISTS idx_obras_año        ON obras (año);
CREATE INDEX IF NOT EXISTS idx_obras_artista    ON obras (artista);
CREATE INDEX IF NOT EXISTS idx_obras_created_at ON obras (created_at DESC);

-- ============================================================
-- 3. TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug   text NOT NULL,

  CONSTRAINT tags_nombre_unique UNIQUE (nombre),
  CONSTRAINT tags_slug_unique   UNIQUE (slug),
  CONSTRAINT tags_slug_format   CHECK  (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- ============================================================
-- 4. OBRA_TAGS  (relación N:M)
-- ============================================================
CREATE TABLE IF NOT EXISTS obra_tags (
  obra_id uuid NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,

  PRIMARY KEY (obra_id, tag_id)
);

-- Índice inverso para "todas las obras con este tag"
CREATE INDEX IF NOT EXISTS idx_obra_tags_tag_id ON obra_tags (tag_id);

-- ============================================================
-- 5. IMÁGENES
-- ============================================================
CREATE TABLE IF NOT EXISTS imagenes (
  id           uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id      uuid     NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  url_storage  text     NOT NULL,
  principal    boolean  NOT NULL DEFAULT false,
  orden        smallint NOT NULL DEFAULT 0,

  CONSTRAINT imagenes_orden_non_negative CHECK (orden >= 0)
);

-- Índices de imágenes
CREATE INDEX IF NOT EXISTS idx_imagenes_obra_id           ON imagenes (obra_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_obra_principal    ON imagenes (obra_id, principal);
CREATE INDEX IF NOT EXISTS idx_imagenes_obra_orden        ON imagenes (obra_id, orden);

-- Solo una imagen principal por obra
CREATE UNIQUE INDEX IF NOT EXISTS uq_imagenes_obra_principal
  ON imagenes (obra_id)
  WHERE principal = true;

-- ============================================================
-- 6. USUARIOS_ADMIN
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios_admin (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  rol        text        NOT NULL DEFAULT 'editor',
  estado     text        NOT NULL DEFAULT 'activo',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usuarios_admin_email_unique UNIQUE (email),
  CONSTRAINT usuarios_admin_email_format CHECK  (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT usuarios_admin_rol_values   CHECK  (rol    IN ('admin', 'editor', 'viewer')),
  CONSTRAINT usuarios_admin_estado_values CHECK (estado IN ('activo', 'inactivo'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_admin_email  ON usuarios_admin (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_admin_rol    ON usuarios_admin (rol);

-- ============================================================
-- 7. TRIGGER: updated_at automático en o

-- ============================================================
-- 7. TRIGGER: updated_at automático en obras
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_obras_updated_at
  BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FIN — FASE 0 creada correctamente
-- ============================================================