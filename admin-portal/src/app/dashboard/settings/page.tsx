'use client';

/**
 * Admin Settings Page (§3)
 *
 * Three sections:
 * 1. Change Username
 * 2. Change Password
 * 3. Admin WhatsApp Number (single source of truth — feeds license onboarding + Orbitex Services buttons)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Phone, UserPen, Lock, Loader2, Check } from 'lucide-react';
import {
  changeAdminPasswordAction,
  changeAdminUsernameAction,
  updateWhatsAppNumberAction,
  fetchAdminSettingsAction,
} from './actions';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Settings state
  const [username, setUsername] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback
  const [usernameMsg, setUsernameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await fetchAdminSettingsAction();
      if (result.settings) {
        setUsername(result.settings.username);
        setWhatsappNumber(result.settings.whatsappNumber);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameMsg(null);
    setSavingUsername(true);
    const result = await changeAdminUsernameAction({ newUsername: username });
    setSavingUsername(false);
    if (result.error) setUsernameMsg({ type: 'error', text: result.error });
    else setUsernameMsg({ type: 'success', text: 'Username updated.' });
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    const result = await changeAdminPasswordAction({ currentPassword, newPassword });
    setSavingPassword(false);
    if (result.error) setPasswordMsg({ type: 'error', text: result.error });
    else {
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  async function handleSaveWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    setWhatsappMsg(null);
    setSavingWhatsapp(true);
    const result = await updateWhatsAppNumberAction({ number: whatsappNumber });
    setSavingWhatsapp(false);
    if (result.error) setWhatsappMsg({ type: 'error', text: result.error });
    else setWhatsappMsg({ type: 'success', text: 'WhatsApp number updated. This change applies everywhere — license onboarding, Orbitex Services, and password reset routing.' });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)',
  };

  const sectionTitleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
    fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)',
  };

  const msgStyle = (type: 'success' | 'error'): React.CSSProperties => ({
    padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
    marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
    background: type === 'success' ? 'var(--color-success-subtle)' : 'var(--color-error-subtle)',
    color: type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
  });

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 600, margin: '0 auto' }}>
      <button onClick={() => router.push('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-6)' }}>
        Admin Settings
      </h1>

      {/* Username */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}><UserPen size={18} /> Username</div>
        <form onSubmit={handleSaveUsername} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label htmlFor="admin-username-edit" className="input-label">Admin Username</label>
            <input id="admin-username-edit" type="text" className="input-field" value={username}
              onChange={(e) => setUsername(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingUsername} style={{ height: 42 }}>
            {savingUsername ? <Loader2 size={16} className="spinner" /> : <><Save size={14} /> Save</>}
          </button>
        </form>
        {usernameMsg && <div style={msgStyle(usernameMsg.type)}>{usernameMsg.type === 'success' && <Check size={14} />}{usernameMsg.text}</div>}
      </div>

      {/* Password */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}><Lock size={18} /> Change Password</div>
        <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="input-group">
            <label htmlFor="admin-current-pw" className="input-label">Current Password</label>
            <input id="admin-current-pw" type="password" className="input-field" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="input-group">
            <label htmlFor="admin-new-pw" className="input-label">New Password</label>
            <input id="admin-new-pw" type="password" className="input-field" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="input-group">
            <label htmlFor="admin-confirm-pw" className="input-label">Confirm New Password</label>
            <input id="admin-confirm-pw" type="password" className="input-field" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPassword} style={{ alignSelf: 'flex-end' }}>
            {savingPassword ? <Loader2 size={16} className="spinner" /> : <><Save size={14} /> Change Password</>}
          </button>
        </form>
        {passwordMsg && <div style={msgStyle(passwordMsg.type)}>{passwordMsg.type === 'success' && <Check size={14} />}{passwordMsg.text}</div>}
      </div>

      {/* WhatsApp Number */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}><Phone size={18} /> Admin WhatsApp Number</div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
          This single number is used everywhere — the &quot;Get a license key&quot; link on the client login screen,
          the WhatsApp redirect after generating a key, every &quot;Request&quot; button in Orbitex Services,
          and admin-assisted password resets. One field, one source of truth.
        </p>
        <form onSubmit={handleSaveWhatsapp} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label htmlFor="admin-whatsapp" className="input-label">WhatsApp Number</label>
            <input id="admin-whatsapp" type="tel" className="input-field" value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="9422880355" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingWhatsapp} style={{ height: 42 }}>
            {savingWhatsapp ? <Loader2 size={16} className="spinner" /> : <><Save size={14} /> Save</>}
          </button>
        </form>
        {whatsappMsg && <div style={msgStyle(whatsappMsg.type)}>{whatsappMsg.type === 'success' && <Check size={14} />}{whatsappMsg.text}</div>}
      </div>
    </div>
  );
}
