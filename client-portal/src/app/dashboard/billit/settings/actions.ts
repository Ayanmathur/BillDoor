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

  // Auto-assign barcodes to any products missing barcodes when barcode mode is enabled
  if (data.barcodeEnabled) {
    await assignBarcodesToMissingCatalogItems(supabase, user.id);
  }

  return {};
}

export async function assignBarcodesToMissingCatalogItems(supabase: any, clientId: string) {
  try {
    const { data: items } = await supabase
      .from('catalog_items')
      .select('id, name, barcode_value')
      .eq('client_id', clientId)
      .eq('active', true);

    if (!items || items.length === 0) return;

    const missingItems = items.filter((item: any) => !item.barcode_value || item.barcode_value.trim() === '');
    if (missingItems.length === 0) return;

    for (let i = 0; i < missingItems.length; i++) {
      const item = missingItems[i];
      const prefix = (item.name || 'ITM')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3) || 'ITM';
      
      const uniqueNum = String(i + 1).padStart(3, '0');
      const barcode = `${prefix}${uniqueNum}`;

      await supabase
        .from('catalog_items')
        .update({
          barcode_value: barcode,
          barcode_auto_generated: true,
        })
        .eq('id', item.id)
        .eq('client_id', clientId);
    }
  } catch (err) {
    console.error('Error auto-assigning barcodes:', err);
  }
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
