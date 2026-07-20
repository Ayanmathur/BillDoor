'use server';

/**
 * BillDoor — Activation Server Actions (§2)
 *
 * Two actions:
 *   1. verifyKeyAction — validates license key, returns pre-fill data
 *   2. activateAction — creates the client account
 *
 * SECURITY: Public HTTP POST endpoints.
 *   Rate-limited → Zod validated → processed → audit logged.
 *   License keys use crypto-safe hashing.
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { activationSchema } from '@/shared/schemas';
import {
  checkRateLimit,
  ACTIVATION_RATE_LIMIT,
  getClientIp,
} from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ============================================================
// Hash a license key (same as what admin uses when generating)
// ============================================================
function hashLicenseKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

// ============================================================
// Step 1: Verify license key
// ============================================================
interface VerifyResult {
  error?: string;
  phone?: string;
  preFill?: {
    businessName: string;
    slug: string;
    googlePlaceId: string;
    about: string;
  };
}

export async function verifyKeyAction(data: {
  licenseKey: string;
}): Promise<VerifyResult> {
  // Rate limit
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit(ACTIVATION_RATE_LIMIT, ip);
  if (!rateCheck.success) {
    return { error: `Too many attempts. Try again in ${rateCheck.resetInSeconds} seconds.` };
  }

  if (!data.licenseKey?.trim()) {
    return { error: 'License key is required.' };
  }

  const keyHash = hashLicenseKey(data.licenseKey);
  const supabase = await createAdminClient();

  const { data: key, error } = await supabase
    .from('license_keys')
    .select('id, mobile_number, status, business_name, slug, google_place_id, about')
    .eq('key_hash', keyHash)
    .single();

  if (error || !key) {
    return { error: `Invalid license key (Debug: ${error?.message || 'Not found'} - RLS/Env Issue?)` };
  }

  if (key.status === 'activated') {
    return { error: 'This license key has already been activated.' };
  }

  return {
    phone: key.mobile_number,
    preFill: {
      businessName: key.business_name || '',
      slug: key.slug || '',
      googlePlaceId: key.google_place_id || '',
      about: key.about || '',
    },
  };
}

// ============================================================
// Step 2: Create the account
// ============================================================
interface ActivateResult {
  error?: string;
}

export async function activateAction(data: {
  licenseKey: string;
  username: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  businessType: string;
  slug: string;
  phone: string;
  email: string;
}): Promise<ActivateResult> {
  // 1. Rate limit
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit(ACTIVATION_RATE_LIMIT, ip);
  if (!rateCheck.success) {
    return { error: `Too many attempts. Try again in ${rateCheck.resetInSeconds} seconds.` };
  }

  // 2. Zod validation (safeParse — never parse)
  const parsed = activationSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return { error: firstError?.message || 'Invalid input.' };
  }

  const {
    licenseKey,
    username,
    password,
    businessName,
    businessType,
    slug,
    phone,
    email,
  } = parsed.data;

  const supabase = await createAdminClient();

  // 3. Verify license key again (prevent race condition)
  const keyHash = hashLicenseKey(licenseKey);
  const { data: key, error: keyError } = await supabase
    .from('license_keys')
    .select('id, mobile_number, status, google_place_id, about')
    .eq('key_hash', keyHash)
    .single();

  if (keyError || !key) {
    return { error: 'Invalid license key.' };
  }

  if (key.status === 'activated') {
    return { error: 'This license key has already been activated.' };
  }

  // 4. Check username uniqueness
  const { data: existingUser } = await supabase
    .from('clients')
    .select('id')
    .eq('username', username)
    .is('deleted_at', null)
    .single();

  if (existingUser) {
    return { error: 'This username is already taken. Please choose another.' };
  }

  // 5. Check slug uniqueness
  const { data: existingSlug } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (existingSlug) {
    return { error: 'This URL slug is already taken. Please choose another.' };
  }

  // 6. Hash password (bcrypt, salt rounds = 12)
  const passwordHash = await bcrypt.hash(password, 12);

  // 7. Create Supabase Auth user
  const authEmail = `${username}@billdoor.local`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: authEmail,
    password: password,
    email_confirm: true,
    user_metadata: {
      username,
      role: 'client',
    },
  });

  if (authError || !authUser.user) {
    return { error: 'Failed to create account. Please try again.' };
  }

  // 8. Create client record (uses the auth user's ID as the client ID)
  const validTill = new Date();
  validTill.setFullYear(validTill.getFullYear() + 1); // Default: 1 year validity

  const { error: clientError } = await supabase
    .from('clients')
    .insert({
      id: authUser.user.id,
      business_name: businessName,
      slug,
      business_type: businessType || 'general',
      google_place_id: key.google_place_id || null,
      about: key.about || '',
      license_key_id: key.id,
      username,
      password_hash: passwordHash,
      email: email || null,
      email_verified: false,
      phone,
      registered_at: new Date().toISOString(),
      valid_till: validTill.toISOString(),
      status: 'active',
      modules_enabled: {
        review_flow: true,
        billit: true,
        appointer: true,
        whatsapp_auto: false, // Enabled manually by admin
      },
      has_gst: false,
      gst_number: null,
      owner_name: '',
      address: '',
      logo_url: null,
      instagram_url: null,
      facebook_url: null,
      website_url: null,
      show_barcode_on_bill: false,
      reward_settings: {
        triggers: { feedback: true, bill_created: false, appointment_completed: false },
        reward_type: 'percent_discount',
        reward_value: 10,
        review_reward_mode: 'all_feedback',
        max_per_customer_per_day: 1,
      },
    });

  if (clientError) {
    // Rollback: delete auth user if client creation fails
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return { error: 'Failed to create account. Please try again.' };
  }

  // 9. Mark license key as activated
  await supabase
    .from('license_keys')
    .update({ status: 'activated', client_id: authUser.user.id })
    .eq('id', key.id);

  // 10. Create bill sequence for this client
  await supabase
    .from('bill_sequences')
    .insert({
      client_id: authUser.user.id,
      bill_date: new Date().toISOString().split('T')[0],
      last_number: 0,
    });

  // 11. Seed default WhatsApp templates
  const defaultTemplates = [
    {
      client_id: authUser.user.id,
      type: 'billit',
      name: 'Bill Receipt',
      content: 'Hi {customer_name}, here is your bill from {business_name}. Amount: ₹{grand_total}. View: {bill_link}',
      is_active: true,
    },
    {
      client_id: authUser.user.id,
      type: 'appointer_reminder',
      name: 'Appointment Reminder',
      content: 'Hi {customer_name}, reminder: your appointment at {business_name} is on {slot_date} at {slot_time}.',
      is_active: true,
    },
    {
      client_id: authUser.user.id,
      type: 'broadcast',
      name: 'Thank You & Review',
      content: 'Hi {customer_name}, thank you for relying on {business_name}! 🙏\n\nHere is your bill: {bill_link}\n\nWe\'d love your feedback — please review us here: {review_link}\n\nYour support means the world to us! ❤️',
      is_active: true,
    },
  ];

  await supabase.from('whatsapp_templates').insert(defaultTemplates);

  // 12. Audit log
  await logAuditEvent(supabase, {
    actorType: 'client',
    actorId: authUser.user.id,
    action: AUDIT_ACTIONS.ACTIVATION_SUCCESS,
    target: key.id,
    metadata: { username, businessName, slug, ip },
  });

  return {};
}
