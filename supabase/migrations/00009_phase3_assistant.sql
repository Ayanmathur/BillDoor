-- ============================================================
-- BillDoor Schema — Migration 00009
-- Phase 3: AI Assistant — query logging table
-- ============================================================

CREATE TABLE IF NOT EXISTS assistant_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  query TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  tools_used TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aq_client_id ON assistant_queries(client_id);

ALTER TABLE assistant_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client can view own assistant queries" ON assistant_queries;
CREATE POLICY "Client can view own assistant queries"
  ON assistant_queries FOR SELECT
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Client can insert own assistant queries" ON assistant_queries;
CREATE POLICY "Client can insert own assistant queries"
  ON assistant_queries FOR INSERT
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admin can manage all assistant queries" ON assistant_queries;
CREATE POLICY "Admin can manage all assistant queries"
  ON assistant_queries FOR ALL
  USING (public.is_admin());
