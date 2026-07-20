'use server';

import { createClient } from '@/lib/supabase/server';

// Fetch all notifications for the authenticated client
export async function fetchNotificationsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: 'Unauthorized.', notifications: [] };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { error: 'Failed to fetch notifications.', notifications: [] };
  }

  return {
    notifications: (data || []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      clientId: n.client_id as string,
      type: n.type as string,
      title: n.title as string,
      message: n.message as string,
      read: n.read as boolean,
      createdAt: n.created_at as string,
    })),
  };
}

// Fetch unread count (for the bell badge in app-shell)
export async function fetchUnreadCountAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { count: 0 };

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', user.id)
    .eq('read', false);

  return { count: count || 0 };
}

// Mark a single notification as read/unread
export async function markNotificationReadAction(id: string, read: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('notifications')
    .update({ read })
    .eq('id', id)
    .eq('client_id', user.id);

  return { success: true };
}

// Mark all notifications as read
export async function markAllReadAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('client_id', user.id)
    .eq('read', false);

  return { success: true };
}

// Dismiss (delete) a notification
export async function dismissNotificationAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('client_id', user.id);

  return { success: true };
}
