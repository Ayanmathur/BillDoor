/**
 * Payment Reminder Cron Job — GET /api/cron/payment-reminders
 *
 * Runs daily (via Vercel Cron). Finds clients expiring within 7 days,
 * auto-creates Razorpay payment links, inserts notifications.
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createPaymentLink, calculateAmount } from '@/lib/razorpay';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createAdminClient();
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find active clients expiring within 7 days
  const { data: expiringClients } = await supabase
    .from('clients')
    .select('id, business_name, phone, modules_enabled, valid_till')
    .eq('status', 'active')
    .is('deleted_at', null)
    .lte('valid_till', sevenDaysFromNow.toISOString())
    .gte('valid_till', now.toISOString());

  if (!expiringClients || expiringClients.length === 0) {
    return NextResponse.json({ status: 'ok', processed: 0 });
  }

  // Get pricing from platform_settings
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('pricing_1_service_paise, pricing_2_services_paise, pricing_3_services_paise, default_subscription_months')
    .single();

  const pricing = settings || {
    pricing_1_service_paise: 50000,
    pricing_2_services_paise: 80000,
    pricing_3_services_paise: 100000,
    default_subscription_months: 1,
  };

  let processed = 0;
  const errors: string[] = [];

  for (const client of expiringClients) {
    // Check if we already sent a reminder in the last 7 days
    const { data: recentPayment } = await supabase
      .from('subscription_payments')
      .select('id')
      .eq('client_id', client.id)
      .eq('status', 'created')
      .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (recentPayment) continue; // Already sent

    const modules = (client.modules_enabled || {}) as {
      review_flow: boolean; billit: boolean; appointer: boolean;
    };
    const amount = calculateAmount(modules, pricing);
    const months = pricing.default_subscription_months;

    // Create Razorpay payment link
    const result = await createPaymentLink({
      clientId: client.id,
      businessName: client.business_name,
      phone: client.phone,
      amountPaise: amount,
      months,
    });

    if ('error' in result) {
      errors.push(`${client.business_name}: ${result.error}`);
      continue;
    }

    // Insert subscription_payments record
    await supabase
      .from('subscription_payments')
      .insert({
        client_id: client.id,
        razorpay_payment_link_id: result.paymentLinkId,
        amount_paise: amount,
        months,
        status: 'created',
        payment_link_url: result.shortUrl,
        notes: { source: 'auto_reminder', valid_till: client.valid_till },
      });

    // Notify client
    await supabase
      .from('notifications')
      .insert({
        client_id: client.id,
        type: 'subscription_due',
        title: 'Subscription Expiring Soon',
        message: `Your BillDoor subscription expires on ${new Date(client.valid_till).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Renew now to avoid interruption.`,
        read: false,
      });

    // Audit log
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'system',
        actor_id: client.id,
        action: 'PAYMENT_REMINDER_SENT',
        target: client.id,
        metadata: {
          business_name: client.business_name,
          amount_paise: amount,
          payment_link_url: result.shortUrl,
          valid_till: client.valid_till,
        },
      });

    processed++;
  }

  return NextResponse.json({
    status: 'ok',
    processed,
    total: expiringClients.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
