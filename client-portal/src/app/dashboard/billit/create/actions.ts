'use server';

/**
 * Billit — Bill Creation Server Actions (§5.4)
 *
 * Phone-first customer lookup → reward code validation → create bill
 * Bill number: BILL-YYYYMMDD-### (per-client, per-day DB sequence)
 * WhatsApp send tracking (manual via wa.me link)
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================================
// Lookup customer by phone
// ============================================================
export async function lookupCustomerAction(phone: string) {
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
// Lookup catalog item by barcode (RLS-scoped)
// ============================================================
export async function lookupBarcodeAction(barcodeValue: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', item: null };

  const { data: item } = await supabase
    .from('catalog_items')
    .select('id, name, price, unit, gst_percent, barcode_value')
    .eq('client_id', user.id)
    .eq('barcode_value', barcodeValue.trim())
    .eq('active', true)
    .single();

  if (!item) return { error: 'No product matches this barcode.', item: null };
  return { item };
}

// ============================================================
// Search catalog items (typeahead)
// ============================================================
export async function searchCatalogAction(query: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [] };

  const { data } = await supabase
    .from('catalog_items')
    .select('id, name, price, unit, gst_percent, barcode_value')
    .eq('client_id', user.id)
    .eq('active', true)
    .ilike('name', `%${query}%`)
    .limit(10);

  return { items: data || [] };
}

// ============================================================
// Validate reward code
// ============================================================
export async function validateRewardCodeAction(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', reward: null };

  const { data: reward } = await supabase
    .from('reward_codes')
    .select('id, code, type, value, redeemed, reward_catalog_item_id, source_type')
    .eq('client_id', user.id)
    .eq('code', code.trim().toUpperCase())
    .single();

  if (!reward) return { error: 'Reward code not found.', reward: null };
  if (reward.redeemed) return { error: 'This code has already been redeemed.', reward: null };

  // For free_item rewards, resolve catalog item name
  let catalogItemName: string | null = null;
  if (reward.type === 'free_item' && reward.reward_catalog_item_id) {
    const { data: item } = await supabase
      .from('catalog_items')
      .select('name')
      .eq('id', reward.reward_catalog_item_id)
      .single();
    catalogItemName = item?.name || null;
  }

  return { reward: { ...reward, catalogItemName } };
}

// ============================================================
// Create bill
// ============================================================
const lineItemSchema = z.object({
  catalogItemId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().min(0.01),
  unit: z.string().optional(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  gstPercent: z.number().min(0).max(100).default(0),
  addedVia: z.enum(['manual', 'search', 'barcode']).default('manual'),
});

const createBillSchema = z.object({
  billId: z.string().optional(),
  customerPhone: z.string().min(10),
  customerName: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  discountTotal: z.number().min(0).default(0),
  extraCharges: z.number().min(0).default(0),
  extraChargesNote: z.string().optional(),
  rewardCodeId: z.string().optional(),
  rewardDiscount: z.number().min(0).default(0),
  notes: z.string().optional(),
  asDraft: z.boolean().optional().default(false),
});

export async function createBillAction(data: z.infer<typeof createBillSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = createBillSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid bill data.' };

  const d = parsed.data;
  const clientId = user.id;

  // 1. Upsert customer (phone-first, create if not found)
  let customerId: string;
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('client_id', clientId)
    .eq('phone', d.customerPhone.replace(/\D/g, ''))
    .single();

  if (existing) {
    customerId = existing.id;
  } else {
    const { data: newCust, error: custErr } = await supabase
      .from('customers')
      .insert({
        client_id: clientId,
        name: d.customerName,
        phone: d.customerPhone.replace(/\D/g, ''),
        total_visits: 0,
        total_spent: 0,
      })
      .select('id')
      .single();
    if (custErr || !newCust) return { error: 'Failed to create customer.' };
    customerId = newCust.id;
  }

  // 2. Resolve bill number & slug
  let existingBill: any = null;
  if (d.billId) {
    const { data: b } = await supabase.from('bills').select('id, status, bill_number, bill_slug').eq('id', d.billId).single();
    existingBill = b;
  }

  let billNumber: string;
  let billSlug: string;

  if (existingBill) {
    if (existingBill.status === 'issued') {
      billNumber = existingBill.bill_number;
      billSlug = existingBill.bill_slug;
    } else {
      if (!d.asDraft) {
        const { data: seqResult, error: seqErr } = await supabase.rpc('next_bill_number', { p_client_id: clientId });
        if (seqErr || !seqResult) return { error: 'Failed to generate bill number.' };
        billNumber = seqResult as string;
        billSlug = existingBill.bill_slug; // Preserve existing slug so pre-opened tabs don't 404
      } else {
        billNumber = existingBill.bill_number;
        billSlug = existingBill.bill_slug;
      }
    }
  } else {
    if (d.asDraft) {
      billNumber = `DRAFT-${Date.now()}`;
    } else {
      const { data: seqResult, error: seqErr } = await supabase.rpc('next_bill_number', { p_client_id: clientId });
      if (seqErr || !seqResult) return { error: 'Failed to generate bill number.' };
      billNumber = seqResult as string;
    }
    billSlug = `${billNumber.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  }

  // 3. Calculate totals
  let subtotal = 0;
  let gstTotal = 0;
  const processedItems = d.lineItems.map((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const afterDiscount = lineTotal - (item.discount || 0);
    const gst = afterDiscount * ((item.gstPercent || 0) / 100);
    subtotal += afterDiscount;
    gstTotal += gst;
    return { ...item, lineTotal: afterDiscount, gstAmount: gst };
  });

  const grandTotal = subtotal + gstTotal - d.rewardDiscount + d.extraCharges - d.discountTotal;
  const billStatus = d.asDraft ? 'draft' : 'issued';

  // 4. Upsert bill
  let bill: any;
  let billErr: any;

  if (existingBill) {
    const { data, error } = await supabase
      .from('bills')
      .update({
        customer_id: customerId,
        bill_number: billNumber,
        bill_slug: billSlug,
        line_items: processedItems,
        subtotal,
        discount_total: d.discountTotal + d.rewardDiscount,
        gst_total: gstTotal,
        extra_charges: d.extraCharges,
        extra_charges_note: d.extraChargesNote || null,
        grand_total: Math.max(0, grandTotal),
        reward_code_id: d.asDraft ? null : (d.rewardCodeId || null),
        notes: d.notes || null,
        status: billStatus,
      })
      .eq('id', existingBill.id)
      .select('id, bill_slug, bill_number, grand_total')
      .single();
    bill = data;
    billErr = error;
  } else {
    const { data, error } = await supabase
      .from('bills')
      .insert({
        client_id: clientId,
        customer_id: customerId,
        bill_number: billNumber,
        bill_slug: billSlug,
        line_items: processedItems,
        subtotal,
        discount_total: d.discountTotal + d.rewardDiscount,
        gst_total: gstTotal,
        extra_charges: d.extraCharges,
        extra_charges_note: d.extraChargesNote || null,
        grand_total: Math.max(0, grandTotal),
        reward_code_id: d.asDraft ? null : (d.rewardCodeId || null),
        notes: d.notes || null,
        sent_via: null,
        status: billStatus,
      })
      .select('id, bill_slug, bill_number, grand_total')
      .single();
    bill = data;
    billErr = error;
  }

  if (billErr) return { error: 'Failed to save bill. Try again.' };

  // 5. One-time side effects (skip if already issued previously)
  if (!d.asDraft && (!existingBill || existingBill.status === 'draft')) {
    if (d.rewardCodeId) {
      await supabase.from('reward_codes')
        .update({ redeemed: true, redeemed_at: new Date().toISOString(), redeemed_bill_id: bill?.id })
        .eq('id', d.rewardCodeId);
    }

    await supabase.from('customers').update({ name: d.customerName }).eq('id', customerId);

    await supabase.rpc('increment_customer_visits', {
      p_customer_id: customerId,
      p_amount: Math.max(0, grandTotal),
    });
  }

  // 8. Track 2 — Loyalty milestone increment (skip for drafts)
  if (d.asDraft) {
    // Drafts: return immediately, no loyalty or WhatsApp
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return {
      bill: {
        id: bill?.id,
        billNumber: bill?.bill_number,
        billSlug: bill?.bill_slug,
        grandTotal: bill?.grand_total,
        billUrl: `${appUrl}/bill/${bill?.bill_slug}`,
        customerPhone: d.customerPhone.replace(/\D/g, ''),
        customerName: d.customerName,
        isDraft: true,
      },
    };
  }

  // Loyalty Track 2 (only for issued bills)
  const { data: clientConfig } = await supabase
    .from('clients')
    .select('loyalty_config')
    .eq('id', clientId)
    .single();

  const loyaltyConfig = clientConfig?.loyalty_config as any;
  if (loyaltyConfig?.track2_enabled && loyaltyConfig?.track2) {
    const t2 = loyaltyConfig.track2;

    // One-per-day dedup: check if already incremented today
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data: todayBills } = await supabase
      .from('bills')
      .select('id')
      .eq('client_id', clientId)
      .eq('customer_id', customerId)
      .gte('created_at', todayStart)
      .neq('id', bill?.id); // Exclude the bill we just created

    const alreadyBilledToday = (todayBills?.length || 0) > 0;

    if (!alreadyBilledToday) {
      // Get or create loyalty progress row
      const { data: progress } = await supabase
        .from('customer_loyalty_progress')
        .select('*')
        .eq('client_id', clientId)
        .eq('customer_id', customerId)
        .single();

      let newCount: number;

      if (progress) {
        // Determine increment value
        const incrementValue = t2.goal_type === 'spend' ? Math.max(0, grandTotal) : 1;
        newCount = progress.current_count + incrementValue;

        await supabase
          .from('customer_loyalty_progress')
          .update({ current_count: newCount, updated_at: new Date().toISOString() })
          .eq('id', progress.id);
      } else {
        // Create new progress row
        const incrementValue = t2.goal_type === 'spend' ? Math.max(0, grandTotal) : 1;
        newCount = incrementValue;

        await supabase
          .from('customer_loyalty_progress')
          .insert({
            client_id: clientId,
            customer_id: customerId,
            current_count: newCount,
            cycle_started_at: new Date().toISOString(),
          });
      }

      // Check if goal reached
      if (newCount >= t2.goal_value) {
        // Generate reward code
        const codePrefix = t2.reward_type === 'free_item' ? 'FREE' : 'LOYAL';
        const codeRandom = crypto.randomBytes(3).toString('hex').toUpperCase();
        const rewardCode = `${codePrefix}-${codeRandom}`;

        // Find catalog item for free_item rewards
        let catalogItemId = null;
        if (t2.reward_type === 'free_item' && t2.reward_catalog_item_id) {
          catalogItemId = t2.reward_catalog_item_id;
        }

        const { data: newReward } = await supabase
          .from('reward_codes')
          .insert({
            client_id: clientId,
            customer_id: customerId,
            code: rewardCode,
            type: t2.reward_type,
            value: t2.reward_type === 'flat_discount' ? (t2.reward_flat_value || 0) : 0,
            source_type: 'loyalty_milestone',
            reward_catalog_item_id: catalogItemId,
            redeemed: false,
          })
          .select('id')
          .single();

        // Reset counter
        await supabase
          .from('customer_loyalty_progress')
          .update({
            current_count: 0,
            cycle_started_at: new Date().toISOString(),
            last_reward_code_id: newReward?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('client_id', clientId)
          .eq('customer_id', customerId);
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    bill: {
      id: bill?.id,
      billNumber: bill?.bill_number,
      billSlug: bill?.bill_slug,
      grandTotal: bill?.grand_total,
      billUrl: `${appUrl}/bill/${bill?.bill_slug}`,
      customerPhone: d.customerPhone.replace(/\D/g, ''),
      customerName: d.customerName,
    },
  };
}

// ============================================================
// Log manual WhatsApp send
// ============================================================
export async function logWhatsAppSendAction(billId: string, customerPhone: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  await supabase
    .from('bills')
    .update({
      sent_via: 'manual',
      sent_at: new Date().toISOString(),
    })
    .eq('id', billId)
    .eq('client_id', user.id);

  return {};
}

// ============================================================
// Fetch client settings for bill creation
// ============================================================
export async function fetchBillSettingsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', settings: null };

  const { data: client } = await supabase
    .from('clients')
    .select('business_name, slug, barcode_enabled, has_gst, gst_number, reward_settings')
    .eq('id', user.id)
    .single();

  if (!client) return { error: 'Client not found.', settings: null };

  // Fetch the billit WhatsApp template
  const { data: template } = await supabase
    .from('whatsapp_templates')
    .select('content')
    .eq('client_id', user.id)
    .eq('type', 'billit')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  return {
    settings: {
      ...client,
      bill_whatsapp_template: template?.content || null,
    },
  };
}

// ============================================================
// Void a bill (never deletes — requires reason)
// ============================================================
const voidBillSchema = z.object({
  billId: z.string().uuid(),
  reason: z.string().min(5, 'Void reason must be at least 5 characters'),
});

export async function voidBillAction(data: z.infer<typeof voidBillSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const parsed = voidBillSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Invalid input.' };

  // Verify bill belongs to this client and is currently 'issued'
  const { data: bill } = await supabase
    .from('bills')
    .select('id, status, bill_number')
    .eq('id', parsed.data.billId)
    .eq('client_id', user.id)
    .single();

  if (!bill) return { error: 'Bill not found.' };
  if (bill.status === 'voided') return { error: 'Bill is already voided.' };
  if (bill.status === 'draft') return { error: 'Cannot void a draft. Delete or finalize it first.' };

  const { error } = await supabase
    .from('bills')
    .update({ status: 'voided', void_reason: parsed.data.reason })
    .eq('id', parsed.data.billId)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to void bill.' };

  // Create notification
  await supabase.from('notifications').insert({
    client_id: user.id,
    type: 'bill_sent',
    title: 'Bill Voided',
    message: `${bill.bill_number} voided: ${parsed.data.reason}`,
  });

  return { success: true };
}

// ============================================================
// Finalize a draft bill (assigns real bill number)
// ============================================================
export async function finalizeDraftAction(billId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  // Verify it's a draft belonging to this client
  const { data: draft } = await supabase
    .from('bills')
    .select('id, status, reward_code_id, customer_id, grand_total, bill_slug')
    .eq('id', billId)
    .eq('client_id', user.id)
    .single();

  if (!draft) return { error: 'Bill not found.' };
  if (draft.status !== 'draft') return { error: 'Only draft bills can be finalized.' };

  // Generate real bill number via atomic DB function
  const { data: billNumResult, error: seqErr } = await supabase.rpc('next_bill_number', {
    p_client_id: user.id,
  });
  if (seqErr || !billNumResult) return { error: 'Failed to generate bill number.' };
  const billNumber = billNumResult as string;

  const { error } = await supabase
    .from('bills')
    .update({ status: 'issued', bill_number: billNumber })
    .eq('id', billId)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to finalize bill.' };

  // Now do post-issue tasks: reward redemption, customer stats, loyalty
  // (Reward code redemption if one was attached)
  if (draft.reward_code_id) {
    await supabase
      .from('reward_codes')
      .update({ redeemed: true, redeemed_at: new Date().toISOString(), redeemed_bill_id: billId })
      .eq('id', draft.reward_code_id);
  }

  // Update customer stats
  await supabase
    .from('customers')
    .update({
      last_visit_at: new Date().toISOString(),
    })
    .eq('id', draft.customer_id);

  const rpcResult = await supabase.rpc('increment_customer_visits', {
    p_customer_id: draft.customer_id,
    p_amount: Math.max(0, Number(draft.grand_total)),
  });
  void rpcResult;

  return { success: true, billNumber };
}

// ============================================================
// Fetch bills list (with status filter)
// ============================================================
export async function fetchBillsAction(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', bills: [], total: 0 };

  const limit = params?.limit || 25;
  const offset = params?.offset || 0;

  let query = supabase
    .from('bills')
    .select('id, bill_number, bill_slug, grand_total, status, void_reason, created_at, customer_id', { count: 'exact' })
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  const { data, count, error } = await query;
  if (error) return { error: 'Failed to fetch bills.', bills: [], total: 0 };

  // Fetch customer names and phones
  const customerIds = [...new Set((data || []).map((b: any) => b.customer_id))];
  let customerMap: Record<string, { name: string; phone: string }> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone')
      .in('id', customerIds);
    for (const c of (customers || [])) {
      customerMap[c.id] = { name: c.name, phone: c.phone || '' };
    }
  }

  return {
    bills: (data || []).map((b: any) => ({
      id: b.id,
      billNumber: b.bill_number,
      billSlug: b.bill_slug,
      grandTotal: b.grand_total,
      status: b.status,
      voidReason: b.void_reason,
      customerName: customerMap[b.customer_id]?.name || 'Unknown',
      customerPhone: customerMap[b.customer_id]?.phone || '',
      createdAt: b.created_at,
    })),
    total: count || 0,
  };
}

// ============================================================
// Delete a draft bill (only drafts can be deleted)
// ============================================================
export async function deleteDraftAction(billId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.' };

  const { data: bill } = await supabase
    .from('bills')
    .select('id, status')
    .eq('id', billId)
    .eq('client_id', user.id)
    .single();

  if (!bill) return { error: 'Bill not found.' };
  if (bill.status !== 'draft') return { error: 'Only draft bills can be deleted.' };

  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('id', billId)
    .eq('client_id', user.id);

  if (error) return { error: 'Failed to delete draft.' };
  return { success: true };
}

// ============================================================
// Fetch distinct GST rates from client's catalog (for calculator)
// ============================================================
export async function fetchDistinctGstRatesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized.', rates: [] };

  const { data } = await supabase
    .from('catalog_items')
    .select('default_gst_percent')
    .eq('client_id', user.id)
    .eq('active', true);

  // Extract unique rates
  const uniqueRates = [...new Set((data || []).map((d: any) => Number(d.default_gst_percent)))]
    .filter(r => r > 0)
    .sort((a, b) => a - b);

  return { rates: uniqueRates };
}

// ============================================================
// Preview next bill number (does not consume sequence)
// ============================================================
export async function previewNextBillNumberAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: client } = await supabase.from('clients').select('has_gst').eq('id', user.id).single();
  if (!client) return null;

  if (client.has_gst) {
    const today = new Date();
    // Use IST for accurate FY boundary
    const istTime = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
    let fyStart = istTime.getUTCFullYear() % 100;
    if (istTime.getUTCMonth() < 3) fyStart -= 1; // Before April
    const fyEnd = fyStart + 1;
    const fy = `${fyStart.toString().padStart(2, '0')}${fyEnd.toString().padStart(2, '0')}`;
    
    const { data: seq } = await supabase.from('bill_gst_sequences')
      .select('last_number').eq('client_id', user.id).eq('financial_year', fy).single();
    const nextNum = (seq?.last_number || 0) + 1;
    return `INV-${fy}-${nextNum.toString().padStart(4, '0')}`;
  } else {
    const today = new Date();
    const istTime = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = istTime.toISOString().split('T')[0].replace(/-/g, '');
    const { data: seq } = await supabase.from('bill_sequences')
      .select('last_number').eq('client_id', user.id).eq('date_prefix', todayStr).single();
    const nextNum = (seq?.last_number || 0) + 1;
    return `BILL-${todayStr}-${nextNum.toString().padStart(3, '0')}`;
  }
}
