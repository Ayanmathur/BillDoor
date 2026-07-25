'use server';

/**
 * Dashboard — Server Actions
 *
 * Fetches summary data for the dashboard cards.
 * Each query is RLS-scoped to the authenticated client.
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function fetchMyShopsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { shops: [], activeShopId: null, canSwitch: false };

  const { data: currentClient } = await supabase
    .from('clients')
    .select('id, business_name, slug, parent_owner_id, multi_shop_granted, modules_enabled')
    .eq('id', user.id)
    .single();

  if (!currentClient) return { shops: [], activeShopId: null, canSwitch: false };

  const ownerId = (currentClient as any).parent_owner_id || currentClient.id;
  const adminGranted = (currentClient as any).multi_shop_granted === true;
  const clientEnabled = ((currentClient.modules_enabled as any)?.multi_shop) === true;
  const canSwitch = adminGranted && clientEnabled;

  if (!canSwitch) {
    return {
      shops: [{ id: currentClient.id, name: currentClient.business_name, slug: currentClient.slug }],
      activeShopId: currentClient.id,
      canSwitch: false,
    };
  }

  const { data: shops } = await supabase
    .from('clients')
    .select('id, business_name, slug')
    .or(`id.eq.${ownerId},parent_owner_id.eq.${ownerId}`)
    .eq('status', 'active');

  const cookieStore = await cookies();
  const activeCookie = cookieStore.get('billdoor_active_shop_id')?.value;
  const activeShopId = activeCookie && shops?.some(s => s.id === activeCookie) ? activeCookie : currentClient.id;

  return {
    shops: (shops || []).map(s => ({ id: s.id, name: s.business_name, slug: s.slug })),
    activeShopId,
    canSwitch: true,
  };
}

export async function setActiveShopAction(shopId: string) {
  const cookieStore = await cookies();
  cookieStore.set('billdoor_active_shop_id', shopId, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  return { success: true };
}

export async function fetchDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const clientId = user.id;

  // Fetch client settings for tiles + slug
  const { data: clientSettings } = await supabase
    .from('clients')
    .select('slug, modules_enabled, dashboard_tiles_hidden')
    .eq('id', clientId)
    .single();

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

  // Monthly Expenses (for Financial Overview card)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('client_id', clientId)
    .gte('expense_date', startOfMonth);

  const monthExpenseTotal = (monthExpenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

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
    monthExpenseTotal,
    pendingServiceRequests: (pendingRequests || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      serviceType: r.service_type as string,
      createdAt: r.created_at as string,
    })),
    clientSlug: clientSettings?.slug || '',
    modulesEnabled: clientSettings?.modules_enabled || {},
    dashboardTilesHidden: clientSettings?.dashboard_tiles_hidden || [],
  };
}
