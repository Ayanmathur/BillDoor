'use client';

/**
 * Appointer — Settings Page
 *
 * - Public booking link + QR code
 * - Appointer config (no-show grace, default duration, slot increment,
 *   advance booking window, default business hours, public booking toggle)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Link2, Copy, Check, QrCode, Save, Loader2,
  Clock, Calendar, Timer, Download, Shield, ExternalLink
} from 'lucide-react';
import {
  fetchAppointerSettingsAction,
  updateAppointerConfigAction,
} from './actions';

export default function AppointerSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Settings
  const [slug, setSlug] = useState('');
  const [noShowGraceMin, setNoShowGraceMin] = useState(10);
  const [defaultDurationMin, setDefaultDurationMin] = useState(30);
  const [slotIncrementMin, setSlotIncrementMin] = useState(30);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [defaultOpen, setDefaultOpen] = useState('09:00');
  const [defaultClose, setDefaultClose] = useState('21:00');
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await fetchAppointerSettingsAction();
      if (result.settings) {
        setSlug(result.settings.slug || '');
        const c = result.settings.config;
        setNoShowGraceMin(c.no_show_grace_min);
        setDefaultDurationMin(c.default_duration_min);
        setSlotIncrementMin(c.slot_increment_min);
        setAdvanceBookingDays(c.advance_booking_days);
        setDefaultOpen(c.default_open);
        setDefaultClose(c.default_close);
        setPublicBookingEnabled(c.public_booking_enabled);
      }
      setLoading(false);
    }
    load();
  }, []);

  const bookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/book/${slug}`
    : `/book/${slug}`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}`;

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: do nothing */ }
  }

  async function handleDownloadQR() {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `booking-qr-${slug}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = await updateAppointerConfigAction({
      noShowGraceMin,
      defaultDurationMin,
      slotIncrementMin,
      advanceBookingDays,
      defaultOpen,
      defaultClose,
      publicBookingEnabled,
    });
    if (result.error) setError(result.error);
    else flash();
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Back */}
      <button
        className="btn"
        onClick={() => router.push('/dashboard/appointer')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)',
        }}
      >
        <ArrowLeft size={16} /> Back to Appointer
      </button>

      {/* Status messages */}
      {error && (
        <div style={{
          padding: 'var(--space-3)', background: 'var(--color-error-subtle)',
          color: 'var(--color-error)', borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        }} role="alert">{error}</div>
      )}
      {saved && (
        <div style={{
          padding: 'var(--space-3)', background: 'var(--color-success-subtle)',
          color: 'var(--color-success)', borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}><Check size={16} /> Saved successfully</div>
      )}

      {/* Section 1: Public Booking Link */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          <Link2 size={18} /> Online Booking Link
        </h3>

        <div className="toggle-field" style={{ marginBottom: 'var(--space-3)' }}>
          <div>
            <div className="toggle-field-label">Enable Public Booking</div>
            <div className="toggle-field-desc">
              Allow customers to book appointments via the public booking page
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={publicBookingEnabled}
              onChange={(e) => setPublicBookingEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {publicBookingEnabled && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)',
            }}>
              <input
                type="text"
                readOnly
                value={bookingUrl}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
              <button className="btn" onClick={handleCopyLink} title="Copy link" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', backgroundColor: '#0d9488', color: 'white', border: 'none' }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn" title="Open link" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', textDecoration: 'none', backgroundColor: '#0d9488', color: 'white', border: 'none' }}>
                <ExternalLink size={16} />
                Open
              </a>
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 'var(--space-3)', padding: 'var(--space-4)',
              background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
            }}>
              <img
                src={qrUrl}
                alt="Booking QR Code"
                width={180}
                height={180}
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
              <button className="btn" onClick={handleDownloadQR} style={{ fontSize: 'var(--text-xs)' }}>
                <Download size={14} /> Download QR
              </button>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', margin: 0 }}>
                Share this link or QR so customers can book appointments online.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Section 2: Appointment Defaults */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          <Clock size={18} /> Appointment Defaults
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
              Default Duration (min)
            </label>
            <select
              value={defaultDurationMin}
              onChange={(e) => setDefaultDurationMin(Number(e.target.value))}
              style={{
                width: '100%', padding: 'var(--space-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              }}
            >
              {[15, 20, 30, 45, 60, 90, 120].map((v) => (
                <option key={v} value={v}>{v} min</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
              <Timer size={14} style={{ verticalAlign: -2, marginRight: 2 }} />
              No-Show Grace (min)
            </label>
            <select
              value={noShowGraceMin}
              onChange={(e) => setNoShowGraceMin(Number(e.target.value))}
              style={{
                width: '100%', padding: 'var(--space-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              }}
            >
              {[5, 10, 15, 20, 30].map((v) => (
                <option key={v} value={v}>{v} min</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
              <Calendar size={14} style={{ verticalAlign: -2, marginRight: 2 }} />
              Booking Slot Grid
            </label>
            <select
              value={slotIncrementMin}
              onChange={(e) => setSlotIncrementMin(Number(e.target.value))}
              style={{
                width: '100%', padding: 'var(--space-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              }}
            >
              {[15, 30, 60].map((v) => (
                <option key={v} value={v}>Every {v} min</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
              Advance Booking Window
            </label>
            <select
              value={advanceBookingDays}
              onChange={(e) => setAdvanceBookingDays(Number(e.target.value))}
              style={{
                width: '100%', padding: 'var(--space-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              }}
            >
              {[7, 14, 30, 60, 90].map((v) => (
                <option key={v} value={v}>{v} days ahead</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-3)' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
            Default Business Hours (when no resource hours set)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="time"
              value={defaultOpen}
              onChange={(e) => setDefaultOpen(e.target.value)}
              style={{
                padding: 'var(--space-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              }}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>to</span>
            <input
              type="time"
              value={defaultClose}
              onChange={(e) => setDefaultClose(e.target.value)}
              style={{
                padding: 'var(--space-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: 'var(--space-4)' }}
      >
        {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Settings
      </button>
    </div>
  );
}
