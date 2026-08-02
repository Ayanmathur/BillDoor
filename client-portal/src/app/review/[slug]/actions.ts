'use server';

/**
 * Review Flow — Server Actions (§5.3)
 *
 * Public endpoints (rate-limited):
 * - submitReviewAction: save star rating + optional feedback
 * - generateAiReviewAction: call Gemini to generate a review draft
 * - issueRewardAction: generate a human-readable reward code
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/shared/rate-limit';
import crypto from 'crypto';
import { z } from 'zod';

// ============================================================
// Fetch client info by slug (for the public review page)
// ============================================================
export async function fetchClientBySlugAction(slug: string) {
  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'review:fetch', maxRequests: 30, windowSeconds: 60 }, ip);
  if (!rateCheck.success) return { error: 'Rate limited.', client: null };

  const supabase = await createAdminClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, slug, about, business_type, logo_url, google_place_id, status, reward_settings, whatsapp_url, phone')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!client) return { error: 'Business not found.', client: null };
  if (client.status === 'revoked') return { error: 'temporarily_unavailable', client: null };

  return { client };
}

// ============================================================
// Submit review (1-5 stars + optional feedback text)
// ============================================================
const reviewSchema = z.object({
  clientId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  feedbackText: z.string().optional(),
  sessionId: z.string().uuid().optional(),
});

export async function submitReviewAction(data: {
  clientId: string;
  stars: number;
  feedbackText?: string;
  sessionId?: string;
}) {
  const parsed = reviewSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input data.' };

  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'review:submit', maxRequests: 10, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: 'Too many reviews. Try again later.' };

  if (data.stars < 1 || data.stars > 5) return { error: 'Invalid rating.' };

  const supabase = await createAdminClient();

  // Create or update review session
  let sessionId = data.sessionId;
  if (!sessionId) {
    const { data: session } = await supabase
      .from('review_sessions')
      .insert({
        client_id: data.clientId,
        source: 'qr',
        ip_address: ip,
        stars: data.stars,
        regeneration_count: 0,
      })
      .select('id')
      .single();
    sessionId = session?.id;
  }

  // Insert review
  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      client_id: data.clientId,
      stars: data.stars,
      feedback_text: data.feedbackText || null,
      source: 'qr_link',
      session_id: sessionId,
      ip_address: ip,
      read: false,
    })
    .select('id')
    .single();

  if (error) return { error: 'Failed to submit review. Try again.' };

  return { reviewId: review?.id, sessionId };
}

// ============================================================
// Generate AI review draft via Gemini (4-5★ path)
// ============================================================
const generateAiSchema = z.object({
  clientId: z.string().uuid(),
  businessName: z.string(),
  businessType: z.string().optional(),
  about: z.string().optional(),
  stars: z.number().int().min(1).max(5),
  previousDrafts: z.array(z.string()),
  sessionId: z.string().uuid(),
});

export async function generateAiReviewAction(data: {
  clientId: string;
  businessName: string;
  businessType?: string;
  about?: string;
  stars: number;
  previousDrafts: string[];
  sessionId: string;
}) {
  const parsed = generateAiSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input data.', draft: null };

  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'review:ai', maxRequests: 10, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: 'Rate limited. Try again later.', draft: null };

  // Cap regenerations per session
  const supabase = await createAdminClient();
  const { data: session } = await supabase
    .from('review_sessions')
    .select('regeneration_count')
    .eq('id', data.sessionId)
    .single();

  if (session && (session.regeneration_count || 0) >= 5) {
    return { error: 'Maximum regenerations reached for this session.', draft: null };
  }

  // Increment count
  await supabase
    .from('review_sessions')
    .update({ regeneration_count: (session?.regeneration_count || 0) + 1 })
    .eq('id', data.sessionId);

  // Build business-aware prompt & fallbacks based on about/businessType
  const businessContext = `${data.businessName} ${data.businessType || ''} ${data.about || ''}`.toLowerCase();

  const isFoodOrDelivery = /tiffin|food|mess|catering|kitchen|meal|delivery|canteen|restaurant|dhaba|bento/i.test(businessContext);
  const isSalonOrSpa = /salon|spa|hair|beauty|parlor|barber/i.test(businessContext);

  const previousText = data.previousDrafts.length > 0
    ? `\n\nIMPORTANT: Do NOT repeat or closely rephrase any of these previous drafts:\n${data.previousDrafts.map((d, i) => `${i + 1}. "${d}"`).join('\n')}`
    : '';

  const prompt = `You are helping a satisfied customer write a genuine Google review for a business.

Business Name: ${data.businessName}
${data.businessType ? `Business Type: ${data.businessType}` : ''}
${data.about ? `About Business & Offerings: ${data.about}` : ''}
Rating: ${data.stars} out of 5 stars

Write a short, natural-sounding Google review (2-3 sentences). It MUST specifically reflect the actual business concept (${data.businessName} - ${data.businessType || ''} ${data.about || ''}).
${isFoodOrDelivery ? '- CRITICAL: This is a food/tiffin/delivery service! Mention delicious taste, home-cooked feel, fresh ingredients, or punctual delivery. NEVER mention visiting a physical shop!' : ''}
- Sound like an authentic happy customer, not a marketer.
- Be warm and specific.
- Do NOT mention star rating numbers.${previousText}

Reply with ONLY the review text, no quotes, no explanation.`;

  // Smart business-aware fallback templates
  let fallbacks = [
    `I had a fantastic experience with ${data.businessName}. Highly recommended!`,
    `Excellent service from ${data.businessName}. Very professional and top quality!`,
    `Really impressed with ${data.businessName}. Great experience overall!`
  ];

  if (isFoodOrDelivery) {
    fallbacks = [
      `Delicious, fresh home-style food from ${data.businessName}! Timely delivery and amazing taste every single time.`,
      `Super satisfied with ${data.businessName}. The food quality is fresh, hygienic, and delivered right on time!`,
      `Hands down the best food service! ${data.businessName} serves meals that taste just like home. Highly recommended!`
    ];
  } else if (isSalonOrSpa) {
    fallbacks = [
      `Wonderful experience at ${data.businessName}. The staff is skilled, gentle, and very professional!`,
      `Highly recommend ${data.businessName}! Great hygiene, relaxed atmosphere, and excellent service.`,
      `Loved the service at ${data.businessName}. Very attentive staff and great results!`
    ];
  }

  const getFallback = () => {
    const available = fallbacks.filter(f => !data.previousDrafts.includes(f));
    const list = available.length > 0 ? available : fallbacks;
    return list[Math.floor(Math.random() * list.length)];
  };

  let draftText = '';

  // Tier 1: Gemini API (gemini-2.0-flash, gemini-1.5-flash, gemini-flash-latest)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
    for (const model of geminiModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 120,
              },
            }),
          }
        );
        if (response.ok) {
          const resJson = await response.json();
          const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (text) {
            draftText = text;
            break;
          }
        }
      } catch (e) {
        // Continue to next model or tier
      }
    }
  }

  // Tier 2: OpenRouter API (openai/gpt-4o-mini)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!draftText && openrouterKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://billdoor.com',
          'X-Title': 'BillDoor Review Flow',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 120,
        }),
      });
      if (response.ok) {
        const resJson = await response.json();
        draftText = resJson.choices?.[0]?.message?.content?.trim() || '';
      }
    } catch (e) {
      // Continue to next tier
    }
  }

  // Tier 3: Groq API (llama-3.3-70b-versatile, llama-3.1-8b-instant)
  const groqKey = process.env.GROQ_API_KEY;
  if (!draftText && groqKey) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of groqModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 120,
          }),
        });
        if (response.ok) {
          const resJson = await response.json();
          const text = resJson.choices?.[0]?.message?.content?.trim() || '';
          if (text) {
            draftText = text;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  if (draftText) {
    // Clean up surrounding quotes
    const cleanedDraft = draftText.replace(/^["']|["']$/g, '').trim();
    return { draft: cleanedDraft };
  }

  return { draft: getFallback() };
}

// ============================================================
// Issue reward code (human-readable format: SAVE10-X4F9)
// ============================================================
const issueRewardSchema = z.object({
  clientId: z.string().uuid(),
  reviewId: z.string().uuid().optional(),
  trigger: z.string(),
});

export async function issueRewardAction(data: {
  clientId: string;
  reviewId?: string;
  trigger: string;
}) {
  const parsed = issueRewardSchema.safeParse(data);
  if (!parsed.success) return { error: 'Invalid input data.', reward: null };

  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'reward:issue', maxRequests: 5, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return { error: 'Rate limited.', reward: null };

  const supabase = await createAdminClient();

  // Fetch client reward settings
  const { data: client } = await supabase
    .from('clients')
    .select('reward_settings, business_name')
    .eq('id', data.clientId)
    .single();

  if (!client?.reward_settings) return { error: 'Rewards not configured.', reward: null };

  const rs = client.reward_settings as Record<string, any>;

  // Generate human-readable code
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  const prefix = rs.reward_type === 'percent_discount'
    ? `SAVE${rs.reward_value}`
    : `OFF${rs.reward_value}`;
  const code = `${prefix}-${suffix}`;

  const { data: reward, error } = await supabase
    .from('reward_codes')
    .insert({
      client_id: data.clientId,
      code,
      type: rs.reward_type,
      value: rs.reward_value,
      source_type: data.trigger,
      source_id: data.reviewId || null,
      redeemed: false,
    })
    .select('id, code, type, value')
    .single();

  if (error) return { error: 'Failed to generate reward.', reward: null };

  return {
    reward: {
      code: reward?.code,
      type: reward?.type,
      value: reward?.value,
      businessName: client.business_name,
    },
  };
}

// ============================================================
// Log Google review click-through event
// ============================================================
const googleClickSchema = z.object({
  sessionId: z.string().uuid(),
  event: z.enum(['redirected', 'copied', 'skipped']).default('redirected'),
});

export async function logGoogleReviewClickAction(data: {
  sessionId: string;
  event?: string;
}) {
  const parsed = googleClickSchema.safeParse(data);
  if (!parsed.success) return {};

  const ip = await getClientIp(headers);
  const rateCheck = checkRateLimit({ prefix: 'google:click', maxRequests: 20, windowSeconds: 300 }, ip);
  if (!rateCheck.success) return {};

  const supabase = await createAdminClient();

  await supabase
    .from('google_review_events')
    .insert({
      review_session_id: parsed.data.sessionId,
      event: parsed.data.event,
    });

  return {};
}
