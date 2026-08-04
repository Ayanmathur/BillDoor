-- Migration: Add framed_card_enabled to clients table
-- Date: 2026-08-04
-- Author: Orbitex Engineering

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS framed_card_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.clients.framed_card_enabled IS 'Admin toggle granting client permission to enable framed wood style on digital business card';
