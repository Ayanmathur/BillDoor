'use server';

import { createClient } from '@/lib/supabase/server';

export async function fetchTallyExportDataAction(dateFrom: string, dateTo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', bills: [] };

  const { data: bills, error } = await supabase
    .from('bills')
    .select('id, bill_number, created_at, grand_total, subtotal, discount_total, gst_total, status, customer:customers(name, phone)')
    .eq('client_id', user.id)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59')
    .order('created_at', { ascending: true });

  if (error) return { error: 'Failed to fetch bills for Tally export.', bills: [] };
  return { bills: bills || [] };
}
