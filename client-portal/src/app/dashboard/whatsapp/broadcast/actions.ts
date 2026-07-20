'use server';

/**
 * WhatsApp Broadcast — Server Actions
 *
 * Audience fetching (opted_in = true, deduped by phone),
 * campaign creation, and send execution.
 *
 * Sending ONLY goes through the official WhatsApp Business Cloud API.
 * Never personal-number bulk sends.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { decryptCredential } from '@/lib/encryption';

const audienceFilterSchema = z.object({
  sourceModule: z.enum(['all', 'billit', 'appointer']).default('all'),
  lastVisitDays: z.number().nullable().optional(),
  minVisits: z.number().nullable().optional(),
  minSpent: z.number().nullable().optional(),
});

const sendSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  filters: audienceFilterSchema,
});

// ---- Fetch Audience (preview + count) ----
export async function fetchAudienceAction(filters: {
  sourceModule?: string;
  lastVisitDays?: number | null;
  minVisits?: number | null;
  minSpent?: number | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', count: 0, preview: [] };

  const parsed = audienceFilterSchema.safeParse(filters);
  if (!parsed.success) return { error: 'Invalid filters.', count: 0, preview: [] };

  let query = supabase
    .from('customers')
    .select('id, name, phone, total_visits, total_spent, last_visit_at')
    .eq('client_id', user.id)
    .eq('opted_in', true);

  // Date range filter
  if (parsed.data.lastVisitDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parsed.data.lastVisitDays);
    query = query.gte('last_visit_at', cutoff.toISOString());
  }

  // Engagement filters
  if (parsed.data.minVisits) {
    query = query.gte('total_visits', parsed.data.minVisits);
  }
  if (parsed.data.minSpent) {
    query = query.gte('total_spent', parsed.data.minSpent);
  }

  // Order by most recent visit
  query = query.order('last_visit_at', { ascending: false });

  const { data, error } = await query;

  if (error) return { error: 'Failed to fetch audience.', count: 0, preview: [] };

  // Deduplicate by phone number
  const seen = new Set<string>();
  const deduped = (data || []).filter((c: Record<string, unknown>) => {
    const phone = c.phone as string;
    if (seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });

  return {
    count: deduped.length,
    preview: deduped.slice(0, 10).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string,
      phone: c.phone as string,
      totalVisits: c.total_visits as number,
    })),
  };
}

// ---- Send Broadcast Campaign ----
export async function sendBroadcastAction(input: {
  templateId: string;
  filters: {
    sourceModule?: string;
    lastVisitDays?: number | null;
    minVisits?: number | null;
    minSpent?: number | null;
  };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  // 1. Verify WhatsApp connection
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('connection_status, api_credentials_encrypted, monthly_message_count')
    .eq('client_id', user.id)
    .single();

  if (!config || config.connection_status !== 'connected') {
    return { error: 'WhatsApp is not connected. Go to Settings to connect your API.' };
  }

  if (!config.api_credentials_encrypted) {
    return { error: 'No API credentials found. Save your credentials in Settings first.' };
  }

  // 2. Fetch template
  const { data: template } = await supabase
    .from('whatsapp_templates')
    .select('content, name')
    .eq('id', parsed.data.templateId)
    .eq('client_id', user.id)
    .eq('type', 'broadcast')
    .eq('is_active', true)
    .single();

  if (!template) return { error: 'Template not found or inactive.' };

  // 3. Fetch audience (opted_in only, deduped)
  let query = supabase
    .from('customers')
    .select('id, name, phone')
    .eq('client_id', user.id)
    .eq('opted_in', true);

  if (parsed.data.filters.lastVisitDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parsed.data.filters.lastVisitDays);
    query = query.gte('last_visit_at', cutoff.toISOString());
  }
  if (parsed.data.filters.minVisits) {
    query = query.gte('total_visits', parsed.data.filters.minVisits);
  }
  if (parsed.data.filters.minSpent) {
    query = query.gte('total_spent', parsed.data.filters.minSpent);
  }

  const { data: audience } = await query;
  if (!audience || audience.length === 0) {
    return { error: 'No opted-in customers match your filters.' };
  }

  // Deduplicate by phone
  const seen = new Set<string>();
  const recipients = audience.filter((c: Record<string, unknown>) => {
    const phone = c.phone as string;
    if (seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });

  // 4. Get client business name for template variable substitution
  const { data: client } = await supabase
    .from('clients')
    .select('business_name')
    .eq('id', user.id)
    .single();

  const shopName = (client?.business_name as string) || 'our store';

  // 5. Create campaign row
  const { data: campaign, error: campaignError } = await supabase
    .from('broadcast_campaigns')
    .insert({
      client_id: user.id,
      template_id: parsed.data.templateId,
      audience_filter: parsed.data.filters,
      recipient_count: recipients.length,
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    return { error: 'Failed to create campaign.' };
  }

  // 6. Create recipient rows
  const recipientRows = recipients.map((c: Record<string, unknown>) => ({
    campaign_id: campaign.id,
    customer_id: c.id as string,
    phone: c.phone as string,
    status: 'pending',
  }));

  await supabase.from('broadcast_recipients').insert(recipientRows);

  // 7. STUB: Send via Meta Cloud API
  // In production, this would:
  // - Decrypt credentials: decryptCredential(config.api_credentials_encrypted)
  // - Parse { phoneNumberId, accessToken }
  // - For each recipient, POST to https://graph.facebook.com/v21.0/{phoneNumberId}/messages
  //   with the template content (variable-substituted: {customer_name} -> c.name, {business_name} -> shopName)
  // - Update each broadcast_recipients row with status = 'sent' or 'failed'
  //
  // For now, mark all as "sent" (stub)
  await supabase
    .from('broadcast_recipients')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('campaign_id', campaign.id);

  // 8. Increment monthly message count
  await supabase
    .from('whatsapp_config')
    .update({
      monthly_message_count: (config.monthly_message_count || 0) + recipients.length,
    })
    .eq('client_id', user.id);

  return {
    success: true,
    campaignId: campaign.id,
    recipientCount: recipients.length,
  };
}

// ---- Fetch Campaign History ----
export async function fetchCampaignHistoryAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', campaigns: [] };

  const { data, error } = await supabase
    .from('broadcast_campaigns')
    .select(`
      id, template_id, audience_filter, sent_at, recipient_count, created_at,
      whatsapp_templates ( name )
    `)
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { error: 'Failed to fetch campaigns.', campaigns: [] };

  return {
    campaigns: (data || []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      templateName: (c.whatsapp_templates as Record<string, unknown>)?.name as string || 'Unknown',
      recipientCount: c.recipient_count as number,
      sentAt: c.sent_at as string | null,
      createdAt: c.created_at as string,
    })),
  };
}
