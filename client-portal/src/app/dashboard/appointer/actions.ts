'use server';

/**
 * Appointer — Core Server Actions
 *
 * Today view data, status updates, no-show auto-flagging,
 * walk-in gap-finding, and reminder ladder.
 *
 * HARD RULE: Booked slots are protected absolute time.
 * Walk-ins fill gaps or join a queue — never overwrite bookings.
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================
// Fetch appointments for a given date, grouped by resource
// ============================================================
export async function fetchTodayAppointmentsAction(dateStr?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', groups: [] };

  const today = dateStr || new Date().toISOString().split('T')[0];
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

  // Fetch resources
  const { data: resources } = await supabase
    .from('resources')
    .select('id, name, active')
    .eq('client_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true });

  // Fetch all appointments for the day
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, resource_id, customer_id, slot_start, slot_end, estimated_duration_min, status, reminder_sent, reminder_5_sent, notes, service_name, created_at')
    .eq('client_id', user.id)
    .gte('slot_start', dayStart)
    .lte('slot_start', dayEnd)
    .order('slot_start', { ascending: true });

  // Fetch customer info for all appointments
  const customerIds = [...new Set((appointments || []).map((a: any) => a.customer_id))];
  let customerMap: Record<string, { name: string; phone: string }> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone')
      .in('id', customerIds);
    for (const c of (customers || [])) {
      customerMap[c.id] = { name: c.name, phone: c.phone };
    }
  }

  // Group appointments by resource
  const groups = (resources || []).map((r: any) => ({
    resourceId: r.id,
    resourceName: r.name,
    appointments: (appointments || [])
      .filter((a: any) => a.resource_id === r.id)
      .map((a: any) => ({
        id: a.id,
        resourceId: a.resource_id,
        customerId: a.customer_id,
        customerName: customerMap[a.customer_id]?.name || 'Unknown',
        customerPhone: customerMap[a.customer_id]?.phone || '',
        slotStart: a.slot_start,
        slotEnd: a.slot_end,
        estimatedDurationMin: a.estimated_duration_min,
        status: a.status,
        reminderSent: a.reminder_sent,
        reminder5Sent: a.reminder_5_sent,
        notes: a.notes,
        serviceName: a.service_name,
      })),
  }));

  return { groups };
}

// ============================================================
// Update appointment status
// ============================================================
export async function updateAppointmentStatusAction(data: {
  id: string;
  status: 'completed' | 'no_show' | 'cancelled';
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const validStatuses = ['completed', 'no_show', 'cancelled'];
  if (!validStatuses.includes(data.status)) return { error: 'Invalid status.' };

  const { error } = await supabase
    .from('appointments')
    .update({ status: data.status })
    .eq('id', data.id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update status.' };

  // Create notification for status change
  const notifType = data.status === 'no_show' ? 'appointment_no_show' :
                    data.status === 'completed' ? 'appointment_completed' :
                    'appointment_booked';

  if (data.status !== 'cancelled') {
    await supabase.from('notifications').insert({
      client_id: user.id,
      type: notifType,
      title: data.status === 'no_show' ? 'No-Show Flagged' : 'Appointment Completed',
      message: `Appointment marked as ${data.status.replace('_', ' ')}.`,
    });
  }

  return {};
}

// ============================================================
// Auto-flag no-shows (past grace window)
// ============================================================
export async function flagNoShowsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', flagged: 0 };

  const graceMs = 10 * 60 * 1000; // 10 minute grace
  const cutoff = new Date(Date.now() - graceMs).toISOString();

  // Find overdue booked appointments
  const { data: overdue } = await supabase
    .from('appointments')
    .select('id')
    .eq('client_id', user.id)
    .eq('status', 'booked')
    .lt('slot_start', cutoff);

  if (!overdue || overdue.length === 0) return { flagged: 0 };

  const ids = overdue.map((a: any) => a.id);

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'no_show' })
    .in('id', ids)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to flag no-shows.', flagged: 0 };

  // Notify for each
  const notifs = ids.map((id: string) => ({
    client_id: user.id,
    type: 'appointment_no_show' as const,
    title: 'No-Show Auto-Flagged',
    message: `Appointment auto-flagged as no-show (10 min grace window exceeded).`,
  }));
  await supabase.from('notifications').insert(notifs);

  return { flagged: ids.length };
}

// ============================================================
// Find walk-in slot (gap-filling logic)
//
// HARD RULE: booked slots are NEVER moved. Walk-ins fill gaps only.
// Respects: business_hours (if set), buffer_after_min on services
// ============================================================
export async function findWalkInSlotAction(data: {
  resourceId?: string;
  durationMin: number;
  bufferMin?: number;
  date?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', slot: null, queue: null };

  const today = data.date || new Date().toISOString().split('T')[0];
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;
  const duration = data.durationMin || 30;
  const buffer = data.bufferMin || 0;
  const totalNeeded = duration + buffer; // Service + cleanup/prep buffer
  const now = new Date();

  // Day-of-week name for business_hours lookup
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayOfWeek = dayNames[new Date(today).getDay()];

  // Get active resources (now including business_hours)
  const { data: resources } = await supabase
    .from('resources')
    .select('id, name, business_hours')
    .eq('client_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (!resources || resources.length === 0) return { error: 'No active resources.', slot: null, queue: null };

  const targetResources = data.resourceId
    ? resources.filter((r: any) => r.id === data.resourceId)
    : resources;

  // For each resource, find the next gap
  for (const resource of targetResources) {
    // Determine search window from business_hours (null = always open)
    const bh = resource.business_hours as Record<string, { open: string; close: string } | null> | null;
    let windowStart: Date;
    let windowEnd: Date;

    if (bh && bh[dayOfWeek]) {
      // Resource has business hours set and is open today
      const dayHours = bh[dayOfWeek]!;
      windowStart = new Date(`${today}T${dayHours.open}:00`);
      windowEnd = new Date(`${today}T${dayHours.close}:00`);
    } else if (bh && !bh[dayOfWeek]) {
      // Resource is closed today (business hours set but day is null)
      continue;
    } else {
      // No business hours set — always open (preserves existing behavior)
      windowStart = new Date(dayStart);
      windowEnd = new Date(dayEnd);
    }

    const { data: appts } = await supabase
      .from('appointments')
      .select('slot_start, slot_end, status')
      .eq('client_id', user.id)
      .eq('resource_id', resource.id)
      .gte('slot_start', dayStart)
      .lte('slot_start', dayEnd)
      .in('status', ['booked', 'walkin'])
      .order('slot_start', { ascending: true });

    // Find gap from "now" or window start, whichever is later
    let searchFrom = now > windowStart ? now : windowStart;
    const bookedSlots = (appts || []).map((a: any) => ({
      start: new Date(a.slot_start),
      end: new Date(a.slot_end),
    }));

    for (let i = 0; i <= bookedSlots.length; i++) {
      const gapStart = i === 0 ? searchFrom : bookedSlots[i - 1].end;
      const gapEnd = i < bookedSlots.length ? bookedSlots[i].start : windowEnd;

      // Only consider future gaps within the business hours window
      const effectiveStart = gapStart > now ? gapStart : now;
      if (effectiveStart >= windowEnd) break; // Past closing time

      const gapMinutes = (gapEnd.getTime() - effectiveStart.getTime()) / 60000;

      if (gapMinutes >= totalNeeded) {
        // Round up to next 5 min
        const roundedStart = new Date(Math.ceil(effectiveStart.getTime() / 300000) * 300000);
        const slotEnd = new Date(roundedStart.getTime() + duration * 60000);

        // Ensure slot + buffer fits before next appointment and within business hours
        const slotEndWithBuffer = new Date(slotEnd.getTime() + buffer * 60000);
        if (slotEndWithBuffer > windowEnd) continue;

        // Verify this doesn't overlap any booked slot (including buffer)
        const overlaps = bookedSlots.some(s =>
          roundedStart < s.end && slotEndWithBuffer > s.start
        );
        if (!overlaps) {
          return {
            slot: {
              slotStart: roundedStart.toISOString(),
              slotEnd: slotEnd.toISOString(),
              resourceId: resource.id,
              resourceName: resource.name,
            },
            queue: null,
          };
        }
      }
    }
  }

  // No gap found on any resource — return queue estimate
  // Find the earliest end-time across all resources
  let earliestEnd: Date | null = null;
  let queueResource = targetResources[0];

  for (const resource of targetResources) {
    const { data: lastAppt } = await supabase
      .from('appointments')
      .select('slot_end, resource_id')
      .eq('client_id', user.id)
      .eq('resource_id', resource.id)
      .gte('slot_start', dayStart)
      .in('status', ['booked', 'walkin'])
      .order('slot_end', { ascending: false })
      .limit(1);

    if (lastAppt && lastAppt.length > 0) {
      const endTime = new Date(lastAppt[0].slot_end);
      if (!earliestEnd || endTime < earliestEnd) {
        earliestEnd = endTime;
        queueResource = resource;
      }
    }
  }

  return {
    slot: null,
    queue: {
      estimatedAvailable: earliestEnd ? earliestEnd.toISOString() : now.toISOString(),
      resourceId: queueResource.id,
      resourceName: queueResource.name,
    },
  };
}

// ============================================================
// Fire reminders (T-30, T-5, T-0)
// Called from client-side polling on the Today view
// ============================================================
export async function fireRemindersAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', fired: 0 };

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

  // Fetch upcoming booked appointments
  const { data: upcoming } = await supabase
    .from('appointments')
    .select('id, slot_start, reminder_sent, reminder_5_sent, customer_id, service_name')
    .eq('client_id', user.id)
    .in('status', ['booked', 'walkin'])
    .gte('slot_start', dayStart)
    .lte('slot_start', dayEnd);

  if (!upcoming || upcoming.length === 0) return { fired: 0 };

  // Get customer names
  const customerIds = [...new Set(upcoming.map((a: any) => a.customer_id))];
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .in('id', customerIds);
  const nameMap: Record<string, string> = {};
  for (const c of (customers || [])) nameMap[c.id] = c.name;

  let fired = 0;

  for (const appt of upcoming) {
    const slotTime = new Date(appt.slot_start);
    const minsUntil = (slotTime.getTime() - now.getTime()) / 60000;
    const customerName = nameMap[appt.customer_id] || 'Customer';

    // T-30 reminder (between 25-35 min before)
    if (!appt.reminder_sent && minsUntil <= 35 && minsUntil > 5) {
      await supabase.from('notifications').insert({
        client_id: user.id,
        type: 'appointment_reminder',
        title: `Appointment in ~30 min`,
        message: `${customerName}${appt.service_name ? ' — ' + appt.service_name : ''} at ${slotTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      });
      await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', appt.id)
        .eq('client_id', user.id);
      fired++;
    }

    // T-5 reminder (between 0-8 min before)
    if (!appt.reminder_5_sent && minsUntil <= 8 && minsUntil > -2) {
      await supabase.from('notifications').insert({
        client_id: user.id,
        type: 'appointment_reminder',
        title: minsUntil <= 1 ? 'Appointment starting now!' : `Appointment in ~5 min`,
        message: `${customerName}${appt.service_name ? ' — ' + appt.service_name : ''} at ${slotTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      });
      await supabase
        .from('appointments')
        .update({ reminder_5_sent: true })
        .eq('id', appt.id)
        .eq('client_id', user.id);
      fired++;
    }
  }

  return { fired };
}

// ============================================================
// Fetch business name (for WhatsApp template)
// ============================================================
export async function fetchAppointerSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', settings: null };

  const { data } = await supabase
    .from('clients')
    .select('business_name, slug')
    .eq('id', user.id)
    .single();

  return { settings: data };
}
