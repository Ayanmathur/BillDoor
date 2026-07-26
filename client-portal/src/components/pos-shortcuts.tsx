'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Download, Monitor, X } from 'lucide-react';

export default function PosShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Capture beforeinstallprompt event for PWA installation
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Register Global POS Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (e.key !== 'F2' && e.key !== 'F4') return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        router.push('/dashboard/billit/create');
      }

      if (e.key === 'F4') {
        e.preventDefault();
        if (pathname.includes('/dashboard/billit/create')) {
          const scanBtn = document.getElementById('camera-scan-btn');
          if (scanBtn) scanBtn.click();
        } else {
          router.push('/dashboard/billit/create?scan=true');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router, pathname]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Only display popup when strictly on the Settings page (/dashboard/settings) and prompt is available
  const isSettingsPage = pathname === '/dashboard/settings';
  if (!isSettingsPage || !deferredPrompt || isInstalled || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 360,
      }}
    >
      <div style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', padding: 8, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
        <Monitor size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)' }}>
          Install BillDoor Web App
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
          Install for fast desktop & mobile home screen access.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-primary"
          onClick={handleInstallClick}
          style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Download size={14} /> Install
        </button>
        <button
          className="bills-action-btn"
          onClick={() => setDismissed(true)}
          style={{ padding: 4 }}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
