'use client';

/**
 * WhatsApp Settings Page
 *
 * API credentials (encrypted), connection status, quality rating,
 * automation toggle, monthly message count.
 *
 * Credentials are NEVER shown in plaintext — only a masked tail.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Loader2, Wifi, WifiOff, AlertTriangle,
  ShieldCheck, ToggleLeft, ToggleRight, RefreshCw, KeyRound,
  Activity, MessageSquare,
} from 'lucide-react';
import {
  fetchWhatsAppSettingsAction,
  saveWhatsAppCredentialsAction,
  testWhatsAppConnectionAction,
  toggleAutomationAction,
} from './actions';
import '../whatsapp.css';

interface SettingsData {
  hasCredentials: boolean;
  credentialMask: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  qualityRating: string;
  automationEnabled: boolean;
  monthlyMessageCount: number;
}

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Credential form
  const [showCredForm, setShowCredForm] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetchWhatsAppSettingsAction();
      if (res.config) setSettings(res.config);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveCredentials() {
    if (!phoneNumberId || !accessToken) {
      setError('Both Phone Number ID and Access Token are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    const res = await saveWhatsAppCredentialsAction({ phoneNumberId, accessToken });
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Credentials saved and encrypted. Test connection to verify.');
      setShowCredForm(false);
      setPhoneNumberId('');
      setAccessToken('');
      // Refresh settings
      const updated = await fetchWhatsAppSettingsAction();
      if (updated.config) setSettings(updated.config);
    }
    setSaving(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setError('');
    setSuccess('');

    const res = await testWhatsAppConnectionAction();
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Connection successful! Quality rating: ${res.qualityRating}`);
      // Refresh settings
      const updated = await fetchWhatsAppSettingsAction();
      if (updated.config) setSettings(updated.config);
    }
    setTesting(false);
  }

  async function handleToggleAutomation() {
    if (!settings) return;
    const newVal = !settings.automationEnabled;
    setSettings({ ...settings, automationEnabled: newVal });
    await toggleAutomationAction({ enabled: newVal });
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)' }}>
        <Loader2 size={20} className="spinner" /> Loading settings...
      </div>
    );
  }

  const statusIcon = settings?.connectionStatus === 'connected'
    ? <Wifi size={16} style={{ color: 'var(--color-success)' }} />
    : settings?.connectionStatus === 'error'
      ? <AlertTriangle size={16} style={{ color: 'var(--color-error)' }} />
      : <WifiOff size={16} style={{ color: 'var(--color-text-tertiary)' }} />;

  return (
    <div style={{ maxWidth: 640 }}>
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
          {success}
        </div>
      )}

      <div className="wa-settings-grid">
        {/* 1. Connection Status */}
        <div className="settings-section">
          <h3 className="settings-section-title">
            {statusIcon} Connection Status
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className={`wa-status-dot ${settings?.connectionStatus || 'disconnected'}`} />
            <span style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', textTransform: 'capitalize' }}>
              {settings?.connectionStatus || 'Disconnected'}
            </span>
            <button
              className="btn btn-primary"
              onClick={handleTestConnection}
              disabled={testing || !settings?.hasCredentials}
              style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}
            >
              {testing ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
              Test Connection
            </button>
          </div>
        </div>

        {/* 2. API Credentials */}
        <div className="settings-section">
          <h3 className="settings-section-title">
            <KeyRound size={18} /> API Credentials
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
            Your WhatsApp Business Cloud API credentials. Encrypted at rest, never returned in plaintext.
          </p>

          {settings?.hasCredentials && !showCredForm ? (
            <div>
              <div className="wa-credential-masked">
                <span><ShieldCheck size={14} style={{ marginRight: 6 }} /> {settings.credentialMask || 'Encrypted credentials saved'}</span>
                <button
                  onClick={() => setShowCredForm(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: 'var(--text-xs)', fontFamily: 'inherit' }}
                >
                  Update
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Phone Number ID
                </label>
                <input
                  className="wa-credential-input"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Access Token
                </label>
                <input
                  className="wa-credential-input"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxx..."
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary" onClick={handleSaveCredentials} disabled={saving}>
                  {saving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                  Save &amp; Encrypt
                </button>
                {showCredForm && (
                  <button
                    className="btn"
                    onClick={() => { setShowCredForm(false); setPhoneNumberId(''); setAccessToken(''); }}
                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Quality Rating */}
        <div className="settings-section">
          <h3 className="settings-section-title">
            <Activity size={18} /> Quality Rating
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            Meta&apos;s quality assessment of your WhatsApp Business account. Green is healthy, Yellow is a warning.
          </p>
          <span className={`wa-quality-badge ${(settings?.qualityRating || 'unknown').toLowerCase()}`}>
            {settings?.qualityRating || 'Unknown'}
          </span>
        </div>

        {/* 4. Automation Toggle */}
        <div className="settings-section">
          <h3 className="settings-section-title">
            {settings?.automationEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            Automation
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
            When ON, Billit and Appointer can automatically send WhatsApp messages via the Cloud API instead of manual wa.me links.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings?.automationEnabled || false}
                onChange={handleToggleAutomation}
              />
              <span className="toggle-slider" />
            </label>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              {settings?.automationEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* 5. Monthly Message Count */}
        <div className="settings-section">
          <h3 className="settings-section-title">
            <MessageSquare size={18} /> Monthly Usage
          </h3>
          <div className="wa-stat-card" style={{ border: 'none', padding: 0 }}>
            <div>
              <div className="wa-stat-value">{settings?.monthlyMessageCount || 0}</div>
              <div className="wa-stat-label">Messages sent this month</div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
            Resets on the 1st of each month. Useful for monitoring cost exposure.
          </p>
        </div>
      </div>
    </div>
  );
}
