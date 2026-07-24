'use server';

/**
 * Menu Photo → Catalog Import (OCR)
 *
 * Uses Gemini API to extract menu items from uploaded photos.
 * All items land in catalog_import_staging for mandatory human review.
 */

import { createClient } from '@/lib/supabase/server';

interface ExtractedItem {
  name: string;
  price: number;
}

/**
 * Upload a menu photo and extract items via Gemini OCR.
 * Returns a staging record ID and the extracted items for review.
 */
export async function extractMenuItemsAction(imageBase64: string, imageMimeType: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'AI service not configured. Please contact admin.' };

  // Call Gemini with the image for menu extraction
  const prompt = `You are a menu parser. Extract all food/drink/service items and their prices from this menu image.
Return ONLY a JSON array of objects with "name" (string) and "price" (number in INR).
Example: [{"name": "Masala Dosa", "price": 120}, {"name": "Filter Coffee", "price": 40}]
If you cannot extract any items, return an empty array [].
Do not include descriptions, categories, or any extra text — just the JSON array.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!response.ok) {
      return { error: 'Failed to process image. Please try again.' };
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';

    // Parse the JSON response — handle markdown code blocks
    let jsonText = rawText;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }

    let items: ExtractedItem[];
    try {
      items = JSON.parse(jsonText);
      if (!Array.isArray(items)) items = [];
    } catch {
      return { error: 'Could not parse menu items from image. Please try a clearer photo.' };
    }

    // Validate and clean items
    items = items
      .filter(item => item.name && typeof item.price === 'number' && item.price > 0)
      .map(item => ({
        name: String(item.name).trim().slice(0, 200),
        price: Math.round(Number(item.price) * 100) / 100,
      }));

    if (items.length === 0) {
      return { error: 'No menu items found in this image. Please try a clearer photo.' };
    }

    // Save to staging table
    const { data: staging, error: insertError } = await supabase
      .from('catalog_import_staging')
      .insert({
        client_id: user.id,
        extracted_items: items,
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (insertError) {
      return { error: 'Failed to save extracted items. Please try again.' };
    }

    return {
      stagingId: staging.id,
      items,
      count: items.length,
    };
  } catch {
    return { error: 'Failed to process image. Please try again.' };
  }
}

/**
 * Commit approved items from staging to catalog_items.
 * Applies a bulk GST rate to all imported items.
 */
export async function commitStagingItemsAction(data: {
  stagingId: string;
  items: Array<{ name: string; price: number }>;
  gstRate: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!data.items.length) return { error: 'No items to import.' };

  const validGstRates = [0, 5, 12, 18, 28];
  if (!validGstRates.includes(data.gstRate)) return { error: 'Invalid GST rate.' };

  // Insert into catalog_items
  const catalogRows = data.items.map(item => ({
    client_id: user.id,
    name: item.name,
    price: item.price,
    unit: 'pc',
    gst_percent: data.gstRate,
    is_active: true,
  }));

  const { error: insertError } = await supabase
    .from('catalog_items')
    .insert(catalogRows);

  if (insertError) {
    return { error: 'Failed to import items to catalog.' };
  }

  // Mark staging as committed
  await supabase
    .from('catalog_import_staging')
    .update({ status: 'committed' })
    .eq('id', data.stagingId)
    .eq('client_id', user.id);

  return { success: true, count: data.items.length };
}

/**
 * Discard a staging import.
 */
export async function discardStagingAction(stagingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('catalog_import_staging')
    .update({ status: 'discarded' })
    .eq('id', stagingId)
    .eq('client_id', user.id);

  return { success: true };
}
