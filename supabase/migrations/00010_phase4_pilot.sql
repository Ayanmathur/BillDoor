-- ============================================================
-- BillDoor Schema — Migration 00010
-- Phase 4: Pilot Feedback — table reservations, menu import staging
-- ============================================================

-- 1. Table reservations: make resources optionally bookable online
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS bookable_online BOOLEAN NOT NULL DEFAULT true;

-- 2. Menu import staging table
CREATE TABLE IF NOT EXISTS catalog_import_staging (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  source_image_url TEXT,
  extracted_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'committed', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cis_client_id ON catalog_import_staging(client_id);

ALTER TABLE catalog_import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own import staging"
  ON catalog_import_staging FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all import staging"
  ON catalog_import_staging FOR ALL
  USING (public.is_admin());
