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
    .select('id, username, business_name, slug, google_place_id, about, status, created_at, deleted_at')
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

  // Use the admin client (which has service_role key) to update Supabase Auth
  const { createAdminClient } = await import('@/lib/supabase/server');
  const supabaseAdmin = await createAdminClient();

  const { data: client } = await supabaseAdmin.from('clients').select('username').eq('id', clientId).single();
  if (client) {
    await supabaseAdmin.auth.admin.updateUserById(clientId, {
      password: newPasswordPlain
    });
  }

  await logAuditEvent(supabaseAdmin, {
    actorType: 'admin',
    actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_PASSWORD_RESET,
    metadata: { reason: 'Admin reset client password', targetClientId: clientId },
  });

  return { success: true };
}

export async function updateClientDetailsAction(data: {
  clientId: string;
  businessName: string;
  slug: string;
  googlePlaceId: string;
  about: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();
  if (!adminUser) return { error: 'Unauthorized' };

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', data.slug)
    .neq('id', data.clientId)
    .is('deleted_at', null)
    .single();
  
  if (existing) return { error: 'This URL slug is already taken by another client.' };

  const { error: updateError } = await supabase
    .from('clients')
    .update({
      business_name: data.businessName,
      slug: data.slug,
      google_place_id: data.googlePlaceId || null,
      about: data.about || '',
    })
    .eq('id', data.clientId);

  if (updateError) {
    return { error: 'Failed to update client details' };
  }

  await logAuditEvent(supabase, {
    actorType: 'admin',
    actorId: user.id,
    action: AUDIT_ACTIONS.BUSINESS_SETTINGS_UPDATED,
    metadata: { reason: 'Admin updated client details', targetClientId: data.clientId, updates: data },
  });

  return { success: true };
}
