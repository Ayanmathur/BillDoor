'use client';

/**
 * BillDoor — Account Activation Page (§2)
 *
 * Flow: Client enters license key → form validates →
 *   if key has pre-filled fields (paid setup), show them read-only with green badge →
 *   client fills remaining fields → creates account.
 *
 * One-shot: license key can only be activated once.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DoorOpen, Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { validateActivation } from '@/shared/validation';
import { verifyKeyAction, activateAction } from './actions';
import './activate.css';

interface PreFillData {
  businessName: string;
  slug: string;
  googlePlaceId: string;
  about: string;
}

export default function ActivatePage() {
  const router = useRouter();

  // Step 1: license key entry
  const [licenseKey, setLicenseKey] = useState('');
  const [keyVerified, setKeyVerified] = useState(false);
  const [preFill, setPreFill] = useState<PreFillData | null>(null);
  const [keyPhone, setKeyPhone] = useState('');

  // Step 2: account details
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  // Step 1: Verify the license key
  async function handleVerifyKey() {
    if (!licenseKey.trim()) {
      setErrors({ licenseKey: 'License key is required' });
      return;
    }
    setErrors({});
    setServerError('');
    setIsVerifying(true);

    try {
      const result = await verifyKeyAction({ licenseKey: licenseKey.trim() });
      if (result.error) {
        setServerError(result.error);
      } else {
        setKeyVerified(true);
        setKeyPhone(result.phone || '');
        setPhone(result.phone || '');
        if (result.preFill) {
          setPreFill(result.preFill);
          setBusinessName(result.preFill.businessName || '');
          setSlug(result.preFill.slug || '');
        }
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  // Step 2: Create the account
  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    // Client-side validation (UX only)
    const validation = validateActivation({
      licenseKey,
      username,
      password,
      confirmPassword,
      businessName,
      slug,
      phone,
      email: email || undefined,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      const result = await activateAction({
        licenseKey,
        username,
        password,
        confirmPassword,
        businessName,
        businessType: '',
        slug,
        phone,
        email: email || '',
      });

      if (result.error) {
        setServerError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Auto-generate slug from business name
  function handleBusinessNameChange(value: string) {
    setBusinessName(value);
    if (!preFill?.slug) {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      setSlug(autoSlug);
    }
  }

  if (success) {
    return (
      <div className="activate-page">
        <div className="activate-container">
          <div className="activate-card">
            <div className="activate-success">
              <CheckCircle size={32} style={{ margin: '0 auto var(--space-3)' }} />
              <p style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-1)' }}>
                Account created successfully!
              </p>
              <p>Redirecting to login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="activate-page">
      <div className="activate-container">
        <div className="activate-header">
          <DoorOpen size={40} strokeWidth={1.5} color="var(--color-accent)" style={{ margin: '0 auto var(--space-3)', display: 'block' }} />
          <h1 className="activate-brand">Create Your BillDoor Account</h1>
          <p className="activate-subtitle">Activate your license key to get started</p>
        </div>

        <div className="activate-card">
          <form className="activate-form" onSubmit={handleActivate}>
            {serverError && (
              <div className="activate-error" role="alert">{serverError}</div>
            )}

            {/* Step 1: License Key */}
            <div>
              <span className="activate-step-label">Step 1 — License Key</span>
              <div className="input-group">
                <label htmlFor="activate-key" className="input-label">License Key</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input
                    id="activate-key"
                    type="text"
                    className={`input-field ${errors.licenseKey ? 'error' : ''}`}
                    value={licenseKey}
                    onChange={(e) => { setLicenseKey(e.target.value); setKeyVerified(false); }}
                    placeholder="Enter your license key"
                    disabled={keyVerified}
                    style={{ flex: 1 }}
                  />
                  {!keyVerified && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleVerifyKey}
                      disabled={isVerifying}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {isVerifying ? <Loader2 size={16} className="spinner" /> : 'Verify'}
                    </button>
                  )}
                  {keyVerified && (
                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-success)' }}>
                      <CheckCircle size={20} />
                    </span>
                  )}
                </div>
                {errors.licenseKey && <span className="input-error-text">{errors.licenseKey}</span>}
              </div>
            </div>

            {/* Step 2: Account details — only shown after key is verified */}
            {keyVerified && (
              <>
                <div className="activate-divider" />
                <span className="activate-step-label">Step 2 — Your Account</span>

                {/* Username */}
                <div className="input-group">
                  <label htmlFor="activate-username" className="input-label">Username</label>
                  <input
                    id="activate-username"
                    type="text"
                    className={`input-field ${errors.username ? 'error' : ''}`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="Choose a username"
                    autoComplete="username"
                  />
                  {errors.username && <span className="input-error-text">{errors.username}</span>}
                </div>

                {/* Password row */}
                <div className="field-row">
                  <div className="input-group">
                    <label htmlFor="activate-password" className="input-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="activate-password"
                        type={showPassword ? 'text' : 'password'}
                        className={`input-field ${errors.password ? 'error' : ''}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 chars"
                        autoComplete="new-password"
                        style={{ paddingRight: 'var(--space-10)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: 'var(--space-2)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex' }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <span className="input-error-text">{errors.password}</span>}
                  </div>
                  <div className="input-group">
                    <label htmlFor="activate-confirm" className="input-label">Confirm</label>
                    <input
                      id="activate-confirm"
                      type={showPassword ? 'text' : 'password'}
                      className={`input-field ${errors.confirmPassword ? 'error' : ''}`}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter"
                      autoComplete="new-password"
                    />
                    {errors.confirmPassword && <span className="input-error-text">{errors.confirmPassword}</span>}
                  </div>
                </div>

                <div className="activate-divider" />
                <span className="activate-step-label">Step 3 — Business Info</span>

                {/* Business name */}
                <div className="input-group">
                  <label htmlFor="activate-biz" className="input-label">
                    Business Name
                    {preFill?.businessName && <span className="prefilled-badge">Pre-filled</span>}
                  </label>
                  <input
                    id="activate-biz"
                    type="text"
                    className={`input-field ${errors.businessName ? 'error' : ''}`}
                    value={businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    placeholder="Your business name"
                    readOnly={!!preFill?.businessName}
                  />
                  {errors.businessName && <span className="input-error-text">{errors.businessName}</span>}
                </div>

                {/* Slug */}
                <div className="input-group">
                  <label htmlFor="activate-slug" className="input-label">
                    URL Slug
                    {preFill?.slug && <span className="prefilled-badge">Pre-filled</span>}
                  </label>
                  <input
                    id="activate-slug"
                    type="text"
                    className={`input-field ${errors.slug ? 'error' : ''}`}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-business"
                    readOnly={!!preFill?.slug}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    billdoor.com/review/{slug || 'your-business'}
                  </span>
                  {errors.slug && <span className="input-error-text">{errors.slug}</span>}
                </div>

                {/* Phone + Email */}
                <div className="field-row">
                  <div className="input-group">
                    <label htmlFor="activate-phone" className="input-label">
                      Phone
                      {keyPhone && <span className="prefilled-badge">From key</span>}
                    </label>
                    <input
                      id="activate-phone"
                      type="tel"
                      className={`input-field ${errors.phone ? 'error' : ''}`}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91"
                      readOnly={!!keyPhone}
                      style={{ fontSize: '16px' }}
                    />
                    {errors.phone && <span className="input-error-text">{errors.phone}</span>}
                  </div>
                  <div className="input-group">
                    <label htmlFor="activate-email" className="input-label">
                      Email <span style={{ color: 'var(--color-text-tertiary)' }}>(recommended)</span>
                    </label>
                    <input
                      id="activate-email"
                      type="email"
                      className={`input-field ${errors.email ? 'error' : ''}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com"
                      style={{ fontSize: '16px' }}
                    />
                    {errors.email && <span className="input-error-text">{errors.email}</span>}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="btn btn-primary activate-submit"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 size={18} className="spinner" /> : 'Create Account'}
                </button>
              </>
            )}
          </form>
        </div>

        <div className="activate-links">
          <a href="/login" className="activate-link">
            Already have an account? <strong>Sign in</strong>
          </a>
        </div>
      </div>
    </div>
  );
}
