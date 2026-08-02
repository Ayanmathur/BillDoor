'use server';

import { createClient } from '@/lib/supabase/server';

export interface BulkStagingRow {
  name: string;
  type: 'product' | 'service';
  price: number;
  gstPercent: number;
  barcode: string;
  category: string;
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
  const headerLowers = firstCols.map(c => c.toLowerCase());
  
  let nameIdx = -1;
  let priceIdx = -1;
  let categoryIdx = -1;
  let typeIdx = -1;
  let gstIdx = -1;
  let barcodeIdx = -1;

  const isHeader = headerLowers.some(h => 
    h.includes('name') || h.includes('item') || h.includes('product') || h.includes('service') || h.includes('price') || h.includes('category')
  );

  if (isHeader) {
    headerLowers.forEach((h, idx) => {
      if (h.includes('name') || h.includes('item') || h.includes('product')) {
        if (nameIdx === -1) nameIdx = idx;
      } else if (h.includes('price') || h.includes('rate') || h.includes('amount') || h.includes('mrp')) {
        if (priceIdx === -1) priceIdx = idx;
      } else if (h.includes('cat') || h.includes('group') || h.includes('section')) {
        if (categoryIdx === -1) categoryIdx = idx;
      } else if (h === 'type' || h.includes('kind')) {
        if (typeIdx === -1) typeIdx = idx;
      } else if (h.includes('gst') || h.includes('tax')) {
        if (gstIdx === -1) gstIdx = idx;
      } else if (h.includes('barcode') || h.includes('code') || h.includes('sku')) {
        if (barcodeIdx === -1) barcodeIdx = idx;
      }
    });
  }

  const startIndex = isHeader ? 1 : 0;
  const rows: BulkStagingRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    // Split line respecting delimiter
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length === 0 || !cols[0]) continue;

    let name = '';
    let price = 0;
    let category = '';
    let rawType = 'product';
    let gstInputVal = '';
    let barcode = '';

    if (isHeader && nameIdx !== -1) {
      name = cols[nameIdx] || '';
      price = parseFloat(cols[priceIdx] || '0') || 0;
      category = categoryIdx !== -1 ? cols[categoryIdx] || '' : '';
      rawType = (typeIdx !== -1 ? cols[typeIdx] : 'product') || 'product';
      gstInputVal = gstIdx !== -1 ? cols[gstIdx] || '' : '';
      barcode = barcodeIdx !== -1 ? cols[barcodeIdx] || '' : '';
    } else {
      // Positional fallback:
      // Col 0: Name
      // Col 1: Price (or Type if string)
      // Col 2: Category
      // Col 3: Type ('product' | 'service')
      // Col 4: GST%
      // Col 5: Barcode
      name = cols[0] || '';
      const col1IsNum = !isNaN(parseFloat(cols[1]));

      if (col1IsNum) {
        price = parseFloat(cols[1]) || 0;
        category = cols[2] || '';
        rawType = cols[3] || 'product';
        gstInputVal = cols[4] || '';
        barcode = cols[5] || '';
      } else {
        rawType = cols[1] || 'product';
        price = parseFloat(cols[2] || '0') || 0;
        category = cols[3] || '';
        gstInputVal = cols[4] || '';
        barcode = cols[5] || '';
      }
    }

    if (!name) continue;

    let type: 'product' | 'service' = 'product';
    let hasTypeWarning = false;
    const lowerType = rawType.toLowerCase();

    if (lowerType === 'product' || lowerType === 'p' || lowerType === 'item') {
      type = 'product';
    } else if (lowerType === 'service' || lowerType === 's') {
      type = 'service';
    } else {
      type = 'product';
      hasTypeWarning = true;
    }

    const gstInput = parseFloat(gstInputVal);
    const gstPercent = isNaN(gstInput) ? defaultGst : gstInput;

    if (!barcode && barcodeEnabled) {
      barcode = `BC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    }

    rows.push({
      name,
      type,
      price,
      gstPercent,
      barcode: barcodeEnabled ? barcode : '',
      category: category.trim(),
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

  // Process and upsert categories
  const categoryMap = new Map<string, string>(); // name.toLowerCase() -> category_id
  const uniqueCategories = Array.from(new Set(items.map(i => i.category?.trim()).filter(Boolean) as string[]));

  if (uniqueCategories.length > 0) {
    const { data: existingCats } = await supabase
      .from('catalog_categories')
      .select('id, name, display_order')
      .eq('client_id', user.id);

    const existingMap = new Map((existingCats || []).map(c => [c.name.toLowerCase(), c.id]));
    let maxOrder = (existingCats || []).reduce((max, c) => Math.max(max, c.display_order ?? 0), -1);

    for (const catName of uniqueCategories) {
      const lower = catName.toLowerCase();
      if (existingMap.has(lower)) {
        categoryMap.set(lower, existingMap.get(lower)!);
      } else {
        maxOrder++;
        const { data: newCat } = await supabase
          .from('catalog_categories')
          .insert({
            client_id: user.id,
            name: catName,
            display_order: maxOrder,
          })
          .select('id')
          .single();

        if (newCat) {
          categoryMap.set(lower, newCat.id);
        }
      }
    }
  }

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

    const catId = item.category?.trim() ? categoryMap.get(item.category.trim().toLowerCase()) || null : null;

    return {
      client_id: user.id,
      name: item.name,
      type: item.type,
      price: item.price,
      gst_percent: item.gstPercent,
      barcode_value: barcode || null,
      barcode_auto_generated: !item.barcode && barcodeEnabled,
      category_id: catId,
      active: true,
    };
  });

  const { error } = await supabase
    .from('catalog_items')
    .insert(insertRows);

  if (error) return { error: `Failed to commit items. (${error.message})` };

  return { success: true, count: items.length };
}
