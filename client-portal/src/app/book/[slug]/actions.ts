'use server';

/**
 * Public Self-Booking — Server Actions
 *
 * Unauthenticated. Rate-limited by IP. Reads client info by slug,
 * computes available slots from business_hours − existing bookings − buffer,
 * and creates appointments with the same overlap guard as staff-side booking.
 */

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';
import { z } from 'zod';

// ============================================================
// Fetch public booking info (client name, services, resources)
// ============================================================
export async function fetchBookingInfoAction(slug: string) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'book:fetch', maxRequests: 30, windowSeconds: 60 }, ip);
  if (!rateCheck.success) return { error: 'Too many requests. Please try again later.' };

  const supabase = await createClient();

  // Find client by slug
  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, slug, status, appointer_config')
    .eq('slug', slug)
    .single();

  if (!client) return { error: 'Business not found.' };
  if (client.status === 'revoked') return { error: 'This business is currently unavailable.' };

  // Check if public booking is enabled
  const config = client.appointer_config as Record<string, any> | null;
  if (config && config.public_booking_enabled === false) {
    return { error: 'Online booking is not available for this business.' };
  }

  // Fetch active resources with business hours
  const { data: resources } = await supabase
    .from('resources')
    .select('id, name, business_hours')
    .eq('client_id', client.id)
    .eq('active', true)
    .order('created_at', { ascending: true });

  // Fetch services (type='service' catalog items)
  const { data: services } = await supabase
    .from('catalog_items')
    .select('id, name, default_resource_id, default_duration_min, buffer_after_min, price')
    .eq('client_id', client.id)
    .eq('type', 'service')
    .eq('active', true)
    .order('name', { ascending: true });

  return {
    client: {
      id: client.id,
      businessName: client.business_name,
      slug: client.slug,
    },
    resources: (resources || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      businessHours: r.business_hours,
    })),
    services: (services || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      defaultResourceId: s.default_resource_id,
      defaultDurationMin: s.default_duration_min || 30,
      bufferAfterMin: s.buffer_after_min || 0,
      price: s.price,
    })),
  };
}

// ============================================================
// Fetch available time slots for a resource on a given date
// ============================================================
export async function fetchAvailableSlotsAction(data: {
  clientId: string;
  resourceId: string;
  date: string;
  durationMin: number;
  bufferMin?: number;
}) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'book:slots', maxRequests: 60, windowSeconds: 60 }, ip);
  if (!rateCheck.success) return { error: 'Too many requests.', slots: [], closed: false };

  const supabase = await createClient();

  const { clientId, resourceId, date, durationMin, bufferMin = 0 } = data;
  const totalNeeded = durationMin + bufferMin;

  // Get resource business hours
  const { data: resource } = await supabase
    .from('resources')
    .select('business_hours')
    .eq('id', resourceId)
    .eq('client_id', clientId)
    .single();

  // Determine day window
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayOfWeek = dayNames[new Date(date).getDay()];
  let windowStart: string;
  let windowEnd: string;

  const bh = resource?.business_hours as Record<string, { open: string; close: string } | null> | null;

  if (bh && bh[dayOfWeek]) {
    windowStart = `${date}T${bh[dayOfWeek]!.open}:00`;
    windowEnd = `${date}T${bh[dayOfWeek]!.close}:00`;
  } else if (bh && !bh[dayOfWeek]) {
    // Closed on this day
    return { slots: [], closed: true };
  } else {
    // No business hours set — default 09:00-21:00
    windowStart = `${date}T09:00:00`;
    windowEnd = `${date}T21:00:00`;
  }

  // Fetch existing appointments for this resource on this date
  const { data: appts } = await supabase
    .from('appointments')
    .select('slot_start, slot_end')
    .eq('client_id', clientId)
    .eq('resource_id', resourceId)
    .gte('slot_start', `${date}T00:00:00`)
    .lte('slot_start', `${date}T23:59:59`)
    .in('status', ['booked', 'walkin'])
    .order('slot_start', { ascending: true });

  const bookedSlots = (appts || []).map((a: any) => ({
    start: new Date(a.slot_start).getTime(),
    end: new Date(a.slot_end).getTime(),
  }));

  // Generate available slot times (30-min increments within window)
  const slots: { start: string; end: string }[] = [];
  const windowStartMs = new Date(windowStart).getTime();
  const windowEndMs = new Date(windowEnd).getTime();
  const now = Date.now();
  const slotIncrement = 30 * 60000; // Check every 30 mins

  for (let t = windowStartMs; t + totalNeeded * 60000 <= windowEndMs; t += slotIncrement) {
    // Skip past slots
    if (t < now) continue;

    const slotStart = t;
    const slotEnd = t + durationMin * 60000;
    const slotEndWithBuffer = t + totalNeeded * 60000;

    // Check for overlaps with existing appointments
    const hasConflict = bookedSlots.some(b =>
      slotStart < b.end && slotEndWithBuffer > b.start
    );

    if (!hasConflict) {
      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotEnd).toISOString(),
      });
    }
  }

  return { slots, closed: false };
}

// ============================================================
// Create a public booking (rate-limited, overlap-guarded)
// ============================================================
const bookingSchema = z.object({
  clientId: z.string().uuid(),
  resourceId: z.string().uuid(),
  customerName: z.string().min(1, 'Your name is required.'),
  customerPhone: z.string().min(10, 'Enter a valid 10-digit phone number.'),
  slotStart: z.string().min(1),
  slotEnd: z.string().min(1),
  durationMin: z.number().min(5),
  bufferMin: z.number().optional(),
  serviceName: z.string().optional(),
  notes: z.string().optional(),
});

export async function createPublicBookingAction(data: {
  clientId: string;
  resourceId: string;
  customerName: string;
  customerPhone: string;
  slotStart: string;
  slotEnd: string;
  durationMin: number;
  bufferMin?: number;
  serviceName?: string;
  notes?: string;
}) {
  // Zod validation
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  // Rate limit
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'book:create', maxRequests: 10, windowSeconds: 3600 }, ip);
  if (!rateCheck.success) return { error: 'Too many booking requests. Please try again later.' };

  const cleanPhone = (data.customerPhone || '').replace(/\D/g, '');

  const supabase = await createClient();
  const buffer = data.bufferMin || 0;
  const slotEndWithBuffer = new Date(new Date(data.slotEnd).getTime() + buffer * 60000).toISOString();

  // ── BUSINESS HOURS CHECK ───────────────────────────────
  const { data: resource } = await supabase
    .from('resources')
    .select('business_hours')
    .eq('id', data.resourceId)
    .eq('client_id', data.clientId)
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

    if (new Date(data.slotStart) < openTime || new Date(slotEndWithBuffer) > closeTime) {
      return { error: `Slot must be within business hours: ${dayHours.open} – ${dayHours.close}.` };
    }
  }

  // ── OVERLAP GUARD ──────────────────────────────────────
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('client_id', data.clientId)
    .eq('resource_id', data.resourceId)
    .in('status', ['booked', 'walkin'])
    .lt('slot_start', slotEndWithBuffer)
    .gt('slot_end', data.slotStart);

  if (conflicts && conflicts.length > 0) {
    return { error: 'This time slot is no longer available. Please choose another.' };
  }

  // ── CUSTOMER UPSERT ────────────────────────────────────
  let customerId: string;
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('client_id', data.clientId)
    .eq('phone', cleanPhone)
    .single();

  if (existing) {
    customerId = existing.id;
    await supabase
      .from('customers')
      .update({ name: data.customerName.trim() })
      .eq('id', customerId)
      .eq('client_id', data.clientId);
  } else {
    const { data: newCustomer, error: insertErr } = await supabase
      .from('customers')
      .insert({
        client_id: data.clientId,
        name: data.customerName.trim(),
        phone: cleanPhone,
        total_visits: 0,
        total_spent: 0,
      })
      .select('id')
      .single();

    if (insertErr || !newCustomer) return { error: 'Failed to register. Please try again.' };
    customerId = newCustomer.id;
  }

  // ── INSERT APPOINTMENT ─────────────────────────────────
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      client_id: data.clientId,
      resource_id: data.resourceId,
      customer_id: customerId,
      slot_start: data.slotStart,
      slot_end: data.slotEnd,
      estimated_duration_min: data.durationMin || 30,
      status: 'booked',
      service_name: data.serviceName || null,
      notes: data.notes ? `[Online Booking] ${data.notes}` : '[Online Booking]',
    })
    .select('id')
    .single();

  if (apptErr || !appt) return { error: 'Failed to book appointment. Please try again.' };

  // Create notification for the business owner
  await supabase.from('notifications').insert({
    client_id: data.clientId,
    type: 'appointment_booked',
    title: 'Online Booking Received',
    message: `${data.customerName.trim()} booked ${data.serviceName || 'an appointment'} at ${new Date(data.slotStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
  });

  return {
    success: true,
    appointmentId: appt.id,
    slotStart: data.slotStart,
    serviceName: data.serviceName,
  };
}
