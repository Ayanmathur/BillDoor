/**
 * Razorpay Webhook Handler — POST /api/razorpay-webhook
 *
 * Verifies signature, handles payment_link.paid events,
 * auto-extends client valid_till, logs to audit_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event as string;

  // Only handle payment_link.paid
  if (event !== 'payment_link.paid') {
    return NextResponse.json({ status: 'ignored' });
  }

  const paymentLinkEntity = (payload.payload as Record<string, Record<string, unknown>>)?.payment_link?.entity;
  if (!paymentLinkEntity) {
    return NextResponse.json({ error: 'Missing payment link entity' }, { status: 400 });
  }

  const rpayLinkId = (paymentLinkEntity as Record<string, unknown>).id as string;
  const rpayPaymentId = ((payload.payload as Record<string, Record<string, unknown>>)?.payment?.entity as Record<string, unknown>)?.id as string;
  const notes = (paymentLinkEntity as Record<string, Record<string, string>>).notes || {};
  const clientId = notes.client_id;
  const months = parseInt(notes.months || '1', 10);

  if (!clientId || !rpayLinkId) {
    return NextResponse.json({ error: 'Missing client_id or link ID in notes' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // 1. Update subscription_payments record
  const { data: subPayment } = await supabase
    .from('subscription_payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      razorpay_payment_id: rpayPaymentId || null,
    })
    .eq('razorpay_payment_link_id', rpayLinkId)
    .eq('client_id', clientId)
    .select('id')
    .single();

  if (!subPayment) {
    // Payment link not found in our records — log and accept
    console.error(`Webhook: subscription_payments not found for rpay link ${rpayLinkId}`);
    return NextResponse.json({ status: 'no_record' });
  }

  // 2. Auto-extend client valid_till
  const { data: client } = await supabase
    .from('clients')
    .select('valid_till, business_name')
    .eq('id', clientId)
    .single();

  if (client) {
    const baseDate = client.valid_till && new Date(client.valid_till) > new Date()
      ? new Date(client.valid_till)
      : new Date();
    baseDate.setMonth(baseDate.getMonth() + months);

    await supabase
      .from('clients')
      .update({ valid_till: baseDate.toISOString(), status: 'active' })
      .eq('id', clientId);

    // 3. Notify client
    await supabase
      .from('notifications')
      .insert({
        client_id: clientId,
        type: 'subscription_due',
        title: 'Subscription Extended',
        message: `Your BillDoor subscription has been extended by ${months} month(s). Valid till ${baseDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        read: false,
      });

    // 4. Audit log
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'system',
        actor_id: clientId,
        action: 'SUBSCRIPTION_PAYMENT_RECEIVED',
        target: clientId,
        metadata: {
          razorpay_payment_link_id: rpayLinkId,
          razorpay_payment_id: rpayPaymentId,
          months,
          new_valid_till: baseDate.toISOString(),
          business_name: client.business_name,
        },
      });
  }

  return NextResponse.json({ status: 'ok' });
}
