'use server';

import { createClient } from '@/lib/supabase/server';

export async function fetchRevenueReportAction(from: string, to: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  let query = supabase
    .from('bills')
    .select('id, grand_total, created_at')
    .eq('client_id', user.id);

  if (from) query = query.gte('created_at', from + 'T00:00:00.000Z');
  if (to) query = query.lte('created_at', to + 'T23:59:59.999Z');

  const { data: bills, error } = await query;
  if (error) return { error: error.message };

  let totalRevenue = 0;
  const byDate: Record<string, number> = {};

  (bills || []).forEach((bill: any) => {
    const amount = Number(bill.grand_total || 0);
    totalRevenue += amount;
    
    // Group by local date string
    const date = new Date(bill.created_at).toISOString().split('T')[0];
    byDate[date] = (byDate[date] || 0) + amount;
  });

  const billCount = bills?.length || 0;
  const avgBillValue = billCount > 0 ? totalRevenue / billCount : 0;
  
  const dailyBreakdown = Object.entries(byDate)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRevenue,
    billCount,
    avgBillValue,
    dailyBreakdown,
  };
}

export async function fetchGstSummaryAction(from: string, to: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  let query = supabase
    .from('bills')
    .select('id, created_at, bill_items(tax_percent, taxable_value, cgst, sgst, total_tax)')
    .eq('client_id', user.id);

  if (from) query = query.gte('created_at', from + 'T00:00:00.000Z');
  if (to) query = query.lte('created_at', to + 'T23:59:59.999Z');

  const { data: bills, error } = await query;
  if (error) return { error: error.message };

  const gstRates = [0, 5, 12, 18, 28];
  const summary: Record<number, { taxable_value: number, cgst: number, sgst: number, total_tax: number }> = {};
  gstRates.forEach(rate => {
    summary[rate] = { taxable_value: 0, cgst: 0, sgst: 0, total_tax: 0 };
  });

  (bills || []).forEach((bill: any) => {
    (bill.bill_items || []).forEach((item: any) => {
      // Handle both tax_percent and gst_rate naming just in case
      const rate = Number(item.tax_percent || item.gst_rate || 0);
      if (summary[rate]) {
        summary[rate].taxable_value += Number(item.taxable_value || item.taxable_amount || 0);
        summary[rate].cgst += Number(item.cgst || item.cgst_amount || 0);
        summary[rate].sgst += Number(item.sgst || item.sgst_amount || 0);
        summary[rate].total_tax += Number(item.total_tax || item.tax_amount || 0);
      }
    });
  });

  const rateGroups = Object.entries(summary).map(([rate, data]) => ({
    rate: Number(rate),
    ...data
  }));

  return {
    rateGroups
  };
}
