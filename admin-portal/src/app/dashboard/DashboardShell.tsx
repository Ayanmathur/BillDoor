'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings, 
  Sun, 
  Moon, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell
} from 'lucide-react';
import { adminLogoutAction } from '@/app/login/actions';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('billdoor-admin-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('billdoor-admin-theme', newTheme);
  };

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clients', href: '/dashboard/clients', icon: Briefcase },
    { name: 'Portfolio', href: '/dashboard/portfolio', icon: Briefcase },
    { name: 'Audit Logs', href: '/dashboard/audit', icon: FileText },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <img src={collapsed ? "/favicon.png" : "/logo-dark.png"} alt="BillDoor" className="sidebar-logo" />
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Precise active state matching
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link key={item.name} href={item.href} className={`sidebar-nav-item ${isActive ? 'active' : ''}`}>
                <Icon className="sidebar-nav-icon" />
                <span className="sidebar-nav-label">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="sidebar-nav-label">Collapse</span>}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topnav">
          <div className="topnav-left">
            <span className="topnav-breadcrumb">Admin Dashboard</span>
          </div>
          <div className="topnav-right">
            <button className="topnav-btn" onClick={toggleTheme} aria-label="Toggle Theme">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
            <button className="topnav-btn" aria-label="Notifications">
              <Bell />
              <span className="notification-badge"></span>
            </button>
            <form action={adminLogoutAction}>
              <button type="submit" className="topnav-btn" aria-label="Logout">
                <LogOut />
              </button>
            </form>
          </div>
        </header>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
