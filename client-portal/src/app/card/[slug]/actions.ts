'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';

export async function fetchBusinessCardAction(slug: string) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'card:fetch', maxRequests: 30, windowSeconds: 60 }, ip);
  if (!rateCheck.success) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const supabase = await createAdminClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, slug, owner_name, about, address, address_url, phone, logo_url, status, modules_enabled, appointer_config, instagram_url, facebook_url, website_url, linkedin_url, x_url, whatsapp_url, framed_card_enabled, bill_settings')
    .eq('slug', slug)
    .single();

  if (!client) return { error: 'Business not found.' };
  if (client.status === 'revoked') return { error: 'temporarily_unavailable' };

  const config = client.appointer_config as Record<string, any> | null;
  const modules = client.modules_enabled as Record<string, any> || {};
  const quickTools = modules.quick_tools as Record<string, boolean> || {};

  const reviewActive = modules.review_flow !== false;
  const appointmentActive = modules.appointer !== false && !(config && config.public_booking_enabled === false);
  const catalogActive = modules.billit !== false || modules.appointer !== false;

  return {
    client,
    activeLinks: {
      reviewActive,
      appointmentActive,
      catalogActive,
    }
  };
}
