'use client';

/**
 * BillDoor — Review Flow Client Component (§5.3)
 *
 * Star rating (1-5) with two branches:
 * - 1-3★ → private feedback form → saved privately, never redirected to Google
 * - 4-5★ → Gemini AI review draft → copy + regenerate → 3s countdown → Google redirect
 *
 * Stars are visual stars (★), not emoji (emoji only on bill page per spec).
 * Regenerate pauses countdown. Capped at 3-5 regenerations/session.
 * Reward card shown after submission if rewards are enabled.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Star, Copy, RefreshCw, Check, Loader2, ExternalLink, Heart,
} from 'lucide-react';
import {
  submitReviewAction,
  generateAiReviewAction,
  issueRewardAction,
  logGoogleReviewClickAction,
} from './actions';
import './review.css';

interface ReviewPageProps {
  clientId: string;
  businessName: string;
  businessType: string;
  about: string;
  logoUrl: string;
  googlePlaceId: string;
  rewardSettings: Record<string, any> | null;
}

type Stage = 'rating' | 'feedback' | 'ai_draft' | 'thank_you';

export default function ReviewPage({
  clientId, businessName, businessType, about, logoUrl, googlePlaceId, rewardSettings,
}: ReviewPageProps) {
  const [stage, setStage] = useState<Stage>('rating');
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // AI draft state
  const [aiDraft, setAiDraft] = useState('');
  const [previousDrafts, setPreviousDrafts] = useState<string[]>([]);
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);

  // Countdown state
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Reward state
  const [reward, setReward] = useState<{ code: string; type: string; value: number; businessName: string } | null>(null);

  const initials = businessName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // Google review URL
  const googleReviewUrl = googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : `https://www.google.com/search?q=${encodeURIComponent(businessName + ' reviews')}`;

  // Countdown logic
  const startCountdown = useCallback(() => {
    if (!googleReviewUrl) return;
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          // Redirect to Google in the same tab to avoid popup blockers
          logGoogleReviewClickAction({ sessionId: sessionId || '', event: 'redirected' });
          window.location.href = googleReviewUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [googleReviewUrl, sessionId]);

  const pauseCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // Handle star selection
  async function handleStarSelect(rating: number) {
    setStars(rating);

    if (rating <= 3) {
      // Private feedback path
      setStage('feedback');
    } else {
      // AI draft path (4-5★)
      setAiLoading(true);
      setStage('ai_draft');

      // Submit the rating first to get a session
      const submitResult = await submitReviewAction({ clientId, stars: rating, sessionId: sessionId || undefined });
      if (submitResult.sessionId) setSessionId(submitResult.sessionId);

      // Generate AI draft
      const aiResult = await generateAiReviewAction({
        clientId,
        businessName,
        businessType,
        about,
        stars: rating,
        previousDrafts: [],
        sessionId: submitResult.sessionId || '',
      });

      if (aiResult.draft) {
        setAiDraft(aiResult.draft);
        setPreviousDrafts([aiResult.draft]);
        try {
          await navigator.clipboard.writeText(aiResult.draft);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch (e) {
          // Ignore clipboard errors
        }
        startCountdown();
      }
      setAiLoading(false);

    }
  }

  // Submit private feedback (1-3★)
  async function handleSubmitFeedback() {
    setLoading(true);
    const result = await submitReviewAction({ clientId, stars, feedbackText, sessionId: sessionId || undefined });
    if (result.sessionId) setSessionId(result.sessionId);


    setStage('thank_you');
    setLoading(false);
  }

  // Regenerate AI draft
  async function handleRegenerate() {
    pauseCountdown();
    setAiLoading(true);
    setRegenerateCount(prev => prev + 1);

    const result = await generateAiReviewAction({
      clientId,
      businessName,
      businessType,
      about,
      stars,
      previousDrafts,
      sessionId: sessionId || '',
    });

    if (result.draft) {
      setAiDraft(result.draft);
      setPreviousDrafts(prev => [...prev, result.draft!]);
      try {
        await navigator.clipboard.writeText(result.draft);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (e) {
        // Ignore clipboard errors
      }
      startCountdown(); // Restart countdown after new draft
    }
    setAiLoading(false);
  }

  // Copy draft + instant redirect
  async function handleCopyDraft() {
    await navigator.clipboard.writeText(aiDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Redirect immediately after copy (same tab to avoid popup blocker)
    pauseCountdown();
    if (googleReviewUrl) {
      logGoogleReviewClickAction({ sessionId: sessionId || '', event: 'copied' });
      setTimeout(() => {
        window.location.href = googleReviewUrl;
      }, 500);
    }
  }

  return (
    <div className="review-page">
      <div className="review-container">
        {/* Header */}
        <div className="review-header">
          <div className="review-logo">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
            ) : initials}
          </div>
          <div className="review-biz-name">{businessName}</div>
          {about && <div className="review-biz-about">{about}</div>}
        </div>

        <div className="review-body">
          {/* Rating Stage */}
          {stage === 'rating' && (
            <>
              <div className="review-prompt">How was your experience?</div>
              <div className="rating" style={{ display: 'flex', justifyContent: 'center', flexDirection: 'row-reverse', width: '100%', marginBottom: 'var(--space-5)' }}>
                <input type="radio" id="star5" name="rating" value="5" onChange={() => handleStarSelect(5)} />
                <label htmlFor="star5" title="5 stars"></label>
                
                <input type="radio" id="star4" name="rating" value="4" onChange={() => handleStarSelect(4)} />
                <label htmlFor="star4" title="4 stars"></label>
                
                <input type="radio" id="star3" name="rating" value="3" onChange={() => handleStarSelect(3)} />
                <label htmlFor="star3" title="3 stars"></label>
                
                <input type="radio" id="star2" name="rating" value="2" onChange={() => handleStarSelect(2)} />
                <label htmlFor="star2" title="2 stars"></label>
                
                <input type="radio" id="star1" name="rating" value="1" onChange={() => handleStarSelect(1)} />
                <label htmlFor="star1" title="1 star"></label>
              </div>
            </>
          )}

          {/* Private Feedback (1-3★) */}
          {stage === 'feedback' && (
            <div className="feedback-section">
              <div className="review-prompt">
                We&apos;re sorry to hear that.
                <br />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  Your feedback helps us improve. What could we do better?
                </span>
              </div>

              <div className="rating" style={{ display: 'flex', justifyContent: 'center', flexDirection: 'row-reverse', width: '100%', marginBottom: 'var(--space-3)' }}>
                <input type="radio" id="fb_star5" name="fb_rating" value="5" onChange={() => handleStarSelect(5)} checked={stars === 5} />
                <label htmlFor="fb_star5" title="5 stars"></label>
                
                <input type="radio" id="fb_star4" name="fb_rating" value="4" onChange={() => handleStarSelect(4)} checked={stars === 4} />
                <label htmlFor="fb_star4" title="4 stars"></label>
                
                <input type="radio" id="fb_star3" name="fb_rating" value="3" onChange={() => handleStarSelect(3)} checked={stars === 3} />
                <label htmlFor="fb_star3" title="3 stars"></label>
                
                <input type="radio" id="fb_star2" name="fb_rating" value="2" onChange={() => handleStarSelect(2)} checked={stars === 2} />
                <label htmlFor="fb_star2" title="2 stars"></label>
                
                <input type="radio" id="fb_star1" name="fb_rating" value="1" onChange={() => handleStarSelect(1)} checked={stars === 1} />
                <label htmlFor="fb_star1" title="1 star"></label>
              </div>

              <textarea
                className="feedback-textarea"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Tell us what happened..."
                maxLength={1000}
                autoFocus
              />
              <div className="feedback-note">
                This feedback is private and only visible to {businessName}.
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button className="review-btn" onClick={() => { setStage('rating'); setStars(0); }}>Back</button>
                <button className="review-btn primary" onClick={handleSubmitFeedback} disabled={loading}>
                  {loading ? <Loader2 size={16} className="spinner" /> : null}
                  Submit Feedback
                </button>
              </div>
            </div>
          )}

          {/* AI Draft (4-5★) */}
          {stage === 'ai_draft' && (
            <div className="ai-draft-section">
              <div className="star-rating" style={{ marginBottom: 'var(--space-3)' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className={`star-btn ${s <= stars ? 'selected' : ''}`} style={{ cursor: 'default', fontSize: 24 }}>★</span>
                ))}
              </div>

              {aiLoading ? (
                <div className="review-loading">
                  <Loader2 size={20} className="spinner" />
                  <span>Generating your review...</span>
                </div>
              ) : aiDraft ? (
                <>
                  <div className="ai-draft-card">
                    <div className="ai-draft-label">
                      <Star size={12} /> Suggested review for Google
                    </div>
                    <div className="ai-draft-text">{aiDraft}</div>
                    
                    <div className="ai-draft-copy-notice" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success, #10b981)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 'var(--space-3)' }}>
                      <Check size={14} /> Already copied to clipboard for pasting!
                    </div>

                    <div className="ai-draft-actions">
                      <button className={`btn-copy-anim ${copied ? 'copied' : ''}`} onClick={handleCopyDraft}>
                        <span className="copy-text-default">
                          <ExternalLink size={14} /> Go to Google
                        </span>
                        <span className="copy-text-success">
                          <Check size={14} /> Opening...
                        </span>
                      </button>
                      <button
                        className="review-btn"
                        onClick={handleRegenerate}
                        disabled={aiLoading || regenerateCount >= 4}
                        title={regenerateCount >= 4 ? 'Max regenerations reached' : 'Generate a different review'}
                      >
                        <RefreshCw size={14} /> Regenerate
                      </button>
                    </div>
                  </div>

                  {/* Countdown */}
                  {countdown > 0 && googleReviewUrl && (
                    <div className="countdown-bar">
                      <ExternalLink size={14} />
                      Redirecting to Google in <span className="countdown-number">{countdown}</span>
                    </div>
                  )}
                </>
              ) : null}

            </div>
          )}

          {/* Thank You (after feedback) */}
          {stage === 'thank_you' && (
            <div className="thank-you">
              <div className="thank-you-icon">
                <Heart size={28} />
              </div>
              <div className="thank-you-title">Thank You!</div>
              <div className="thank-you-sub">
                Your feedback has been shared with {businessName}. We appreciate you taking the time.
              </div>

            </div>
          )}
        </div>

        <div className="review-footer">
          Powered by BillDoor · Orbitex
        </div>
      </div>
    </div>
  );
}
