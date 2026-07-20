'use client';

/**
 * BillDoor — Client General Settings (§9)
 *
 * Tabbed settings: Business Info · GST · Socials · Rewards · Account
 * Uses shared design tokens. Danger zone at the bottom.
 */

import { useState, useEffect } from 'react';
import {
  Building2, Hash, Globe, Gift, Lock, AlertTriangle, Save, Loader2,
  Instagram, Facebook, ExternalLink, MapPin, Check, Trophy,
  Upload, User, Trash2, Image, Linkedin, Twitter, MessageCircle
} from 'lucide-react';
import {
  fetchSettingsAction,
  updateBusinessInfoAction,
  updateGstAction,
  updateSocialsAction,
  updateRewardSettingsAction,
  updateLoyaltyConfigAction,
  changePasswordAction,
  changeUsernameAction,
  uploadLogoAction,
  deleteAccountAction,
} from './actions';

type SettingsTab = 'business' | 'gst' | 'socials' | 'rewards' | 'account';

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('business');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Settings state
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [about, setAbout] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const [hasGst, setHasGst] = useState(false);
  const [gstNumber, setGstNumber] = useState('');

  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const [rewardsEnabled, setRewardsEnabled] = useState(false);
  const [rewardTriggers, setRewardTriggers] = useState({ feedback: true, bill_created: false, appointment_completed: false });
  const [rewardType, setRewardType] = useState('percent_discount');
  const [rewardValue, setRewardValue] = useState(10);
  const [reviewRewardMode, setReviewRewardMode] = useState('all_feedback');
  const [maxPerDay, setMaxPerDay] = useState(1);

  // Track 2 — Loyalty
  const [track2Enabled, setTrack2Enabled] = useState(false);
  const [track2GoalType, setTrack2GoalType] = useState<'visits' | 'spend'>('visits');
  const [track2GoalValue, setTrack2GoalValue] = useState(5);
  const [track2RewardType, setTrack2RewardType] = useState<'free_item' | 'flat_discount'>('flat_discount');
  const [track2FlatValue, setTrack2FlatValue] = useState(100);
  const [track2CatalogItemName, setTrack2CatalogItemName] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Username change
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');

  // Logo
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Delete account
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await fetchSettingsAction();
      if (result.settings) {
        const s = result.settings;
        setBusinessName(s.businessName);
        setSlug(s.slug);
        setAbout(s.about);
        setOwnerName(s.ownerName);
        setAddress(s.address);
        setPhone(s.phone);
        setHasGst(s.hasGst);
        setGstNumber(s.gstNumber);
        setInstagramUrl(s.instagramUrl);
        setFacebookUrl(s.facebookUrl);
        setWebsiteUrl(s.websiteUrl);
        setLinkedinUrl(s.linkedinUrl || '');
        setXUrl(s.xUrl || '');
        setWhatsappUrl(s.whatsappUrl || '');

        if (s.rewardSettings) {
          setRewardsEnabled(s.rewardSettings.enabled ?? false);
          setRewardTriggers(s.rewardSettings.triggers || rewardTriggers);
          setRewardType(s.rewardSettings.reward_type || 'percent_discount');
          setRewardValue(s.rewardSettings.reward_value ?? 10);
          setReviewRewardMode(s.rewardSettings.review_reward_mode || 'all_feedback');
          setMaxPerDay(s.rewardSettings.max_per_customer_per_day ?? 1);
        }
        
        // Load loyalty config
        if (s.loyaltyConfig?.track2_enabled) {
          setTrack2Enabled(true);
          setTrack2GoalType(s.loyaltyConfig.track2?.goal_type || 'visits');
          setTrack2GoalValue(s.loyaltyConfig.track2?.goal_value || 5);
          setTrack2RewardType(s.loyaltyConfig.track2?.reward_type || 'flat_discount');
          setTrack2FlatValue(s.loyaltyConfig.track2?.reward_flat_value || 100);
        }
        setUsername(s.username || '');
        setNewUsername(s.username || '');
        setLogoUrl(s.logoUrl || '');
      }
      setLoading(false);
    }
    load();
  }, []);

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  async function handleSaveBusiness() {
    setSaving(true); setError('');
    const result = await updateBusinessInfoAction({ businessName, slug, about, ownerName, address, phone });
    if (result.error) setError(result.error); else flash();
    setSaving(false);
  }

  async function handleSaveGst() {
    setSaving(true); setError('');
    const result = await updateGstAction({ hasGst, gstNumber });
    if (result.error) setError(result.error); else flash();
    setSaving(false);
  }

  async function handleSaveSocials() {
    setSaving(true); setError(''); setSaved(false);
    const result = await updateSocialsAction({
      instagramUrl, facebookUrl, websiteUrl, linkedinUrl, xUrl, whatsappUrl
    });
    if (result.error) setError(result.error); else flash();
    setSaving(false);
  }

  async function handleSaveRewards() {
    setSaving(true); setError('');
    const result = await updateRewardSettingsAction({
      enabled: rewardsEnabled, triggers: rewardTriggers, rewardType, rewardValue, reviewRewardMode, maxPerCustomerPerDay: maxPerDay,
    });
    if (result.error) setError(result.error); else flash();
    setSaving(false);
  }

  async function handleSaveLoyalty() {
    setSaving(true); setError('');
    const result = await updateLoyaltyConfigAction({
      track2Enabled: track2Enabled,
      track2GoalType: track2GoalType,
      track2GoalValue: track2GoalValue,
      track2RewardType: track2RewardType,
      track2FlatValue: track2FlatValue,
      track2CatalogItemName: track2CatalogItemName,
    });
    if (result.error) setError(result.error); else flash();
    setSaving(false);
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSaving(true); setError('');
    const result = await changePasswordAction({ currentPassword, newPassword });
    if (result.error) setError(result.error); else { flash(); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    setSaving(false);
  }

  async function handleChangeUsername() {
    if (!newUsername || !usernamePassword) { setError('Fill in all fields.'); return; }
    setSaving(true); setError('');
    const result = await changeUsernameAction({ newUsername, currentPassword: usernamePassword });
    if (result.error) setError(result.error); else { flash(); setUsername(newUsername); setUsernamePassword(''); }
    setSaving(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const formData = new FormData();
    formData.append('logo', file);
    const result = await uploadLogoAction(formData);
    if (result.error) setError(result.error);
    else if (result.logoUrl) { setLogoUrl(result.logoUrl); flash(); }
    setUploading(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true); setError('');
    const result = await deleteAccountAction({ confirmText: deleteConfirmText, password: deletePassword });
    if (result.error) { setError(result.error); setDeleting(false); return; }
    // Redirect to login after deletion
    window.location.href = '/login';
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}><Loader2 size={24} className="spinner" /></div>;

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'business', label: 'Business', icon: <Building2 size={14} /> },
    { key: 'gst', label: 'GST', icon: <Hash size={14} /> },
    { key: 'socials', label: 'Socials', icon: <Globe size={14} /> },
    { key: 'rewards', label: 'Rewards', icon: <Gift size={14} /> },
    { key: 'account', label: 'Account', icon: <Lock size={14} /> },
  ];

  return (
    <div className="settings-page">
      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`settings-tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setError(''); }}>
            {t.icon} <span style={{ marginLeft: 4 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }} role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-subtle)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Check size={16} /> Saved successfully
        </div>
      )}

      {/* Business Info */}
      {tab === 'business' && (
        <div className="settings-section">
          <h3 className="settings-section-title"><Building2 size={18} /> Business Information</h3>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label">Business Name *</label>
              <input className="input-field" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">URL Slug *</label>
              <input className="input-field" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="my-business" />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>billdoor.com/review/{slug}</span>
            </div>
          </div>
          <div className="settings-row full">
            <div className="input-group">
              <label className="input-label">About</label>
              <textarea className="input-field" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={500} placeholder="A brief description of your business..." />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{about.length}/500</span>
            </div>
          </div>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label">Owner Name</label>
              <input className="input-field" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Phone</label>
              <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
          </div>
          <div className="settings-row full">
            <div className="input-group">
              <label className="input-label">Address</label>
              <textarea className="input-field" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>

          {/* Logo Upload */}
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
            <label className="input-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Image size={14} /> Business Logo
            </label>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
              Used in QR codes, digital bills, and review pages. Max 2MB (PNG, JPG, WebP, SVG).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              {logoUrl ? (
                <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
                  <Image size={24} />
                </div>
              )}
              <label className="btn btn-primary" style={{ cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                {uploading ? <Loader2 size={14} className="spinner" /> : <Upload size={14} />}
                {logoUrl ? 'Replace' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSaveBusiness} disabled={saving} style={{ marginTop: 'var(--space-3)' }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save
          </button>
        </div>
      )}

      {/* GST */}
      {tab === 'gst' && (
        <div className="settings-section">
          <h3 className="settings-section-title"><Hash size={18} /> GST Settings</h3>
          <div className="toggle-field">
            <div>
              <div className="toggle-field-label">GST Registered</div>
              <div className="toggle-field-desc">Enable to add GSTIN to bills</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={hasGst} onChange={(e) => setHasGst(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          {hasGst && (
            <div className="settings-row full" style={{ marginTop: 'var(--space-3)' }}>
              <div className="input-group">
                <label className="input-label">GST Number (GSTIN)</label>
                <input className="input-field" value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={15} placeholder="22AAAAA0000A1Z5" />
              </div>
            </div>
          )}
          <button className="btn btn-primary" onClick={handleSaveGst} disabled={saving} style={{ marginTop: 'var(--space-3)' }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save
          </button>
        </div>
      )}

      {/* Socials */}
      {tab === 'socials' && (
        <div className="settings-section">
          <h3 className="settings-section-title"><Globe size={18} /> Social & Review Links</h3>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label"><Instagram size={14} style={{ verticalAlign: -2 }} /> Instagram</label>
              <input className="input-field" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/yourbusiness" />
            </div>
            <div className="input-group">
              <label className="input-label"><Facebook size={14} style={{ verticalAlign: -2 }} /> Facebook</label>
              <input className="input-field" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/yourbusiness" />
            </div>
          </div>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label"><Linkedin size={14} style={{ verticalAlign: -2 }} /> LinkedIn</label>
              <input className="input-field" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/..." />
            </div>
            <div className="input-group">
              <label className="input-label"><Twitter size={14} style={{ verticalAlign: -2 }} /> X (Twitter)</label>
              <input className="input-field" value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="https://x.com/yourbusiness" />
            </div>
          </div>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label"><ExternalLink size={14} style={{ verticalAlign: -2 }} /> Website</label>
              <input className="input-field" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com" />
            </div>
            <div className="input-group">
              <label className="input-label"><MessageCircle size={14} style={{ verticalAlign: -2 }} /> WhatsApp Link</label>
              <input className="input-field" value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} placeholder="https://wa.me/91..." />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSaveSocials} disabled={saving} style={{ marginTop: 'var(--space-3)' }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save
          </button>
        </div>
      )}

      {/* Rewards */}
      {tab === 'rewards' && (
        <div className="settings-section">
          <h3 className="settings-section-title"><Gift size={18} /> Reward Settings</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Configure automatic reward codes issued to customers. Spans Review Flow, Billit, and Appointer.
          </p>

          <div className="toggle-field" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div>
              <div className="toggle-field-label">Enable Rewards System</div>
              <div className="toggle-field-desc">Master switch to turn all reward programs ON or OFF globally.</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={rewardsEnabled} onChange={(e) => setRewardsEnabled(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          {rewardsEnabled && (
            <>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>Triggers</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {(['feedback', 'bill_created', 'appointment_completed'] as const).map((key) => (
                  <div className="toggle-field" key={key}>
                <div className="toggle-field-label">
                  {key === 'feedback' ? 'After giving feedback (Review Flow)' : key === 'bill_created' ? 'After bill payment (Billit)' : 'After appointment (Appointer)'}
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={rewardTriggers[key]} onChange={(e) => setRewardTriggers({ ...rewardTriggers, [key]: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
          </div>

          <div className="settings-row">
            <div className="input-group">
              <label className="input-label">Reward Type</label>
              <select className="input-field" value={rewardType} onChange={(e) => setRewardType(e.target.value)}>
                <option value="percent_discount">% Discount</option>
                <option value="flat_discount">Flat ₹ Off</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Value ({rewardType === 'percent_discount' ? '%' : '₹'})</label>
              <input className="input-field" type="number" min={1} max={rewardType === 'percent_discount' ? 100 : 5000} value={rewardValue} onChange={(e) => setRewardValue(Number(e.target.value))} />
            </div>
          </div>

          <div className="settings-row">
            <div className="input-group">
              <label className="input-label">Max Rewards per Customer per Day</label>
              <input className="input-field" type="number" min={1} max={10} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
            </div>
          </div>

          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)', marginTop: 'var(--space-4)' }}>Review Reward Policy</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input type="radio" name="rewardMode" value="all_feedback" checked={reviewRewardMode === 'all_feedback'} onChange={() => setReviewRewardMode('all_feedback')} />
              Reward all feedback (recommended)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input type="radio" name="rewardMode" value="positive_only" checked={reviewRewardMode === 'positive_only'} onChange={() => setReviewRewardMode('positive_only')} />
              Reward positive reviews only (4-5★)
            </label>
          </div>
              {reviewRewardMode === 'positive_only' && (
                <div className="risk-note">
                  <AlertTriangle size={14} style={{ verticalAlign: -2 }} /> <strong>Policy Risk:</strong> Rewarding only positive reviews may violate Google&apos;s review policies and could lead to review removal or penalties. &quot;Reward all feedback&quot; is the safer default.
                </div>
              )}
            </>
          )}

          <button className="btn btn-primary" onClick={handleSaveRewards} disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Track 1
          </button>
        </div>
      )}

      {/* Track 2 — Loyalty Milestones */}
      {tab === 'rewards' && (
        <div className="settings-section" style={{ marginTop: 'var(--space-4)' }}>
          <h3 className="settings-section-title"><Trophy size={18} /> Loyalty Program (Track 2)</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Milestone-based rewards — customers earn a reward after a set number of visits or spend amount.
          </p>

          <div className="toggle-field" style={{ marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="toggle-field-label">Enable Loyalty Program</div>
              <div className="toggle-field-desc">Customers see progress on their digital bill</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={track2Enabled} onChange={(e) => setTrack2Enabled(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          {track2Enabled && (
            <>
              <div className="settings-row">
                <div className="input-group">
                  <label className="input-label">Goal Type</label>
                  <select className="input-field" value={track2GoalType} onChange={(e) => setTrack2GoalType(e.target.value as any)}>
                    <option value="visits">Number of Visits</option>
                    <option value="spend">Total Spend (₹)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Goal Value ({track2GoalType === 'visits' ? 'visits' : '₹'})</label>
                  <input className="input-field" type="number" min={2} max={track2GoalType === 'visits' ? 50 : 50000}
                    value={track2GoalValue} onChange={(e) => setTrack2GoalValue(Number(e.target.value))} />
                </div>
              </div>
              <div className="settings-row">
                <div className="input-group">
                  <label className="input-label">Reward Type</label>
                  <select className="input-field" value={track2RewardType} onChange={(e) => setTrack2RewardType(e.target.value as any)}>
                    <option value="flat_discount">Flat ₹ Discount</option>
                    <option value="free_item">Free Item (from catalog)</option>
                  </select>
                </div>
                {track2RewardType === 'flat_discount' && (
                  <div className="input-group">
                    <label className="input-label">Discount Amount (₹)</label>
                    <input className="input-field" type="number" min={1} max={5000}
                      value={track2FlatValue} onChange={(e) => setTrack2FlatValue(Number(e.target.value))} />
                  </div>
                )}
                {track2RewardType === 'free_item' && (
                  <div className="input-group">
                    <label className="input-label">Free Item Name</label>
                    <input className="input-field" value={track2CatalogItemName}
                      onChange={(e) => setTrack2CatalogItemName(e.target.value)}
                      placeholder="e.g. Regular Coffee" />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Must match a catalog item name exactly</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                One increment per customer per day (same dedup as Track 1). Reward unlocks on the next visit, never auto-applied to the bill that triggered it.
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={handleSaveLoyalty} disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Loyalty
          </button>
        </div>
      )}

      {/* Account */}
      {tab === 'account' && (
        <>
          {/* Username Change */}
          <div className="settings-section">
            <h3 className="settings-section-title"><User size={18} /> Change Username</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
              Current username: <strong>{username}</strong>
            </p>
            <div className="settings-row">
              <div className="input-group">
                <label className="input-label">New Username</label>
                <input className="input-field" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="new-username" />
              </div>
              <div className="input-group">
                <label className="input-label">Confirm with Password</label>
                <input className="input-field" type="password" value={usernamePassword} onChange={(e) => setUsernamePassword(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleChangeUsername} disabled={saving || newUsername === username} style={{ marginTop: 'var(--space-3)' }}>
              {saving ? <Loader2 size={16} className="spinner" /> : <User size={16} />} Update Username
            </button>
          </div>

          {/* Password Change */}
          <div className="settings-section">
            <h3 className="settings-section-title"><Lock size={18} /> Change Password</h3>
            <div className="settings-row full">
              <div className="input-group">
                <label className="input-label">Current Password</label>
                <input className="input-field" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
            </div>
            <div className="settings-row">
              <div className="input-group">
                <label className="input-label">New Password</label>
                <input className="input-field" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
              </div>
              <div className="input-group">
                <label className="input-label">Confirm New Password</label>
                <input className="input-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={saving} style={{ marginTop: 'var(--space-3)' }}>
              {saving ? <Loader2 size={16} className="spinner" /> : <Lock size={16} />} Change Password
            </button>
          </div>

          {/* Danger Zone */}
          <div className="settings-section danger-zone">
            <h3 className="settings-section-title"><AlertTriangle size={18} /> Danger Zone</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Deleting your account is permanent. Your data will be soft-deleted and retained for 90 days, then purged. Contact admin to reactivate within 90 days.
            </p>
            <div className="settings-row full">
              <div className="input-group">
                <label className="input-label">
                  <Trash2 size={14} style={{ verticalAlign: -2 }} /> Type <strong>&quot;DELETE&quot;</strong> or your business name (<strong>{businessName}</strong>) to confirm
                </label>
                <input
                  className="input-field"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "DELETE" or your business name'
                  style={{ borderColor: deleteConfirmText ? 'var(--color-error)' : undefined }}
                />
              </div>
            </div>
            <div className="settings-row full">
              <div className="input-group">
                <label className="input-label">Password</label>
                <input className="input-field" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </div>
            </div>
            <button
              className="btn"
              style={{ background: 'var(--color-error)', color: 'white', border: 'none', marginTop: 'var(--space-3)' }}
              onClick={handleDeleteAccount}
              disabled={
                deleting ||
                (!deleteConfirmText || (deleteConfirmText.toUpperCase() !== 'DELETE' && deleteConfirmText !== businessName)) ||
                !deletePassword
              }
            >
              {deleting ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />} Delete My Account
            </button>
          </div>
        </>
      )}
    </div>
  );
}
