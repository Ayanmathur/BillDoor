'use server';

/**
 * Admin Login Server Action
 * Authenticates against admin_users table (not clients).
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { loginSchema } from '@/shared/schemas';
import { checkRateLimit, AUTH_RATE_LIMIT, getClientIp } from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';
import bcrypt from 'bcryptjs';

export async function adminLoginAction(data: { username: string; password: string }) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ ...AUTH_RATE_LIMIT, prefix: 'admin:auth' }, ip);
  if (!rateCheck.success) {
    return { error: `Too many attempts. Try again in ${rateCheck.resetInSeconds}s.` };
  }

  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid credentials.' };

  const { username, password } = parsed.data;
  const supabase = await createAdminClient();

  const { data: admin, error: lookupErr } = await supabase
    .from('admin_users')
    .select('id, username, password_hash')
    .eq('username', username)
    .single();

  if (lookupErr || !admin) {
    await logAuditEvent(supabase, {
      actorType: 'system', actorId: 'admin-auth',
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { username, reason: 'user_not_found', ip },
    });
    return { error: 'Invalid credentials.' };
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    await logAuditEvent(supabase, {
      actorType: 'admin', actorId: admin.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { reason: 'invalid_password', ip },
    });
    return { error: 'Invalid credentials.' };
  }

  // Create/sign-in Supabase Auth session for admin
  const authEmail = `admin_${username}@billdoor.local`;
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: authEmail, password });

  if (signInErr) {
    // First login — create auth user
    const { error: createErr } = await supabase.auth.admin.createUser({
      id: admin.id,
      email: authEmail, password, email_confirm: true,
      user_metadata: { admin_id: admin.id, username: admin.username, role: 'admin' },
    });
    if (createErr) return { error: 'Authentication failed.' };

    const { error: retryErr } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (retryErr) return { error: 'Authentication failed.' };
  }

  await logAuditEvent(supabase, {
    actorType: 'admin', actorId: admin.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    metadata: { ip },
  });

  return {};
}
