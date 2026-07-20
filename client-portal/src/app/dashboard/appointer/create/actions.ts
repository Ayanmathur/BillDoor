'use server';

/**
 * Appointer — Create Appointment Server Actions
 *
 * Overlap guard enforces: booked slots are NEVER double-booked.
 * The system flags conflicts instead of auto-rescheduling.
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================
// Lookup customer by phone (reuses Billit pattern)
// ============================================================
export async function lookupCustomerForAppointerAction(phone: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', customer: null };

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) return { error: 'Enter a valid phone number.', customer: null };

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, total_visits, total_spent, last_visit_at')
    .eq('client_id', user.id)
    .eq('phone', cleanPhone)
    .single();

  return { customer };
}

// ============================================================
// Create appointment with overlap guard
// ============================================================
export async function createAppointmentAction(data: {
  customerName: string;
  customerPhone: string;
  resourceId: string;
  slotStart: string;
  slotEnd: string;
  durationMin: number;
  bufferMin?: number;
  isWalkin: boolean;
  serviceName?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  // Validate inputs
  if (!data.customerName?.trim()) return { error: 'Customer name is required.' };
  if (!data.customerPhone?.trim()) return { error: 'Customer phone is required.' };
  if (!data.resourceId) return { error: 'Resource is required.' };
  if (!data.slotStart || !data.slotEnd) return { error: 'Time slot is required.' };

  const cleanPhone = data.customerPhone.replace(/\D/g, '');
  if (cleanPhone.length < 10) return { error: 'Enter a valid phone number.' };

  const buffer = data.bufferMin || 0;
  const slotEndWithBuffer = new Date(new Date(data.slotEnd).getTime() + buffer * 60000).toISOString();

  // ── BUSINESS HOURS CHECK ───────────────────────────────
  // Validate slot is within resource's business hours (if set)
  const { data: resource } = await supabase
    .from('resources')
    .select('business_hours')
    .eq('id', data.resourceId)
    .eq('client_id', user.id)
    .single();

  if (resource?.business_hours) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const slotDate = new Date(data.slotStart);
    const dayOfWeek = dayNames[slotDate.getDay()];
    const bh = resource.business_hours as Record<string, { open: string; close: string } | null>;
    const dayHours = bh[dayOfWeek];

    if (!dayHours) {
      return { error: 'This resource is not available on the selected day.' };
    }

    const dateStr = data.slotStart.split('T')[0];
    const openTime = new Date(`${dateStr}T${dayHours.open}:00`);
    const closeTime = new Date(`${dateStr}T${dayHours.close}:00`);
    const proposedStart = new Date(data.slotStart);
    const proposedEndBuf = new Date(slotEndWithBuffer);

    if (proposedStart < openTime || proposedEndBuf > closeTime) {
      return { error: `Slot must be within business hours: ${dayHours.open} – ${dayHours.close}.` };
    }
  }

  // ── OVERLAP GUARD ──────────────────────────────────────
  // Check for time conflicts on the chosen resource
  // HARD RULE: never silently double-book, never auto-reschedule
  // Buffer is factored in: new slot's effective end = slotEnd + buffer
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id, slot_start, slot_end, status')
    .eq('client_id', user.id)
    .eq('resource_id', data.resourceId)
    .in('status', ['booked', 'walkin'])
    .lt('slot_start', slotEndWithBuffer)
    .gt('slot_end', data.slotStart);

  if (conflicts && conflicts.length > 0) {
    const conflict = conflicts[0];
    const conflictStart = new Date(conflict.slot_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const conflictEnd = new Date(conflict.slot_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return {
      error: `Time conflict: an existing ${conflict.status === 'walkin' ? 'walk-in' : 'booking'} occupies ${conflictStart}–${conflictEnd} on this resource. Choose a different time or resource.`,
    };
  }

  // ── CUSTOMER UPSERT ────────────────────────────────────
  let customerId: string;
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('client_id', user.id)
    .eq('phone', cleanPhone)
    .single();

  if (existing) {
    customerId = existing.id;
    // Update name if changed
    await supabase
      .from('customers')
      .update({ name: data.customerName.trim() })
      .eq('id', customerId)
      .eq('client_id', user.id);
  } else {
    const { data: newCustomer, error: insertErr } = await supabase
      .from('customers')
      .insert({
        client_id: user.id,
        name: data.customerName.trim(),
        phone: cleanPhone,
        total_visits: 0,
        total_spent: 0,
      })
      .select('id')
      .single();

    if (insertErr || !newCustomer) return { error: 'Failed to create customer.' };
    customerId = newCustomer.id;
  }

  // ── INSERT APPOINTMENT ─────────────────────────────────
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      client_id: user.id,
      resource_id: data.resourceId,
      customer_id: customerId,
      slot_start: data.slotStart,
      slot_end: data.slotEnd,
      estimated_duration_min: data.durationMin || 30,
      status: data.isWalkin ? 'walkin' : 'booked',
      service_name: data.serviceName || null,
      notes: data.notes || null,
    })
    .select('id')
    .single();

  if (apptErr || !appt) return { error: 'Failed to create appointment.' };

  // Create notification
  await supabase.from('notifications').insert({
    client_id: user.id,
    type: 'appointment_booked',
    title: data.isWalkin ? 'Walk-in Added' : 'Appointment Booked',
    message: `${data.customerName.trim()} — ${new Date(data.slotStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${data.serviceName ? ' (' + data.serviceName + ')' : ''}`,
  });

  return { appointmentId: appt.id };
}

// ============================================================
// Fetch services (catalog items with type='service') for dropdown
// ============================================================
export async function fetchServicesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', services: [] };

  const { data } = await supabase
    .from('catalog_items')
    .select('id, name, default_resource_id, default_duration_min, buffer_after_min, price')
    .eq('client_id', user.id)
    .eq('type', 'service')
    .eq('active', true)
    .order('name', { ascending: true });

  return { services: data || [] };
}
