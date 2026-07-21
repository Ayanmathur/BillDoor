-- Add missing bill_settings column to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS bill_settings JSONB NOT NULL DEFAULT '{"default_gst": 0, "default_discount_type": "₹", "default_discount_value": 0}'::jsonb;
