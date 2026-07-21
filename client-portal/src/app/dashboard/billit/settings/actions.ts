'use server';
import { createClient } from '@/lib/supabase/server';

export async function fetchBillitSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', settings: null };

  const { data } = await supabase
    .from('clients')
    .select('barcode_enabled, barcode_settings, slug, whatsapp_catalog_template, modules_enabled, bill_settings')
    .eq('id', user.id)
    .single();

  return { settings: data };
}

export async function updateBillitSettingsAction(data: {
  barcodeEnabled: boolean;
  defaultGst: number;
  defaultDiscountType: string;
  defaultDiscountValue: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { error } = await supabase
    .from('clients')
    .update({ 
      barcode_enabled: data.barcodeEnabled,
      bill_settings: {
        default_gst: data.defaultGst,
        default_discount_type: data.defaultDiscountType,
        default_discount_value: data.defaultDiscountValue
      }
    })
    .eq('id', user.id);

  if (error) {
    console.error('Settings Update Error:', error);
    return { error: `Failed to save settings. (${error.message})` };
  }
  return {};
}

export async function updateCatalogTemplateAction(template: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { error } = await supabase
    .from('clients')
    .update({ whatsapp_catalog_template: template })
    .eq('id', user.id);

  if (error) return { error: 'Failed to save template.' };
  return {};
}

// ============================================================
// Fetch Bill WhatsApp template from whatsapp_templates table
// ============================================================
export async function fetchBillWhatsAppTemplateAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', template: null };

  const { data } = await supabase
    .from('whatsapp_templates')
    .select('id, content')
    .eq('client_id', user.id)
    .eq('type', 'billit')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  return { template: data };
}

// ============================================================
// Update (or insert) Bill WhatsApp template
// ============================================================
export async function updateBillWhatsAppTemplateAction(content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  // Check if one already exists
  const { data: existing } = await supabase
    .from('whatsapp_templates')
    .select('id')
    .eq('client_id', user.id)
    .eq('type', 'billit')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('whatsapp_templates')
      .update({ content })
      .eq('id', existing.id);
    if (error) return { error: 'Failed to save template.' };
  } else {
    const { error } = await supabase
      .from('whatsapp_templates')
      .insert({ client_id: user.id, type: 'billit', name: 'Default Bill', content });
    if (error) return { error: 'Failed to create template.' };
  }

  return {};
}
