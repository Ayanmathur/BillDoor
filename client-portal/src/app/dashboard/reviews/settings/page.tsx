'use client';

/**
 * BillDoor — Review Flow Settings Page
 *
 * Dedicated settings page for Review Flow module.
 * Controls: Connect with Client toggle, WhatsApp Resolution Card toggle,
 * and Custom Resolution Message Template for 1–3 star feedback.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Check, MessageSquare } from 'lucide-react';
import {
  fetchReviewFlowSettingsAction,
  updateReviewFlowSettingsAction,
} from '../actions';

export default function ReviewFlowSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [connectWithClient, setConnectWithClient] = useState(true);
  const [whatsappContact, setWhatsappContact] = useState(true);
  const [directGoogleReview, setDirectGoogleReview] = useState(false);
  const [customResolutionText, setCustomResolutionText] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetchReviewFlowSettingsAction();
      if (res.settings) {
        setConnectWithClient(res.settings.connectWithClient);
        setWhatsappContact(res.settings.whatsappContact);
        setDirectGoogleReview(res.settings.directGoogleReview || false);
        setCustomResolutionText(res.settings.customResolutionText);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    const res = await updateReviewFlowSettingsAction({
      connectWithClient,
      whatsappContact,
      directGoogleReview,
      customResolutionText,
    });
    setSaving(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <button
          className="btn"
          onClick={() => router.push('/dashboard/reviews')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--color-border)' }}
        >
          <ArrowLeft size={16} /> Back to Reviews
        </button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={22} color="var(--color-accent)" /> Review Flow Settings
          </h2>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}
      {saved && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-subtle)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={16} /> Review Flow settings saved successfully!
        </div>
      )}

      {/* Main Settings Card */}
      <div className="dash-card" style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          {/* Toggle 1: Connect with Client */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <div>
                <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                  Connect with Client
                </span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  Enables the <code style={{ fontSize: 11, background: 'var(--color-bg-primary)', padding: '2px 6px', borderRadius: 4 }}>&quot;Looking for public assistance options?&quot;</code> link for 1–3 star feedback.
                </div>
              </div>
              <input
                type="checkbox"
                checked={connectWithClient}
                onChange={(e) => setConnectWithClient(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--color-accent)', marginLeft: 16 }}
              />
            </div>
          </div>

          {/* Toggle 2: WhatsApp Resolution Card */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <div>
                <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                  Contact Business via WhatsApp Card
                </span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  Displays the green <code style={{ fontSize: 11, background: 'var(--color-bg-primary)', padding: '2px 6px', borderRadius: 4 }}>&quot;Contact Business via WhatsApp&quot;</code> card inside your resolution box, linked directly to your saved phone / WhatsApp number.
                </div>
              </div>
              <input
                type="checkbox"
                checked={whatsappContact}
                onChange={(e) => setWhatsappContact(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--color-accent)', marginLeft: 16 }}
              />
            </div>
          </div>

          {/* Toggle 3: Direct Google Review Redirect (Fast Track) */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <div>
                <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                  Direct Google Review Redirect (Fast Track 4–5 Stars)
                </span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                  Skip AI review draft generation and immediately redirect 4–5 star ratings directly to your Google Place review page. Maximize review collection speed.
                </div>
              </div>
              <input
                type="checkbox"
                checked={directGoogleReview}
                onChange={(e) => setDirectGoogleReview(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--color-accent)', marginLeft: 16 }}
              />
            </div>
          </div>

          {/* Custom Resolution Message Template Area */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <label style={{ display: 'block', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Custom Resolution Message Template (1–3 Stars)
            </label>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
              Message template displayed to customers inside the resolution box. If left blank, default text will be used.
            </div>
            <textarea
              value={customResolutionText}
              onChange={(e) => setCustomResolutionText(e.target.value)}
              placeholder="Our management personally reviews all private notes within 2 hours to resolve issues directly."
              rows={3}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
              Save Review Flow Settings
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
