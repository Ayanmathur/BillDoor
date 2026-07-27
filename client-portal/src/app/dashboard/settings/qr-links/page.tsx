'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Download, Check, QrCode, ExternalLink, Loader2 } from 'lucide-react';
import { fetchQrLinksDataAction } from './actions';
import './qr-links.css';

export default function QrLinksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    async function load() {
      const res = await fetchQrLinksDataAction();
      if (!res.error) {
        setData(res);
      }
      setLoading(false);
    }
    load();
  }, []);

  function copyLink(path: string, key: string) {
    const url = `${origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function downloadQR(path: string, key: string) {
    const url = `${origin}${path}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    fetch(qrUrl)
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${key}-qr-${data.slug}.png`;
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

  if (!data) {
    return (
      <div className="settings-page">
        <button className="btn" onClick={() => router.push('/dashboard/settings')}>
          <ArrowLeft size={16} /> Back to Settings
        </button>
        <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-error)' }}>
          Error loading QR Links data.
        </p>
      </div>
    );
  }

  const activeLinks = data.links.filter((l: any) => l.active);
  const inactiveLinks = data.links.filter((l: any) => !l.active);

  return (
    <div className="settings-page qr-links-page">
      <button
        className="btn"
        onClick={() => router.push('/dashboard/settings')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)',
        }}
      >
        <ArrowLeft size={16} /> Back to Settings
      </button>

      <div className="settings-section">
        <h2 className="settings-section-title">
          <QrCode size={20} /> QR Codes & Links
        </h2>
        <p className="qr-links-subtitle">
          All your public links in one place. Download QR codes or copy links to share.
        </p>

        <div className="qr-cards-grid">
          {activeLinks.map((link: any) => {
            const url = `${origin}${link.path}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
            const isCopied = copiedKey === link.key;

            return (
              <div key={link.key} className="qr-card">
                <div className="qr-card-header">
                  <h3>{link.label}</h3>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="external-link-icon" title="Open in new tab">
                    <ExternalLink size={16} />
                  </a>
                </div>
                <div className="qr-card-content">
                  <div className="qr-image-wrapper">
                    <img src={qrUrl} alt={`${link.label} QR Code`} width={120} height={120} />
                  </div>
                  <div className="qr-card-actions">
                    <div className="url-display" title={url}>{url}</div>
                    <div className="btn-group">
                      <button className="btn" onClick={() => copyLink(link.path, link.key)}>
                        {isCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        {isCopied ? 'Copied' : 'Copy Link'}
                      </button>
                      <button className="btn btn-primary" onClick={() => downloadQR(link.path, link.key)}>
                        <Download size={14} /> Download QR
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Open in new tab">
                        <ExternalLink size={14} /> Open Link
                      </a>
                    </div>
                    <div className="qr-suggestion">{link.suggestion}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {inactiveLinks.length > 0 && (
          <div className="inactive-links-section">
            <h3 className="inactive-links-title">Inactive Links</h3>
            <p className="inactive-links-subtitle">Enable these features in your Settings to use them.</p>
            <div className="qr-cards-grid inactive-grid">
              {inactiveLinks.map((link: any) => (
                <div key={link.key} className="qr-card inactive-card">
                  <div className="qr-card-header">
                    <h3>{link.label}</h3>
                  </div>
                  <div className="qr-card-content">
                    <div className="qr-image-wrapper placeholder">
                      <QrCode size={40} className="text-muted" />
                    </div>
                    <div className="qr-card-actions">
                      <div className="url-display text-muted">{origin}{link.path}</div>
                      <div className="qr-suggestion">Enable this in Settings</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
