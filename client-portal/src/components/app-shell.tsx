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

import { useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Star, Receipt, CalendarClock, MessageSquare,
  Briefcase, Settings, Bell, Moon, Sun, LogOut, PanelLeftClose,
  PanelLeft, DoorOpen, ChevronRight,
} from 'lucide-react';
import { fetchUnreadCountAction } from '@/app/dashboard/notifications/actions';
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
// This order follows how a business owner thinks about their day, NOT the build order.
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { key: 'billit', label: 'Billit', href: '/dashboard/billit', icon: <Receipt size={20} />, moduleKey: 'billit' },
  { key: 'appointer', label: 'Appointer', href: '/dashboard/appointer', icon: <CalendarClock size={20} />, moduleKey: 'appointer' },
  { key: 'reviews', label: 'Review Flow', href: '/dashboard/reviews', icon: <Star size={20} />, moduleKey: 'review_flow' },
  { key: 'whatsapp', label: 'WhatsApp Auto', href: '/dashboard/whatsapp', icon: <MessageSquare size={20} />, moduleKey: 'whatsapp_auto' },
  { key: 'services', label: 'Orbitex Services', href: '/dashboard/services', icon: <Briefcase size={20} />, dividerBefore: true },
  { key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: <Settings size={20} /> },
];

interface AppShellProps {
  children: ReactNode;
  businessName: string;
  modulesEnabled: Record<string, boolean>;
  notificationCount?: number;
}

export default function AppShell({ children, businessName, modulesEnabled, notificationCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [unreadCount, setUnreadCount] = useState(notificationCount || 0);

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

  // Filter nav by enabled modules
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.moduleKey) return true;
    return modulesEnabled[item.moduleKey] === true;
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

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar */}
      <nav className="sidebar" role="navigation" aria-label="Main navigation">
        <Link href="/dashboard" className="sidebar-brand" style={{ padding: collapsed ? 'var(--space-4) 0' : 'var(--space-4)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          {collapsed ? (
            <img src="/logo-icon.png" alt="BillDoor Logo" style={{ height: '32px', width: 'auto' }} />
          ) : (
            <img src="/logo-dark.png" alt="BillDoor Logo" style={{ height: '28px', width: 'auto' }} />
          )}
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
          <button className="sidebar-collapse-btn" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeft size={18} /> : <><PanelLeftClose size={18} /> <span className="nav-item-label">Collapse</span></>}
          </button>
        </div>
      </nav>

      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar-left">
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>
        <div className="topbar-right">
          {/* Notification Bell */}
          <button className="topbar-btn" title="Notifications" onClick={() => router.push('/dashboard/notifications')}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="topbar-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {/* Theme Toggle */}
          <button className="topbar-btn" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Logout */}
          <button className="topbar-btn" title="Logout" onClick={handleLogout}>
            <LogOut size={18} />
          </button>

          {/* User */}
          <div className="topbar-user">
            <div className="topbar-user-avatar">{initials}</div>
            <span>{businessName}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="shell-content">
        {children}
      </main>
    </div>
  );
}
