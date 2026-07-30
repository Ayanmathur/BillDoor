-- ============================================================
-- Migration 00012: Admin Subscription Hold & Directory Access Toggles
-- ============================================================

-- 1. Pre-revoke subscription hold toggle
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS subscription_hold_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN clients.subscription_hold_enabled IS
  'When true, blocks feature navigation and displays Payment Due / Subscription on Hold screen.';

-- 2. Directory access toggle (also syncable via modules_enabled.directory)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS directory_access_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN clients.directory_access_enabled IS
  'When true, client can access /directory and see the View Client Directory link.';
