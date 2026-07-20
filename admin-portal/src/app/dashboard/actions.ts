'use server';

/**
 * Admin — License Key Generation (§2)
 *
 * Cryptographically random key (crypto.randomBytes, NEVER Math.random).
 * Stored hashed (SHA-256). Raw key shown once, never retrievable.
 * WhatsApp redirect uses admin_whatsapp_number from platform_settings.
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { generateLicenseKeySchema } from '@/shared/schemas';
import { checkRateLimit, getClientIp, getUserAgent } from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';
import { encryptKey, decryptKey, hashLicenseKey } from '@/shared/crypto-utils';
import crypto from 'crypto';

function generateKey(): string {
  return crypto.randomBytes(24).toString('base64url');
}

interface GenerateResult {
  error?: string;
  rawKey?: string;
  keyId?: string;
  whatsappNumber?: string;
}

export async function generateLicenseKeyAction(data: {
  mobileNumber: string;
  businessName?: string;
  slug?: string;
  googlePlaceId?: string;
  about?: string;
}): Promise<GenerateResult> {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit(
    { prefix: 'admin:keygen', maxRequests: 20, windowSeconds: 60 },
    ip
  );
  if (!rateCheck.success) {
    return { error: `Rate limited. Try again in ${rateCheck.resetInSeconds}s.` };
  }

  const parsed = generateLicenseKeySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  const { mobileNumber, businessName, slug, googlePlaceId, about } = parsed.data;
  const supabase = await createAdminClient();

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  // Generate cryptographically random key
  const rawKey = generateKey();
  const keyHash = hashLicenseKey(rawKey);
  const keyEncrypted = encryptKey(rawKey);

  // Check for hash collision (astronomically unlikely but defense-in-depth)
  const { data: existing } = await supabase
    .from('license_keys')
    .select('id')
    .eq('key_hash', keyHash)
    .single();

  if (existing) {
    // Regenerate on collision
    return generateLicenseKeyAction(data);
  }

  // Insert license key (hash for verification, encrypted for admin unmask)
  const { data: newKey, error: insertError } = await supabase
    .from('license_keys')
    .insert({
      key_hash: keyHash,
      key_encrypted: keyEncrypted,
      mobile_number: mobileNumber,
      status: 'unused',
      business_name: businessName || null,
      slug: slug || null,
      google_place_id: googlePlaceId || null,
      about: about || null,
    })
    .select('id')
    .single();

  if (insertError || !newKey) {
    return { error: 'Failed to generate key. Try again.' };
  }

  // Get admin WhatsApp number from platform_settings (single source of truth)
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('admin_whatsapp_number')
    .single();

  // Audit log
  await logAuditEvent(supabase, {
    actorType: 'admin',
    actorId: user.id,
    action: AUDIT_ACTIONS.LICENSE_KEY_GENERATED,
    target: newKey.id,
    metadata: { mobileNumber, hasPrefill: !!businessName, ip },
  });

  return {
    rawKey,
    keyId: newKey.id,
    whatsappNumber: settings?.admin_whatsapp_number || '',
  };
}

/**
 * Fetch all license keys for the admin table view.
 */
export async function fetchLicenseKeysAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', keys: [] };
  }

  const { data, error } = await supabase
    .from('license_keys')
    .select(`
      id, mobile_number, status, business_name, slug, created_at,
      clients ( id, business_name, username, status, registered_at )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { error: 'Failed to fetch keys.', keys: [] };
  return { keys: data || [] };
}

/**
 * Fetch all clients for the admin dashboard.
 */
export async function fetchClientsAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', clients: [] };
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, business_name, username, slug, phone, status, modules_enabled, registered_at, valid_till, deleted_at')
    .is('deleted_at', null)
    .order('registered_at', { ascending: false })
    .limit(200);

  if (error) return { error: 'Failed to fetch clients.', clients: [] };
  return { clients: data || [] };
}

/**
 * Toggle modules for a client.
 */
export async function toggleModulesAction(data: {
  clientId: string;
  modules: { reviewFlow: boolean; billit: boolean; appointer: boolean; whatsappAuto: boolean };
}) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  // Read current to preserve quick_tools (merge, not overwrite)
  const { data: client } = await supabase
    .from('clients')
    .select('modules_enabled')
    .eq('id', data.clientId)
    .single();

  const current = (client?.modules_enabled || {}) as Record<string, unknown>;

  const { error } = await supabase
    .from('clients')
    .update({
      modules_enabled: {
        review_flow: data.modules.reviewFlow,
        billit: data.modules.billit,
        appointer: data.modules.appointer,
        whatsapp_auto: data.modules.whatsappAuto,
        quick_tools: current.quick_tools || { gst_calculator: false, catalog_viewer: false },
      },
    })
    .eq('id', data.clientId);

  if (error) return { error: 'Failed to update modules.' };

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_MODULES_TOGGLED,
    target: data.clientId,
    metadata: { modules: data.modules },
  });

  return {};
}

/**
 * Toggle individual Quick Tools for a client.
 */
export async function toggleQuickToolsAction(data: {
  clientId: string;
  tool: string;
  enabled: boolean;
}) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  // Read current modules_enabled to merge
  const { data: client } = await supabase
    .from('clients')
    .select('modules_enabled')
    .eq('id', data.clientId)
    .single();

  const current = (client?.modules_enabled || {}) as Record<string, unknown>;
  const currentTools = (current.quick_tools || {}) as Record<string, boolean>;

  const { error } = await supabase
    .from('clients')
    .update({
      modules_enabled: {
        ...current,
        quick_tools: {
          ...currentTools,
          [data.tool]: data.enabled,
        },
      },
    })
    .eq('id', data.clientId);

  if (error) return { error: 'Failed to update quick tool.' };

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_MODULES_TOGGLED,
    target: data.clientId,
    metadata: { quickTool: data.tool, enabled: data.enabled },
  });

  return {};
}

/**
 * Revoke or reactivate a client.
 */
export async function toggleClientStatusAction(data: { clientId: string; action: 'revoke' | 'reactivate' }) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  const newStatus = data.action === 'revoke' ? 'revoked' : 'active';
  const { error } = await supabase
    .from('clients')
    .update({ status: newStatus })
    .eq('id', data.clientId);

  if (error) return { error: `Failed to ${data.action} client.` };

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: user.id,
    action: data.action === 'revoke' ? AUDIT_ACTIONS.CLIENT_REVOKED : AUDIT_ACTIONS.CLIENT_REACTIVATED,
    target: data.clientId,
  });

  return {};
}

// ============================================================
// Inquiries — leads from "Get a license key" on login page
// ============================================================

export async function fetchInquiriesAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', inquiries: null };
  }

  const { data: inquiries, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { error: 'Failed to fetch inquiries.', inquiries: null };
  return { inquiries };
}

export async function updateInquiryStatusAction(data: {
  inquiryId: string;
  status: 'new' | 'contacted' | 'converted' | 'dismissed';
  notes?: string;
}) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  const update: Record<string, unknown> = {
    status: data.status,
    updated_at: new Date().toISOString(),
  };
  if (data.notes !== undefined) update.notes = data.notes;

  const { error } = await supabase
    .from('inquiries')
    .update(update)
    .eq('id', data.inquiryId);

  if (error) return { error: 'Failed to update inquiry.' };
  return {};
}

// ============================================================
// Valid-till extension — one-click +1/+N months
// ============================================================

export async function extendValidityAction(data: { clientId: string; months: number }) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  if (data.months < 1 || data.months > 24) return { error: 'Months must be between 1 and 24.' };

  // Get current valid_till
  const { data: client } = await supabase
    .from('clients')
    .select('valid_till')
    .eq('id', data.clientId)
    .single();

  if (!client) return { error: 'Client not found.' };

  // Extend from current valid_till or now (whichever is later)
  const baseDate = client.valid_till && new Date(client.valid_till) > new Date()
    ? new Date(client.valid_till)
    : new Date();
  baseDate.setMonth(baseDate.getMonth() + data.months);

  const { error } = await supabase
    .from('clients')
    .update({ valid_till: baseDate.toISOString() })
    .eq('id', data.clientId);

  if (error) return { error: 'Failed to extend validity.' };

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_VALIDITY_EXTENDED,
    target: data.clientId,
    metadata: { months: data.months, newValidTill: baseDate.toISOString() },
  });

  return {};
}

// ============================================================
// Unmask license key — decrypt for admin to resend
// ============================================================

export async function unmaskKeyAction(data: { keyId: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', rawKey: null };
  }

  const { data: key } = await supabase
    .from('license_keys')
    .select('id, key_encrypted, mobile_number')
    .eq('id', data.keyId)
    .single();

  if (!key || !key.key_encrypted) {
    return { error: 'Key not found or was generated before encryption was enabled.', rawKey: null };
  }

  try {
    const rawKey = decryptKey(key.key_encrypted);

    // Audit log — unmasking a key is a sensitive action
    await logAuditEvent(supabase, {
      actorType: 'admin', actorId: user.id,
      action: AUDIT_ACTIONS.LICENSE_KEY_COPIED,
      target: key.id,
      ipAddress: ip, userAgent: ua,
      metadata: { action: 'unmask', mobile: key.mobile_number },
    });

    return { rawKey };
  } catch {
    return { error: 'Failed to decrypt key. Check encryption secret.', rawKey: null };
  }
}

// ============================================================
// Create Razorpay payment link — tiered pricing
// ============================================================

import { createPaymentLink as rpayCreateLink, calculateAmount } from '@/lib/razorpay';

export async function createPaymentLinkAction(data: {
  clientId: string;
  months?: number;
  customAmountPaise?: number;
}) {
  const ip = await getClientIp(headers);
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  // Fetch client
  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, phone, modules_enabled')
    .eq('id', data.clientId)
    .single();

  if (!client) return { error: 'Client not found.' };

  // Fetch pricing from platform_settings
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('pricing_1_service_paise, pricing_2_services_paise, pricing_3_services_paise, default_subscription_months')
    .single();

  const pricing = settings || {
    pricing_1_service_paise: 50000,
    pricing_2_services_paise: 80000,
    pricing_3_services_paise: 100000,
    default_subscription_months: 1,
  };

  const months = data.months || pricing.default_subscription_months;
  const modules = (client.modules_enabled || {}) as {
    review_flow: boolean; billit: boolean; appointer: boolean;
  };
  const amountPaise = data.customAmountPaise || calculateAmount(modules, pricing) * months;

  // Create Razorpay payment link
  const result = await rpayCreateLink({
    clientId: client.id,
    businessName: client.business_name,
    phone: client.phone,
    amountPaise,
    months,
  });

  if ('error' in result) return { error: result.error };

  // Insert subscription_payments record
  await supabase
    .from('subscription_payments')
    .insert({
      client_id: client.id,
      razorpay_payment_link_id: result.paymentLinkId,
      amount_paise: amountPaise,
      months,
      status: 'created',
      payment_link_url: result.shortUrl,
      notes: { source: 'admin_manual', created_by: user.id },
    });

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: user.id,
    action: 'PAYMENT_LINK_CREATED',
    target: client.id,
    metadata: {
      business_name: client.business_name,
      amount_paise: amountPaise,
      months,
      payment_link_url: result.shortUrl,
      ip,
    },
  });

  return { shortUrl: result.shortUrl, amountPaise, months };
}

// ============================================================
// Fetch subscription payment history for a client
// ============================================================

export async function fetchSubscriptionPaymentsAction(clientId: string) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', payments: [] };
  }

  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { error: 'Failed to fetch payments.', payments: [] };
  return { payments: data || [] };
}

// ============================================================
// Fetch pricing settings (for admin UI display)
// ============================================================

export async function fetchPricingAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  const { data } = await supabase
    .from('platform_settings')
    .select('pricing_1_service_paise, pricing_2_services_paise, pricing_3_services_paise, default_subscription_months')
    .single();

  return { pricing: data };
}

