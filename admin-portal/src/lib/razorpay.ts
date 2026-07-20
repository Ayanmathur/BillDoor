/**
 * Razorpay Payment Links — Server-side only utility
 *
 * Uses the Razorpay REST API directly (no SDK) to create payment links
 * for subscription renewal. Keys are in .env.local, never client-side.
 */

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_API = 'https://api.razorpay.com/v1';

function getAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
}

/**
 * Calculate subscription amount based on enabled modules.
 * Pricing: ₹500/service, ₹800/any 2, ₹1000/all 3
 */
export function calculateAmount(
  modulesEnabled: { review_flow: boolean; billit: boolean; appointer: boolean },
  pricing: { pricing_1_service_paise: number; pricing_2_services_paise: number; pricing_3_services_paise: number }
): number {
  const count = [modulesEnabled.review_flow, modulesEnabled.billit, modulesEnabled.appointer]
    .filter(Boolean).length;

  if (count >= 3) return pricing.pricing_3_services_paise;
  if (count === 2) return pricing.pricing_2_services_paise;
  if (count === 1) return pricing.pricing_1_service_paise;
  return pricing.pricing_1_service_paise; // minimum 1 service
}

/**
 * Create a Razorpay Payment Link for subscription renewal.
 */
export async function createPaymentLink(params: {
  clientId: string;
  businessName: string;
  phone: string;
  amountPaise: number;
  months: number;
  description?: string;
  callbackUrl?: string;
}): Promise<{ paymentLinkId: string; shortUrl: string } | { error: string }> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return { error: 'Razorpay keys not configured.' };
  }

  const body = {
    amount: params.amountPaise,
    currency: 'INR',
    accept_partial: false,
    description: params.description || `BillDoor subscription renewal — ${params.months} month(s)`,
    customer: {
      name: params.businessName,
      contact: params.phone.startsWith('+') ? params.phone : `+91${params.phone}`,
    },
    notify: {
      sms: true,
      email: false,
    },
    reminder_enable: true,
    notes: {
      client_id: params.clientId,
      months: String(params.months),
      source: 'billdoor_admin',
    },
    callback_url: params.callbackUrl || '',
    callback_method: params.callbackUrl ? 'get' : '',
    expire_by: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  try {
    const response = await fetch(`${RAZORPAY_API}/payment_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { error: (err as Record<string, Record<string, string>>)?.error?.description || `Razorpay error: ${response.status}` };
    }

    const data = await response.json() as { id: string; short_url: string };
    return {
      paymentLinkId: data.id,
      shortUrl: data.short_url,
    };
  } catch (err) {
    return { error: 'Failed to connect to Razorpay.' };
  }
}

/**
 * Verify Razorpay webhook signature (HMAC SHA-256).
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret) return false;

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
