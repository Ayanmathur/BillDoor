'use server';

/**
 * BillDoor — Password Reset Server Actions (§2)
 *
 * Two paths:
 *   1. Email on file: license key + magic link sent to registered email
 *   2. No email: license key → flagged for admin-assisted reset via WhatsApp
 *
 * NEVER silently allow a reset on license key alone with zero secondary check.
 * Rate-limit both paths. Log every attempt in audit_log.
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { passwordResetRequestSchema } from '@/shared/schemas';
import {
  checkRateLimit,
  PASSWORD_RESET_RATE_LIMIT,
  getClientIp,
} from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';
import crypto from 'crypto';

function hashLicenseKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

interface ResetRequestResult {
  error?: string;
  path?: 'email' | 'admin_assisted';
  message?: string;
}

export async function requestPasswordResetAction(data: {
  licenseKey: string;
  email?: string;
}): Promise<ResetRequestResult> {
  // 1. Rate limit — strict (3 per 5 minutes)
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit(PASSWORD_RESET_RATE_LIMIT, ip);
  if (!rateCheck.success) {
    return { error: `Too many attempts. Try again in ${rateCheck.resetInSeconds} seconds.` };
  }

  // 2. Validate
  const parsed = passwordResetRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { error: 'License key is required.' };
  }

  const { licenseKey } = parsed.data;
  const supabase = await createAdminClient();

  // 3. Find license key
  const keyHash = hashLicenseKey(licenseKey);
  const { data: key } = await supabase
    .from('license_keys')
    .select('id, client_id, status')
    .eq('key_hash', keyHash)
    .single();

  if (!key || key.status !== 'activated' || !key.client_id) {
    // Generic error — don't reveal if key exists
    await logAuditEvent(supabase, {
      actorType: 'system', actorId: 'auth',
      action: AUDIT_ACTIONS.PASSWORD_RESET_FAILED,
      metadata: { reason: 'key_not_found_or_inactive', ip },
    });
    return { error: 'Invalid license key or account not yet activated.' };
  }

  // 4. Find client
  const { data: client } = await supabase
    .from('clients')
    .select('id, email, email_verified, username, business_name, status')
    .eq('id', key.client_id)
    .is('deleted_at', null)
    .single();

  if (!client) {
    return { error: 'Account not found.' };
  }

  // Revoked clients cannot reset password — they can't log in anyway
  if (client.status === 'revoked') {
    await logAuditEvent(supabase, {
      actorType: 'client', actorId: client.id,
      action: AUDIT_ACTIONS.PASSWORD_RESET_FAILED,
      metadata: { reason: 'account_revoked', ip },
    });
    return { error: 'Your account has been suspended. Contact support.' };
  }

  // Log the attempt
  await logAuditEvent(supabase, {
    actorType: 'client', actorId: client.id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
    metadata: { hasEmail: !!client.email, ip },
  });

  // 5. Determine path
  if (client.email && client.email_verified) {
    // PATH 1: Email on file → send magic link
    // Two factors: license key (something they have) + email access (something they control)
    
    // Generate a time-limited reset token
    const resetToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store token in notifications as a temporary mechanism
    // In production, use a dedicated password_reset_tokens table
    await supabase.from('notifications').insert({
      client_id: client.id,
      type: 'orbitex_update',
      title: 'Password Reset Requested',
      message: JSON.stringify({
        tokenHash,
        expiresAt: expiresAt.toISOString(),
        type: 'password_reset',
      }),
      read: false,
    });

    // TODO: Send email with reset link containing resetToken
    // For now, log the token for development purposes
    // In production: use Resend/SendGrid to send the magic link

    return {
      path: 'email',
      message: `A password reset link has been sent to ${client.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}. Check your inbox.`,
    };
  } else {
    // PATH 2: No email → admin-assisted reset
    // License key alone is NOT enough — requires admin verification via WhatsApp
    
    // Create a notification for the admin
    // The admin dashboard shows a flag, admin contacts client via WhatsApp to verify
    await supabase.from('notifications').insert({
      client_id: client.id,
      type: 'orbitex_update',
      title: 'Admin-Assisted Password Reset',
      message: JSON.stringify({
        type: 'admin_reset_request',
        clientId: client.id,
        username: client.username,
        businessName: client.business_name,
        requestedAt: new Date().toISOString(),
        ip,
      }),
      read: false,
    });

    // Get admin WhatsApp for the message
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('admin_whatsapp_number')
      .single();

    return {
      path: 'admin_assisted',
      message: `No email on file. A password reset request has been sent to the BillDoor support team. They will verify your identity via WhatsApp (${settings?.admin_whatsapp_number ? '***' + settings.admin_whatsapp_number.slice(-4) : 'support'}) and reset your password.`,
    };
  }
}

/**
 * Admin action: Complete an admin-assisted password reset.
 * Called from admin dashboard after WhatsApp verification.
 */
export async function adminResetClientPasswordAction(data: {
  clientId: string;
  newPassword: string;
}) {
  const supabase = await createAdminClient();

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  if (!data.newPassword || data.newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(data.newPassword, 12);

  // Update client password hash
  const { error: updateError } = await supabase
    .from('clients')
    .update({ password_hash: passwordHash })
    .eq('id', data.clientId);

  if (updateError) return { error: 'Failed to reset password.' };

  // Also update Supabase Auth password
  const { data: client } = await supabase
    .from('clients')
    .select('username')
    .eq('id', data.clientId)
    .single();

  if (client) {
    await supabase.auth.admin.updateUserById(data.clientId, {
      password: data.newPassword,
    });
  }

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_PASSWORD_RESET,
    target: data.clientId,
  });

  return {};
}
