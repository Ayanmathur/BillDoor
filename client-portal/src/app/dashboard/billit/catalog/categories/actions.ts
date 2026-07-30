'use server';

/**
 * Billit — Catalog Categories Server Actions
 *
 * CRUD for catalog_categories + item assignment, visibility, availability.
 * All RLS-scoped to authenticated client.
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================================
// Fetch all categories for the client
// ============================================================
export async function fetchCategoriesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', categories: null };

  const { data, error } = await supabase
    .from('catalog_categories')
    .select('id, name, display_order')
    .eq('client_id', user.id)
    .order('display_order', { ascending: true });

  if (error) return { error: 'Failed to fetch categories.', categories: null };
  return { categories: data };
}

// ============================================================
// Add a new category
// ============================================================
const addCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(100, 'Category name too long.'),
});

export async function addCategoryAction(input: { name: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = addCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  // Get next display_order
  const { data: existing } = await supabase
    .from('catalog_categories')
    .select('display_order')
    .eq('client_id', user.id)
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

  const { error } = await supabase
    .from('catalog_categories')
    .insert({
      client_id: user.id,
      name: parsed.data.name,
      display_order: nextOrder,
    });

  if (error) return { error: 'Failed to add category.' };
  return {};
}

// ============================================================
// Update a category name
// ============================================================
const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Category name is required.').max(100),
});

export async function updateCategoryAction(input: { id: string; name: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  const { error } = await supabase
    .from('catalog_categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update category.' };
  return {};
}

// ============================================================
// Delete a category (items fall to uncategorized)
// ============================================================
export async function deleteCategoryAction(input: { id: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: 'Invalid category ID.' };

  // ON DELETE SET NULL handles category_id → null on items
  const { error } = await supabase
    .from('catalog_categories')
    .delete()
    .eq('id', parsed.data.id)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to delete category.' };
  return {};
}

// ============================================================
// Reorder categories (bulk display_order update)
// ============================================================
const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export async function reorderCategoriesAction(input: { orderedIds: string[] }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input.' };

  // Update each category's display_order
  const updates = parsed.data.orderedIds.map((id, index) =>
    supabase
      .from('catalog_categories')
      .update({ display_order: index })
      .eq('id', id)
      .eq('client_id', user.id)
  );

  const results = await Promise.all(updates);
  const failed = results.some(r => r.error);
  if (failed) return { error: 'Failed to reorder categories.' };
  return {};
}

// ============================================================
// Assign an item to a category
// ============================================================
export async function assignItemCategoryAction(input: { itemId: string; categoryId: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = z.object({
    itemId: z.string().uuid(),
    categoryId: z.string().uuid().nullable(),
  }).safeParse(input);
  if (!parsed.success) return { error: 'Invalid input.' };

  const { error } = await supabase
    .from('catalog_items')
    .update({ category_id: parsed.data.categoryId })
    .eq('id', parsed.data.itemId)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to assign category.' };
  return {};
}

// ============================================================
// Toggle show_in_catalog
// ============================================================
export async function toggleItemCatalogVisibilityAction(input: { itemId: string; show: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = z.object({
    itemId: z.string().uuid(),
    show: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return { error: 'Invalid input.' };

  const { error } = await supabase
    .from('catalog_items')
    .update({ show_in_catalog: parsed.data.show })
    .eq('id', parsed.data.itemId)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update visibility.' };
  return {};
}

// ============================================================
// Toggle is_available
// ============================================================
export async function toggleItemAvailabilityAction(input: { itemId: string; available: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = z.object({
    itemId: z.string().uuid(),
    available: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return { error: 'Invalid input.' };

  const { error } = await supabase
    .from('catalog_items')
    .update({ is_available: parsed.data.available })
    .eq('id', parsed.data.itemId)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to update availability.' };
  return {};
}

// ============================================================
// Fetch all active items with category info for the builder UI
// ============================================================
export async function fetchItemsWithCategoryAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', items: null };

  const { data, error } = await supabase
    .from('catalog_items')
    .select('id, name, type, price, unit, category_id, show_in_catalog, is_available')
    .eq('client_id', user.id)
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) return { error: 'Failed to fetch items.', items: null };
  return { items: data };
}
