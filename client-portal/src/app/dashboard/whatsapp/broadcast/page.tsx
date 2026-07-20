'use client';

/**
 * WhatsApp Broadcast — Campaign Creation Page
 *
 * 3-step flow:
 * 1. Select Template
 * 2. Build Audience (opted_in = true, deduped, segmentation nudged)
 * 3. Preview & Send
 *
 * Sending ONLY goes through the official WhatsApp Business Cloud API.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Send, FileText, Users, Check,
  Loader2, Info, Clock, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { fetchBroadcastTemplatesAction } from '../templates/actions';
import { fetchWhatsAppSettingsAction } from '../settings/actions';
import {
  fetchAudienceAction,
  sendBroadcastAction,
  fetchCampaignHistoryAction,
} from './actions';
import '../whatsapp.css';

interface Template {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
}

interface AudiencePreview {
  id: string;
  name: string;
  phone: string;
  totalVisits: number;
}

interface Campaign {
  id: string;
  templateName: string;
  recipientCount: number;
  sentAt: string | null;
  createdAt: string;
}

type Step = 1 | 2 | 3;

export default function BroadcastPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Step 1: Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Step 2: Audience filters
  const [sourceModule, setSourceModule] = useState<'all' | 'billit' | 'appointer'>('all');
  const [lastVisitDays, setLastVisitDays] = useState<number | null>(null);
  const [minVisits, setMinVisits] = useState<number | null>(null);
  const [minSpent, setMinSpent] = useState<number | null>(null);
  const [audienceCount, setAudienceCount] = useState(0);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Step 3: Confirmation
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      const [templatesRes, settingsRes, campaignsRes] = await Promise.all([
        fetchBroadcastTemplatesAction(),
        fetchWhatsAppSettingsAction(),
        fetchCampaignHistoryAction(),
      ]);

      const active = (templatesRes.templates || []).filter(
        (t: { isActive: boolean }) => t.isActive
      );
      setTemplates(active);
      setConnectionStatus(settingsRes.config?.connectionStatus || 'disconnected');
      setCampaigns(campaignsRes.campaigns || []);
      setLoading(false);
    }
    load();
  }, []);

  // Load audience when filters change
  const loadAudience = useCallback(async () => {
    setAudienceLoading(true);
    const res = await fetchAudienceAction({
      sourceModule,
      lastVisitDays,
      minVisits,
      minSpent,
    });
    setAudienceCount(res.count);
    setAudiencePreview(res.preview || []);
    setAudienceLoading(false);
  }, [sourceModule, lastVisitDays, minVisits, minSpent]);

  useEffect(() => {
    if (step === 2) loadAudience();
  }, [step, loadAudience]);

  async function handleSend() {
    setSending(true);
    setError('');

    const res = await sendBroadcastAction({
      templateId: selectedTemplateId,
      filters: { sourceModule, lastVisitDays, minVisits, minSpent },
    });

    if (res.error) {
      setError(res.error);
      setSending(false);
      setShowConfirm(false);
      return;
    }

    setSuccess(`Campaign sent to ${res.recipientCount} recipients!`);
    setSending(false);
    setShowConfirm(false);

    // Refresh campaigns
    const updated = await fetchCampaignHistoryAction();
    setCampaigns(updated.campaigns || []);

    // Reset to step 1
    setTimeout(() => {
      setStep(1);
      setSelectedTemplateId('');
      setSuccess('');
    }, 3000);
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)' }}>
        <Loader2 size={20} className="spinner" /> Loading...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/whatsapp')}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)', fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={16} /> Back to WhatsApp Auto
      </button>

      {/* Alerts */}
      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-subtle)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          <Check size={14} style={{ marginRight: 4 }} /> {success}
        </div>
      )}

      {/* Step Progress Bar */}
      <div className="wa-steps">
        <div className={`wa-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="wa-step-num">{step > 1 ? <Check size={14} /> : '1'}</div>
          <span>Template</span>
        </div>
        <div className={`wa-step-line ${step > 1 ? 'done' : ''}`} />
        <div className={`wa-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="wa-step-num">{step > 2 ? <Check size={14} /> : '2'}</div>
          <span>Audience</span>
        </div>
        <div className={`wa-step-line ${step > 2 ? 'done' : ''}`} />
        <div className={`wa-step ${step === 3 ? 'active' : ''}`}>
          <div className="wa-step-num">3</div>
          <span>Send</span>
        </div>
      </div>

      {/* STEP 1: Select Template */}
      {step === 1 && (
        <div className="settings-section">
          <h3 className="settings-section-title"><FileText size={18} /> Select Template</h3>

          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-5)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                No active broadcast templates. Create one first.
              </p>
              <button className="btn btn-primary" onClick={() => router.push('/dashboard/whatsapp/templates')}>
                Create Template
              </button>
            </div>
          ) : (
            <>
              <div className="wa-template-list">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className="wa-template-card"
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedTemplateId === t.id ? 'var(--color-accent)' : undefined,
                      boxShadow: selectedTemplateId === t.id ? '0 0 0 2px var(--color-accent-subtle)' : undefined,
                    }}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <div className="wa-template-header">
                      <div className="wa-template-name">
                        {selectedTemplateId === t.id && <Check size={14} style={{ color: 'var(--color-accent)', marginRight: 4 }} />}
                        {t.name}
                      </div>
                    </div>
                    <div className="wa-template-preview">{t.content}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep(2)}
                  disabled={!selectedTemplateId}
                >
                  Next: Build Audience <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Build Audience */}
      {step === 2 && (
        <div className="settings-section">
          <h3 className="settings-section-title"><Users size={18} /> Build Audience</h3>

          {/* Segmentation Nudge */}
          <div className="wa-nudge">
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Segmented campaigns perform better and protect your WhatsApp quality rating. Use filters to target the right customers instead of sending to everyone.
            </span>
          </div>

          {/* Filters */}
          <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {/* Source Module */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Source
              </label>
              <select
                className="input-field"
                value={sourceModule}
                onChange={(e) => setSourceModule(e.target.value as 'all' | 'billit' | 'appointer')}
              >
                <option value="all">All Customers (Billit + Appointer)</option>
                <option value="billit">Billit Customers Only</option>
                <option value="appointer">Appointer Customers Only</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Last Visit Within
              </label>
              <select
                className="input-field"
                value={lastVisitDays ?? ''}
                onChange={(e) => setLastVisitDays(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
              </select>
            </div>

            {/* Engagement */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Min. Total Visits
                </label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  value={minVisits ?? ''}
                  onChange={(e) => setMinVisits(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Any"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Min. Total Spent (₹)
                </label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  value={minSpent ?? ''}
                  onChange={(e) => setMinSpent(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Any"
                />
              </div>
            </div>
          </div>

          {/* Audience Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="wa-audience-count">
              {audienceLoading ? (
                <Loader2 size={16} className="spinner" />
              ) : (
                <Users size={16} />
              )}
              <span>{audienceCount} opted-in recipient{audienceCount !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={loadAudience}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: 'var(--text-xs)', fontFamily: 'inherit' }}
            >
              Refresh
            </button>
          </div>

          {/* Preview Table */}
          {audiencePreview.length > 0 && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
                Preview (first {audiencePreview.length} of {audienceCount}):
              </div>
              <table className="wa-audience-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {audiencePreview.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{c.phone}</td>
                      <td>{c.totalVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setStep(1)} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(3)}
              disabled={audienceCount === 0}
            >
              Next: Preview &amp; Send <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview & Send */}
      {step === 3 && (
        <div className="settings-section">
          <h3 className="settings-section-title"><Send size={18} /> Preview &amp; Send</h3>

          {/* Connection Check */}
          {connectionStatus !== 'connected' && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <AlertTriangle size={16} />
              WhatsApp is not connected. Go to Settings to connect your API first.
            </div>
          )}

          {/* Summary */}
          <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Template</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>{selectedTemplate?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Recipients</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>{audienceCount} opted-in customers</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Delivery Method</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-success)' }}>Official Cloud API</span>
            </div>
          </div>

          {/* Template Preview */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Message preview:</div>
            <div className="wa-template-preview">
              {(selectedTemplate?.content || '')
                .replace(/\{customer_name\}/g, 'Priya')
                .replace(/\{shop_name\}/g, 'Your Business')}
            </div>
          </div>

          {/* Send / Confirm */}
          {!showConfirm ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep(2)} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowConfirm(true)}
                disabled={connectionStatus !== 'connected' || audienceCount === 0}
              >
                <Send size={14} /> Send Campaign
              </button>
            </div>
          ) : (
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-warning-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-warning)' }}>
                Send &ldquo;{selectedTemplate?.name}&rdquo; to {audienceCount} recipients?
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                This action cannot be undone. Messages will be sent via the official Cloud API.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                <button className="btn" onClick={() => setShowConfirm(false)} style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                  {sending ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
                  Confirm &amp; Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaign History */}
      {campaigns.length > 0 && (
        <div className="settings-section" style={{ marginTop: 'var(--space-5)' }}>
          <h3 className="settings-section-title"><Clock size={18} /> Recent Campaigns</h3>
          {campaigns.map(c => (
            <div key={c.id} className="wa-campaign-row">
              <span className={`wa-campaign-status ${c.sentAt ? 'sent' : 'pending'}`}>
                {c.sentAt ? 'Sent' : 'Pending'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{c.templateName}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {c.recipientCount} recipients · {new Date(c.sentAt || c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
