'use server';

/**
 * Billit — Customers Server Actions (§5.4)
 *
 * Shared customer list (deduplicated per phone per client).
 * Also doubles as WhatsApp broadcast audience picker.
 */

import { createClient } from '@/lib/supabase/server';

export async function fetchCustomersAction(filters?: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', customers: null, total: 0 };

  const page = filters?.page || 1;
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('client_id', user.id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');

  const { data, count, error } = await query;
  if (error) return { error: 'Failed to fetch customers.', customers: null, total: 0 };

  // Fetch loyalty progress for all customers in this batch
  const customerIds = (data || []).map((c: any) => c.id);
  let loyaltyMap: Record<string, number> = {};
  let loyaltyGoal = 0;
  let loyaltyEnabled = false;

  if (customerIds.length > 0) {
    const { data: loyaltyData } = await supabase
      .from('customer_loyalty_progress')
      .select('customer_id, current_count')
      .eq('client_id', user.id)
      .in('customer_id', customerIds);

    if (loyaltyData) {
      loyaltyData.forEach((lp: any) => { loyaltyMap[lp.customer_id] = lp.current_count; });
    }

    // Get loyalty config for goal value
    const { data: clientData } = await supabase
      .from('clients')
      .select('loyalty_config')
      .eq('id', user.id)
      .single();

    if (clientData?.loyalty_config?.track2_enabled) {
      loyaltyEnabled = true;
      loyaltyGoal = clientData.loyalty_config.track2?.goal_value || 0;
    }
  }

  return {
    customers: data,
    total: count || 0,
    loyaltyMap,
    loyaltyGoal,
    loyaltyEnabled,
  };
}

export async function fetchCustomerDetailAction(customerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', customer: null, bills: null, reviews: null };

  const [customerResult, billsResult, reviewsResult, loyaltyResult] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).eq('client_id', user.id).single(),
    supabase.from('bills').select('id, bill_number, grand_total, created_at').eq('client_id', user.id).eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20),
    supabase.from('reviews').select('id, stars, feedback_text, created_at').eq('client_id', user.id).limit(10),
    supabase.from('customer_loyalty_progress').select('current_count, cycle_started_at, last_reward_code_id').eq('client_id', user.id).eq('customer_id', customerId).single(),
  ]);

  return {
    customer: customerResult.data,
    bills: billsResult.data || [],
    reviews: reviewsResult.data || [],
    loyaltyProgress: loyaltyResult.data || null,
  };
}
