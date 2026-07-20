'use client';

/**
 * BillDoor — Login Page (§2 + Inquiry Flow)
 * 
 * Layout: login form front and center (username + password).
 * Two secondary text links below:
 *   - "Have a license key? Create your account"
 *   - "Need a license key? Get one" → opens inquiry form → saves to DB → WhatsApp redirect
 * 
 * The onboarding paths don't visually compete with ordinary login.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DoorOpen, Eye, EyeOff, X, Send, Loader2, ArrowLeft } from 'lucide-react';
import { validateLogin } from '@/shared/validation';
import { loginAction } from './actions';
import { submitInquiryAction } from './inquiry-action';
import './login.css';

// Helper component for floating label
function FloatingInput({ id, type, label, value, onChange, placeholder, disabled, autoFocus, autoComplete, error, children }: any) {
  return (
    <div className="form-control" style={{ marginBottom: error ? 5 : 20 }}>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          required
          data-has-value={value.length > 0}
          className={error ? 'error' : ''}
          style={{ paddingRight: children ? 'var(--space-10)' : 0 }}
        />
        <label htmlFor={id}>
          {label.split('').map((char: string, i: number) => (
            <span key={i} style={{ transitionDelay: `${i * 30}ms` }}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </label>
        {children}
      </div>
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Inquiry form state
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryError, setInquiryError] = useState('');
  const [inquiryLoading, setInquiryLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    // Client-side validation (UX only — server re-validates)
    const validation = validateLogin({ username, password });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    setIsLoading(true);
    try {
      const result = await loginAction({ username, password });
      if (result.error) {
        setServerError(result.error);
      } else {
        router.push('/dashboard');
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    setInquiryError('');

    if (!inquiryName.trim() || inquiryName.trim().length < 2) {
      setInquiryError('Please enter your name.');
      return;
    }
    if (!inquiryPhone.trim()) {
      setInquiryError('Please enter your phone number.');
      return;
    }

    setInquiryLoading(true);
    try {
      const result = await submitInquiryAction({
        name: inquiryName.trim(),
        phone: inquiryPhone.trim(),
      });
      if (result.error) {
        setInquiryError(result.error);
      } else if (result.whatsappUrl) {
        // Open WhatsApp with pre-filled message
        window.open(result.whatsappUrl, '_blank');
        // Reset and close
        setShowInquiry(false);
        setInquiryName('');
        setInquiryPhone('');
      }
    } catch {
      setInquiryError('Something went wrong. Please try again.');
    } finally {
      setInquiryLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <DoorOpen size={56} strokeWidth={1.5} color="var(--color-accent)" />
          </div>
          <h1 className="login-brand">BillDoor</h1>
          <p className="login-subtitle">Smart billing & reviews for your business</p>
        </div>

        {/* Login card — OR — Inquiry form */}
        {showInquiry ? (
          <div className="login-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <button
                type="button"
                onClick={() => { setShowInquiry(false); setInquiryError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 0, display: 'flex' }}
                aria-label="Back to login"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
                Get a License Key
              </h2>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
              Tell us your name and number — we&apos;ll connect you with Orbitex on WhatsApp to get started.
            </p>
            <form className="login-form" onSubmit={handleInquirySubmit}>
              {inquiryError && (
                <div className="login-error" role="alert">
                  {inquiryError}
                </div>
              )}

              <FloatingInput
                id="inquiry-name"
                type="text"
                label="Your Name"
                value={inquiryName}
                onChange={(e: any) => setInquiryName(e.target.value)}
                autoFocus
              />

              <FloatingInput
                id="inquiry-phone"
                type="tel"
                label="Your Phone Number"
                value={inquiryPhone}
                onChange={(e: any) => setInquiryPhone(e.target.value)}
              />

              <button
                type="submit"
                className="btn btn-primary login-submit"
                disabled={inquiryLoading}
              >
                {inquiryLoading ? <Loader2 size={16} className="spinner" /> : <><Send size={16} /> Connect on WhatsApp</>}
              </button>
            </form>
          </div>
        ) : (
          <div className="login-card">
            <form className="login-form" onSubmit={handleSubmit}>
              {serverError && (
                <div className="login-error" role="alert">
                  {serverError}
                </div>
              )}

              {/* Username */}
              <FloatingInput
                id="login-username"
                type="text"
                label="Username"
                value={username}
                onChange={(e: any) => setUsername(e.target.value.toLowerCase())}
                autoComplete="username"
                autoFocus
                error={errors.username}
              />

              {/* Password */}
              <FloatingInput
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                autoComplete="current-password"
                error={errors.password}
              >
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 'var(--space-1)',
                    top: '15px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-tertiary)',
                    padding: 0,
                    display: 'flex',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </FloatingInput>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary login-submit"
                disabled={isLoading}
              >
                {isLoading ? <span className="spinner" /> : 'Sign In'}
              </button>
            </form>
          </div>
        )}

        {/* Secondary links (§2: don't visually compete with login) */}
        {!showInquiry && (
          <div className="login-links">
            <a href="/activate" className="login-link">
              Have a license key? <strong>Create your account</strong>
            </a>
            <a
              href="https://wa.me/919422880355?text=Hello%20Orbitex%2C%20I%20am%20interested%20in%20BillDoor.%20Please%20share%20a%20license%20key."
              target="_blank"
              rel="noopener noreferrer"
              className="login-link"
            >
              Need a license key? <strong>Get one</strong>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

