'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

const SERVICE_TYPES = ['website', 'seo', 'ads', 'branding', 'social_media_management', 'support', 'qr_menu_design', 'business_card_design'] as const;

// Fetch admin WhatsApp number from platform_settings (using service role)
// Fallback: always resolves to 919422880355 if DB value is missing/empty
export async function fetchAdminWhatsAppAction() {
  const FALLBACK_ADMIN_PHONE = '919422880355';
  try {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return { phone: FALLBACK_ADMIN_PHONE };

    const supabase = await createAdminClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('admin_whatsapp_number')
      .single();
    const dbPhone = data?.admin_whatsapp_number?.trim();
    if (dbPhone && dbPhone.length >= 10) {
      return { phone: dbPhone.replace(/[^0-9]/g, '') };
    }
  } catch {
    // DB error — fall through to hardcoded fallback
  }
  return { phone: FALLBACK_ADMIN_PHONE };
}

// Fetch client's website URL and directory access setting
export async function fetchClientWebsiteAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: null, directoryAccessEnabled: true };

  const { data } = await supabase
    .from('clients')
    .select('website_url, directory_access_enabled')
    .eq('id', user.id)
    .single();

  return { 
    url: data?.website_url || null,
    directoryAccessEnabled: data?.directory_access_enabled !== false
  };
}

// Fetch all service requests for this client
export async function fetchServiceRequestsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', requests: [] };

  const { data, error } = await supabase
    .from('service_requests')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { error: 'Failed to fetch requests.', requests: [] };

  return {
    requests: (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      serviceType: r.service_type as string,
      status: r.status as string,
      description: r.description as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    })),
  };
}

// Create a new service request
export async function createServiceRequestAction(input: {
  serviceType: string;
  description?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!SERVICE_TYPES.includes(input.serviceType as any)) {
    return { error: 'Invalid service type.' };
  }

  // Check if there's already an active (non-done) request for this service
  const { data: existing } = await supabase
    .from('service_requests')
    .select('id')
    .eq('client_id', user.id)
    .eq('service_type', input.serviceType)
    .neq('status', 'done')
    .single();

  if (existing) {
    return { error: 'You already have an active request for this service.' };
  }

  const { error } = await supabase
    .from('service_requests')
    .insert({
      client_id: user.id,
      service_type: input.serviceType,
      description: input.description || '',
    });

  if (error) return { error: 'Failed to create request.' };
  return { success: true };
}

// Fetch active portfolio items for showcase gallery
export async function fetchPortfolioItemsAction(category?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', items: [] };

  let query = supabase
    .from('portfolio_items')
    .select('id, category, title, description, external_link, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return { error: 'Failed to fetch portfolio.', items: [] };

  return {
    items: (data || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      category: item.category as string,
      title: item.title as string,
      description: item.description as string,
      externalLink: item.external_link as string,
      displayOrder: item.display_order as number,
    })),
  };
}
