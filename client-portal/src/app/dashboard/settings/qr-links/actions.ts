'use server';

import { createClient } from '@/lib/supabase/server';

export async function fetchQrLinksDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { data: client, error } = await supabase
    .from('clients')
    .select('slug, status, modules_enabled, appointer_config')
    .eq('id', user.id)
    .single();

  if (error || !client) return { error: 'Client not found.' };

  const modules = client.modules_enabled || {};
  const appointer = client.appointer_config || {};
  const isRevoked = client.status === 'revoked';

  const isBillitEnabled = modules.billit !== false;
  const isAppointerEnabled = modules.appointer !== false;

  const links = [
    {
      key: 'review',
      label: 'Review Flow',
      path: `/review/${client.slug}`,
      active: !isRevoked && modules.review_flow !== false,
      suggestion: 'Great for: table tents, receipts'
    },
    {
      key: 'appointer',
      label: 'Appointer Booking',
      path: `/book/${client.slug}`,
      active: !isRevoked && isAppointerEnabled && appointer.public_booking_enabled !== false,
      suggestion: 'Great for: shop window, social bio'
    },
    {
      key: 'catalog',
      label: 'Digital Catalog',
      path: `/catalog/${client.slug}`,
      active: !isRevoked && (isBillitEnabled || isAppointerEnabled) && modules.quick_tools?.catalog_viewer !== false,
      suggestion: 'Great for: WhatsApp status, menu boards'
    },
    {
      key: 'card',
      label: 'Digital Business Card',
      path: `/card/${client.slug}`,
      active: !isRevoked,
      suggestion: 'Great for: email signatures, networking'
    }
  ];

  return {
    slug: client.slug,
    links
  };
}
