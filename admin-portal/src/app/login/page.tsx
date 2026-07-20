'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Receipt, Star, CalendarClock, Store, Cake, Scissors, Stethoscope, GraduationCap, Building2, Utensils, Heart } from 'lucide-react';
import { adminLoginAction } from './actions';
import './login.css';

// Minimal, elegant background pattern of abstract business icons
function LoginBackground() {
  const icons = [Receipt, Star, CalendarClock, Store, Cake, Scissors, Stethoscope, GraduationCap, Building2, Utensils, Heart];
  // Generate a fixed pattern so it doesn't flicker on rehydration
  const pattern = Array.from({ length: 40 }).map((_, i) => {
    const Icon = icons[i % icons.length];
    const top = `${((i * 17) % 100)}%`;
    const left = `${((i * 23) % 100)}%`;
    const size = 24 + ((i * 7) % 24);
    const opacity = 0.03 + (((i * 3) % 5) * 0.01);
    const rotation = ((i * 45) % 360);
    return (
      <div key={i} style={{ position: 'absolute', top, left, opacity, transform: `rotate(${rotation}deg)` }}>
        <Icon size={size} color="currentColor" />
      </div>
    );
  });

  return (
    <div className="login-background-pattern" style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      color: 'var(--color-text-primary)'
    }}>
      {pattern}
    </div>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Username and password required.'); return; }

    setIsLoading(true);
    try {
      const result = await adminLoginAction({ username: username.trim(), password });
      if (result.error) { setError(result.error); }
      else { router.push('/dashboard'); }
    } catch { setError('Something went wrong.'); }
    finally { setIsLoading(false); }
  }

  return (
    <div className="admin-login-page" style={{ position: 'relative' }}>
      <LoginBackground />
      <div className="admin-login-container" style={{ position: 'relative', zIndex: 10 }}>
        <div className="admin-login-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <img src="/logo-light.png" alt="BillDoor Logo" width="180" style={{ objectFit: 'contain' }} className="admin-login-main-logo" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
            <Shield size={20} strokeWidth={1.5} color="var(--color-text-tertiary)" />
            <h1 className="admin-login-brand" style={{ fontSize: 'var(--text-lg)', marginBottom: 0 }}>BillDoor</h1>
            <span className="admin-login-badge" style={{ marginTop: 0 }}>Admin Panel</span>
          </div>
        </div>
        <div className="admin-login-card">
          <form className="admin-login-form" onSubmit={handleSubmit}>
            {error && <div className="admin-login-error" role="alert">{error}</div>}
            <div className="input-group">
              <label htmlFor="admin-username" className="input-label">Username</label>
              <input id="admin-username" type="text" className="input-field" value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="Admin username" autoComplete="username" autoFocus />
            </div>
            <div className="input-group">
              <label htmlFor="admin-password" className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input id="admin-password" type={showPassword ? 'text' : 'password'} className="input-field"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                  autoComplete="current-password" style={{ paddingRight: 'var(--space-10)' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex' }}
                  aria-label={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary admin-login-submit" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="admin-login-footer">Orbitex Platform Administration</p>
      </div>
    </div>
  );
}
