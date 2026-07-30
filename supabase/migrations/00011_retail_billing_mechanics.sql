-- ============================================================
-- Migration 00011: Retail Billing Mechanics
-- Inclusive GST mode, CGST/SGST split, MRP savings, Round-off,
-- Payment method tracking. All additive, backward-compatible.
-- ============================================================

-- 1. Client-level GST calculation mode (proper column, not JSONB —
--    this affects real tax math, not a UI preference)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gst_calculation_mode TEXT NOT NULL DEFAULT 'exclusive'
  CHECK (gst_calculation_mode IN ('exclusive', 'inclusive'));

COMMENT ON COLUMN clients.gst_calculation_mode IS
  'exclusive = price + GST on top (cafes/services). inclusive = price already contains GST, tax extracted backward (retail/FMCG).';

-- 2. MRP on catalog items (nullable — only populated when enabled)
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2);

COMMENT ON COLUMN catalog_items.mrp IS
  'Legal Maximum Retail Price. Nullable. When set and > price, enables the Customer Savings Badge on bills. Independent of discount_type/discount_value.';

-- 3. Bill-level additions
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_mrp_savings NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_calculation_mode TEXT NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash','upi','credit_card','debit_card','other'));

COMMENT ON COLUMN bills.round_off_amount IS
  'Signed rounding adjustment to nearest whole rupee. Can be +/- 0.50 max.';
COMMENT ON COLUMN bills.total_mrp_savings IS
  'Frozen sum of (mrp - price) * qty across all line items where mrp > price. Stored at creation time so it survives catalog MRP changes.';
COMMENT ON COLUMN bills.gst_calculation_mode IS
  'Snapshot of client gst_calculation_mode at bill creation time. Ensures historical bills render correctly if client switches modes later.';

-- 4. Index for payment analytics
CREATE INDEX IF NOT EXISTS idx_bills_payment_method ON bills (client_id, payment_method)
  WHERE payment_method IS NOT NULL;
