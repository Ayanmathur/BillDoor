'use server';

/**
 * Digital Catalog — Public Server Actions
 * Rate-limited. Unauthenticated. Read-only.
 */

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';

export async function fetchCatalogAction(slug: string) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'catalog:fetch', maxRequests: 30, windowSeconds: 60 }, ip);
  if (!rateCheck.success) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const supabase = await createClient();

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

  const { data: items } = await supabase
    .from('catalog_items')
    .select('name, price, type, unit')
    .eq('client_id', client.id)
    .eq('active', true)
    .order('name', { ascending: true });

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
    })),
  };
}
