'use server';

/**
 * BillDoor — Login Server Action
 * 
 * SECURITY: This is a public HTTP POST endpoint.
 * Steps: (1) rate limit, (2) validate input, (3) authenticate, (4) audit log.
 * Uses safeParse() — never throws unhandled exceptions.
 */

import { headers } from 'next/headers';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/shared/schemas';
import {
  checkRateLimit,
  AUTH_RATE_LIMIT,
  getClientIp,
} from '@/shared/rate-limit';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';

interface LoginResult {
  error?: string;
}

export async function loginAction(data: {
  username: string;
  password: string;
}): Promise<LoginResult> {
  // 1. Rate limit (by IP)
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit(AUTH_RATE_LIMIT, ip);
  if (!rateCheck.success) {
    return {
      error: `Too many login attempts. Try again in ${rateCheck.resetInSeconds} seconds.`,
    };
  }

  // 2. Validate input with Zod (safeParse, never parse)
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { error: 'Invalid username or password.' };
  }

  const { username, password } = parsed.data;

  // 3. Look up client by username
  const supabase = await createAdminClient();

  const { data: client, error: lookupError } = await supabase
    .from('clients')
    .select('id, username, password_hash, status, deleted_at')
    .eq('username', username)
    .is('deleted_at', null)
    .single();

  if (lookupError || !client) {
    await logAuditEvent(supabase, {
      actorType: 'system',
      actorId: 'auth',
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { username, reason: 'user_not_found', ip },
    });
    // Generic message — don't reveal if username exists
    return { error: 'Invalid username or password.' };
  }

  // Check if client is revoked
  if (client.status === 'revoked') {
    await logAuditEvent(supabase, {
      actorType: 'client',
      actorId: client.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { reason: 'account_revoked', ip },
    });
    return { error: 'Your account has been suspended. Contact support.' };
  }

  // 4. Verify password (bcrypt)
  // Dynamic import to avoid Edge runtime issues
  const bcrypt = await import('bcryptjs');
  const passwordValid = await bcrypt.compare(password, client.password_hash);

  if (!passwordValid) {
    await logAuditEvent(supabase, {
      actorType: 'client',
      actorId: client.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      metadata: { reason: 'invalid_password', ip },
    });
    return { error: 'Invalid username or password.' };
  }

  // 5. Create Supabase Auth session
  // Use the regular client (anon key) so the session cookie is set properly
  const authClient = await createClient();
  const authEmail = `${username}@billdoor.local`;

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: authEmail,
    password: password,
  });

  if (signInError) {
    // If the user doesn't exist in Supabase Auth yet (first login after migration),
    // create them
    if (signInError.message.includes('Invalid login credentials')) {
      const { error: signUpError } = await supabase.auth.admin.createUser({
        email: authEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          client_id: client.id,
          username: client.username,
          role: 'client',
        },
      });

      if (signUpError) {
        return { error: 'Authentication failed. Please try again.' };
      }

      // Retry sign in with regular client
      const { error: retryError } = await authClient.auth.signInWithPassword({
        email: authEmail,
        password: password,
      });

      if (retryError) {
        return { error: 'Authentication failed. Please try again.' };
      }
    } else {
      return { error: 'Authentication failed. Please try again.' };
    }
  }

  // 6. Audit log success
  await logAuditEvent(supabase, {
    actorType: 'client',
    actorId: client.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    metadata: { ip },
  });

  return {};
}
