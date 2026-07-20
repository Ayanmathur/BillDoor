'use server';

/**
 * Digital Bill Page — Server Actions
 *
 * Public — fetch bill by slug, submit inline review.
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';
import { z } from 'zod';

export async function fetchBillBySlugAction(slug: string) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'bill:fetch', maxRequests: 30, windowSeconds: 60 }, ip);
  if (!rateCheck.success) return { error: 'Rate limited.', bill: null, client: null, customer: null };

  const supabase = await createAdminClient();

  const { data: bill } = await supabase
    .from('bills')
    .select(`
      id, bill_number, bill_slug, line_items, subtotal, discount_total,
      gst_total, extra_charges, extra_charges_note, grand_total,
      notes, created_at, sent_via,
      customer_id, client_id, status, void_reason
    `)
    .eq('bill_slug', slug)
    .single();

  if (!bill) return { error: 'Bill not found.', bill: null, client: null, customer: null };

  // Fetch client info
  const { data: client } = await supabase
    .from('clients')
    .select('business_name, slug, address, phone, logo_url, has_gst, gst_number, google_place_id, instagram_url, facebook_url, website_url, about, barcode_enabled, status, reward_settings')
    .eq('id', bill.client_id)
    .single();

  // Fetch customer
  const { data: customer } = await supabase
    .from('customers')
    .select('name, phone')
    .eq('id', bill.customer_id)
    .single();

  // Fetch client loyalty config
  const { data: clientWithLoyalty } = await supabase
    .from('clients')
    .select('loyalty_config')
    .eq('id', bill.client_id)
    .single();

  // Fetch customer loyalty progress
  let loyaltyProgress = null;
  if (clientWithLoyalty?.loyalty_config?.track2_enabled && bill.customer_id) {
    const { data: lp } = await supabase
      .from('customer_loyalty_progress')
      .select('current_count')
      .eq('client_id', bill.client_id)
      .eq('customer_id', bill.customer_id)
      .single();
    loyaltyProgress = lp;
  }

  if (client?.status === 'revoked') return { error: 'unavailable', bill: null, client: null, customer: null, loyaltyConfig: null, loyaltyProgress: null };

  return {
    bill,
    client,
    customer,
    loyaltyConfig: clientWithLoyalty?.loyalty_config || null,
    loyaltyProgress,
  };
}

const inlineReviewSchema = z.object({
  clientId: z.string().uuid(),
  billId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  feedbackText: z.string().optional(),
});

export async function submitInlineReviewAction(data: {
  clientId: string;
  billId: string;
  stars: number;
  feedbackText?: string;
}) {
  const parsed = inlineReviewSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input data.' };

  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'bill:review', maxRequests: 5, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: 'Too many attempts.' };

  const supabase = await createAdminClient();

  // Check if already reviewed for this bill
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('client_id', data.clientId)
    .eq('bill_id', data.billId)
    .single();

  if (existing) return { error: 'already_reviewed' };

  const { error } = await supabase
    .from('reviews')
    .insert({
      client_id: data.clientId,
      bill_id: data.billId,
      stars: data.stars,
      feedback_text: data.feedbackText || null,
      source: 'digital_bill',
      ip_address: ip,
      read: false,
    });

  if (error) return { error: 'Failed to submit review.' };
  return {};
}
