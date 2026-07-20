import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/app-shell';

/**
 * Dashboard Layout — Server Component
 *
 * Auth guard: redirect to /login if no session.
 * Fetches client record for module-aware nav + business name.
 * Passes data to AppShell (client component).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch client record
  const { data: client } = await supabase
    .from('clients')
    .select('business_name, modules_enabled, status')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single();

  if (!client) {
    redirect('/login');
  }

  // Revoked clients get kicked out
  if (client.status === 'revoked') {
    redirect('/login');
  }

  // Count unread notifications
  const { count: notifCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', user.id)
    .eq('read', false);

  return (
    <AppShell
      businessName={client.business_name || 'My Business'}
      modulesEnabled={client.modules_enabled || {}}
      notificationCount={notifCount || 0}
    >
      {children}
    </AppShell>
  );
}
