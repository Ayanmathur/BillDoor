'use server';

import { createAdminClient } from '@/lib/supabase/server';

export async function fetchAuditLogsAction(params: {
  page?: number;
  actorType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  ipSearch?: string;
}) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', logs: [], totalCount: 0 };
  }

  const page = params.page || 1;
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (params.actorType) query = query.eq('actor_type', params.actorType);
  if (params.action) query = query.eq('action', params.action);
  if (params.dateFrom) query = query.gte('created_at', params.dateFrom);
  if (params.dateTo) query = query.lte('created_at', params.dateTo + 'T23:59:59Z');
  if (params.ipSearch) query = query.ilike('ip_address', `%${params.ipSearch}%`);

  const { data, count, error } = await query;
  if (error) return { error: 'Failed to fetch audit logs.', logs: [], totalCount: 0 };

  return {
    logs: (data || []).map((log: Record<string, unknown>) => ({
      id: log.id as string,
      actorType: log.actor_type as string,
      actorId: log.actor_id as string,
      action: log.action as string,
      target: log.target as string | null,
      metadata: log.metadata as Record<string, unknown>,
      ipAddress: log.ip_address as string | null,
      userAgent: log.user_agent as string | null,
      createdAt: log.created_at as string,
    })),
    totalCount: count || 0,
    page,
  };
}

export async function fetchAuditActionsListAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { actions: [] };
  }

  // Get distinct actions from audit_log
  const { data } = await supabase
    .from('audit_log')
    .select('action')
    .limit(500);

  const unique = [...new Set((data || []).map((d: Record<string, unknown>) => d.action as string))];
  return { actions: unique.sort() };
}
