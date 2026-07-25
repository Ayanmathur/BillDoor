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
    .select('id, created_at, gst_total, subtotal, bill_items(gst_percent, unit_price, quantity, discount_amount, total)')
    .eq('client_id', user.id);

  if (from) query = query.gte('created_at', from + 'T00:00:00.000Z');
  if (to) query = query.lte('created_at', to + 'T23:59:59.999Z');

  const { data: bills, error } = await query;
  if (error) {
    console.error('fetchGstSummary error:', error);
    return { error: error.message };
  }

  const gstRates = [0, 5, 12, 18, 28];
  const summary: Record<number, { taxable_value: number; cgst: number; sgst: number; total_tax: number }> = {};
  gstRates.forEach(rate => {
    summary[rate] = { taxable_value: 0, cgst: 0, sgst: 0, total_tax: 0 };
  });

  (bills || []).forEach((bill: any) => {
    const items = bill.bill_items || [];
    if (items.length > 0) {
      items.forEach((item: any) => {
        const rate = Number(item.gst_percent || 0);
        const qty = Number(item.quantity || 1);
        const price = Number(item.unit_price || 0);
        const disc = Number(item.discount_amount || 0);
        
        const taxable = Math.max(0, (price * qty) - disc);
        const taxAmount = taxable * (rate / 100);
        const cgst = taxAmount / 2;
        const sgst = taxAmount / 2;

        if (!summary[rate]) {
          summary[rate] = { taxable_value: 0, cgst: 0, sgst: 0, total_tax: 0 };
        }

        summary[rate].taxable_value += taxable;
        summary[rate].cgst += cgst;
        summary[rate].sgst += sgst;
        summary[rate].total_tax += taxAmount;
      });
    } else if (Number(bill.gst_total || 0) > 0) {
      // Fallback for bills without granular line items (default 18%)
      const gstTotal = Number(bill.gst_total);
      const subtotal = Number(bill.subtotal || 0);
      const defaultRate = 18;
      summary[defaultRate].taxable_value += subtotal;
      summary[defaultRate].cgst += gstTotal / 2;
      summary[defaultRate].sgst += gstTotal / 2;
      summary[defaultRate].total_tax += gstTotal;
    }
  });

  const rateGroups = Object.entries(summary).map(([rate, data]) => ({
    rate: Number(rate),
    taxable_value: Math.round(data.taxable_value * 100) / 100,
    cgst: Math.round(data.cgst * 100) / 100,
    sgst: Math.round(data.sgst * 100) / 100,
    total_tax: Math.round(data.total_tax * 100) / 100,
  })).sort((a, b) => a.rate - b.rate);

  return {
    rateGroups
  };
}
