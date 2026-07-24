-- ============================================================
-- BillDoor Schema — Migration 00006
-- Billit multi-template support + auto-select toggle
-- ============================================================

-- 1. New table: whatsapp_bill_templates (Billit-specific, separate from whatsapp_templates)
CREATE TABLE IF NOT EXISTS whatsapp_bill_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_default_first_visit BOOLEAN NOT NULL DEFAULT false,
  is_default_repeat_visit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wbt_client_id ON whatsapp_bill_templates(client_id);

ALTER TABLE whatsapp_bill_templates ENABLE ROW LEVEL SECURITY;

-- RLS: identical pattern to every other tenant table
CREATE POLICY "Client can manage own bill templates"
  ON whatsapp_bill_templates FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all bill templates"
  ON whatsapp_bill_templates FOR ALL
  USING (public.is_admin());

-- updated_at trigger (reuses existing function)
CREATE TRIGGER trg_whatsapp_bill_templates_updated
  BEFORE UPDATE ON whatsapp_bill_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Auto-select toggle on clients table (default false — no behavior change for existing clients)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billit_auto_select_template BOOLEAN NOT NULL DEFAULT false;
