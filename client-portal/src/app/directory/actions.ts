'use server';

import { createAdminClient } from '@/lib/supabase/server';

export interface ListedClient {
  id: string;
  businessName: string;
  slug: string;
  about: string;
}

export async function fetchPublicDirectoryAction() {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('clients')
    .select('id, business_name, slug, about')
    .eq('publicly_listed', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('business_name', { ascending: true });

  if (error) {
    return { clients: [] };
  }

  const clients: ListedClient[] = (data || []).map(c => ({
    id: c.id,
    businessName: c.business_name || 'Business',
    slug: c.slug,
    about: c.about || '',
  }));

  return { clients };
}
