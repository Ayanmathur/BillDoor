-- ============================================================
-- BillDoor Schema — Migration 00007
-- Phase 1: Foundation — two-layer toggle, public listing flag
-- ============================================================

-- Two-layer toggle: client can hide dashboard tiles admin has granted
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dashboard_tiles_hidden JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Public directory opt-in (used in Phase 5, schema added now to avoid future migration)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS publicly_listed BOOLEAN NOT NULL DEFAULT false;
