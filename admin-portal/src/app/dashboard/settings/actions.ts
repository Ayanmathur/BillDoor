'use server';

/**
 * Admin Settings Server Actions (§3)
 * 
 * - Change admin username
 * - Change admin password (bcrypt, same standard as client auth)
 * - Update admin_whatsapp_number (single source of truth in platform_settings)
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, getUserAgent } from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { supabase, user: null, adminId: null, error: 'Unauthorized.' };
  }
  return { supabase, user, adminId: user.id, error: null };
}

export async function changeAdminPasswordAction(data: { currentPassword: string; newPassword: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const rateCheck = checkRateLimit({ prefix: 'admin:settings', maxRequests: 5, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: `Rate limited. Try again in ${rateCheck.resetInSeconds}s.` };

  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { error: error || 'Unauthorized.' };

  if (!data.newPassword || data.newPassword.length < 8) return { error: 'New password must be at least 8 characters.' };

  // Verify current password
  const { data: admin } = await supabase
    .from('admin_users')
    .select('password_hash, username')
    .eq('id', adminId)
    .single();

  if (!admin) return { error: 'Admin not found.' };

  const valid = await bcrypt.compare(data.currentPassword, admin.password_hash);
  if (!valid) return { error: 'Current password is incorrect.' };

  // Hash new password (same standard as client auth — bcrypt, 12 rounds)
  const newHash = await bcrypt.hash(data.newPassword, 12);
  const { error: updateErr } = await supabase
    .from('admin_users')
    .update({ password_hash: newHash })
    .eq('id', adminId);

  if (updateErr) return { error: 'Failed to update password.' };

  // Also update Supabase Auth password
  const authEmail = `admin_${admin.username}@billdoor.local`;
  await supabase.auth.admin.updateUserById(adminId, { password: data.newPassword });

  // Force re-sign-in
  await supabase.auth.signInWithPassword({ email: authEmail, password: data.newPassword });

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: adminId,
    action: AUDIT_ACTIONS.ADMIN_PASSWORD_CHANGED,
    ipAddress: ip, userAgent: ua,
  });

  return {};
}

export async function changeAdminUsernameAction(data: { newUsername: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { error: error || 'Unauthorized.' };

  const username = data.newUsername.trim().toLowerCase();
  if (!username || username.length < 3) return { error: 'Username must be at least 3 characters.' };

  const { error: updateErr } = await supabase
    .from('admin_users')
    .update({ username })
    .eq('id', adminId);

  if (updateErr) return { error: 'Failed to update username.' };

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: adminId,
    action: AUDIT_ACTIONS.ADMIN_SETTINGS_UPDATED,
    ipAddress: ip, userAgent: ua,
    metadata: { field: 'username', newValue: username },
  });

  return {};
}

export async function updateWhatsAppNumberAction(data: { number: string }) {
  const ip = await getClientIp(headers);
  const ua = await getUserAgent(headers);
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { error: error || 'Unauthorized.' };

  const number = data.number.trim().replace(/\D/g, '');
  if (!number || number.length < 10) return { error: 'Enter a valid phone number.' };

  // Upsert platform_settings singleton
  const { data: existing } = await supabase.from('platform_settings').select('id').single();

  if (existing) {
    await supabase.from('platform_settings').update({ admin_whatsapp_number: number }).eq('id', existing.id);
  } else {
    await supabase.from('platform_settings').insert({ admin_whatsapp_number: number });
  }

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: adminId,
    action: AUDIT_ACTIONS.ADMIN_SETTINGS_UPDATED,
    ipAddress: ip, userAgent: ua,
    metadata: { field: 'admin_whatsapp_number', newValue: `***${number.slice(-4)}` },
  });

  return {};
}

export async function fetchAdminSettingsAction() {
  const { supabase, error } = await requireAdmin();
  if (error) return { error, settings: null };

  const { data: settings } = await supabase.from('platform_settings').select('admin_whatsapp_number').single();
  const { data: { user } } = await supabase.auth.getUser();

  return {
    settings: {
      whatsappNumber: settings?.admin_whatsapp_number || (process.env.ADMIN_WHATSAPP_NUMBER ? `91${process.env.ADMIN_WHATSAPP_NUMBER.replace(/^91/, '')}` : '919422880355'),
      username: user?.user_metadata?.username || '',
    },
  };
}
