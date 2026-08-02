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

  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !openrouterKey && !groqKey) {
    return { error: 'AI service not configured. Please contact admin.' };
  }

  let mime = imageMimeType ? imageMimeType.toLowerCase().trim() : 'image/webp';
  if (mime.includes('webp')) mime = 'image/webp';
  else if (mime.includes('png')) mime = 'image/png';
  else if (mime.includes('jpg') || mime.includes('jpeg')) mime = 'image/jpeg';
  else mime = 'image/webp';

  // Call AI with image for menu extraction
  const prompt = `You are a menu parser. Extract all food/drink/service items and their numeric prices from this menu image.
Return ONLY a compact JSON array of objects with "name" (string) and "price" (number in INR).
If an item has multiple sizes/prices (e.g. Full 360 / Half 200), create separate items for each (e.g. "Item Name (Full)" price 360, "Item Name (Half)" price 200).
Do not add extra whitespace, indentation, or newlines.
Example: [{"name":"Masala Dosa","price":120},{"name":"Filter Coffee","price":40}]`;

  let rawText = '';
  let lastError = '';

  // Tier 1: Gemini API
  if (geminiKey) {
    const candidateModels = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.0-flash'];
    for (const model of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType: mime, data: imageBase64 } },
                  { text: prompt },
                ],
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          rawText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
          break; // Success!
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastError = errJson?.error?.message || `Gemini ${model} HTTP ${response.status}`;
        }
      } catch (e: any) {
        lastError = e?.message || 'Gemini network error';
      }
    }
  }

  // Tier 2: OpenRouter API (Fallback 2)
  if (!rawText && openrouterKey) {
    const dataUri = `data:${mime};base64,${imageBase64}`;
    const openrouterModels = ['openai/gpt-4o-mini', 'openai/gpt-4o'];

    for (const model of openrouterModels) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://billdoor.local',
            'X-Title': 'BillDoor',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: dataUri } },
                ],
              },
            ],
            temperature: 0.1,
            max_tokens: 8192,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          rawText = result.choices?.[0]?.message?.content?.trim() || '[]';
          break; // Success!
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastError = errJson?.error?.message || `OpenRouter ${model} HTTP ${response.status}`;
        }
      } catch (e: any) {
        lastError = e?.message || 'OpenRouter network error';
      }
    }
  }

  // Tier 3: Groq API (Fallback 3)
  if (!rawText && groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        rawText = result.choices?.[0]?.message?.content?.trim() || '[]';
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = errJson?.error?.message || `Groq HTTP ${response.status}`;
      }
    } catch (e: any) {
      lastError = e?.message || 'Groq network error';
    }
  }

  if (!rawText) {
    return { error: `Failed to process image (${lastError || 'Service unavailable'}). Please try again.` };
  }

    // Parse the JSON response — handle markdown code blocks & truncated output
    let jsonText = rawText;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }

    let items: ExtractedItem[] = [];
    try {
      items = JSON.parse(jsonText);
      if (!Array.isArray(items)) items = [];
    } catch {
      // Attempt repair for truncated JSON array
      const lastBrace = jsonText.lastIndexOf('}');
      if (lastBrace !== -1) {
        const repaired = jsonText.slice(0, lastBrace + 1) + ']';
        try {
          items = JSON.parse(repaired);
          if (!Array.isArray(items)) items = [];
        } catch {
          return { error: 'Could not parse menu items from image. Please try a clearer photo.' };
        }
      } else {
        return { error: 'Could not parse menu items from image. Please try a clearer photo.' };
      }
    }

    // Validate and clean items
    items = items
      .filter(item => item && item.name && typeof item.price === 'number' && item.price > 0)
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

  const { data: client } = await supabase
    .from('clients')
    .select('barcode_enabled')
    .eq('id', user.id)
    .single();

  const barcodeEnabled = client?.barcode_enabled === true;

  // Insert into catalog_items
  const catalogRows = data.items.map((item, idx) => {
    let barcode: string | null = null;
    if (barcodeEnabled) {
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
      type: 'product' as const,
      price: item.price,
      unit: 'pc',
      gst_percent: data.gstRate,
      barcode_value: barcode,
      barcode_auto_generated: barcodeEnabled,
      active: true,
    };
  });

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
