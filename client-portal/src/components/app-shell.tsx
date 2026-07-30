'use client';

/**
 * BillDoor — App Shell (§6)
 *
 * Wraps all /dashboard/* routes.
 * - Dark sidebar nav (module-aware — only shows enabled modules)
 * - Fixed display order: Dashboard → Billit → Appointer → Review Flow → WhatsApp Auto → [divider] → Orbitex Services → Settings
 * - Build order ≠ display order: display follows how a business owner thinks about their day
 * - Collapsible to icon-only (persisted in localStorage)
 * - Top bar: page title, notification bell, theme toggle, user menu, logout
 * - Mobile: sidebar becomes bottom tab bar
 */

import { useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Star, Receipt, CalendarClock, MessageSquare,
  Briefcase, Settings, Bell, Moon, Sun, LogOut, PanelLeftClose,
  PanelLeft, DoorOpen, ChevronRight, Menu, X, ArrowLeft, QrCode, AlertTriangle
} from 'lucide-react';
import { fetchUnreadCountAction } from '@/app/dashboard/notifications/actions';
import DashboardShortcut from '@/components/dashboard-shortcut';
import './app-shell.css';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  moduleKey?: string; // if set, only show when this module is enabled
  dividerBefore?: boolean; // visual separator before this item
}

// Display order per spec §10: Dashboard → Billit → Appointer → Review Flow → WhatsApp Auto → [divider] → Orbitex Services → Settings
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { key: 'billit', label: 'Billit', href: '/dashboard/billit', icon: <Receipt size={20} />, moduleKey: 'billit' },
  { key: 'appointer', label: 'Appointer', href: '/dashboard/appointer', icon: <CalendarClock size={20} />, moduleKey: 'appointer' },
  { key: 'reviews', label: 'Review Flow', href: '/dashboard/reviews', icon: <Star size={20} />, moduleKey: 'review_flow' },
  { key: 'whatsapp', label: 'WhatsApp Auto', href: '/dashboard/whatsapp', icon: <MessageSquare size={20} />, moduleKey: 'whatsapp_auto' },
  { key: 'services', label: 'Orbitex Services', href: '/dashboard/services', icon: <Briefcase size={20} />, dividerBefore: true },
  { key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: <Settings size={20} /> },
];

import { Store } from 'lucide-react';
import { fetchMyShopsAction, setActiveShopAction } from '@/app/dashboard/actions';

interface AppShellProps {
  children: ReactNode;
  businessName: string;
  clientSlug?: string;
  logoUrl?: string | null;
  modulesEnabled: Record<string, boolean>;
  notificationCount?: number;
  subscriptionHoldEnabled?: boolean;
  directoryAccessEnabled?: boolean;
}

export default function AppShell({
  children, businessName, clientSlug = '', logoUrl, modulesEnabled, notificationCount = 0,
  subscriptionHoldEnabled = false, directoryAccessEnabled = true
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [unreadCount, setUnreadCount] = useState(notificationCount || 0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Multi-shop state
  const [shops, setShops] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [canSwitchShops, setCanSwitchShops] = useState(false);

  useEffect(() => {
    async function checkShops() {
      const res = await fetchMyShopsAction();
      if (res.canSwitch && res.shops.length > 1) {
        setShops(res.shops);
        setActiveShopId(res.activeShopId);
        setCanSwitchShops(true);
      }
    }
    checkShops();
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('billdoor-sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    const savedTheme = localStorage.getItem('billdoor-theme');
    if (savedTheme === 'dark') {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    async function loadUnreadCount() {
      const { count } = await fetchUnreadCountAction();
      setUnreadCount(count || 0);
    }
    loadUnreadCount();

    const handleSync = () => {
      loadUnreadCount();
    };
    window.addEventListener('notifications-updated', handleSync);
    return () => window.removeEventListener('notifications-updated', handleSync);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('billdoor-sidebar-collapsed', String(next));
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('billdoor-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Filter nav items by enabled modules (if on hold, hide all feature nav items)
  const visibleNav = subscriptionHoldEnabled
    ? []
    : NAV_ITEMS.filter(item => {
        if (!item.moduleKey) return true;
        return modulesEnabled[item.moduleKey] !== false;
      });

  // Determine active nav item
  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  // Page title from current nav item
  const currentNav = visibleNav.find((item) => isActive(item.href));
  const pageTitle = currentNav?.label || 'Dashboard';

  // User initials
  const initials = businessName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (!mobileOpen && deltaY > 30) {
      setMobileOpen(true);
    } else if (mobileOpen && deltaY < -30) {
      setMobileOpen(false);
    }
    touchStartY.current = null;
  };

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar Drawer */}
      <nav
        className="sidebar"
        role="navigation"
        aria-label="Main navigation"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Link href="/dashboard" className="sidebar-brand">
          <img
            src={collapsed
              ? (theme === 'dark' ? "/favicon.png" : "/logo-icon.png")
              : (theme === 'dark' ? "/logo-dark.png" : "/logo-light.png")}
            alt="BillDoor Logo"
            className="sidebar-brand-img"
          />
        </Link>

        <div className="sidebar-divider" />

        <div className="sidebar-nav">
          {visibleNav.map((item) => (
            <div key={item.key}>
              {item.dividerBefore && <div className="sidebar-divider nav-section-divider" />}
              <Link
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </Link>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {/* Theme Toggle */}
          <button 
            className={`nav-item ${collapsed ? 'collapsed-theme' : ''}`} 
            onClick={toggleTheme} 
            title={collapsed ? 'Toggle Theme' : undefined} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              width: '100%', 
              textAlign: 'left', 
              cursor: 'pointer', 
              marginTop: 'auto',
              marginBottom: 'var(--space-2)'
            }}
          >
            <span className="nav-item-icon">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </span>
            <span className="nav-item-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Logout */}
          <button 
            className="nav-item" 
            onClick={handleLogout} 
            title={collapsed ? 'Logout' : undefined}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              width: '100%', 
              textAlign: 'left', 
              cursor: 'pointer',
              color: 'var(--color-error)'
            }}
          >
            <span className="nav-item-icon">
              <LogOut size={20} />
            </span>
            <span className="nav-item-label">Logout</span>
          </button>

          <div className="sidebar-divider" style={{ margin: 'var(--space-2) 0' }} />

          <button className="sidebar-collapse-btn" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeft size={18} /> : <><PanelLeftClose size={18} /> <span className="nav-item-label">Collapse</span></>}
          </button>
        </div>

        <div id="mobile-sidebar-widget-area">
          <DashboardShortcut />
        </div>
      </nav>

      {/* Top Bar */}
      <div className="topbar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="topbar-left">
          <button 
            className="topbar-btn back-btn" 
            onClick={() => router.back()} 
            title="Go Back" 
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>

        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <div className="mobile-handle-line"></div>
        </button>
        <div className="topbar-right">
          {canSwitchShops && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Store size={16} style={{ color: 'var(--color-text-secondary)' }} />
              <select
                value={activeShopId || ''}
                onChange={async (e) => {
                  const id = e.target.value;
                  setActiveShopId(id);
                  await setActiveShopAction(id);
                  window.location.reload();
                }}
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px 8px',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notification Bell */}
          <button className="topbar-btn" title="Notifications" onClick={() => router.push('/dashboard/notifications')}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="topbar-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {/* User */}
          <div className="topbar-user">
            <div className="topbar-user-avatar" style={{ overflow: 'hidden', padding: logoUrl ? 0 : undefined }}>
              {logoUrl ? (
                <img src={logoUrl} alt={businessName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initials
              )}
            </div>
            <span>{businessName}</span>
          </div>
        </div>
      </div>

        {/* Content */}
        <main className="shell-content">
          {subscriptionHoldEnabled ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '70vh', padding: 'var(--space-6)', textAlign: 'center'
            }}>
              <div style={{
                background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl, 16px)', padding: 'var(--space-6) var(--space-8)',
                maxWidth: 520, width: '100%', boxShadow: 'var(--shadow-lg)', boxSizing: 'border-box'
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: 'var(--color-error-subtle)',
                  color: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)'
                }}>
                  <AlertTriangle size={32} />
                </div>
                <h1 style={{ fontSize: 'var(--text-2xl, 24px)', fontWeight: 'var(--weight-bold, 700)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                  Payment Due, Subscription on Hold
                </h1>
                <p style={{ fontSize: 'var(--text-md, 16px)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                  Done with payment? Contact Admin
                </p>
                <a
                  href={`https://wa.me/919422880355?text=${encodeURIComponent(`This is ${businessName}${clientSlug ? ` (${clientSlug})` : ''}\nI am done with the payment`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                    backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff',
                    padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--text-base, 16px)',
                    fontWeight: 'var(--weight-bold, 700)', borderRadius: 'var(--radius-lg, 12px)'
                  }}
                >
                  <MessageSquare size={18} /> Contact Admin
                </a>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
    </div>
  );
}
