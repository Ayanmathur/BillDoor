'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

const SERVICE_TYPES = ['website', 'seo', 'ads', 'branding', 'support'] as const;

// Fetch admin WhatsApp number from platform_settings (using service role)
export async function fetchAdminWhatsAppAction() {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('platform_settings')
    .select('admin_whatsapp_number')
    .single();
  const fallback = process.env.ADMIN_WHATSAPP_NUMBER ? `91${process.env.ADMIN_WHATSAPP_NUMBER.replace(/^91/, '')}` : '919422880355';
  return { phone: data?.admin_whatsapp_number || fallback };
}

// Fetch client's website URL
export async function fetchClientWebsiteAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: null };

  const { data } = await supabase
    .from('clients')
    .select('website_url')
    .eq('id', user.id)
    .single();

  return { url: data?.website_url || null };
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
