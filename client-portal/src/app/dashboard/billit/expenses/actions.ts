'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const expenseSchema = z.object({
  amount: z.number().positive(),
  category: z.enum(['rent', 'salary', 'supplies', 'utilities', 'marketing', 'general', 'other']),
  notes: z.string().optional(),
  expenseDate: z.string(), // ISO string YYYY-MM-DD
});

const updateExpenseSchema = expenseSchema.partial();

export async function fetchExpensesAction(filters?: { from?: string; to?: string; category?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', expenses: [] };

  let query = supabase
    .from('expenses')
    .select('id, category, amount, note, expense_date, created_at')
    .eq('client_id', user.id)
    .order('expense_date', { ascending: false });

  if (filters?.from) query = query.gte('expense_date', filters.from);
  if (filters?.to) query = query.lte('expense_date', filters.to);
  if (filters?.category && filters.category !== 'all') query = query.eq('category', filters.category);

  const { data, error } = await query;
  if (error) {
    console.error('fetchExpenses error:', error);
    return { error: 'Failed to fetch expenses', expenses: [] };
  }

  const mapped = (data || []).map(exp => ({
    ...exp,
    notes: exp.note,
  }));

  return { expenses: mapped };
}

export async function createExpenseAction(data: { amount: number; category: string; notes?: string; expenseDate: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input data' };

  const { error } = await supabase.from('expenses').insert({
    client_id: user.id,
    amount: parsed.data.amount,
    category: parsed.data.category,
    note: parsed.data.notes || null,
    expense_date: parsed.data.expenseDate,
  });

  if (error) {
    console.error('createExpense error:', error);
    return { error: error.message };
  }

  return { success: true };
}

export async function updateExpenseAction(id: string, data: { amount?: number; category?: string; notes?: string; expenseDate?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const parsed = updateExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input data' };

  const updateData: any = {};
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.notes !== undefined) updateData.note = parsed.data.notes;
  if (parsed.data.expenseDate !== undefined) updateData.expense_date = parsed.data.expenseDate;

  const { error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .eq('client_id', user.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteExpenseAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('client_id', user.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function fetchExpenseSummaryAction(from?: string, to?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', summary: {}, totalExpenses: 0 };

  let query = supabase
    .from('expenses')
    .select('amount, category')
    .eq('client_id', user.id);

  if (from && from.trim()) query = query.gte('expense_date', from.trim());
  if (to && to.trim()) query = query.lte('expense_date', to.trim());

  const { data, error } = await query;
  if (error) {
    console.error('fetchExpenseSummary error:', error);
    return { error: 'Failed to fetch summary', summary: {}, totalExpenses: 0 };
  }

  const summary = (data || []).reduce((acc: Record<string, number>, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount || 0);
    return acc;
  }, {});

  const totalExpenses = Object.values(summary).reduce((a, b) => a + b, 0);

  return { summary, totalExpenses };
}
