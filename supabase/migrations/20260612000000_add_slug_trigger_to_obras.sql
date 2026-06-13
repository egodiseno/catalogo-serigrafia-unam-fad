-- Migration: add slug column + auto-generate trigger to obras
-- Timestamp: 20260612000000

-- ── 1. Agregar columna slug ───────────────────────────────────────────────────
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS slug text;

-- ── 2. Función que genera slug con hash ──────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_obra_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  hash_part text;
BEGIN
  -- Generar slug-base: titulo + "-" + artista
  base_slug := lower(
    concat(
      regexp_replace(NEW.titulo, '[^a-zA-Z0-9 ]+', '', 'g'),
      '-',
      regexp_replace(NEW.artista, '[^a-zA-Z0-9 ]+', '', 'g')
    )
  );

  -- Remover espacios extras
  base_slug := regexp_replace(base_slug, ' +', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');

  -- Truncar a 45 caracteres
  base_slug := substring(base_slug, 1, 45);
  base_slug := rtrim(base_slug, '-');

  -- Generar hash corto (4 primeros caracteres del UUID)
  hash_part := substring(NEW.id::text, 1, 4);

  -- Concatenar: slug-base + "-" + hash (máximo 50 caracteres)
  NEW.slug := substring(concat(base_slug, '-', hash_part), 1, 50);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Trigger en INSERT ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS obras_slug_insert ON obras;
CREATE TRIGGER obras_slug_insert
  BEFORE INSERT ON obras
  FOR EACH ROW
  EXECUTE FUNCTION generate_obra_slug();

-- ── 4. Trigger en UPDATE (solo si cambian titulo o artista) ──────────────────
DROP TRIGGER IF EXISTS obras_slug_update ON obras;
CREATE TRIGGER obras_slug_update
  BEFORE UPDATE ON obras
  FOR EACH ROW
  WHEN (OLD.titulo IS DISTINCT FROM NEW.titulo
     OR OLD.artista IS DISTINCT FROM NEW.artista)
  EXECUTE FUNCTION generate_obra_slug();

-- ── 5. Backfill: generar slug para obras existentes ──────────────────────────
UPDATE obras
SET slug = substring(
  concat(
    rtrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(concat(
              regexp_replace(titulo,  '[^a-zA-Z0-9 ]+', '', 'g'),
              '-',
              regexp_replace(artista, '[^a-zA-Z0-9 ]+', '', 'g')
            )),
            ' +', '-', 'g'),
          '-+', '-', 'g'),
        '^-|-$', '', 'g'),
      '-'),
    '-',
    substring(id::text, 1, 4)
  ), 1, 50)
WHERE slug IS NULL;
