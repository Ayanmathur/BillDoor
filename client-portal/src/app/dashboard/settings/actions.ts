'use server';

/**
 * Client Settings — Server Actions (§9)
 *
 * Business info, GST, socials, rewards, password change, account management.
 * All Zod-validated, audit-logged, RLS-scoped.
 */

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, getUserAgent } from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, client: null, error: 'Unauthorized.' };

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single();

  return { supabase, client, user, error: client ? null : 'Client not found.' };
}

// ============================================================
// Fetch all settings
// ============================================================
export async function fetchSettingsAction() {
  const { client, error } = await getAuthenticatedClient();
  if (error || !client) return { error, settings: null };

  return {
    settings: {
      username: client.username || '',
      businessName: client.business_name || '',
      slug: client.slug || '',
      about: client.about || '',
      ownerName: client.owner_name || '',
      address: client.address || '',
      phone: client.phone || '',
      email: client.email || '',
      logoUrl: client.logo_url || '',
      hasGst: client.has_gst || false,
      gstNumber: client.gst_number || '',
      instagramUrl: client.instagram_url || '',
      facebookUrl: client.facebook_url || '',
      websiteUrl: client.website_url || '',
      linkedinUrl: client.linkedin_url || '',
      xUrl: client.x_url || '',
      whatsappUrl: client.whatsapp_url || '',
      rewardSettings: client.reward_settings || {
        triggers: { feedback: true, bill_created: false, appointment_completed: false },
        reward_type: 'percent_discount',
        reward_value: 10,
        review_reward_mode: 'all_feedback',
        max_per_customer_per_day: 1,
      },
      loyaltyConfig: client.loyalty_config || null,
    },
  };
}

// ============================================================
// Update business info
// ============================================================
const businessInfoSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  about: z.string().max(500).optional(),
  ownerName: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(15).optional(),
});

export async function updateBusinessInfoAction(data: z.infer<typeof businessInfoSchema>) {
  const ip = await getClientIp(headers);
  const { supabase, client, user, error } = await getAuthenticatedClient();
  if (error || !client || !user) return { error: error || 'Unauthorized.' };

  const parsed = businessInfoSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  // Check slug uniqueness (exclude self)
  if (parsed.data.slug !== client.slug) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', parsed.data.slug)
      .neq('id', user.id)
      .is('deleted_at', null)
      .single();
    if (existing) return { error: 'This URL slug is already taken.' };
  }

  const { error: updateErr } = await supabase
    .from('clients')
    .update({
      business_name: parsed.data.businessName,
      slug: parsed.data.slug,
      about: parsed.data.about || '',
      owner_name: parsed.data.ownerName || '',
      address: parsed.data.address || '',
      phone: parsed.data.phone || client.phone,
    })
    .eq('id', user.id);

  if (updateErr) return { error: 'Failed to update. Try again.' };

  await logAuditEvent(supabase, {
    actorType: 'client', actorId: user.id,
    action: AUDIT_ACTIONS.BUSINESS_SETTINGS_UPDATED,
    metadata: { section: 'business_info', ip },
  });

  return {};
}

// ============================================================
// Update GST
// ============================================================
export async function updateGstAction(data: { hasGst: boolean; gstNumber: string }) {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { error: error || 'Unauthorized.' };

  if (data.hasGst && (!data.gstNumber || data.gstNumber.length < 15)) {
    return { error: 'Enter a valid 15-character GST number.' };
  }

  await supabase
    .from('clients')
    .update({
      has_gst: data.hasGst,
      gst_number: data.hasGst ? data.gstNumber.toUpperCase() : null,
    })
    .eq('id', user.id);

  return {};
}

// ============================================================
// Update socials
// ============================================================
export async function updateSocialsAction(data: {
  instagramUrl: string; facebookUrl: string; websiteUrl: string; linkedinUrl: string; xUrl: string; whatsappUrl: string;
}) {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { error: error || 'Unauthorized.' };

  await supabase
    .from('clients')
    .update({
      instagram_url: data.instagramUrl,
      facebook_url: data.facebookUrl,
      website_url: data.websiteUrl,
      linkedin_url: data.linkedinUrl,
      x_url: data.xUrl,
      whatsapp_url: data.whatsappUrl,
    })
    .eq('id', user.id);

  return {};
}

// ============================================================
// Update reward settings
// ============================================================
export async function updateRewardSettingsAction(data: {
  enabled: boolean;
  triggers: { feedback: boolean; bill_created: boolean; appointment_completed: boolean };
  rewardType: string;
  rewardValue: number;
  reviewRewardMode: string;
  maxPerCustomerPerDay: number;
}) {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { error: error || 'Unauthorized.' };

  await supabase
    .from('clients')
    .update({
      reward_settings: {
        enabled: data.enabled,
        triggers: data.triggers,
        reward_type: data.rewardType,
        reward_value: data.rewardValue,
        review_reward_mode: data.reviewRewardMode,
        max_per_customer_per_day: data.maxPerCustomerPerDay,
      },
    })
    .eq('id', user.id);

  return {};
}

// ============================================================
// Update loyalty config (Track 2)
// ============================================================
export async function updateLoyaltyConfigAction(data: {
  track2Enabled: boolean;
  track2GoalType: 'visits' | 'spend';
  track2GoalValue: number;
  track2RewardType: 'free_item' | 'flat_discount';
  track2FlatValue: number;
  track2CatalogItemName: string;
}) {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { error: error || 'Unauthorized.' };

  // For free_item, look up catalog item by name to get ID
  let catalogItemId: string | null = null;
  if (data.track2Enabled && data.track2RewardType === 'free_item' && data.track2CatalogItemName) {
    const { data: item } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('client_id', user.id)
      .ilike('name', data.track2CatalogItemName.trim())
      .single();

    if (!item) return { error: `Catalog item "${data.track2CatalogItemName}" not found. Name must match exactly.` };
    catalogItemId = item.id;
  }

  const loyaltyConfig = {
    track2_enabled: data.track2Enabled,
    track2: {
      goal_type: data.track2GoalType,
      goal_value: data.track2GoalValue,
      reward_type: data.track2RewardType,
      reward_flat_value: data.track2FlatValue,
      reward_catalog_item_id: catalogItemId,
    },
  };

  await supabase
    .from('clients')
    .update({ loyalty_config: loyaltyConfig })
    .eq('id', user.id);

  return {};
}

// ============================================================
// Change password
// ============================================================
export async function changePasswordAction(data: { currentPassword: string; newPassword: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const rateCheck = checkRateLimit({ prefix: 'client:password', maxRequests: 5, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: `Rate limited. Try again in ${rateCheck.resetInSeconds}s.` };

  const { supabase, client, user, error } = await getAuthenticatedClient();
  if (error || !client || !user) return { error: error || 'Unauthorized.' };

  if (!data.newPassword || data.newPassword.length < 8) return { error: 'New password must be at least 8 characters.' };

  const valid = await bcrypt.compare(data.currentPassword, client.password_hash);
  if (!valid) return { error: 'Current password is incorrect.' };

  const newHash = await bcrypt.hash(data.newPassword, 12);
  await supabase.from('clients').update({ password_hash: newHash }).eq('id', user.id);

  // Update Supabase Auth password too
  const adminSupabase = await createAdminClient();
  await adminSupabase.auth.admin.updateUserById(user.id, { password: data.newPassword });

  await logAuditEvent(supabase, {
    actorType: 'client', actorId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    ipAddress: ip, userAgent: ua,
  });

  return {};
}

// ============================================================
// Change username
// ============================================================
const usernameSchema = z.object({
  newUsername: z.string().trim().min(3, 'Username must be at least 3 characters').max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, dots, dashes, and underscores'),
  currentPassword: z.string().min(1, 'Enter your password to confirm'),
});

export async function changeUsernameAction(data: { newUsername: string; currentPassword: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const rateCheck = checkRateLimit({ prefix: 'client:username', maxRequests: 5, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: `Rate limited. Try again in ${rateCheck.resetInSeconds}s.` };

  const { supabase, client, user, error } = await getAuthenticatedClient();
  if (error || !client || !user) return { error: error || 'Unauthorized.' };

  const parsed = usernameSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  // Verify password
  const valid = await bcrypt.compare(parsed.data.currentPassword, client.password_hash);
  if (!valid) return { error: 'Password is incorrect.' };

  // Check uniqueness
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('username', parsed.data.newUsername)
    .neq('id', user.id)
    .is('deleted_at', null)
    .single();
  if (existing) return { error: 'This username is already taken.' };

  await supabase.from('clients').update({ username: parsed.data.newUsername }).eq('id', user.id);

  await logAuditEvent(supabase, {
    actorType: 'client', actorId: user.id,
    action: 'USERNAME_CHANGED',
    metadata: { oldUsername: client.username, newUsername: parsed.data.newUsername, ip },
  });

  return {};
}

// ============================================================
// Upload logo (uses Supabase Storage)
// ============================================================
export async function uploadLogoAction(formData: FormData) {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { error: error || 'Unauthorized.', logoUrl: null };

  const file = formData.get('logo') as File;
  if (!file) return { error: 'No file uploaded.', logoUrl: null };

  // Validate file type and size
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Only PNG, JPG, WebP, or SVG files are allowed.', logoUrl: null };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: 'Logo must be under 2MB.', logoUrl: null };
  }

  const ext = file.name.split('.').pop() || 'png';
  const filePath = `logos/${user.id}/logo.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('public-assets')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadErr) return { error: 'Failed to upload. Try again.', logoUrl: null };

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(filePath);
  const logoUrl = urlData?.publicUrl || '';

  // Save URL to client record
  await supabase.from('clients').update({ logo_url: logoUrl }).eq('id', user.id);

  return { logoUrl };
}

// ============================================================
// Delete account (soft delete with confirmation)
// ============================================================
const deleteSchema = z.object({
  confirmText: z.string().min(1, 'Enter confirmation text'),
  password: z.string().min(1, 'Enter your password'),
});

export async function deleteAccountAction(data: { confirmText: string; password: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const rateCheck = checkRateLimit({ prefix: 'client:delete', maxRequests: 3, windowSeconds: 600 }, ip);
  if (!rateCheck.success) return { error: `Rate limited. Try again in ${rateCheck.resetInSeconds}s.` };

  const { supabase, client, user, error } = await getAuthenticatedClient();
  if (error || !client || !user) return { error: error || 'Unauthorized.' };

  const parsed = deleteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  // Confirm text must be "DELETE" or the exact business name
  const isDeleteWord = parsed.data.confirmText.toUpperCase() === 'DELETE';
  const isBusinessName = parsed.data.confirmText === client.business_name;
  if (!isDeleteWord && !isBusinessName) {
    return { error: 'Type "DELETE" or your exact business name to confirm.' };
  }

  // Verify password
  const valid = await bcrypt.compare(parsed.data.password, client.password_hash);
  if (!valid) return { error: 'Password is incorrect.' };

  // Soft delete — set deleted_at timestamp
  await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id);

  await logAuditEvent(supabase, {
    actorType: 'client', actorId: user.id,
    action: 'ACCOUNT_DELETED',
    metadata: { businessName: client.business_name, ip },
    ipAddress: ip, userAgent: ua,
  });

  // Sign out
  await supabase.auth.signOut();

  return { deleted: true };
}

