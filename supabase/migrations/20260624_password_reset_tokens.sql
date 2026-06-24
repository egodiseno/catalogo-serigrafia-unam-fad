-- ──────────────────────────────────────────────────────────────────────────
-- Migración: password_reset_tokens
-- Fecha: 2026-06-24
-- Proyecto: Catálogo Digital de Obra Serigráfica — UNAM / FAD
--
-- PROPÓSITO:
--   Almacena tokens de un solo uso para el flujo de recuperación de
--   contraseña self-service. La Edge Function reset-user-password genera
--   un token (UUID v4), lo inserta aquí con expiración de 30 min, y lo
--   marca como usado tras el restablecimiento exitoso.
--
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para búsquedas por token (endpoint /confirm lo usa en cada request)
CREATE INDEX IF NOT EXISTS idx_prt_token
  ON password_reset_tokens (token)
  WHERE used = false;

-- Habilitar RLS — sin políticas públicas: solo el service_role client accede
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Limpieza opcional: eliminar tokens expirados + usados con más de 24h de antigüedad.
-- Si tienes pg_cron habilitado, descomentar y programar:
-- SELECT cron.schedule('cleanup-password-reset-tokens', '0 */6 * * *', $$
--   DELETE FROM password_reset_tokens
--   WHERE (used = true OR expires_at < now()) AND created_at < now() - INTERVAL '24 hours';
-- $$);
