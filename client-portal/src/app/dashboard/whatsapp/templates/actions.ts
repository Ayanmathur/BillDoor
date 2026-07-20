'use server';

/**
 * WhatsApp Broadcast Templates — Server Actions
 *
 * CRUD for templates with type = 'broadcast' ONLY.
 * Billit and Appointer templates are managed from their own modules.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  content: z.string().min(5, 'Template content is required').max(2000),
});

const updateSchema = templateSchema.extend({
  isActive: z.boolean().optional(),
});

// ---- Fetch Broadcast Templates ----
export async function fetchBroadcastTemplatesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', templates: [] };

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('client_id', user.id)
    .eq('type', 'broadcast')
    .order('created_at', { ascending: false });

  if (error) return { error: 'Failed to fetch templates.', templates: [] };

  return {
    templates: (data || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: t.name as string,
      content: t.content as string,
      isActive: t.is_active as boolean,
      createdAt: t.created_at as string,
      updatedAt: t.updated_at as string,
    })),
  };
}

// ---- Create Template ----
export async function createBroadcastTemplateAction(input: {
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
    .from('whatsapp_templates')
    .insert({
      client_id: user.id,
      type: 'broadcast',
      name: parsed.data.name,
      content: parsed.data.content,
    });

  if (error) return { error: 'Failed to create template.' };
  return { success: true };
}

// ---- Update Template ----
export async function updateBroadcastTemplateAction(
  id: string,
  input: { name: string; content: string; isActive?: boolean }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input.' };
  }

  const updateData: Record<string, unknown> = {
    name: parsed.data.name,
    content: parsed.data.content,
  };
  if (parsed.data.isActive !== undefined) {
    updateData.is_active = parsed.data.isActive;
  }

  const { error } = await supabase
    .from('whatsapp_templates')
    .update(updateData)
    .eq('id', id)
    .eq('client_id', user.id)
    .eq('type', 'broadcast'); // Safety: only broadcast templates

  if (error) return { error: 'Failed to update template.' };
  return { success: true };
}

// ---- Delete (Soft) Template ----
export async function deleteBroadcastTemplateAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { error } = await supabase
    .from('whatsapp_templates')
    .update({ is_active: false })
    .eq('id', id)
    .eq('client_id', user.id)
    .eq('type', 'broadcast');

  if (error) return { error: 'Failed to delete template.' };
  return { success: true };
}
