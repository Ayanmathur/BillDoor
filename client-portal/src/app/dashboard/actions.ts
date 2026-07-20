'use server';

/**
 * Dashboard — Server Actions
 *
 * Fetches summary data for the dashboard cards.
 * Each query is RLS-scoped to the authenticated client.
 */

import { createClient } from '@/lib/supabase/server';

export async function fetchDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const clientId = user.id;

  // Parallel queries for speed
  const [reviewsResult, billsResult, customersResult, todayBillsResult] = await Promise.all([
    // Review stats
    supabase
      .from('reviews')
      .select('stars', { count: 'exact' })
      .eq('client_id', clientId),

    // Total bills
    supabase
      .from('bills')
      .select('grand_total', { count: 'exact' })
      .eq('client_id', clientId),

    // Total customers
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),

    // Today's bills
    supabase
      .from('bills')
      .select('grand_total')
      .eq('client_id', clientId)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  // Calculate review stats
  const reviews = reviewsResult.data || [];
  const totalReviews = reviewsResult.count || 0;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + (r.stars || 0), 0) / totalReviews).toFixed(1)
    : '0.0';
  const positiveReviews = reviews.filter(r => (r.stars || 0) >= 4).length;
  const negativeReviews = reviews.filter(r => (r.stars || 0) <= 3).length;

  // Unread feedback count
  const { count: unreadCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('read', false);

  // Pending service requests
  const { data: pendingRequests } = await supabase
    .from('service_requests')
    .select('id, service_type, status, created_at')
    .eq('client_id', clientId)
    .eq('status', 'requested');

  // Calculate bill stats
  const todayBills = todayBillsResult.data || [];
  const todayRevenue = todayBills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
  const totalBills = billsResult.count || 0;

  return {
    reviewStats: {
      total: totalReviews,
      avgRating,
      positive: positiveReviews,
      negative: negativeReviews,
      unread: unreadCount || 0,
    },
    billStats: {
      total: totalBills,
      todayCount: todayBills.length,
      todayRevenue,
    },
    customerCount: customersResult.count || 0,
    pendingServiceRequests: (pendingRequests || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      serviceType: r.service_type as string,
      createdAt: r.created_at as string,
    })),
  };
}
