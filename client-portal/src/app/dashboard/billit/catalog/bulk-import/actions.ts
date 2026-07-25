'use server';

import { createClient } from '@/lib/supabase/server';

export interface BulkStagingRow {
  name: string;
  type: 'product' | 'service';
  price: number;
  gstPercent: number;
  barcode: string;
  hasTypeWarning?: boolean;
}

export async function parseBulkImportFileAction(csvText: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', rows: [], barcodeEnabled: false, defaultGst: 0 };

  const { data: client } = await supabase
    .from('clients')
    .select('barcode_enabled, bill_settings')
    .eq('id', user.id)
    .single();

  const barcodeEnabled = client?.barcode_enabled === true;
  const defaultGst = Number(client?.bill_settings?.default_gst || 0);

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    return { error: 'CSV file is empty or missing data rows.', rows: [], barcodeEnabled, defaultGst };
  }

  const rows: BulkStagingRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
    if (cols.length < 2 || !cols[0]) continue;

    const name = cols[0];
    const rawType = (cols[1] || 'product').toLowerCase();
    let type: 'product' | 'service' = 'product';
    let hasTypeWarning = false;

    if (rawType === 'product' || rawType === 'p' || rawType === 'item') {
      type = 'product';
    } else if (rawType === 'service' || rawType === 's') {
      type = 'service';
    } else {
      type = 'product';
      hasTypeWarning = true;
    }

    const price = parseFloat(cols[2] || '0') || 0;
    const gstInput = parseFloat(cols[3] || '');
    const gstPercent = isNaN(gstInput) ? defaultGst : gstInput;

    let barcode = cols[4] || '';
    if (!barcode && barcodeEnabled) {
      barcode = `BC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    }

    rows.push({
      name,
      type,
      price,
      gstPercent,
      barcode: barcodeEnabled ? barcode : '',
      hasTypeWarning,
    });
  }

  return { rows, barcodeEnabled, defaultGst };
}

export async function commitBulkCatalogItemsAction(items: BulkStagingRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!items.length) return { error: 'No items to import.' };

  const insertRows = items.map(item => ({
    client_id: user.id,
    name: item.name,
    type: item.type,
    price: item.price,
    default_gst_percent: item.gstPercent,
    active: true,
  }));

  const { error } = await supabase
    .from('catalog_items')
    .insert(insertRows);

  if (error) return { error: `Failed to commit items. (${error.message})` };

  return { success: true, count: items.length };
}
