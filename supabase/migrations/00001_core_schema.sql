-- ============================================================
-- BillDoor Core Schema — Migration 00001
-- All tables from §1 of the implementation plan
-- UUID PKs, snake_case, soft-delete
-- RLS enabled inline with every table (§3.1 — no deferred RLS)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- RLS Helper Functions (must exist before policies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_client_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE id = (select auth.uid())
  AND deleted_at IS NULL
  LIMIT 1;
  
  RETURN v_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = (select auth.uid())
  );
END;
$$;

-- ============================================================
-- 1. platform_settings (singleton row)
-- ============================================================
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_whatsapp_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX platform_settings_singleton ON platform_settings ((true));
INSERT INTO platform_settings (admin_whatsapp_number) VALUES ('');

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read platform settings"
  ON platform_settings FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can update platform settings"
  ON platform_settings FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- 2. admin_users
-- ============================================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read own record"
  ON admin_users FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Admin can update own record"
  ON admin_users FOR UPDATE
  USING ((select auth.uid()) = id);

-- ============================================================
-- 3. license_keys
-- ============================================================
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash TEXT NOT NULL UNIQUE,
  mobile_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'activated')),
  client_id UUID, -- nullable until activated
  business_name TEXT,
  slug TEXT,
  google_place_id TEXT,
  about TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all license keys"
  ON license_keys FOR ALL
  USING (public.is_admin());

CREATE POLICY "Client can read own license key"
  ON license_keys FOR SELECT
  USING (client_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_license_keys_client_id ON license_keys(client_id);

-- ============================================================
-- 4. clients
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  business_type TEXT NOT NULL DEFAULT '',
  google_place_id TEXT,
  about TEXT DEFAULT '',
  license_key_id UUID NOT NULL REFERENCES license_keys(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_till TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  modules_enabled JSONB NOT NULL DEFAULT '{"review_flow": false, "billit": false, "appointer": false, "whatsapp_auto": false}'::jsonb,
  has_gst BOOLEAN NOT NULL DEFAULT false,
  gst_number TEXT,
  bill_settings JSONB NOT NULL DEFAULT '{"default_gst": 0, "default_discount_type": "₹", "default_discount_value": 0}'::jsonb,
  owner_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  logo_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  website_url TEXT,
  show_barcode_on_bill BOOLEAN NOT NULL DEFAULT false,
  reward_settings JSONB NOT NULL DEFAULT '{
    "triggers": {
      "feedback": false,
      "bill_created": false,
      "appointment_completed": false
    },
    "reward_type": "percent_discount",
    "reward_value": 10,
    "review_reward_mode": "all_feedback",
    "max_per_customer_per_day": 1
  }'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE license_keys
  ADD CONSTRAINT fk_license_keys_client
  FOREIGN KEY (client_id) REFERENCES clients(id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own record"
  ON clients FOR SELECT
  USING (id = (select auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Client can update own record"
  ON clients FOR UPDATE
  USING (id = (select auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Admin can manage all clients"
  ON clients FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 5. customers (shared across Billit, Appointer, Review Flow)
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  opted_in BOOLEAN NOT NULL DEFAULT false,
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, phone)
);

CREATE INDEX idx_customers_client_id ON customers(client_id);
CREATE INDEX idx_customers_phone ON customers(client_id, phone);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own customers"
  ON customers FOR SELECT
  USING (client_id = (select auth.uid()));

CREATE POLICY "Client can insert own customers"
  ON customers FOR INSERT
  WITH CHECK (client_id = (select auth.uid()));

CREATE POLICY "Client can update own customers"
  ON customers FOR UPDATE
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all customers"
  ON customers FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 6. resources (Appointer — solo or multi-resource)
-- ============================================================
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_client_id ON resources(client_id);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own resources"
  ON resources FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all resources"
  ON resources FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 7. catalog_items (unified products + services)
-- ============================================================
CREATE TABLE catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('product', 'service')),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'unit',
  default_gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT '₹' CHECK (discount_type IN ('₹', '%')),
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_resource_id UUID REFERENCES resources(id),
  default_duration_min INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_items_client_id ON catalog_items(client_id);
CREATE INDEX idx_catalog_items_search ON catalog_items(client_id, name);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own catalog items"
  ON catalog_items FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all catalog items"
  ON catalog_items FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 8. bills
-- ============================================================
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  bill_number TEXT NOT NULL,
  bill_slug TEXT NOT NULL UNIQUE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
  sent_via TEXT DEFAULT 'none' CHECK (sent_via IN ('auto', 'manual', 'none')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bills_client_id ON bills(client_id);
CREATE INDEX idx_bills_customer_id ON bills(customer_id);
CREATE INDEX idx_bills_slug ON bills(bill_slug);
CREATE UNIQUE INDEX idx_bills_number ON bills(client_id, bill_number);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own bills"
  ON bills FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all bills"
  ON bills FOR ALL
  USING (public.is_admin());

-- Public read for digital bill page (via bill_slug, no auth required)
CREATE POLICY "Public can read bill by slug"
  ON bills FOR SELECT
  USING (true);

-- ============================================================
-- 9. Bill number sequence function (per-client, per-day)
-- ============================================================
CREATE TABLE bill_sequences (
  client_id UUID NOT NULL REFERENCES clients(id),
  bill_date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, bill_date)
);

ALTER TABLE bill_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own sequences"
  ON bill_sequences FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all sequences"
  ON bill_sequences FOR ALL
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION next_bill_number(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_seq INTEGER;
BEGIN
  INSERT INTO bill_sequences (client_id, bill_date, last_number)
  VALUES (p_client_id, v_today, 1)
  ON CONFLICT (client_id, bill_date)
  DO UPDATE SET last_number = bill_sequences.last_number + 1
  RETURNING last_number INTO v_seq;

  RETURN 'BILL-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- ============================================================
-- 10. payments (v1, minimal)
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID NOT NULL REFERENCES bills(id),
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'card')),
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_bill_id ON payments(bill_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own payments"
  ON payments FOR ALL
  USING (
    bill_id IN (
      SELECT id FROM public.bills WHERE client_id = (select auth.uid())
    )
  );

CREATE POLICY "Admin can manage all payments"
  ON payments FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 11. review_sessions
-- ============================================================
CREATE TABLE review_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  bill_id UUID REFERENCES bills(id),
  source TEXT NOT NULL CHECK (source IN ('qr', 'bill_page')),
  stars INTEGER CHECK (stars >= 1 AND stars <= 5),
  reward_issued BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_sessions_client_id ON review_sessions(client_id);

ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own review sessions"
  ON review_sessions FOR SELECT
  USING (client_id = (select auth.uid()));

CREATE POLICY "Public can insert review sessions"
  ON review_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can manage all review sessions"
  ON review_sessions FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 12. google_review_events
-- ============================================================
CREATE TABLE google_review_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_session_id UUID NOT NULL REFERENCES review_sessions(id),
  event TEXT NOT NULL CHECK (event IN ('redirected', 'copied', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_review_events_session ON google_review_events(review_session_id);

ALTER TABLE google_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert google review events"
  ON google_review_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Client can read own google review events"
  ON google_review_events FOR SELECT
  USING (
    review_session_id IN (
      SELECT id FROM public.review_sessions WHERE client_id = (select auth.uid())
    )
  );

CREATE POLICY "Admin can manage all google review events"
  ON google_review_events FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 13. reviews
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  bill_id UUID REFERENCES bills(id),
  customer_id UUID REFERENCES customers(id),
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  feedback_text TEXT,
  ai_review_text TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_client_id ON reviews(client_id);
CREATE INDEX idx_reviews_client_unread ON reviews(client_id) WHERE read = false;
CREATE INDEX idx_reviews_bill_id ON reviews(client_id, bill_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own reviews"
  ON reviews FOR SELECT
  USING (client_id = (select auth.uid()));

CREATE POLICY "Client can update own reviews"
  ON reviews FOR UPDATE
  USING (client_id = (select auth.uid()));

CREATE POLICY "Public can insert reviews"
  ON reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can manage all reviews"
  ON reviews FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 14. reward_codes
-- ============================================================
CREATE TABLE reward_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  customer_id UUID REFERENCES customers(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('feedback', 'bill_created', 'appointment_completed', 'review_reward', 'loyalty_milestone')),
  source_id UUID,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent_discount', 'flat_discount', 'free_item')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  reward_catalog_item_id UUID REFERENCES catalog_items(id),
  redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  redeemed_bill_id UUID REFERENCES bills(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_codes_client_id ON reward_codes(client_id);
CREATE INDEX idx_reward_codes_code ON reward_codes(code);

ALTER TABLE reward_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own reward codes"
  ON reward_codes FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Public can read reward code by code value"
  ON reward_codes FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage all reward codes"
  ON reward_codes FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 15. appointments
-- ============================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  resource_id UUID NOT NULL REFERENCES resources(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  estimated_duration_min INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'walkin', 'completed', 'no_show', 'cancelled')),
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_5_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  service_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_resource_day ON appointments(resource_id, slot_start);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own appointments"
  ON appointments FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all appointments"
  ON appointments FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 16. notifications (global bell icon)
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL CHECK (type IN (
    'bill_sent', 'bill_failed',
    'appointment_booked', 'appointment_reminder',
    'appointment_no_show', 'appointment_completed',
    'feedback_received',
    'orbitex_update',
    'subscription_due',
    'whatsapp_disconnected'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_client_id ON notifications(client_id);
CREATE INDEX idx_notifications_unread ON notifications(client_id) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own notifications"
  ON notifications FOR SELECT
  USING (client_id = (select auth.uid()));

CREATE POLICY "Client can update own notifications"
  ON notifications FOR UPDATE
  USING (client_id = (select auth.uid()));

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can manage all notifications"
  ON notifications FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 17. service_requests (Orbitex Services tracker)
-- ============================================================
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  service_type TEXT NOT NULL CHECK (service_type IN ('website', 'seo', 'ads', 'branding', 'support')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'in_progress', 'done')),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_requests_client_id ON service_requests(client_id);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own service requests"
  ON service_requests FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all service requests"
  ON service_requests FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 18. whatsapp_templates
-- ============================================================
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL CHECK (type IN ('billit', 'appointer_reminder', 'broadcast')),
  name TEXT NOT NULL DEFAULT 'Default',
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_templates_client_id ON whatsapp_templates(client_id);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own templates"
  ON whatsapp_templates FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all templates"
  ON whatsapp_templates FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 19. whatsapp_config
-- ============================================================
CREATE TABLE whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) UNIQUE,
  api_credentials_encrypted TEXT,
  connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
  quality_rating TEXT DEFAULT 'unknown',
  automation_enabled BOOLEAN NOT NULL DEFAULT false,
  monthly_message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own whatsapp config"
  ON whatsapp_config FOR SELECT
  USING (client_id = (select auth.uid()));

CREATE POLICY "Client can update own whatsapp config"
  ON whatsapp_config FOR UPDATE
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all whatsapp config"
  ON whatsapp_config FOR ALL
  USING (public.is_admin());

CREATE POLICY "Client can insert own whatsapp config"
  ON whatsapp_config FOR INSERT
  WITH CHECK (client_id = (select auth.uid()));

-- ============================================================
-- 20. broadcast_campaigns
-- ============================================================
CREATE TABLE broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  template_id UUID NOT NULL REFERENCES whatsapp_templates(id),
  audience_filter JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_campaigns_client_id ON broadcast_campaigns(client_id);

ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own campaigns"
  ON broadcast_campaigns FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all campaigns"
  ON broadcast_campaigns FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 20b. broadcast_recipients (per-recipient delivery tracking)
-- ============================================================
CREATE TABLE broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id);

ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can read own broadcast recipients"
  ON broadcast_recipients FOR SELECT
  USING (campaign_id IN (
    SELECT id FROM broadcast_campaigns WHERE client_id = (select auth.uid())
  ));

CREATE POLICY "Admin can manage all broadcast recipients"
  ON broadcast_recipients FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 21. audit_log
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'client', 'system')),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_audit_log_ip ON audit_log(ip_address);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read all audit logs"
  ON audit_log FOR SELECT
  USING (public.is_admin());

CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 22. inquiries (pre-license-key leads)
-- ============================================================
CREATE TABLE inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'dismissed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all inquiries"
  ON inquiries FOR ALL
  USING (public.is_admin());

CREATE POLICY "System can insert inquiries"
  ON inquiries FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_created ON inquiries(created_at DESC);

-- ============================================================
-- Barcode fields (§4) on clients and catalog_items
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS barcode_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS barcode_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS barcode_value TEXT;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS barcode_format TEXT NOT NULL DEFAULT 'code128';
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS barcode_auto_generated BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_barcode
  ON catalog_items(client_id, barcode_value)
  WHERE barcode_value IS NOT NULL;

-- ============================================================
-- Loyalty system (Track 2)
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_config jsonb DEFAULT NULL;

CREATE TABLE IF NOT EXISTS customer_loyalty_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  current_count int NOT NULL DEFAULT 0,
  cycle_started_at timestamptz NOT NULL DEFAULT now(),
  last_reward_code_id uuid REFERENCES reward_codes(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, customer_id)
);

ALTER TABLE customer_loyalty_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_own_loyalty_select" ON customer_loyalty_progress
  FOR SELECT USING ((select auth.uid()) = client_id);

CREATE POLICY "client_own_loyalty_insert" ON customer_loyalty_progress
  FOR INSERT WITH CHECK ((select auth.uid()) = client_id);

CREATE POLICY "client_own_loyalty_update" ON customer_loyalty_progress
  FOR UPDATE USING ((select auth.uid()) = client_id);

CREATE INDEX idx_loyalty_progress_client_id ON customer_loyalty_progress(client_id);
CREATE INDEX idx_loyalty_progress_client_customer ON customer_loyalty_progress(client_id, customer_id);

-- ============================================================
-- license_keys.key_encrypted (admin can unmask/resend)
-- ============================================================
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS key_encrypted TEXT;

-- ============================================================
-- Default WhatsApp templates function (called on client activation)
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_templates(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO whatsapp_templates (client_id, type, name, content) VALUES
    (p_client_id, 'billit', 'Default Bill', 'Dear {customer_name}, thanks for shopping at {shop_name}! Your digital bill: {bill_link}'),
    (p_client_id, 'appointer_reminder', 'Default Reminder', 'Hi {customer_name}, reminder: your appointment at {shop_name} is in {time_until}. See you soon!'),
    (p_client_id, 'broadcast', 'Starter Offer', 'Hey {customer_name}! We miss you at {shop_name}. Visit us this week for a special offer!');
END;
$$;

-- ============================================================
-- 25. subscription_payments (Razorpay subscription payment tracking)
-- ============================================================
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  razorpay_payment_link_id TEXT,
  razorpay_payment_id TEXT,
  amount_paise INTEGER NOT NULL,
  months INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'expired', 'failed')),
  payment_link_url TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_payments_client ON subscription_payments(client_id);
CREATE INDEX idx_subscription_payments_rpay ON subscription_payments(razorpay_payment_link_id);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage subscription payments"
  ON subscription_payments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Client can view own subscription payments"
  ON subscription_payments FOR SELECT
  USING (client_id = (select auth.uid()));

-- ============================================================
-- Platform settings — tiered pricing columns
-- ============================================================
-- Pricing: ₹500/service, ₹800/any 2, ₹1000/all 3
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS pricing_1_service_paise INTEGER NOT NULL DEFAULT 50000;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS pricing_2_services_paise INTEGER NOT NULL DEFAULT 80000;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS pricing_3_services_paise INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS default_subscription_months INTEGER NOT NULL DEFAULT 1;

-- ============================================================
-- 26. portfolio_items (Orbitex showcase — no client_id, admin-managed)
-- ============================================================
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('website', 'reel', 'facebook_post', 'generic')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  external_link TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_items_category ON portfolio_items(category);
CREATE INDEX idx_portfolio_items_order ON portfolio_items(display_order);

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage portfolio items"
  ON portfolio_items FOR ALL
  USING (public.is_admin());

CREATE POLICY "Authenticated users can view active portfolio items"
  ON portfolio_items FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON platform_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_admin_users_updated BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_resources_updated BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_catalog_items_updated BEFORE UPDATE ON catalog_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_service_requests_updated BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_whatsapp_templates_updated BEFORE UPDATE ON whatsapp_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_whatsapp_config_updated BEFORE UPDATE ON whatsapp_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inquiries_updated BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_loyalty_progress_updated BEFORE UPDATE ON customer_loyalty_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscription_payments_updated BEFORE UPDATE ON subscription_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_portfolio_items_updated BEFORE UPDATE ON portfolio_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Item 1: bills.status (draft/issued/voided) + void_reason
-- Additive ALTER — existing bills default to 'issued'
-- ============================================================
ALTER TABLE bills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued'
  CHECK (status IN ('draft', 'issued', 'voided'));
ALTER TABLE bills ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(client_id, status);

-- ============================================================
-- Item 4: GST continuous FY numbering (for has_gst=true clients)
-- Non-GST clients keep existing bill_sequences (date-reset)
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_gst_sequences (
  client_id UUID NOT NULL REFERENCES clients(id),
  financial_year TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, financial_year)
);

ALTER TABLE bill_gst_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own GST sequences"
  ON bill_gst_sequences FOR ALL
  USING (client_id = (select auth.uid()));

CREATE POLICY "Admin can manage all GST sequences"
  ON bill_gst_sequences FOR ALL
  USING (public.is_admin());

-- Updated bill number function: branches on has_gst
-- GST clients: INV-2526-0001 (continuous FY Apr-Mar)
-- Non-GST clients: BILL-20260719-001 (date-reset, unchanged)
CREATE OR REPLACE FUNCTION next_bill_number(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_gst BOOLEAN;
  v_today DATE := CURRENT_DATE;
  v_seq INTEGER;
  v_fy_start INTEGER;
  v_fy_end INTEGER;
  v_fy TEXT;
BEGIN
  SELECT has_gst INTO v_has_gst FROM public.clients WHERE id = p_client_id;

  IF v_has_gst = true THEN
    -- Indian Financial Year: Apr-Mar
    IF EXTRACT(MONTH FROM v_today) >= 4 THEN
      v_fy_start := EXTRACT(YEAR FROM v_today)::INTEGER % 100;
      v_fy_end := v_fy_start + 1;
    ELSE
      v_fy_start := (EXTRACT(YEAR FROM v_today)::INTEGER - 1) % 100;
      v_fy_end := v_fy_start + 1;
    END IF;
    v_fy := lpad(v_fy_start::text, 2, '0') || lpad(v_fy_end::text, 2, '0');

    INSERT INTO public.bill_gst_sequences (client_id, financial_year, last_number)
    VALUES (p_client_id, v_fy, 1)
    ON CONFLICT (client_id, financial_year)
    DO UPDATE SET last_number = public.bill_gst_sequences.last_number + 1
    RETURNING last_number INTO v_seq;

    RETURN 'INV-' || v_fy || '-' || lpad(v_seq::text, 4, '0');
  ELSE
    -- Existing date-reset scheme for non-GST (unchanged)
    INSERT INTO public.bill_sequences (client_id, bill_date, last_number)
    VALUES (p_client_id, v_today, 1)
    ON CONFLICT (client_id, bill_date)
    DO UPDATE SET last_number = public.bill_sequences.last_number + 1
    RETURNING last_number INTO v_seq;

    RETURN 'BILL-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
  END IF;
END;
$$;

-- ============================================================
-- Item 5: resources.business_hours (nullable = always open)
--         catalog_items.buffer_after_min (default 0 = no buffer)
-- ============================================================
ALTER TABLE resources ADD COLUMN IF NOT EXISTS business_hours JSONB;
-- Format: {"mon":{"open":"09:00","close":"18:00"},"tue":...,"sun":null}
-- null = resource is always open (preserves current behavior for existing resources)

ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS buffer_after_min INTEGER NOT NULL DEFAULT 0;
-- 0 = no buffer (preserves current duration calculations for existing services)

-- ============================================================
-- Phase 6: Quick Tools + Appointer Settings + Digital Catalog
-- ============================================================

-- Appointer config (centralizes hardcoded constants)
-- null = use code defaults (preserves existing behavior for all current clients)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS appointer_config JSONB;
-- Format: {
--   "no_show_grace_min": 10,       -- default 10 (currently hardcoded)
--   "default_duration_min": 30,    -- default 30 (fallback when no service selected)
--   "slot_increment_min": 30,      -- public booking slot grid: 15/30/60
--   "advance_booking_days": 30,    -- how far ahead customers can book online
--   "default_open": "09:00",       -- fallback when no resource business_hours set
--   "default_close": "21:00",      -- fallback close time
--   "public_booking_enabled": true  -- gate /book/{slug} per client
-- }

-- Digital catalog WhatsApp template (client-editable)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp_catalog_template TEXT;
-- null = use default: "Hi! I'm interested in {item_name}. Is it available?"

-- Updated modules_enabled default for NEW clients (existing clients keep their current JSONB)
-- Code reads missing keys via optional chaining (?.) defaulting to false, so no data migration needed
ALTER TABLE clients ALTER COLUMN modules_enabled
  SET DEFAULT '{"review_flow": false, "billit": false, "appointer": false, "whatsapp_auto": false, "quick_tools": {"gst_calculator": false, "catalog_viewer": false}}'::jsonb;

-- ============================================================
-- Phase 8 Audit Fixes: customer_loyalty_progress & RPC
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_loyalty_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  current_count NUMERIC NOT NULL DEFAULT 0,
  cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reward_code_id UUID REFERENCES reward_codes(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, customer_id)
);

ALTER TABLE customer_loyalty_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can manage own loyalty progress"
  ON customer_loyalty_progress FOR ALL
  USING (client_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION increment_customer_visits(p_customer_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.customers
  SET total_visits = total_visits + 1,
      total_spent = total_spent + p_amount,
      last_visit_at = now()
  WHERE id = p_customer_id;
END;
$$;

-- ============================================================
-- Phase 8 Audit Fixes: Review Flow missing columns
-- ============================================================

ALTER TABLE review_sessions 
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS regeneration_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES review_sessions(id),
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- ============================================================
-- Phase 8b Audit Fixes: bills table column alignment
-- Code uses line_items, discount_total, gst_total, extra_charges_note,
-- reward_code_id, notes — but original schema used items, discount, gst.
-- Strategy: Add the code-expected columns as aliases. Keep originals
-- for backward compatibility, copy data if any exists.
-- ============================================================

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_charges_note TEXT,
  ADD COLUMN IF NOT EXISTS reward_code_id UUID REFERENCES reward_codes(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate any existing data from old column names to new
UPDATE bills SET line_items = items WHERE items != '[]'::jsonb AND line_items = '[]'::jsonb;
UPDATE bills SET discount_total = discount WHERE discount != 0 AND discount_total = 0;
UPDATE bills SET gst_total = gst WHERE gst != 0 AND gst_total = 0;

-- ============================================================
-- Phase 8b Audit Fixes: catalog_items column alignment
-- Code uses gst_percent, barcode_value, deleted_at
-- Schema has default_gst_percent, no barcode_value, no deleted_at
-- ============================================================

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode_value TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS buffer_after_min INTEGER;

-- Migrate existing default_gst_percent data to gst_percent
UPDATE catalog_items SET gst_percent = default_gst_percent WHERE default_gst_percent != 0 AND gst_percent = 0;
