-- ============================================================
-- BillDoor Core Schema — Migration 00002
-- Add social links (LinkedIn, X, WhatsApp) to clients
-- ============================================================

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS x_url TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
