'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { adminLoginAction } from './actions';
import './login.css';

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
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <Shield size={48} strokeWidth={1.5} color="var(--color-accent)" />
          <h1 className="admin-login-brand">BillDoor</h1>
          <span className="admin-login-badge">Admin Panel</span>
        </div>
        <div className="admin-login-card">
          <form className="admin-login-form" onSubmit={handleSubmit}>
            {error && <div className="admin-login-error" role="alert">{error}</div>}
            <div className="input-group">
              <label htmlFor="admin-username" className="input-label">Username</label>
              <input id="admin-username" type="text" className="input-field" value={username}
                onChange={(e) => setUsername(e.target.value)} placeholder="Admin username" autoComplete="username" autoFocus />
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
