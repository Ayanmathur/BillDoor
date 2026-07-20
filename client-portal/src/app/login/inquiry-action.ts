'use server';

/**
 * BillDoor — Inquiry Server Action
 * 
 * "Don't have a license key? Get one" flow:
 * 1. Collect name + phone
 * 2. Save to inquiries table (admin sees it in admin panel)
 * 3. Return WhatsApp redirect URL with pre-filled message
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';
import { z } from 'zod';

const inquirySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim()
    .transform((val) => val.replace(/[\s\-()]/g, ''))
    .pipe(z.string().regex(/^(\+?91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number')),
});

interface InquiryResult {
  error?: string;
  whatsappUrl?: string;
}

export async function submitInquiryAction(data: {
  name: string;
  phone: string;
}): Promise<InquiryResult> {
  // Rate limit — prevent spam (10 per hour per IP)
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit(
    { prefix: 'inquiry:submit', maxRequests: 10, windowSeconds: 3600 },
    ip
  );
  if (!rateCheck.success) {
    return { error: `Too many inquiries. Try again in ${Math.ceil(rateCheck.resetInSeconds / 60)} minutes.` };
  }

  // Validate
  const parsed = inquirySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  const { name, phone } = parsed.data;
  const supabase = await createAdminClient();

  // Fetch admin WhatsApp number from platform_settings (single source of truth)
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('admin_whatsapp_number')
    .single();

  const fallback = process.env.ADMIN_WHATSAPP_NUMBER ? `91${process.env.ADMIN_WHATSAPP_NUMBER.replace(/^91/, '')}` : '919422880355';
  const adminPhone = settings?.admin_whatsapp_number || fallback;

  // Save inquiry to DB (admin can see it in their panel)
  await supabase.from('inquiries').insert({
    name,
    phone,
    message: `Inquiry from login page — ${name} (${phone})`,
    status: 'new',
  });

  // Build WhatsApp redirect with pre-filled message
  const message = encodeURIComponent(
    `Hello Orbitex, I am interested in your service for BillDoor.\n\nMy name is ${name} and my number is ${phone}.`
  );
  const whatsappUrl = `https://wa.me/91${adminPhone.replace(/^\+?91/, '')}?text=${message}`;

  return { whatsappUrl };
}
