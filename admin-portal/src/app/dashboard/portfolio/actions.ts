'use server';

import { createAdminClient } from '@/lib/supabase/server';

const CATEGORIES = ['website', 'reel', 'facebook_post', 'generic'] as const;

// ============================================================
// Fetch all portfolio items (admin sees all, including hidden)
// ============================================================
export async function fetchPortfolioItemsAction() {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.', items: [] };
  }

  const { data, error } = await supabase
    .from('portfolio_items')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return { error: 'Failed to fetch portfolio items.', items: [] };

  return {
    items: (data || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      category: item.category as string,
      title: item.title as string,
      description: item.description as string,
      externalLink: item.external_link as string,
      displayOrder: item.display_order as number,
      isActive: item.is_active as boolean,
      createdAt: item.created_at as string,
    })),
  };
}

// ============================================================
// Create portfolio item
// ============================================================
export async function createPortfolioItemAction(data: {
  category: string;
  title: string;
  description?: string;
  externalLink: string;
  displayOrder?: number;
}) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  if (!CATEGORIES.includes(data.category as typeof CATEGORIES[number])) {
    return { error: 'Invalid category.' };
  }
  if (!data.title.trim()) return { error: 'Title is required.' };
  if (!data.externalLink.trim()) return { error: 'External link is required.' };

  const { error } = await supabase
    .from('portfolio_items')
    .insert({
      category: data.category,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      external_link: data.externalLink.trim(),
      display_order: data.displayOrder || 0,
      is_active: true,
    });

  if (error) return { error: 'Failed to create portfolio item.' };
  return { success: true };
}

// ============================================================
// Update portfolio item
// ============================================================
export async function updatePortfolioItemAction(data: {
  id: string;
  category?: string;
  title?: string;
  description?: string;
  externalLink?: string;
  displayOrder?: number;
  isActive?: boolean;
}) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  if (data.category && !CATEGORIES.includes(data.category as typeof CATEGORIES[number])) {
    return { error: 'Invalid category.' };
  }

  const updates: Record<string, unknown> = {};
  if (data.category !== undefined) updates.category = data.category;
  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.description !== undefined) updates.description = data.description.trim();
  if (data.externalLink !== undefined) updates.external_link = data.externalLink.trim();
  if (data.displayOrder !== undefined) updates.display_order = data.displayOrder;
  if (data.isActive !== undefined) updates.is_active = data.isActive;

  if (Object.keys(updates).length === 0) return { error: 'Nothing to update.' };

  const { error } = await supabase
    .from('portfolio_items')
    .update(updates)
    .eq('id', data.id);

  if (error) return { error: 'Failed to update portfolio item.' };
  return { success: true };
}

// ============================================================
// Toggle visibility (hide/show)
// ============================================================
export async function togglePortfolioVisibilityAction(id: string) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  // Fetch current state
  const { data: item } = await supabase
    .from('portfolio_items')
    .select('is_active')
    .eq('id', id)
    .single();

  if (!item) return { error: 'Item not found.' };

  const { error } = await supabase
    .from('portfolio_items')
    .update({ is_active: !item.is_active })
    .eq('id', id);

  if (error) return { error: 'Failed to toggle visibility.' };
  return { success: true, isActive: !item.is_active };
}

// ============================================================
// Delete portfolio item (hard delete — not tenant data)
// ============================================================
export async function deletePortfolioItemAction(id: string) {
  const supabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.user_metadata?.role || user.user_metadata.role !== 'admin') {
    return { error: 'Unauthorized.' };
  }

  const { error } = await supabase
    .from('portfolio_items')
    .delete()
    .eq('id', id);

  if (error) return { error: 'Failed to delete portfolio item.' };
  return { success: true };
}
