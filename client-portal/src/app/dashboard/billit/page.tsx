'use client';

/**
 * Billit — Module Landing Page
 *
 * Quick-nav to Create Bill, Catalog, Customers, Bills history, and Settings.
 */

import { useRouter } from 'next/navigation';
import { Plus, Package, Users, FileText, Settings, DollarSign, TrendingUp, FileSpreadsheet, LayoutTemplate } from 'lucide-react';

export default function BillitPage() {
  const router = useRouter();

  const actions = [
    { label: 'Create Bill', icon: <Plus size={20} />, route: '/dashboard/billit/create', desc: 'New invoice for a customer', accent: true },
    { label: 'Bills', icon: <FileText size={20} />, route: '/dashboard/billit/bills', desc: 'View all bills & drafts' },
    { label: 'Catalog', icon: <Package size={20} />, route: '/dashboard/billit/catalog', desc: 'Products & services' },
    { label: 'Customers', icon: <Users size={20} />, route: '/dashboard/billit/customers', desc: 'Search customers & history' },
    { label: 'Expense Log', icon: <DollarSign size={20} />, route: '/dashboard/billit/expenses', desc: 'Track & log business expenses' },
    { label: 'Reports & Net', icon: <TrendingUp size={20} />, route: '/dashboard/billit/reports', desc: 'Revenue, expenses & net estimate' },
    { label: 'GST Summary', icon: <FileSpreadsheet size={20} />, route: '/dashboard/billit/reports/gst-summary', desc: 'Rate-wise GST breakdown & XLSX' },
    { label: 'Bill Templates', icon: <LayoutTemplate size={20} />, route: '/dashboard/billit/settings/bill-templates', desc: 'Customize WhatsApp templates' },
    { label: 'Settings', icon: <Settings size={20} />, route: '/dashboard/billit/settings', desc: 'Barcode & preferences' },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
        <FileText size={22} style={{ verticalAlign: -4, marginRight: 'var(--space-2)' }} /> Billit
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={a.accent ? 'btn btn-primary' : 'quick-action-btn'}
            onClick={() => router.push(a.route)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)',
              padding: 'var(--space-4)', textAlign: 'left', height: 'auto',
              ...(a.accent ? {} : { border: '1px solid var(--color-border)' }),
            }}
          >
            {a.icon}
            <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>{a.label}</span>
            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.7, fontWeight: 'var(--weight-normal)' }}>{a.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
