'use server';

/**
 * Client Review Dashboard — Server Actions (§5.3)
 *
 * Fetches reviews, marks read/archived, generates branded QR,
 * exports XLSX.
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================
// Fetch reviews with filters
// ============================================================
export async function fetchReviewsAction(filters?: {
  dateFrom?: string;
  dateTo?: string;
  archived?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', reviews: null, stats: null };

  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('reviews')
    .select('*', { count: 'exact' })
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');
  if (filters?.archived !== undefined) {
    query = query.eq('archived', filters.archived);
  } else {
    query = query.eq('archived', false); // Default: show non-archived
  }

  const { data: reviews, count, error } = await query;
  if (error) return { error: 'Failed to fetch reviews.', reviews: null, stats: null };

  // Stats (all time, not filtered)
  const { data: allReviews } = await supabase
    .from('reviews')
    .select('stars')
    .eq('client_id', user.id);

  const all = allReviews || [];
  const total = all.length;
  const positive = all.filter(r => r.stars >= 4).length;
  const negative = all.filter(r => r.stars <= 3).length;
  const avgRating = total > 0 ? (all.reduce((s, r) => s + r.stars, 0) / total).toFixed(1) : '0.0';

  const { count: unreadCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', user.id)
    .eq('read', false)
    .eq('archived', false);

  return {
    reviews,
    total: count || 0,
    stats: { total, positive, negative, avgRating, unread: unreadCount || 0 },
  };
}

// ============================================================
// Mark reviews as read
// ============================================================
export async function markReviewReadAction(reviewId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('reviews')
    .update({ read: true })
    .eq('id', reviewId)
    .eq('client_id', user.id);

  return {};
}

// ============================================================
// Archive review (separate from read)
// ============================================================
export async function archiveReviewAction(reviewId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('reviews')
    .update({ archived: true, read: true })
    .eq('id', reviewId)
    .eq('client_id', user.id);

  return {};
}

// ============================================================
// Fetch client slug + review link info
// ============================================================
export async function fetchReviewLinkAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', slug: null, logoUrl: null };

  const { data: client } = await supabase
    .from('clients')
    .select('slug, logo_url, business_name')
    .eq('id', user.id)
    .single();

  if (!client) return { error: 'Client not found.', slug: null, logoUrl: null };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    slug: client.slug,
    logoUrl: client.logo_url,
    businessName: client.business_name,
    reviewUrl: `${appUrl}/review/${client.slug}`,
  };
}

// ============================================================
// Export reviews as XLSX (returns JSON data for client-side generation)
// ============================================================
export async function fetchReviewsForExportAction(dateFrom?: string, dateTo?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', data: null };

  let query = supabase
    .from('reviews')
    .select('stars, feedback_text, source, created_at, read, archived')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error) return { error: 'Failed to fetch.', data: null };

  return { data };
}
