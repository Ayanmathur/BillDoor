'use server';
import { createClient } from '@/lib/supabase/server';

export async function fetchBillitSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', settings: null };

  const { data } = await supabase
    .from('clients')
    .select('barcode_enabled, barcode_settings, slug, whatsapp_catalog_template, modules_enabled')
    .eq('id', user.id)
    .single();

  return { settings: data };
}

export async function updateBillitSettingsAction(data: {
  barcodeEnabled: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { error } = await supabase
    .from('clients')
    .update({ barcode_enabled: data.barcodeEnabled })
    .eq('id', user.id);

  if (error) return { error: 'Failed to save settings.' };
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
