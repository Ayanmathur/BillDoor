-- Migration: Add address_url column to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS address_url TEXT DEFAULT '';

COMMENT ON COLUMN clients.address_url IS 'Optional web link (e.g. Google Maps URL) attached to display address when clicked by customer.';
