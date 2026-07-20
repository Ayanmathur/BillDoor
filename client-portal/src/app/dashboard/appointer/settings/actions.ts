'use server';

/**
 * Appointer — Settings Server Actions
 *
 * Fetch and update appointer configuration:
 * - Public booking link (slug)
 * - Appointer config (no-show grace, default duration, etc.)
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================
// Fetch appointer settings
// ============================================================
export async function fetchAppointerSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', settings: null };

  const { data: client } = await supabase
    .from('clients')
    .select('slug, business_name, appointer_config')
    .eq('id', user.id)
    .single();

  if (!client) return { error: 'Client not found.', settings: null };

  // Merge with defaults for any missing keys
  const defaults = {
    no_show_grace_min: 10,
    default_duration_min: 30,
    slot_increment_min: 30,
    advance_booking_days: 30,
    default_open: '09:00',
    default_close: '21:00',
    public_booking_enabled: true,
  };

  const config = { ...defaults, ...(client.appointer_config || {}) };

  return {
    settings: {
      slug: client.slug,
      businessName: client.business_name,
      config,
    },
  };
}

// ============================================================
// Update appointer config
// ============================================================
export async function updateAppointerConfigAction(data: {
  noShowGraceMin?: number;
  defaultDurationMin?: number;
  slotIncrementMin?: number;
  advanceBookingDays?: number;
  defaultOpen?: string;
  defaultClose?: string;
  publicBookingEnabled?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  // Read current config to merge (not overwrite)
  const { data: client } = await supabase
    .from('clients')
    .select('appointer_config')
    .eq('id', user.id)
    .single();

  const current = (client?.appointer_config || {}) as Record<string, unknown>;

  // Validate time format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (data.defaultOpen && !timeRegex.test(data.defaultOpen)) {
    return { error: 'Invalid open time format. Use HH:MM (24-hour).' };
  }
  if (data.defaultClose && !timeRegex.test(data.defaultClose)) {
    return { error: 'Invalid close time format. Use HH:MM (24-hour).' };
  }
  if (data.defaultOpen && data.defaultClose && data.defaultOpen >= data.defaultClose) {
    return { error: 'Close time must be after open time.' };
  }

  const updated = {
    ...current,
    ...(data.noShowGraceMin !== undefined && { no_show_grace_min: data.noShowGraceMin }),
    ...(data.defaultDurationMin !== undefined && { default_duration_min: data.defaultDurationMin }),
    ...(data.slotIncrementMin !== undefined && { slot_increment_min: data.slotIncrementMin }),
    ...(data.advanceBookingDays !== undefined && { advance_booking_days: data.advanceBookingDays }),
    ...(data.defaultOpen !== undefined && { default_open: data.defaultOpen }),
    ...(data.defaultClose !== undefined && { default_close: data.defaultClose }),
    ...(data.publicBookingEnabled !== undefined && { public_booking_enabled: data.publicBookingEnabled }),
  };

  const { error } = await supabase
    .from('clients')
    .update({ appointer_config: updated })
    .eq('id', user.id);

  if (error) return { error: 'Failed to save settings.' };
  return {};
}
