'use server';
import { createClient } from '@/lib/supabase/server';

export async function fetchBillitSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', settings: null };

  const { data } = await supabase
    .from('clients')
    .select('barcode_enabled, barcode_settings, slug, whatsapp_catalog_template, modules_enabled, bill_settings, billit_auto_select_template, gst_calculation_mode')
    .eq('id', user.id)
    .single();

  return { settings: data };
}

export async function updateBillitSettingsAction(data: {
  barcodeEnabled: boolean;
  defaultGst: number;
  defaultDiscountType: string;
  defaultDiscountValue: number;
  billitAutoSelectTemplate?: boolean;
  defaultBillSize?: '55mm' | '80mm' | 'A4';
  posModeEnabled?: boolean;
  cameraBarcodeEnabled?: boolean;
  gstCalculationMode?: 'exclusive' | 'inclusive';
  showCgstSgstSplit?: boolean;
  showGstSlabBreakup?: boolean;
  showMrpAndSavings?: boolean;
  enablePaymentMethod?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  // Fetch current bill_settings to preserve existing keys
  const { data: currentClient } = await supabase
    .from('clients')
    .select('bill_settings')
    .eq('id', user.id)
    .single();

  const existingBillSettings = (currentClient?.bill_settings as Record<string, unknown>) || {};

  const updatePayload: Record<string, unknown> = {
    barcode_enabled: data.barcodeEnabled,
    bill_settings: {
      ...existingBillSettings,
      default_gst: data.defaultGst,
      default_discount_type: data.defaultDiscountType,
      default_discount_value: data.defaultDiscountValue,
      default_bill_size: data.defaultBillSize || '55mm',
      pos_mode_enabled: data.posModeEnabled ?? false,
      camera_barcode_enabled: data.cameraBarcodeEnabled ?? false,
      show_cgst_sgst_split: data.showCgstSgstSplit ?? existingBillSettings.show_cgst_sgst_split ?? false,
      show_gst_slab_breakup: data.showGstSlabBreakup ?? existingBillSettings.show_gst_slab_breakup ?? false,
      show_mrp_and_savings: data.showMrpAndSavings ?? existingBillSettings.show_mrp_and_savings ?? false,
      enable_payment_method: data.enablePaymentMethod ?? existingBillSettings.enable_payment_method ?? false,
    },
  };
  if (data.billitAutoSelectTemplate !== undefined) {
    updatePayload.billit_auto_select_template = data.billitAutoSelectTemplate;
  }
  if (data.gstCalculationMode) {
    updatePayload.gst_calculation_mode = data.gstCalculationMode;
  }

  const { error } = await supabase
    .from('clients')
    .update(updatePayload)
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
