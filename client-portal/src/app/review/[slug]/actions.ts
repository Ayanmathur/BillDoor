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

  const prompt = `You are helping a satisfied customer write a genuine 5-star Google review for a business.

Business Name: ${data.businessName}
${data.businessType ? `Business Type: ${data.businessType}` : ''}
${data.about ? `About Business & Offerings: ${data.about}` : ''}
Rating: ${data.stars} out of 5 stars

Write a full, natural-sounding Google review consisting of 2 to 3 full sentences. It MUST specifically incorporate details about the business concept and offerings (${data.businessName}${data.about ? ` - ${data.about}` : ''}).
${isFoodOrDelivery ? '- CRITICAL: This is a food/tiffin/delivery service! Mention delicious taste, home-cooked feel, fresh ingredients, hygienic packaging, or punctual delivery. NEVER mention visiting a physical shop!' : ''}
${isSalonOrSpa ? '- Focus on skilled staff, clean environment, relaxed atmosphere, and excellent care.' : ''}
- Sound like an authentic happy customer who actually used their products/services.
- Write 2-3 complete sentences with specific details.
- Do NOT mention star rating numbers.${previousText}

Reply with ONLY the review text, no quotes, no explanation.`;

  // Smart business-aware fallback templates (full 2-3 line reviews incorporating about/type)
  const aboutStr = data.about ? ` Their specialization in ${data.about} really stands out.` : '';
  let fallbacks = [
    `I had an absolutely fantastic experience with ${data.businessName}. The quality of service and attention to detail exceeded my expectations.${aboutStr} Highly recommend them to anyone looking for top-notch quality and professional care!`,
    `Extremely impressed with the service at ${data.businessName}. The team is incredibly professional, polite, and prompt.${aboutStr} Will definitely be a returning customer!`,
    `Hands down one of the best experiences I have had with ${data.businessName}. Fantastic quality, warm customer care, and seamless execution.${aboutStr} Five stars all the way!`
  ];

  if (isFoodOrDelivery) {
    fallbacks = [
      `Delicious, fresh home-style food from ${data.businessName}!${aboutStr} Punctual delivery, hygienic packaging, and amazing taste every single time.`,
      `Super satisfied with ${data.businessName}. The food quality is fresh, wholesome, and delivered right on time.${aboutStr} Definitely the best meal service around!`,
      `Hands down the best food service! ${data.businessName} serves meals that taste just like home.${aboutStr} Generous portions, fantastic flavor, and super reliable delivery.`
    ];
  } else if (isSalonOrSpa) {
    fallbacks = [
      `Wonderful experience at ${data.businessName}. The staff is highly skilled, gentle, and very professional.${aboutStr} Left feeling completely relaxed and refreshed!`,
      `Highly recommend ${data.businessName}! Clean and serene ambiance, polite staff, and top-tier service.${aboutStr} Truly worth every rupee!`,
      `Loved my visit to ${data.businessName}. Professional team, great hygienic standards, and amazing attention to detail.${aboutStr} Will definitely be coming back!`
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

  // Tier 4: Pre-Generated 5-Slot Rolling Buffer (Instant 0ms Fallback with Background Overwrite Replenishment)
  const pregeneratedDraft = await getAndConsumePreGeneratedReview(
    data.clientId,
    data.businessName,
    data.businessType,
    data.about,
    data.previousDrafts
  );

  if (pregeneratedDraft) {
    return { draft: pregeneratedDraft };
  }

  // Tier 5: Smart Business-Aware Template Fallback
  return { draft: getFallback() };
}

/**
 * Tier 4 Helper: Fetch and consume 1 review from client's 5-slot pregenerated buffer in DB,
 * and asynchronously trigger background replacement to overwrite the consumed slot.
 */
async function getAndConsumePreGeneratedReview(
  clientId: string,
  businessName: string,
  businessType?: string,
  about?: string,
  previousDrafts: string[] = []
): Promise<string | null> {
  try {
    const supabase = await createAdminClient();
    const { data: client } = await supabase
      .from('clients')
      .select('reward_settings')
      .eq('id', clientId)
      .single();

    if (!client) return null;

    const rs = (client.reward_settings || {}) as Record<string, any>;
    const buffer: string[] = Array.isArray(rs.pregenerated_buffer) ? rs.pregenerated_buffer : [];

    // Filter out previous drafts to prevent duplicate display
    const available = buffer.filter(d => d && !previousDrafts.includes(d));

    if (available.length > 0) {
      const selectedDraft = available[0];
      const remainingBuffer = buffer.filter(d => d !== selectedDraft);

      // Save updated buffer (4 items)
      await supabase
        .from('clients')
        .update({
          reward_settings: {
            ...rs,
            pregenerated_buffer: remainingBuffer,
          },
        })
        .eq('id', clientId);

      // Asynchronously trigger single slot replacement in background (adds new 6th review to fill the 5th slot)
      replenishSingleReviewSlot(clientId, businessName, businessType, about, remainingBuffer).catch(console.error);

      return selectedDraft;
    }
  } catch (err) {
    console.error('Tier 4 pregenerated buffer error:', err);
  }

  return null;
}

/**
 * Background Slot Replenishment: Asynchronously generates 1 brand new, unique review
 * and saves it into the client's 5-slot buffer (capped at 5 items).
 */
async function replenishSingleReviewSlot(
  clientId: string,
  businessName: string,
  businessType?: string,
  about?: string,
  currentBuffer: string[] = []
) {
  try {
    const supabase = await createAdminClient();
    const isFoodOrDelivery = /tiffin|food|mess|catering|kitchen|meal|delivery|canteen|restaurant|dhaba|bento/i.test(`${businessName} ${businessType || ''} ${about || ''}`);
    const isSalonOrSpa = /salon|spa|hair|beauty|parlor|barber/i.test(`${businessName} ${businessType || ''} ${about || ''}`);

    const prompt = `Generate 1 short, highly authentic 5-star Google review (2-3 sentences) for ${businessName} (${businessType || 'business'}).
${about ? `About: ${about}` : ''}
${isFoodOrDelivery ? 'Focus on food taste, home-cooked freshness, hygienic packaging, or timely delivery.' : ''}
${isSalonOrSpa ? 'Focus on skilled staff, clean environment, relaxed atmosphere, and great service.' : ''}
Do NOT repeat any of these existing reviews: ${currentBuffer.join(' | ')}.
Reply with ONLY the review text, no quotes or explanation.`;

    let newReview = '';

    // Attempt Gemini / OpenRouter / Groq to create 1 fresh replacement draft
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 120 } }),
        });
        if (res.ok) {
          const json = await res.json();
          newReview = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
      } catch (e) {}
    }

    if (!newReview) {
      // Smart template fallback if AI is down
      const templates = isFoodOrDelivery ? [
        `Always fresh and delicious meals from ${businessName}! Punctual delivery and great quality every single day.`,
        `Amazing taste and authentic home-style flavors at ${businessName}. Highly recommended for daily meals!`,
        `Extremely satisfied with ${businessName}. Hygienic packaging, generous portions, and wonderful taste!`,
        `${businessName} never disappoints. Food is always hot, fresh, and delivered right on time!`,
        `Best food service in town! ${businessName} offers top-notch quality and fantastic service.`
      ] : isSalonOrSpa ? [
        `Wonderful experience at ${businessName}. Skilled professionals, polite behavior, and excellent results!`,
        `Highly recommend ${businessName}! Super clean, relaxing ambiance, and top-tier customer care.`,
        `Loved my visit to ${businessName}. Professional staff, reasonable pricing, and amazing attention to detail!`,
        `Fantastic service at ${businessName}. The staff takes time to understand what you need and delivers perfectly.`,
        `Great atmosphere and friendly staff at ${businessName}. Will definitely be coming back!`
      ] : [
        `Outstanding experience with ${businessName}. Professional, prompt, and top quality service overall!`,
        `Highly recommend ${businessName}! Very attentive team, seamless execution, and great value.`,
        `Impressed with the professionalism at ${businessName}. Delivered beyond expectations!`,
        `Great work by ${businessName}. Friendly staff, quick turnaround, and excellent customer support.`,
        `Super satisfied with ${businessName}. Would definitely recommend them to friends and family!`
      ];

      const unused = templates.filter(t => !currentBuffer.includes(t));
      newReview = unused[Math.floor(Math.random() * (unused.length || 1))] || templates[0];
    }

    newReview = newReview.replace(/^["']|["']$/g, '').trim();

    // Fetch latest client reward_settings and overwrite buffer, capped at 5
    const { data: client } = await supabase.from('clients').select('reward_settings').eq('id', clientId).single();
    if (client) {
      const rs = (client.reward_settings || {}) as Record<string, any>;
      const existing = Array.isArray(rs.pregenerated_buffer) ? rs.pregenerated_buffer : [];
      const updatedBuffer = Array.from(new Set([...existing, newReview])).slice(0, 5);

      await supabase.from('clients').update({
        reward_settings: {
          ...rs,
          pregenerated_buffer: updatedBuffer,
        }
      }).eq('id', clientId);
    }
  } catch (err) {
    console.error('Replenish review slot error:', err);
  }
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
