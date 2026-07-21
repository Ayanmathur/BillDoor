-- Add missing discount columns to catalog_items
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT '₹' CHECK (discount_type IN ('₹', '%')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2) NOT NULL DEFAULT 0;
