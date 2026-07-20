'use server';

/**
 * Appointer — Resources Server Actions
 *
 * CRUD for resources (staff, chairs, rooms).
 * All actions verify auth first, then process.
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================
// Fetch all resources for the current client
// ============================================================
export async function fetchResourcesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', resources: [] };

  const { data, error } = await supabase
    .from('resources')
    .select('id, name, active, business_hours, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return { error: 'Failed to fetch resources.', resources: [] };
  return { resources: data || [] };
}

// ============================================================
// Add a new resource
// ============================================================
export async function addResourceAction(data: { name: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const name = data.name?.trim();
  if (!name || name.length < 1) return { error: 'Resource name is required.' };
  if (name.length > 100) return { error: 'Name too long (max 100 chars).' };

  const { error } = await supabase
    .from('resources')
    .insert({ client_id: user.id, name });

  if (error) return { error: 'Failed to add resource.' };
  return {};
}

// ============================================================
// Update a resource (name, active status)
// ============================================================
export async function updateResourceAction(data: { id: string; name?: string; active?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!data.id) return { error: 'Resource ID required.' };

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return { error: 'Name cannot be empty.' };
    updates.name = name;
  }
  if (data.active !== undefined) updates.active = data.active;

  const { error } = await supabase
    .from('resources')
    .update(updates)
    .eq('id', data.id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update resource.' };
  return {};
}

// ============================================================
// Update business hours for a resource
// ============================================================
export async function updateBusinessHoursAction(data: {
  id: string;
  businessHours: Record<string, { open: string; close: string } | null> | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!data.id) return { error: 'Resource ID required.' };

  // Validate business hours format if provided
  if (data.businessHours) {
    const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const [day, hours] of Object.entries(data.businessHours)) {
      if (!validDays.includes(day)) return { error: `Invalid day: ${day}` };
      if (hours !== null) {
        if (!timeRegex.test(hours.open) || !timeRegex.test(hours.close)) {
          return { error: `Invalid time format for ${day}. Use HH:MM (24-hour).` };
        }
        if (hours.open >= hours.close) {
          return { error: `${day}: close time must be after open time.` };
        }
      }
    }
  }

  const { error } = await supabase
    .from('resources')
    .update({ business_hours: data.businessHours })
    .eq('id', data.id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update business hours.' };
  return {};
}
