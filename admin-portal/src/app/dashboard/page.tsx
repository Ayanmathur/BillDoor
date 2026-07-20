'use client';

/**
 * BillDoor Admin Dashboard (§3)
 * 
 * Client table: License Key (masked) · Business Name · Username · Phone
 *   · Registered At · Valid Till (extend) · Status badge · Actions
 * 
 * Key generation panel with optional pre-fill (upsell: "Setup by us — billable")
 * 
 * WhatsApp redirect uses admin_whatsapp_number from platform_settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound, Users, Copy, Check, MessageCircle, Shield, ShieldOff,
  Settings, Trash2, UserPen, RotateCcw, Plus, ChevronDown, ChevronUp,
  AlertTriangle, Clock, Activity, Sparkles, LogOut, Inbox, CalendarPlus,
  Phone, CheckCircle, XCircle, Eye, EyeOff, ScrollText, CreditCard, Link2, X,
  Image as ImageIcon,
} from 'lucide-react';
import {
  generateLicenseKeyAction,
  fetchClientsAction,
  fetchLicenseKeysAction,
  toggleClientStatusAction,
  toggleModulesAction,
  toggleQuickToolsAction,
  fetchInquiriesAction,
  updateInquiryStatusAction,
  extendValidityAction,
  unmaskKeyAction,
  createPaymentLinkAction,
} from './actions';
import { createClient } from '@/lib/supabase/client';
import './dashboard.css';

type Client = {
  id: string;
  business_name: string;
  username: string;
  slug: string;
  phone: string;
  status: string;
  modules_enabled: Record<string, boolean>;
  registered_at: string;
  valid_till: string;
  deleted_at: string | null;
};

type Inquiry = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clients' | 'keys' | 'inquiries'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeygen, setShowKeygen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Unmasked key tracking (admin can reveal keys to resend)
  const [unmaskedKeys, setUnmaskedKeys] = useState<Record<string, string>>({});

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ clientId: string; clientName: string; action: 'revoke' | 'reactivate' } | null>(null);

  // Payment link modal state
  const [paymentModal, setPaymentModal] = useState<{ clientId: string; clientName: string; phone: string } | null>(null);
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentResult, setPaymentResult] = useState<{ shortUrl: string; amountPaise: number } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentCopied, setPaymentCopied] = useState(false);

  // Key generation state
  const [keygenMobile, setKeygenMobile] = useState('');
  const [keygenBusiness, setKeygenBusiness] = useState('');
  const [keygenSlug, setKeygenSlug] = useState('');
  const [keygenPlaceId, setKeygenPlaceId] = useState('');
  const [keygenAbout, setKeygenAbout] = useState('');
  const [keygenShowPrefill, setKeygenShowPrefill] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{ rawKey: string; whatsappNumber: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [keygenError, setKeygenError] = useState('');
  const [keygenLoading, setKeygenLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [clientResult, keyResult, inquiryResult] = await Promise.all([
      fetchClientsAction(),
      fetchLicenseKeysAction(),
      fetchInquiriesAction(),
    ]);
    if (clientResult.clients) setClients(clientResult.clients as Client[]);
    if (keyResult.keys) setKeys(keyResult.keys);
    if (inquiryResult.inquiries) setInquiries(inquiryResult.inquiries as Inquiry[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Stats
  const activeClients = clients.filter(c => c.status === 'active').length;
  const revokedClients = clients.filter(c => c.status === 'revoked').length;
  const expiringClients = clients.filter(c => {
    if (c.status !== 'active' || !c.valid_till) return false;
    const daysLeft = (new Date(c.valid_till).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft <= 30 && daysLeft > 0;
  }).length;

  function getStatusBadge(client: Client) {
    if (client.status === 'revoked') return <span className="status-badge revoked">Revoked</span>;
    if (client.valid_till) {
      const daysLeft = (new Date(client.valid_till).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 0) return <span className="status-badge revoked">Expired</span>;
      if (daysLeft <= 30) return <span className="status-badge expiring"><AlertTriangle size={12} /> Expiring</span>;
    }
    return <span className="status-badge active">Active</span>;
  }

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault();
    setKeygenError('');
    setKeygenLoading(true);
    const result = await generateLicenseKeyAction({
      mobileNumber: keygenMobile,
      businessName: keygenBusiness || undefined,
      slug: keygenSlug || undefined,
      googlePlaceId: keygenPlaceId || undefined,
      about: keygenAbout || undefined,
    });
    setKeygenLoading(false);
    if (result.error) { setKeygenError(result.error); return; }
    if (result.rawKey) {
      setGeneratedKey({ rawKey: result.rawKey, whatsappNumber: result.whatsappNumber || '' });
      loadData();
    }
  }

  async function handleCopyKey() {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    if (!generatedKey) return;
    const msg = encodeURIComponent(
      `Your BillDoor license key:\n\n${generatedKey.rawKey}\n\nGo to app.billdoor.com → "Have a license key?" to activate your account.`
    );
    const cleanPhone = keygenMobile.replace(/\D/g, '').replace(/^91/, '');
    window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, '_blank');
  }

  async function handleToggleStatus(clientId: string, action: 'revoke' | 'reactivate') {
    setActionLoading(clientId);
    await toggleClientStatusAction({ clientId, action });
    await loadData();
    setActionLoading(null);
    setConfirmModal(null);
  }

  async function handleCreatePaymentLink() {
    if (!paymentModal) return;
    setPaymentLoading(true);
    setPaymentError('');
    const result = await createPaymentLinkAction({ clientId: paymentModal.clientId, months: paymentMonths });
    setPaymentLoading(false);
    if ('error' in result && result.error) {
      setPaymentError(result.error);
    } else if ('shortUrl' in result && result.shortUrl) {
      setPaymentResult({ shortUrl: result.shortUrl, amountPaise: result.amountPaise || 0 });
    }
  }

  async function handleCopyPaymentLink() {
    if (!paymentResult) return;
    await navigator.clipboard.writeText(paymentResult.shortUrl);
    setPaymentCopied(true);
    setTimeout(() => setPaymentCopied(false), 2000);
  }

  function handleSendPaymentViaWA() {
    if (!paymentResult || !paymentModal) return;
    const amount = (paymentResult.amountPaise / 100).toLocaleString('en-IN');
    const msg = encodeURIComponent(
      `Hi! Your BillDoor subscription renewal is due.\n\nAmount: ₹${amount} (${paymentMonths} month${paymentMonths > 1 ? 's' : ''})\nPay here: ${paymentResult.shortUrl}\n\nYour subscription will be automatically extended after payment.`
    );
    const cleanPhone = paymentModal.phone.replace(/\D/g, '').replace(/^91/, '');
    window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, '_blank');
  }

  async function handleToggleModule(clientId: string, current: Record<string, boolean>, moduleKey: string) {
    setActionLoading(clientId);
    const updated = { ...current, [moduleKey]: !current[moduleKey] };
    await toggleModulesAction({
      clientId,
      modules: {
        reviewFlow: updated.review_flow ?? false,
        billit: updated.billit ?? false,
        appointer: updated.appointer ?? false,
        whatsappAuto: updated.whatsapp_auto ?? false,
      },
    });
    await loadData();
    setActionLoading(null);
  }

  function handleMessageClient(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '').replace(/^91/, '');
    window.open(`https://wa.me/91${cleanPhone}`, '_blank');
  }

  async function handleExtendValidity(clientId: string, months: number) {
    setActionLoading(clientId);
    await extendValidityAction({ clientId, months });
    await loadData();
    setActionLoading(null);
  }

  async function handleInquiryStatus(inquiryId: string, status: 'contacted' | 'converted' | 'dismissed') {
    setActionLoading(inquiryId);
    await updateInquiryStatusAction({ inquiryId, status });
    await loadData();
    setActionLoading(null);
  }

  async function handleUnmaskKey(keyId: string) {
    if (unmaskedKeys[keyId]) {
      // Toggle off — hide again
      setUnmaskedKeys(prev => { const n = { ...prev }; delete n[keyId]; return n; });
      return;
    }
    setActionLoading(keyId);
    const result = await unmaskKeyAction({ keyId });
    setActionLoading(null);
    if (result.rawKey) {
      setUnmaskedKeys(prev => ({ ...prev, [keyId]: result.rawKey! }));
    }
  }

  async function handleCopyUnmasked(keyId: string) {
    const raw = unmaskedKeys[keyId];
    if (!raw) return;
    await navigator.clipboard.writeText(raw);
  }

  const newInquiriesCount = inquiries.filter(i => i.status === 'new').length;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1>BillDoor Admin</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Orbitex Platform Management
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-primary" onClick={() => { setShowKeygen(!showKeygen); setGeneratedKey(null); }}>
            <Plus size={16} /> Generate Key
          </button>
          <button className="action-btn" onClick={() => router.push('/dashboard/audit')} title="Audit Log">
            <ScrollText size={20} />
          </button>
          <button className="action-btn" onClick={() => router.push('/dashboard/portfolio')} title="Portfolio">
            <ImageIcon size={20} />
          </button>
          <button className="action-btn" onClick={() => router.push('/dashboard/settings')} title="Admin Settings">
            <Settings size={20} />
          </button>
          <button className="action-btn" onClick={handleLogout} title="Sign Out">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon total"><Users size={20} /></div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{clients.length}</div>
            <div className="admin-stat-label">Total Clients</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon active"><Activity size={20} /></div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{activeClients}</div>
            <div className="admin-stat-label">Active</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon expiring"><Clock size={20} /></div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{expiringClients}</div>
            <div className="admin-stat-label">Expiring Soon</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon revoked"><ShieldOff size={20} /></div>
          <div className="admin-stat-content">
            <div className="admin-stat-value">{revokedClients}</div>
            <div className="admin-stat-label">Revoked</div>
          </div>
        </div>
      </div>

      {/* Key generation panel */}
      {showKeygen && (
        <div className="keygen-panel">
          <h2><KeyRound size={20} /> Generate License Key</h2>
          {generatedKey ? (
            <div className="key-result">
              <div className="key-result-label">License Key — show once, never retrievable</div>
              <div className="key-result-value">{generatedKey.rawKey}</div>
              <div className="key-result-actions">
                <button className="btn btn-primary" onClick={handleCopyKey}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy Key'}
                </button>
                <button className="btn btn-secondary" onClick={handleWhatsApp}>
                  <MessageCircle size={16} /> Send via WhatsApp
                </button>
                <button className="btn btn-secondary" onClick={() => { setGeneratedKey(null); setKeygenMobile(''); setKeygenBusiness(''); setKeygenSlug(''); setKeygenPlaceId(''); setKeygenAbout(''); setKeygenShowPrefill(false); }}>
                  <Plus size={16} /> Generate Another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGenerateKey} className="keygen-form">
              {keygenError && (
                <div className="full-width" style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }} role="alert">
                  {keygenError}
                </div>
              )}
              <div className="input-group">
                <label htmlFor="keygen-mobile" className="input-label">Client Mobile Number *</label>
                <input id="keygen-mobile" type="tel" className="input-field" required value={keygenMobile}
                  onChange={(e) => setKeygenMobile(e.target.value)} placeholder="9876543210" />
              </div>
              <div />
              <div className="prefill-section">
                <div className="prefill-header" style={{ cursor: 'pointer' }} onClick={() => setKeygenShowPrefill(!keygenShowPrefill)}>
                  <span className="upsell-badge">Setup by us — billable</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                    Pre-fill business details (paid setup service)
                  </span>
                  {keygenShowPrefill ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {keygenShowPrefill && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div className="input-group">
                      <label htmlFor="keygen-business" className="input-label">Business Name</label>
                      <input id="keygen-business" type="text" className="input-field" value={keygenBusiness}
                        onChange={(e) => setKeygenBusiness(e.target.value)} placeholder="Sunshine Bakery" />
                    </div>
                    <div className="input-group">
                      <label htmlFor="keygen-slug" className="input-label">URL Slug</label>
                      <input id="keygen-slug" type="text" className="input-field" value={keygenSlug}
                        onChange={(e) => setKeygenSlug(e.target.value)} placeholder="sunshine-bakery" />
                    </div>
                    <div className="input-group">
                      <label htmlFor="keygen-place" className="input-label">Google Place ID</label>
                      <input id="keygen-place" type="text" className="input-field" value={keygenPlaceId}
                        onChange={(e) => setKeygenPlaceId(e.target.value)} placeholder="ChIJ..." />
                    </div>
                    <div className="input-group">
                      <label htmlFor="keygen-about" className="input-label">About</label>
                      <input id="keygen-about" type="text" className="input-field" value={keygenAbout}
                        onChange={(e) => setKeygenAbout(e.target.value)} placeholder="A cozy neighbourhood bakery..." />
                    </div>
                  </div>
                )}
              </div>
              <div className="full-width" style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowKeygen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={keygenLoading}>
                  {keygenLoading ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>
          <Users size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Clients ({clients.length})
        </button>
        <button className={`admin-tab ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
          <KeyRound size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> License Keys ({keys.length})
        </button>
        <button className={`admin-tab ${activeTab === 'inquiries' ? 'active' : ''}`} onClick={() => setActiveTab('inquiries')}>
          <Inbox size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Inquiries
          {newInquiriesCount > 0 && (
            <span style={{ marginLeft: 6, background: 'var(--color-accent)', color: 'white', borderRadius: 'var(--radius-full)', padding: '1px 6px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>
              {newInquiriesCount}
            </span>
          )}
        </button>
      </div>

      {/* Client table */}
      {activeTab === 'clients' && (
        <div className="client-table-wrap">
          {loading ? (
            <div className="empty-state"><RotateCcw size={24} className="spinner" /><p>Loading...</p></div>
          ) : clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={40} /></div>
              <p>No clients yet. Generate a license key to get started.</p>
            </div>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Username</th>
                  <th>Phone</th>
                  <th>Registered</th>
                  <th>Valid Till</th>
                  <th>Status</th>
                  <th>Modules</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 'var(--weight-medium)' }}>{client.business_name}</td>
                    <td><code style={{ fontSize: 'var(--text-xs)' }}>{client.username}</code></td>
                    <td>{client.phone}</td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {client.registered_at ? new Date(client.registered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {(() => {
                        const vt = client.valid_till ? new Date(client.valid_till) : null;
                        const now = new Date();
                        const daysLeft = vt ? Math.ceil((vt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                        const dateStr = vt ? vt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{dateStr}</span>
                              {vt && daysLeft <= 0 && (
                                <span style={{ color: 'var(--color-error)', fontWeight: 'var(--weight-bold)', fontSize: '10px' }}>
                                  EXPIRED — REVOKE
                                </span>
                              )}
                              {vt && daysLeft > 0 && daysLeft <= 15 && (
                                <span style={{ color: 'hsl(38 90% 50%)', fontWeight: 'var(--weight-bold)', fontSize: '10px' }}>
                                  {daysLeft}d left
                                </span>
                              )}
                              {vt && daysLeft > 15 && daysLeft <= 30 && (
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                                  {daysLeft}d
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[1, 3, 6, 12].map((m) => (
                                <button key={m} className="action-btn" title={`Extend +${m} month${m > 1 ? 's' : ''}`}
                                  onClick={() => handleExtendValidity(client.id, m)}
                                  disabled={actionLoading === client.id}
                                  style={{ padding: '1px 4px', fontSize: '9px', lineHeight: 1.2 }}>
                                  +{m}m
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td>{getStatusBadge(client)}</td>
                    <td>
                      <div className="module-toggles">
                        {['review_flow', 'billit', 'appointer', 'whatsapp_auto'].map((mod) => (
                          <label key={mod} className="module-toggle">
                            <input type="checkbox" checked={client.modules_enabled?.[mod] ?? false}
                              onChange={() => handleToggleModule(client.id, client.modules_enabled || {}, mod)}
                              disabled={actionLoading === client.id} />
                            {mod === 'review_flow' ? 'RF' : mod === 'billit' ? 'BL' : mod === 'appointer' ? 'AP' : 'WA'}
                          </label>
                        ))}
                      </div>
                      <div className="module-toggles" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginRight: '4px' }}>QT:</span>
                        {[{ key: 'gst_calculator', label: 'GC' }, { key: 'catalog_viewer', label: 'CV' }].map((tool) => (
                          <label key={tool.key} className="module-toggle">
                            <input type="checkbox"
                              checked={((client.modules_enabled as any)?.quick_tools || {})?.[tool.key] ?? false}
                              onChange={async () => {
                                setActionLoading(client.id);
                                const current = ((client.modules_enabled as any)?.quick_tools || {});
                                await toggleQuickToolsAction({ clientId: client.id, tool: tool.key, enabled: !(current[tool.key] ?? false) });
                                await loadData();
                                setActionLoading(null);
                              }}
                              disabled={actionLoading === client.id} />
                            {tool.label}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="action-btn" title="Message on WhatsApp" onClick={() => handleMessageClient(client.phone)}>
                          <MessageCircle size={16} />
                        </button>
                        <button className="action-btn" title="Send Payment Link" onClick={() => {
                          setPaymentModal({ clientId: client.id, clientName: client.business_name, phone: client.phone });
                          setPaymentResult(null); setPaymentError(''); setPaymentMonths(1); setPaymentCopied(false);
                        }}>
                          <CreditCard size={16} />
                        </button>
                        {client.status === 'active' ? (
                          <button className="action-btn danger" title="Revoke"
                            onClick={() => setConfirmModal({ clientId: client.id, clientName: client.business_name, action: 'revoke' })}
                            disabled={actionLoading === client.id}>
                            <ShieldOff size={16} />
                          </button>
                        ) : (
                          <button className="action-btn" title="Reactivate"
                            onClick={() => setConfirmModal({ clientId: client.id, clientName: client.business_name, action: 'reactivate' })}
                            disabled={actionLoading === client.id}>
                            <Shield size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* License keys table */}
      {activeTab === 'keys' && (
        <div className="client-table-wrap">
          {loading ? (
            <div className="empty-state"><RotateCcw size={24} className="spinner" /><p>Loading...</p></div>
          ) : keys.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><KeyRound size={40} /></div>
              <p>No license keys generated yet.</p>
            </div>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Mobile</th>
                  <th>Key</th>
                  <th>Pre-fill</th>
                  <th>Status</th>
                  <th>Activated By</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key: any) => (
                  <tr key={key.id}>
                    <td>{key.mobile_number}</td>
                    <td style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace' }}>
                      {unmaskedKeys[key.id]
                        ? <code style={{ background: 'var(--color-success-subtle)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', wordBreak: 'break-all' }}>{unmaskedKeys[key.id]}</code>
                        : <span style={{ color: 'var(--color-text-tertiary)' }}>••••••••</span>
                      }
                    </td>
                    <td>
                      {key.business_name
                        ? <span>{key.business_name} <span className="upsell-badge" style={{ marginLeft: 4 }}>Paid setup</span></span>
                        : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className={`status-badge ${key.status}`}>
                        {key.status === 'activated' ? 'Activated' : 'Unused'}
                      </span>
                    </td>
                    <td>
                      {key.clients?.[0]
                        ? <span>{key.clients[0].business_name} (<code style={{ fontSize: 'var(--text-xs)' }}>{key.clients[0].username}</code>)</span>
                        : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      }
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {new Date(key.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="action-btn" title={unmaskedKeys[key.id] ? 'Hide key' : 'Reveal key'}
                          onClick={() => handleUnmaskKey(key.id)} disabled={actionLoading === key.id}>
                          {unmaskedKeys[key.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        {unmaskedKeys[key.id] && (
                          <>
                            <button className="action-btn" title="Copy key" onClick={() => handleCopyUnmasked(key.id)}>
                              <Copy size={16} />
                            </button>
                            <button className="action-btn" title="Resend via WhatsApp"
                              onClick={() => {
                                const msg = encodeURIComponent(`Your BillDoor license key:\n\n${unmaskedKeys[key.id]}\n\nGo to app.billdoor.com → "Have a license key?" to activate your account.`);
                                const cleanPhone = key.mobile_number.replace(/\D/g, '').replace(/^91/, '');
                                window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, '_blank');
                              }}>
                              <MessageCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* Inquiries table */}
      {activeTab === 'inquiries' && (
        <div className="client-table-wrap">
          {loading ? (
            <div className="empty-state"><RotateCcw size={24} className="spinner" /><p>Loading...</p></div>
          ) : inquiries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Inbox size={40} /></div>
              <p>No inquiries yet. Leads will appear here when someone clicks &quot;Get a license key&quot; on the login page.</p>
            </div>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td style={{ fontWeight: 'var(--weight-medium)' }}>{inq.name}</td>
                    <td>{inq.phone}</td>
                    <td>
                      <span className={`status-badge ${inq.status === 'new' ? 'expiring' : inq.status === 'contacted' ? 'active' : inq.status === 'converted' ? 'active' : 'revoked'}`}>
                        {inq.status === 'new' ? '● New' : inq.status === 'contacted' ? 'Contacted' : inq.status === 'converted' ? '✓ Converted' : 'Dismissed'}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {new Date(inq.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="action-btn" title="Message on WhatsApp"
                          onClick={() => {
                            const cleanPhone = inq.phone.replace(/\D/g, '').replace(/^91/, '');
                            window.open(`https://wa.me/91${cleanPhone}`, '_blank');
                          }}>
                          <MessageCircle size={16} />
                        </button>
                        {inq.status === 'new' && (
                          <button className="action-btn" title="Mark Contacted"
                            onClick={() => handleInquiryStatus(inq.id, 'contacted')}
                            disabled={actionLoading === inq.id}>
                            <Phone size={16} />
                          </button>
                        )}
                        {(inq.status === 'new' || inq.status === 'contacted') && (
                          <button className="action-btn" title="Mark Converted (key issued)"
                            onClick={() => handleInquiryStatus(inq.id, 'converted')}
                            disabled={actionLoading === inq.id}>
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {inq.status !== 'dismissed' && inq.status !== 'converted' && (
                          <button className="action-btn danger" title="Dismiss"
                            onClick={() => handleInquiryStatus(inq.id, 'dismissed')}
                            disabled={actionLoading === inq.id}>
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Revoke/Reactivate confirmation modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {confirmModal.action === 'revoke' ? <ShieldOff size={20} color="var(--color-error)" /> : <Shield size={20} color="var(--color-success)" />}
                {confirmModal.action === 'revoke' ? 'Revoke Client' : 'Reactivate Client'}
              </h3>
              <button className="action-btn" onClick={() => setConfirmModal(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
              {confirmModal.action === 'revoke'
                ? `Revoking "${confirmModal.clientName}" will immediately block their access to BillDoor. Their data will be preserved.`
                : `Reactivate "${confirmModal.clientName}"? They will regain full access. Consider extending their validity after reactivation.`
              }
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className={`btn ${confirmModal.action === 'revoke' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handleToggleStatus(confirmModal.clientId, confirmModal.action)}
                disabled={actionLoading === confirmModal.clientId}
              >
                {actionLoading === confirmModal.clientId ? 'Processing...' : confirmModal.action === 'revoke' ? 'Revoke Access' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Link modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CreditCard size={20} color="var(--color-accent)" />
                Payment Link — {paymentModal.clientName}
              </h3>
              <button className="action-btn" onClick={() => setPaymentModal(null)}><X size={18} /></button>
            </div>

            {paymentResult ? (
              <div>
                <div style={{ padding: 'var(--space-4)', background: 'var(--color-success-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>Payment link created!</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>₹{(paymentResult.amountPaise / 100).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{paymentMonths} month{paymentMonths > 1 ? 's' : ''} subscription</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                  <Link2 size={14} />
                  <code style={{ flex: 1, fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{paymentResult.shortUrl}</code>
                  <button className="action-btn" onClick={handleCopyPaymentLink} title="Copy link">
                    {paymentCopied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Close</button>
                  <button className="btn btn-primary" onClick={handleSendPaymentViaWA}>
                    <MessageCircle size={16} /> Send via WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="input-label">Duration</label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {[1, 3, 6, 12].map((m) => (
                      <button key={m}
                        className={`btn ${paymentMonths === m ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setPaymentMonths(m)}
                        style={{ flex: 1 }}
                      >
                        {m} month{m > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Amount is auto-calculated based on enabled modules. Pricing: ₹500/service, ₹800/any 2, ₹1,000/all 3 — multiplied by duration.
                </p>
                {paymentError && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                    {paymentError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleCreatePaymentLink} disabled={paymentLoading}>
                    {paymentLoading ? 'Creating...' : 'Generate Payment Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
