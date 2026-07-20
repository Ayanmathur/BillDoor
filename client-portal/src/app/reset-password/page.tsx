'use client';

/**
 * BillDoor — Password Reset Page (§2)
 * 
 * Step 1: Enter license key
 * Step 2: System determines path (email or admin-assisted)
 * Step 3: Show appropriate success message
 */

import { useState } from 'react';
import { DoorOpen, KeyRound, Mail, MessageCircle, Loader2 } from 'lucide-react';
import { requestPasswordResetAction } from './actions';

export default function ResetPasswordPage() {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ path: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!licenseKey.trim()) { setError('License key is required.'); return; }

    setIsLoading(true);
    try {
      const res = await requestPasswordResetAction({ licenseKey: licenseKey.trim() });
      if (res.error) { setError(res.error); }
      else if (res.path && res.message) { setResult({ path: res.path, message: res.message }); }
    } catch { setError('Something went wrong.'); }
    finally { setIsLoading(false); }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', padding: 'var(--space-4)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <DoorOpen size={40} strokeWidth={1.5} color="var(--color-accent)" style={{ margin: '0 auto var(--space-3)', display: 'block' }} />
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>Reset Password</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>Enter your license key to get started</p>
        </div>

        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-sm)' }}>
          {result ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: result.path === 'email' ? 'var(--color-accent-subtle)' : 'var(--color-warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
                {result.path === 'email' ? <Mail size={24} color="var(--color-accent)" /> : <MessageCircle size={24} color="var(--color-warning)" />}
              </div>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                {result.path === 'email' ? 'Check Your Email' : 'Admin Verification Required'}
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {result.message}
              </p>
              <a href="/login" className="btn btn-secondary" style={{ marginTop: 'var(--space-6)', display: 'inline-block' }}>
                Back to Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {error && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', textAlign: 'center' }} role="alert">
                  {error}
                </div>
              )}
              <div className="input-group">
                <label htmlFor="reset-key" className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <KeyRound size={14} /> License Key
                </label>
                <input id="reset-key" type="text" className="input-field" value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)} placeholder="Enter your license key" autoFocus />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                This is the same key you used to create your account. If you have an email on file, we&apos;ll send a reset link. Otherwise, our team will verify your identity via WhatsApp.
              </p>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 44, fontWeight: 'var(--weight-semibold)' }} disabled={isLoading}>
                {isLoading ? <Loader2 size={18} className="spinner" /> : 'Request Reset'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
          <a href="/login" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Back to <strong style={{ color: 'var(--color-accent)' }}>Sign In</strong>
          </a>
        </div>
      </div>
    </div>
  );
}
