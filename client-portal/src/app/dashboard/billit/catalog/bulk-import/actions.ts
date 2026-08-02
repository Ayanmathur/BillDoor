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

  // Clean markdown code blocks if pasted from AI output
  let cleanText = csvText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:csv|text)?\s*/i, '').replace(/```\s*$/i, '');
  }

  const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { error: 'Data is empty or missing data rows.', rows: [], barcodeEnabled, defaultGst };
  }

  // Auto-detect delimiter (comma, tab, or pipe)
  const sample = lines[0];
  let delimiter = ',';
  if (sample.includes('\t')) delimiter = '\t';
  else if (sample.includes('|')) delimiter = '|';

  // Check if line 0 is header row
  const firstCols = lines[0].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
  const firstCol0 = (firstCols[0] || '').toLowerCase();
  const firstCol1 = (firstCols[1] || '').toLowerCase();
  const firstCol2 = (firstCols[2] || '').toLowerCase();
  
  const isHeader = firstCol0.includes('name') || firstCol1.includes('type') || firstCol2.includes('price');
  const startIndex = isHeader ? 1 : 0;

  const rows: BulkStagingRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    // Split line respecting delimiter
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length === 0 || !cols[0]) continue;

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

  if (rows.length === 0) {
    return { error: 'Could not parse any valid items from data. Please check format.', rows: [], barcodeEnabled, defaultGst };
  }

  return { rows, barcodeEnabled, defaultGst };
}

export async function commitBulkCatalogItemsAction(items: BulkStagingRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!items.length) return { error: 'No items to import.' };

  const { data: client } = await supabase
    .from('clients')
    .select('barcode_enabled')
    .eq('id', user.id)
    .single();

  const barcodeEnabled = client?.barcode_enabled === true;

  const insertRows = items.map((item, idx) => {
    let barcode = item.barcode;
    if (!barcode && barcodeEnabled) {
      const prefix = (item.name || 'ITM')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3) || 'ITM';
      const seq = String(idx + 1).padStart(3, '0');
      barcode = `${prefix}${seq}`;
    }

    return {
      client_id: user.id,
      name: item.name,
      type: item.type,
      price: item.price,
      gst_percent: item.gstPercent,
      barcode_value: barcode || null,
      barcode_auto_generated: !item.barcode && barcodeEnabled,
      active: true,
    };
  });

  const { error } = await supabase
    .from('catalog_items')
    .insert(insertRows);

  if (error) return { error: `Failed to commit items. (${error.message})` };

  return { success: true, count: items.length };
}
