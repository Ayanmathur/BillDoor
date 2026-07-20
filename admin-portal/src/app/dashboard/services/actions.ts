'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function fetchAllServiceRequestsAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', requests: [] };

  // Fetch service requests joined with client business_name
  const { data, error } = await supabase
    .from('service_requests')
    .select('*, clients!inner(business_name)')
    .order('created_at', { ascending: false });

  if (error) return { error: error.message, requests: [] };

  return {
    requests: (data || []).map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.clients?.business_name || 'Unknown',
      serviceType: r.service_type,
      status: r.status,
      description: r.description || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['requested', 'in_progress', 'done']),
});

export async function updateServiceRequestStatusAction(params: { id: string; status: string }) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const parsed = updateSchema.safeParse(params);
  if (!parsed.success) return { error: 'Invalid input' };

  const { error } = await supabase
    .from('service_requests')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id);

  if (error) return { error: error.message };
  return { success: true };
}
