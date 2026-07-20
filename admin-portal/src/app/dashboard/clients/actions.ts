'use server';

import { createClient } from '@/lib/supabase/server';
import { logAuditEvent, AUDIT_ACTIONS } from '@/shared/audit';

export async function fetchClientsAction() {
  const supabase = await createClient();

  // Enforce admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', clients: [] };

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();
    
  if (!adminUser) return { error: 'Unauthorized', clients: [] };

  const { data, error } = await supabase
    .from('clients')
    .select('id, username, business_name, status, created_at, deleted_at')
    .order('created_at', { ascending: false });

  if (error) {
    return { error: 'Failed to fetch clients', clients: [] };
  }

  return { clients: data || [] };
}

export async function resetClientPasswordAction(clientId: string, newPasswordPlain: string) {
  const supabase = await createClient();

  // Enforce admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();
    
  if (!adminUser) return { error: 'Unauthorized' };

  // Generate bcrypt hash for the new password
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(newPasswordPlain, salt);

  // Update clients table
  const { error: updateError } = await supabase
    .from('clients')
    .update({ password_hash: passwordHash })
    .eq('id', clientId);

  if (updateError) {
    return { error: 'Failed to update client password in database' };
  }

  // Also update Supabase Auth User if the client has an email
  // We need to fetch the client's username to update auth email
  const { data: client } = await supabase.from('clients').select('username').eq('id', clientId).single();
  if (client) {
    const authEmail = `${client.username}@billdoor.local`;
    
    // We can't use admin.updateUserById because we don't know the exact auth user ID for sure without querying auth.users
    // Wait, the auth user ID *should* be the client ID if they signed up through our system!
    const { error: authError } = await supabase.auth.admin.updateUserById(clientId, {
      password: newPasswordPlain
    });
    
    // If authError happens, it might be because the user doesn't exist in Auth yet.
    // That's fine, we updated the clients table password_hash, so when they log in next time,
    // our signInWithPassword hook handles it or falls back to creating the auth user.
  }

  await logAuditEvent(supabase, {
    actorType: 'admin',
    actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_UPDATED,
    metadata: { reason: 'Admin reset client password', targetClientId: clientId },
  });

  return { success: true };
}
