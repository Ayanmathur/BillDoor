-- ============================================================
-- BillDoor Schema — Migration 00008
-- Phase 2: Financial — expenses table, HSN/SAC code
-- ============================================================

-- 1. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  note TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_client_id ON expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(client_id, expense_date);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client can manage own expenses" ON expenses;
CREATE POLICY "Client can manage own expenses"
  ON expenses FOR ALL
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admin can manage all expenses" ON expenses;
CREATE POLICY "Admin can manage all expenses"
  ON expenses FOR ALL
  USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_expenses_updated ON expenses;
CREATE TRIGGER trg_expenses_updated
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. HSN/SAC code on catalog_items
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT;
