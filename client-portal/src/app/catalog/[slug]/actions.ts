'use server';

/**
 * Digital Catalog — Public Server Actions
 * Rate-limited. Unauthenticated. Read-only.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';

export async function fetchCatalogAction(slug: string) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'catalog:fetch', maxRequests: 30, windowSeconds: 60 }, ip);
  if (!rateCheck.success) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const supabase = await createAdminClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, phone, slug, status, modules_enabled, whatsapp_catalog_template')
    .eq('slug', slug)
    .single();

  if (!client) return { error: 'Business not found.' };
  if (client.status === 'revoked') return { error: 'This business is currently unavailable.' };

  // Check if catalog_viewer is enabled
  const modules = client.modules_enabled as Record<string, any> || {};
  const quickTools = modules.quick_tools as Record<string, boolean> || {};
  if (!quickTools.catalog_viewer) {
    return { error: 'Digital catalog is not available for this business.' };
  }

  // Fetch categories for grouping
  const { data: categories } = await supabase
    .from('catalog_categories')
    .select('id, name, display_order')
    .eq('client_id', client.id)
    .order('display_order', { ascending: true });

  const { data: items } = await supabase
    .from('catalog_items')
    .select('name, price, type, unit, is_available, category_id')
    .eq('client_id', client.id)
    .eq('active', true)
    .eq('show_in_catalog', true)
    .order('name', { ascending: true });

  // Build category lookup
  const categoryMap = new Map<string, { name: string; order: number }>();
  (categories || []).forEach((c: any) => {
    categoryMap.set(c.id, { name: c.name, order: c.display_order });
  });

  return {
    business: {
      name: client.business_name,
      phone: client.phone,
      template: client.whatsapp_catalog_template || "Hi! I'm interested in {item_name}. Is it available?",
    },
    items: (items || []).map((i: any) => ({
      name: i.name,
      price: Number(i.price),
      type: i.type,
      unit: i.unit,
      available: i.is_available !== false,
      categoryName: i.category_id ? categoryMap.get(i.category_id)?.name || null : null,
      categoryOrder: i.category_id ? categoryMap.get(i.category_id)?.order ?? 999 : 999,
    })),
  };
}
