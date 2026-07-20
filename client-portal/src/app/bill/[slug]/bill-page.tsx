'use client';

/**
 * BillDoor — Digital Bill Page (public, /bill/[slug]) (§5.4)
 *
 * One link, three jobs: bill display + inline review + WhatsApp payload.
 * Emoji rating (bill page specific — stars on standalone review page).
 * Zudio-inspired layout.
 *
 * Top → bottom:
 * 1. Logo + business name/address
 * 2. 5-emoji rating row (inline Review Flow)
 * 3. Invoice meta (bill number, date, customer)
 * 4. Line items table
 * 5. Summary (subtotal → discount → GST → extras → grand total)
 * 6. Social + review footer
 * 7. Print/Download button
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Printer, Download, Check, Loader2, Instagram, Facebook, Globe,
  ExternalLink, Linkedin, Twitter, MessageCircle, Gift
} from 'lucide-react';
import { submitInlineReviewAction } from './actions';
import { generateAiReviewAction } from '../../review/[slug]/actions';

interface BillPageClientProps {
  bill: any;
  client: any;
  customer: any;
  loyaltyConfig: any;
  loyaltyProgress: any;
  status?: string;
  voidReason?: string;
  hasGst?: boolean;
  gstNumber?: string;
}

const EMOJIS = ['😠', '😞', '😐', '🙂', '🤩'];

export default function BillPageClient({ bill, client, customer, loyaltyConfig, loyaltyProgress, status, voidReason, hasGst, gstNumber }: BillPageClientProps) {
  const searchParams = useSearchParams();
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offerRevealed, setOfferRevealed] = useState(false);

  // AI draft for 4-5★
  const [aiDraft, setAiDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const googleReviewUrl = client.google_place_id
    ? `https://search.google.com/local/writereview?placeid=${client.google_place_id}`
    : null;

  const startCountdown = useCallback(() => {
    if (!googleReviewUrl) return;
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          window.location.href = googleReviewUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [googleReviewUrl]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // Auto-trigger print dialog when opened with ?print=1
  useEffect(() => {
    if (searchParams.get('print') === '1') {
      // Small delay to let the page render fully
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const initials = client.business_name?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'BD';

  async function handleEmojiClick(rating: number) {
    if (reviewed) return;
    setSelectedRating(rating);

    if (rating <= 3) {
      setShowFeedback(true);
    } else {
      // 4-5★: submit + generate AI draft
      setSubmitting(true);
      await submitInlineReviewAction({ clientId: client.id || bill.client_id, billId: bill.id, stars: rating });
      setReviewed(true);

      // Generate AI draft
      setAiLoading(true);
      const result = await generateAiReviewAction({
        clientId: bill.client_id,
        businessName: client.business_name,
        businessType: '',
        about: client.about || '',
        stars: rating,
        previousDrafts: [],
        sessionId: bill.id,
      });
      if (result.draft) {
        setAiDraft(result.draft);
        startCountdown();
      }
      setAiLoading(false);
      setSubmitting(false);
    }
  }

  async function handleSubmitFeedback() {
    setSubmitting(true);
    const result = await submitInlineReviewAction({
      clientId: bill.client_id,
      billId: bill.id,
      stars: selectedRating,
      feedbackText,
    });
    if (result.error === 'already_reviewed') {
      setReviewed(true);
    } else {
      setReviewed(true);
    }
    setSubmitting(false);
    setShowFeedback(false);
  }

  async function handleCopyDraft() {
    try { await navigator.clipboard.writeText(aiDraft); } catch (e) {}
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (googleReviewUrl) window.location.href = googleReviewUrl;
  }

  const lineItems = bill.line_items || [];
  const createdAt = new Date(bill.created_at);
  const anyGst = lineItems.some((item: any) => (item.gstPercent || 0) > 0 || (item.gstAmount || 0) > 0);
  const showGstRow = hasGst || anyGst || Number(bill.gst_total) > 0;
  const docLabel = hasGst ? 'Tax Invoice' : 'Bill';

  return (
    <div className="bill-page">
      <div className="bill-container" style={{ position: 'relative', overflow: 'hidden' }}>
        {status === 'voided' && (
          <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', color: 'rgba(220, 38, 38, 0.15)', fontSize: '5rem', fontWeight: 900, pointerEvents: 'none', zIndex: 10, textAlign: 'center', lineHeight: 1 }}>
            VOIDED
            {voidReason && <div style={{ fontSize: '1.25rem', marginTop: 10, fontWeight: 500, color: 'rgba(220, 38, 38, 0.4)' }}>{voidReason}</div>}
          </div>
        )}
        {status === 'draft' && (
          <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', color: 'rgba(245, 158, 11, 0.15)', fontSize: '5rem', fontWeight: 900, pointerEvents: 'none', zIndex: 10 }}>
            DRAFT
          </div>
        )}
        {/* Header */}
        <div className="bill-header">
          <div className="bill-logo">
            {client.logo_url ? <img src={client.logo_url} alt={client.business_name} /> : initials}
          </div>
          <div className="bill-biz-name">{client.business_name}</div>
          {client.address && <div className="bill-biz-address">{client.address}</div>}
          {client.phone && <div className="bill-biz-address">Tel: {client.phone}</div>}
          {hasGst && gstNumber && <div className="bill-gstin">GSTIN: {gstNumber}</div>}
          <div style={{ marginTop: 'var(--space-2)', fontWeight: 'bold', fontSize: 'var(--text-md)', textTransform: 'uppercase', letterSpacing: 1, color: '#333' }}>{docLabel}</div>
        </div>

        {/* Emoji Rating Row */}
        <div className="bill-rating-row">
          {reviewed ? (
            <div className="bill-rating-done"><Check size={14} /> Thanks for your feedback!</div>
          ) : (
            <>
              <div className="bill-rating-prompt">How was your experience?</div>
              <div className="rating">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <React.Fragment key={rating}>
                    <input 
                      type="radio" 
                      id={`star${rating}`} 
                      name="rating" 
                      value={rating}
                      checked={selectedRating === rating}
                      onChange={() => handleEmojiClick(rating)}
                      disabled={submitting}
                    />
                    <label htmlFor={`star${rating}`} title={`${rating} stars`}></label>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Inline Feedback (1-3★) */}
        {showFeedback && !reviewed && (
          <div className="bill-inline-feedback">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What could we improve?"
              maxLength={500}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="review-btn" onClick={() => { setShowFeedback(false); setSelectedRating(0); }} style={{ fontSize: 11 }}>Cancel</button>
              <button className="review-btn primary" onClick={handleSubmitFeedback} disabled={submitting} style={{ fontSize: 11 }}>
                {submitting ? <Loader2 size={12} className="spinner" /> : null} Submit
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 4 }}>Private feedback — only visible to {client.business_name}</div>
          </div>
        )}

        {/* AI Draft (4-5★) */}
        {reviewed && aiDraft && (
          <div className="bill-inline-feedback">
            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}><Loader2 size={16} className="spinner" /></div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Suggested Google review:</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#333', background: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid #EEE', marginBottom: 'var(--space-2)' }}>{aiDraft}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                  <button className="review-btn primary" onClick={handleCopyDraft} style={{ fontSize: 11 }}>Copy & Go to Google</button>
                </div>
                {countdown > 0 && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-accent)', marginTop: 'var(--space-2)' }}>
                    Redirecting to Google in {countdown}...
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Invoice Meta */}
        <div className="bill-meta">
          <span className="bill-meta-label">Bill No.</span>
          <span className="bill-meta-value">{bill.bill_number}</span>
          <span className="bill-meta-label">Date</span>
          <span className="bill-meta-value">{createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span className="bill-meta-label">Time</span>
          <span className="bill-meta-value">{createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          {customer && (
            <>
              <span className="bill-meta-label">Customer</span>
              <span className="bill-meta-value">{customer.name}</span>
              <span className="bill-meta-label">Phone</span>
              <span className="bill-meta-value">{customer.phone}</span>
            </>
          )}
        </div>

        {/* Line Items */}
        <div className="bill-items">
          <div className="bill-items-header">
            <span>Description</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Tax</span>
            <span>Total</span>
          </div>
          {lineItems.map((item: any, i: number) => {
            const lineTotal = (item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0);
            const gst = lineTotal * ((item.gstPercent || 0) / 100);
            return (
              <div key={i} className="bill-item-row">
                <span style={{ fontWeight: 500 }}>
                  {item.description}
                  {item.unit && <span style={{ color: '#999', fontWeight: 400 }}> /{item.unit}</span>}
                </span>
                <span>{item.quantity}</span>
                <span>₹{(item.unitPrice || 0).toFixed(0)}</span>
                <span style={{ fontSize: 10, color: '#999' }}>{item.gstPercent > 0 ? `${item.gstPercent}%` : '—'}</span>
                <span style={{ fontWeight: 500 }}>₹{(lineTotal + gst).toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="bill-summary">
          <div className="bill-summary-row">
            <span>Subtotal</span>
            <span>₹{Number(bill.subtotal || 0).toFixed(2)}</span>
          </div>
          {Number(bill.discount_total) > 0 && (
            <div className="bill-summary-row discount">
              <span>Discount</span>
              <span>−₹{Number(bill.discount_total).toFixed(2)}</span>
            </div>
          )}
          {showGstRow && Number(bill.gst_total) > 0 && (
            <div className="bill-summary-row">
              <span>GST</span>
              <span>₹{Number(bill.gst_total).toFixed(2)}</span>
            </div>
          )}
          {Number(bill.extra_charges) > 0 && (
            <div className="bill-summary-row">
              <span>{bill.extra_charges_note || 'Extra Charges'}</span>
              <span>+₹{Number(bill.extra_charges).toFixed(2)}</span>
            </div>
          )}
          <div className="bill-grand-total">
            <span>Grand Total</span>
            <span>₹{Number(bill.grand_total || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Offer / Discount Reveal (if enabled) */}
        {client?.reward_settings?.enabled === true && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: 'var(--space-4) 0' }}>
            {offerRevealed ? (
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-success-subtle)', color: 'var(--color-success)', border: '1px dashed var(--color-success)', borderRadius: 'var(--radius-md)', fontWeight: 600, textAlign: 'center' }}>
                Reward Code: {client?.reward_settings?.offer_code || 'SAVE20'}
              </div>
            ) : (
              <button 
                className="review-btn" 
                onClick={() => setOfferRevealed(true)}
                style={{ background: 'var(--color-accent)', color: 'white' }}
              >
                <Gift size={16} /> Get Reward
              </button>
            )}
          </div>
        )}

        {/* Loyalty Stamp Progress (Track 2) */}
        {loyaltyConfig?.track2_enabled && loyaltyConfig?.track2 && (
          <div style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'center', background: '#FAFAFA', borderTop: '1px solid #EEE' }}>
            {(() => {
              const goal = loyaltyConfig.track2.goal_value || 5;
              const current = loyaltyProgress?.current_count || 0;
              const isUnlocked = current === 0 && loyaltyProgress?.last_reward_code_id;
              
              if (isUnlocked) {
                return (
                  <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-success)', marginBottom: 8 }}>Reward Unlocked!</div>
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-subtle)', color: 'var(--color-success)', border: '1px dashed var(--color-success)', borderRadius: 'var(--radius-md)', fontWeight: 600, textAlign: 'center' }}>
                        {loyaltyProgress.last_reward_code_id || 'REWARD'}
                      </div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 'var(--space-1)' }}>Claim on next visit / Show at counter</div>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 'var(--space-2)' }}>
                    {loyaltyConfig.track2.goal_type === 'visits'
                      ? `${current}/${goal} visits to your next reward`
                      : `₹${current}/₹${goal} spent towards your next reward`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                    {Array.from({ length: goal }, (_, i) => (
                      <div key={i} style={{
                        width: 20, height: 20,
                        borderRadius: '50%',
                        background: i < current ? 'var(--color-accent)' : '#E5E5E5',
                        border: i < current ? 'none' : '1px solid #DDD',
                        transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: i < current ? 'white' : '#CCC',
                      }}>
                        {i < current ? '✓' : ''}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Social + Review Footer */}
        <div className="bill-footer">
          <div className="card" style={{ margin: '0 auto' }}>
            {client.instagram_url && (
              <a href={client.instagram_url} target="_blank" rel="noopener noreferrer" className="socialContainer containerOne" title="Instagram">
                <Instagram className="socialSvg" />
              </a>
            )}
            {client.facebook_url && (
              <a href={client.facebook_url} target="_blank" rel="noopener noreferrer" className="socialContainer containerFive" title="Facebook">
                <Facebook className="socialSvg" />
              </a>
            )}
            {client.x_url && (
              <a href={client.x_url} target="_blank" rel="noopener noreferrer" className="socialContainer containerTwo" title="X (Twitter)">
                <Twitter className="socialSvg" />
              </a>
            )}
            {client.linkedin_url && (
              <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" className="socialContainer containerThree" title="LinkedIn">
                <Linkedin className="socialSvg" />
              </a>
            )}
            {client.whatsapp_url && (
              <a href={client.whatsapp_url} target="_blank" rel="noopener noreferrer" className="socialContainer containerFour" title="WhatsApp">
                <MessageCircle className="socialSvg" />
              </a>
            )}
            {client.website_url && (
              <a href={client.website_url} target="_blank" rel="noopener noreferrer" className="socialContainer containerSix" title="Website">
                <Globe className="socialSvg" />
              </a>
            )}
          </div>

          {!reviewed && (
            <div className="bill-google-cta">
              Enjoyed our service? <a href={`/review/${client.slug}?bill_id=${bill.id}`} target="_blank" rel="noopener noreferrer">Leave a Review ★★★★★</a>
            </div>
          )}
        </div>

        {/* Print/Download — opens in new tab so WhatsApp send is not interrupted */}
        <div className="bill-actions">
          <button className="review-btn" onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('print', '1');
            window.open(url.toString(), '_blank');
          }} style={{ fontSize: 12 }}>
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>

        <div className="bill-powered">Powered by BillDoor · Orbitex</div>
      </div>
    </div>
  );
}
