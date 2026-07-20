'use client';

/**
 * Billit — Settings Page
 *
 * Barcode system toggle and module-level preferences.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Barcode, Save, Loader2, Check, Link as LinkIcon, MessageSquare, Copy, ExternalLink, Percent, Tag, Send } from 'lucide-react';
import {
  fetchBillitSettingsAction,
  updateBillitSettingsAction,
  updateCatalogTemplateAction,
  fetchBillWhatsAppTemplateAction,
  updateBillWhatsAppTemplateAction
} from './actions';

export default function BillitSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [defaultGst, setDefaultGst] = useState(0);
  const [defaultDiscountType, setDefaultDiscountType] = useState('₹');
  const [defaultDiscountValue, setDefaultDiscountValue] = useState(0);

  const [slug, setSlug] = useState('');
  const [catalogViewerEnabled, setCatalogViewerEnabled] = useState(false);
  const [catalogTemplate, setCatalogTemplate] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [copied, setCopied] = useState(false);

  // Bill WhatsApp template
  const [billTemplate, setBillTemplate] = useState('Dear {customer_name}, thanks for shopping at {shop_name}! Your digital bill: {bill_link}');
  const [savingBillTemplate, setSavingBillTemplate] = useState(false);
  const [billTemplateError, setBillTemplateError] = useState('');

  useEffect(() => {
    async function load() {
      const result = await fetchBillitSettingsAction();
      if (result.settings) {
        setBarcodeEnabled(result.settings.barcode_enabled ?? false);
        setDefaultGst(result.settings.bill_settings?.default_gst ?? 0);
        setDefaultDiscountType(result.settings.bill_settings?.default_discount_type ?? '₹');
        setDefaultDiscountValue(result.settings.bill_settings?.default_discount_value ?? 0);
        setSlug(result.settings.slug || '');
        setCatalogTemplate(result.settings.whatsapp_catalog_template || "Hi! I'm interested in {item_name}. Is it available?");
        setCatalogViewerEnabled(result.settings.modules_enabled?.quick_tools?.catalog_viewer === true);
      }
      setLoading(false);
    }
    async function loadBillTemplate() {
      const res = await fetchBillWhatsAppTemplateAction();
      if (res.template?.content) setBillTemplate(res.template.content);
    }
    load();
    loadBillTemplate();
  }, []);

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = await updateBillitSettingsAction({ 
      barcodeEnabled,
      defaultGst,
      defaultDiscountType,
      defaultDiscountValue
    });
    if (result.error) setError(result.error);
    else flash();
    setSaving(false);
  }

  async function handleSaveTemplate() {
    if (!catalogTemplate.includes('{item_name}')) {
      setTemplateError('Template must contain {item_name}');
      return;
    }
    setSavingTemplate(true);
    setTemplateError('');
    const result = await updateCatalogTemplateAction(catalogTemplate);
    if (result.error) setTemplateError(result.error);
    else flash();
    setSavingTemplate(false);
  }

  function copyLink() {
    const url = `${window.location.origin}/catalog/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQR() {
    const url = `${window.location.origin}/catalog/${slug}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    fetch(qrUrl)
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `catalog-qr-${slug}.png`;
        link.click();
      });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  const catalogUrl = typeof window !== 'undefined' ? `${window.location.origin}/catalog/${slug}` : '';

  return (
    <div className="settings-page">
      {/* Back button */}
      <button
        className="btn"
        onClick={() => router.push('/dashboard/billit')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)',
        }}
      >
        <ArrowLeft size={16} /> Back to Billit
      </button>

      {/* Status Messages */}
      {error && (
        <div
          style={{
            padding: 'var(--space-3)', background: 'var(--color-error-subtle)',
            color: 'var(--color-error)', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      {saved && (
        <div
          style={{
            padding: 'var(--space-3)', background: 'var(--color-success-subtle)',
            color: 'var(--color-success)', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}
        >
          <Check size={16} /> Saved successfully
        </div>
      )}

      {/* Barcode Section */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          <Barcode size={18} /> Barcode System
        </h3>

        <div className="toggle-field">
          <div>
            <div className="toggle-field-label">Enable Barcode System</div>
            <div className="toggle-field-desc">
              Auto-generate Code128 barcodes for catalog items
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={barcodeEnabled}
              onChange={(e) => setBarcodeEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {barcodeEnabled && (
          <div
            style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
              marginTop: 'var(--space-3)', padding: 'var(--space-2)',
              background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)',
            }}
          >
            When enabled, catalog items will auto-generate Code128 barcodes and a barcode
            scanner input appears in Bill Creation.
          </div>
        )}

        <div style={{ marginTop: 'var(--space-6)' }}>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)' }}>
            <Tag size={16} style={{ display: 'inline', verticalAlign: -3, marginRight: 4 }} /> Default Pricing & Taxes
          </h4>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="input-label">Default GST (%)</label>
              <input 
                className="input-field" 
                type="number" 
                min={0} 
                max={100} 
                value={defaultGst} 
                onChange={(e) => setDefaultGst(Number(e.target.value))} 
                placeholder="e.g. 18" 
              />
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="input-label">Default Discount Type</label>
              <select 
                className="input-field" 
                value={defaultDiscountType} 
                onChange={(e) => setDefaultDiscountType(e.target.value)}
              >
                <option value="₹">Flat ₹ Off</option>
                <option value="%">% Off</option>
              </select>
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="input-label">Default Discount Value</label>
              <input 
                className="input-field" 
                type="number" 
                min={0} 
                value={defaultDiscountValue} 
                onChange={(e) => setDefaultDiscountValue(Number(e.target.value))} 
                placeholder="e.g. 50" 
              />
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ marginTop: 'var(--space-4)' }}
        >
          {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Settings
        </button>
      </div>

      {/* Bill WhatsApp Template Section */}
      <div className="settings-section" style={{ marginTop: 'var(--space-6)' }}>
        <h3 className="settings-section-title">
          <Send size={18} /> Bill WhatsApp Template
        </h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
          This message is sent when you click &quot;Send on WhatsApp&quot; after creating a bill.
        </p>

        {billTemplateError && (
          <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }} role="alert">
            {billTemplateError}
          </div>
        )}

        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>Message Template</label>
          <textarea
            value={billTemplate}
            onChange={e => setBillTemplate(e.target.value)}
            placeholder="Dear {customer_name}, thanks for shopping at {shop_name}! Your digital bill: {bill_link}"
            style={{ width: '100%', minHeight: 100, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span>Available: </span>
            <code style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '4px' }}>{'{customer_name}'}</code>
            <code style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '4px' }}>{'{shop_name}'}</code>
            <code style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '4px' }}>{'{bill_link}'}</code>
            <code style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '4px' }}>{'{review_link}'}</code>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={async () => {
            if (!billTemplate.includes('{bill_link}')) {
              setBillTemplateError('Template must contain {bill_link}');
              return;
            }
            setSavingBillTemplate(true);
            setBillTemplateError('');
            const res = await updateBillWhatsAppTemplateAction(billTemplate);
            if (res.error) setBillTemplateError(res.error);
            else flash();
            setSavingBillTemplate(false);
          }}
          disabled={savingBillTemplate}
        >
          {savingBillTemplate ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Template
        </button>
      </div>

      {catalogViewerEnabled && (
        <>
          {/* Digital Catalog Link Section */}
          <div className="settings-section" style={{ marginTop: 'var(--space-6)' }}>
            <h3 className="settings-section-title">
              <LinkIcon size={18} /> Digital Catalog Link
            </h3>
            
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>Catalog URL</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input 
                  type="text" 
                  value={catalogUrl} 
                  readOnly 
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }} 
                />
                <button className={`copy-open-btn-custom ${copied ? 'copied' : ''}`} onClick={copyLink} title="Copy link">
                  <span className="text">{copied ? 'Copied' : 'Copy'}</span>
                  <span className="icon">
                    {copied ? (
                      <svg viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 384 512" className="fill-icon">
                        <path d="M280 64h40c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128C0 92.7 28.7 64 64 64h40 9.6C121 27.5 153.3 0 192 0s71 27.5 78.4 64H280zM64 112c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16H320c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H304v24c0 13.3-10.7 24-24 24H192 104c-13.3 0-24-10.7-24-24V112H64zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z" />
                      </svg>
                    )}
                  </span>
                </button>
                <a href={catalogUrl} target="_blank" rel="noopener noreferrer" className="copy-open-btn-custom" title="Open link">
                  <span className="text">Open</span>
                  <span className="icon">
                    <ExternalLink size={16} color="white" />
                  </span>
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Catalog QR Code</label>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(catalogUrl)}`} 
                alt="Catalog QR Code" 
                style={{ width: 120, height: 120, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} 
              />
              <button className="btn" onClick={downloadQR}>Download QR</button>
            </div>
          </div>

          {/* Catalog WhatsApp Template Section */}
          <div className="settings-section" style={{ marginTop: 'var(--space-6)' }}>
            <h3 className="settings-section-title">
              <MessageSquare size={18} /> Catalog WhatsApp Template
            </h3>

            {templateError && (
              <div
                style={{
                  padding: 'var(--space-3)', background: 'var(--color-error-subtle)',
                  color: 'var(--color-error)', borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
                }}
                role="alert"
              >
                {templateError}
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>Message Template</label>
              <textarea 
                value={catalogTemplate}
                onChange={e => setCatalogTemplate(e.target.value)}
                placeholder="Hi! I'm interested in {item_name}. Is it available?"
                style={{ width: '100%', minHeight: 80, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                Must contain <code style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '4px' }}>{'{item_name}'}</code>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Template
            </button>
          </div>
        </>
      )}
    </div>
  );
}
