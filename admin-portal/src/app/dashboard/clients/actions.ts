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
    .select('id, username, business_name, slug, google_place_id, about, status, publicly_listed, created_at, deleted_at')
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

// ============================================================
// Per-client financial overview (read-only, admin only)
// ============================================================
export async function fetchClientFinancialsAction(clientId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();
  if (!adminUser) return { error: 'Unauthorized' };

  const { createAdminClient } = await import('@/lib/supabase/server');
  const admin = await createAdminClient();

  // Revenue: bills in the date range
  const { data: bills } = await admin
    .from('bills')
    .select('grand_total, created_at')
    .eq('client_id', clientId)
    .gte('created_at', from)
    .lte('created_at', to);

  const totalRevenue = (bills || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
  const billCount = (bills || []).length;

  // Expenses: in the date range
  const { data: expenses } = await admin
    .from('expenses')
    .select('amount, category')
    .eq('client_id', clientId)
    .gte('expense_date', from.split('T')[0])
    .lte('expense_date', to.split('T')[0]);

  const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const expensesByCategory: Record<string, number> = {};
  for (const e of (expenses || [])) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount || 0);
  }

  // Quarterly Revenue (last 90 days)
  const quarterStart = new Date();
  quarterStart.setDate(quarterStart.getDate() - 90);
  const { data: qBills } = await admin
    .from('bills')
    .select('grand_total')
    .eq('client_id', clientId)
    .gte('created_at', quarterStart.toISOString());
  const quarterlyRevenue = (qBills || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0);

  // Annual Revenue (last 365 days)
  const yearStart = new Date();
  yearStart.setFullYear(yearStart.getFullYear() - 1);
  const { data: yBills } = await admin
    .from('bills')
    .select('grand_total')
    .eq('client_id', clientId)
    .gte('created_at', yearStart.toISOString());
  const annualRevenue = (yBills || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0);

  return {
    revenue: totalRevenue,
    billCount,
    expenses: totalExpenses,
    expensesByCategory,
    estimatedNet: totalRevenue - totalExpenses,
    quarterlyRevenue,
    annualRevenue,
  };
}

export async function togglePubliclyListedAction(clientId: string, publiclyListed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single();
  if (!adminUser) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('clients')
    .update({ publicly_listed: publiclyListed })
    .eq('id', clientId);

  if (error) {
    return { error: 'Failed to update client directory status' };
  }

  return { success: true };
}
