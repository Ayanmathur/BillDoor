'use client';

/**
 * Billit — Module Landing Page
 *
 * Featured 4-slot Create Bill hero tile on the left (desktop) / top (mobile),
 * flanked by 6 standard quick action tiles (2 per row on mobile, 4-col grid on desktop).
 */

import { useRouter } from 'next/navigation';
import { Plus, Package, Users, FileText, Settings, Wallet, LayoutTemplate } from 'lucide-react';

export default function BillitPage() {
  const router = useRouter();

  const standardActions = [
    { label: 'Bills', icon: <FileText size={20} />, route: '/dashboard/billit/bills', desc: 'View all bills & drafts' },
    { label: 'Catalog', icon: <Package size={20} />, route: '/dashboard/billit/catalog', desc: 'Products & services' },
    { label: 'Customers', icon: <Users size={20} />, route: '/dashboard/billit/customers', desc: 'Search customers & history' },
    { label: 'Financials', icon: <Wallet size={20} />, route: '/dashboard/billit/reports', desc: 'Expense log, net profit & GST summary' },
    { label: 'Bill Templates', icon: <LayoutTemplate size={20} />, route: '/dashboard/billit/settings/bill-templates', desc: 'Customize WhatsApp templates' },
    { label: 'Settings', icon: <Settings size={20} />, route: '/dashboard/billit/settings', desc: 'Barcode & preferences' },
  ];

  return (
    <div>
      <style>{`
        .billit-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
        }
        .billit-hero-tile {
          grid-column: span 2;
          grid-row: span 2;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          padding: var(--space-5);
          text-align: left;
          min-height: 180px;
          border-radius: var(--radius-lg);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .billit-hero-tile:hover {
          transform: translateY(-2px);
        }
        @media (min-width: 768px) {
          .billit-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .billit-hero-tile {
            min-height: 200px;
          }
        }
      `}</style>

      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
        <FileText size={22} style={{ verticalAlign: -4, marginRight: 'var(--space-2)' }} /> Billit
      </h2>

      <div className="billit-grid">
        {/* Create Bill Hero Tile (Spans 2 cols x 2 rows = 4 tile slots at top on Mobile, left on Desktop) */}
        <button
          className="btn btn-primary billit-hero-tile"
          onClick={() => router.push('/dashboard/billit/create')}
        >
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: 'var(--radius-md)', display: 'inline-flex' }}>
            <Plus size={32} />
          </div>
          <div>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)', marginBottom: '4px' }}>Create New Bill</div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.9, fontWeight: 'var(--weight-normal)', lineHeight: 1.4 }}>
              Fast POS billing, item selection, GST calculation & instant WhatsApp receipts.
            </div>
          </div>
        </button>

        {/* 6 Standard Actions (2 per row on mobile) */}
        {standardActions.map((a) => (
          <button
            key={a.label}
            className="quick-action-btn"
            onClick={() => router.push(a.route)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              padding: 'var(--space-4)',
              textAlign: 'left',
              height: 'auto',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
            }}
          >
            {a.icon}
            <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>{a.label}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--weight-normal)' }}>{a.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
