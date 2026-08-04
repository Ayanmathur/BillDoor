'use server';

/**
 * Billit — Bill Templates CRUD (Step 2)
 *
 * Manages whatsapp_bill_templates table (Billit-specific).
 * Does NOT touch the existing whatsapp_templates table.
 * All actions: auth first, Zod validate, RLS-scoped.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  content: z.string().min(5, 'Template content must be at least 5 characters').max(2000),
});

// ---- Fetch all bill templates ----
export async function fetchBillTemplatesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', templates: [] };

  const { data, error } = await supabase
    .from('whatsapp_bill_templates')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { error: 'Failed to fetch templates.', templates: [] };

  return {
    templates: (data || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: t.name as string,
      content: t.content as string,
      isDefaultFirstVisit: t.is_default_first_visit as boolean,
      isDefaultRepeatVisit: t.is_default_repeat_visit as boolean,
      createdAt: t.created_at as string,
    })),
  };
}

// ---- Create template ----
export async function createBillTemplateAction(input: {
  name: string;
  content: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  const { error } = await supabase
    .from('whatsapp_bill_templates')
    .insert({
      client_id: user.id,
      name: parsed.data.name,
      content: parsed.data.content,
    });

  if (error) return { error: 'Failed to create template.' };
  return { success: true };
}

// ---- Update template ----
export async function updateBillTemplateAction(
  id: string,
  input: { name: string; content: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  const { error } = await supabase
    .from('whatsapp_bill_templates')
    .update({
      name: parsed.data.name,
      content: parsed.data.content,
    })
    .eq('id', id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update template.' };
  return { success: true };
}

// ---- Delete template ----
export async function deleteBillTemplateAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { error } = await supabase
    .from('whatsapp_bill_templates')
    .delete()
    .eq('id', id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to delete template.' };
  return { success: true };
}

// ---- Set default template (first visit or repeat visit) ----
// Mutually exclusive: only one template can be the default for each category.
export async function setDefaultTemplateAction(
  id: string,
  type: 'first_visit' | 'repeat_visit'
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const column = type === 'first_visit' ? 'is_default_first_visit' : 'is_default_repeat_visit';

  // Step 1: Clear existing default for this category
  const { error: clearErr } = await supabase
    .from('whatsapp_bill_templates')
    .update({ [column]: false })
    .eq('client_id', user.id)
    .eq(column, true);

  if (clearErr) return { error: 'Failed to update default.' };

  // Step 2: Set the new default
  const { error: setErr } = await supabase
    .from('whatsapp_bill_templates')
    .update({ [column]: true })
    .eq('id', id)
    .eq('client_id', user.id);

  if (setErr) return { error: 'Failed to set default.' };
  return { success: true };
}

// ---- Clear default template for a category ----
export async function clearDefaultTemplateAction(
  type: 'first_visit' | 'repeat_visit'
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const column = type === 'first_visit' ? 'is_default_first_visit' : 'is_default_repeat_visit';

  const { error } = await supabase
    .from('whatsapp_bill_templates')
    .update({ [column]: false })
    .eq('client_id', user.id)
    .eq(column, true);

  if (error) return { error: 'Failed to clear default.' };
  return { success: true };
}

// ---- Seed 4 Default Templates ----
export async function seedDefaultBillTemplatesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const defaultTemplates = [
    {
      name: 'Bill + Feedback (Recommended)',
      content: 'Hello {customer_name},\n\nThank you for visiting {business_name}!\nYour total bill amount is ₹{grand_total}.\nBill Number: {bill_number}\n\nView your detailed digital bill here:\n{bill_link}\n\nWe would love to hear your feedback:\n{review_link}\n\nHave a great day!'
    },
    {
      name: 'Bill + Digital Business Card',
      content: 'Hello {customer_name},\n\nThank you for visiting {business_name}!\nYour total bill amount is ₹{grand_total}.\nBill Number: {bill_number}\n\nView your detailed digital bill here:\n{bill_link}\n\nSave our Digital Business Card for future reference:\n{business_card_link}\n\nHave a great day!'
    },
    {
      name: 'Bill + Digital Catalog',
      content: 'Hello {customer_name},\n\nThank you for visiting {business_name}!\nYour total bill amount is ₹{grand_total}.\nBill Number: {bill_number}\n\nView your detailed digital bill here:\n{bill_link}\n\nCheck out our latest offerings in our Digital Catalog:\n{catalog_link}\n\nHave a great day!'
    },
    {
      name: 'Bill + Appointment Booking',
      content: 'Hello {customer_name},\n\nThank you for visiting {business_name}!\nYour total bill amount is ₹{grand_total}.\nBill Number: {bill_number}\n\nView your detailed digital bill here:\n{bill_link}\n\nBook your next appointment with us easily online:\n{appointment_link}\n\nHave a great day!'
    }
  ];

  const inserts = defaultTemplates.map(t => ({
    client_id: user.id,
    name: t.name,
    content: t.content
  }));

  const { error } = await supabase
    .from('whatsapp_bill_templates')
    .insert(inserts);

  if (error) return { error: 'Failed to seed default templates.' };
  return { success: true };
}
