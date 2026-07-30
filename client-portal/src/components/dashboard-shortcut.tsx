'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar, FileText, LayoutGrid } from 'lucide-react';
import './dashboard-shortcut.css';

export default function DashboardShortcut() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="dashboard-shortcut-container" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {/* Dashboard Shortcut */}
      <button
        type="button"
        className="shortcut-pill-btn"
        onClick={() => router.push('/dashboard')}
        style={{
          background: pathname === '/dashboard' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          color: pathname === '/dashboard' ? 'var(--color-accent-text, #ffffff)' : 'var(--color-sidebar-text)',
          border: '1px solid var(--color-sidebar-divider)'
        }}
        title="Dashboard"
      >
        <LayoutGrid size={13} />
        <span>Dashboard</span>
      </button>

      {/* POS New Bill Shortcut */}
      <button
        type="button"
        className="shortcut-pill-btn"
        onClick={() => router.push('/dashboard/billit/create')}
        style={{
          background: pathname.includes('/billit/create') ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          color: pathname.includes('/billit/create') ? 'var(--color-accent-text, #ffffff)' : 'var(--color-sidebar-text)',
          border: '1px solid var(--color-sidebar-divider)'
        }}
        title="Create New Bill (POS Shortcut F2)"
      >
        <FileText size={13} />
        <span>+ New Bill</span>
      </button>

      {/* Appointer Book Shortcut */}
      <button
        type="button"
        className="shortcut-pill-btn"
        onClick={() => router.push('/dashboard/appointer/create')}
        style={{
          background: pathname.includes('/appointer/create') ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          color: pathname.includes('/appointer/create') ? 'var(--color-accent-text, #ffffff)' : 'var(--color-sidebar-text)',
          border: '1px solid var(--color-sidebar-divider)'
        }}
        title="Book Appointment (Appointer Shortcut F8)"
      >
        <Calendar size={13} />
        <span>+ Book</span>
      </button>
    </div>
  );
}
