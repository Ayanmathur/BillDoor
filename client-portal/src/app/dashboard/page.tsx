'use client';

/**
 * BillDoor — Client Dashboard (§6)
 *
 * Module-aware summary cards + quick actions.
 * Shows stats only for enabled modules.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star, Receipt, Users, TrendingUp, Eye, Plus,
  CalendarPlus, Loader2, IndianRupee, CreditCard, Copy, Download, Check, QrCode,
  Wallet, BarChart3, FileSpreadsheet, User, ExternalLink,
} from 'lucide-react';
import { fetchDashboardData } from './actions';
import ChatBubble from '@/components/ai-assistant/chat-bubble';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await fetchDashboardData();
      if (!('error' in result)) setData(result);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  const reviewStats = data?.reviewStats || { total: 0, avgRating: '0.0', positive: 0, negative: 0, unread: 0 };
  const billStats = data?.billStats || { total: 0, todayCount: 0, todayRevenue: 0 };
  const customerCount = data?.customerCount || 0;

  return (
    <div>
      {/* Summary Cards */}
      <div className="dashboard-grid">
        {/* Reviews */}
        <div className="dash-card" onClick={() => router.push('/dashboard/reviews')} style={{ cursor: 'pointer' }}>
          <div className="dash-card-header">
            <span className="dash-card-label">Average Rating</span>
            <div className="dash-card-icon" style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
              <Star size={18} />
            </div>
          </div>
          <div className="dash-card-value">{reviewStats.avgRating} ★</div>
          <div className="dash-card-sub">
            {reviewStats.total} reviews · {reviewStats.unread > 0 && <strong style={{ color: 'var(--color-accent)' }}>{reviewStats.unread} unread</strong>}
          </div>
        </div>

        <div className="dash-card" onClick={() => router.push('/dashboard/reviews')} style={{ cursor: 'pointer' }}>
          <div className="dash-card-header">
            <span className="dash-card-label">Review Funnel</span>
            <div className="dash-card-icon" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'baseline' }}>
            <div>
              <div className="dash-card-value" style={{ color: 'var(--color-success)' }}>{reviewStats.positive}</div>
              <div className="dash-card-sub">4-5★</div>
            </div>
            <div>
              <div className="dash-card-value" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-error)' }}>{reviewStats.negative}</div>
              <div className="dash-card-sub">1-3★</div>
            </div>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="dash-card" onClick={() => router.push('/dashboard/billit/reports?range=today')} style={{ cursor: 'pointer' }}>
          <div className="dash-card-header">
            <span className="dash-card-label">Today&apos;s Revenue</span>
            <div className="dash-card-icon" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
              <IndianRupee size={18} />
            </div>
          </div>
          <div className="dash-card-value">₹{billStats.todayRevenue.toLocaleString('en-IN')}</div>
          <div className="dash-card-sub">{billStats.todayCount} bills today · {billStats.total} total</div>
        </div>

        {/* Customers */}
        <div className="dash-card" onClick={() => router.push('/dashboard/billit/customers')} style={{ cursor: 'pointer' }}>
          <div className="dash-card-header">
            <span className="dash-card-label">Total Customers</span>
            <div className="dash-card-icon" style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="dash-card-value">{customerCount}</div>
          <div className="dash-card-sub">Unique phone numbers</div>
        </div>

        {/* Expenses & Reports */}
        <div className="dash-card" onClick={() => router.push('/dashboard/billit/reports')} style={{ cursor: 'pointer' }}>
          <div className="dash-card-header">
            <span className="dash-card-label">Expenses & Net</span>
            <div className="dash-card-icon" style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="dash-card-value">₹{(data?.monthExpenseTotal || 0).toLocaleString('en-IN')}</div>
          <div className="dash-card-sub">This month expenses · Reports & GST</div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-3)' }}>
        Quick Actions
      </h2>
      <div className="quick-actions">
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit/create')}>
          <Plus size={16} /> Create Bill
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/appointer/create')}>
          <CalendarPlus size={16} /> New Appointment
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/reviews')}>
          <Eye size={16} /> View Reviews
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit/customers')}>
          <Users size={16} /> Customers
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit/catalog')}>
          <Receipt size={16} /> Catalog
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit/expenses')}>
          <Wallet size={16} /> Expense Log
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit/reports')}>
          <BarChart3 size={16} /> Reports & Net
        </button>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit/reports/gst-summary')}>
          <FileSpreadsheet size={16} /> GST Summary
        </button>
      </div>

      {/* Digital Business Card Tile — two-layer toggle gated */}
      {data?.clientSlug && !((data?.dashboardTilesHidden || []) as string[]).includes('business_card') && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-3)' }}>
            <CreditCard size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} /> Digital Business Card
          </h2>
          <div className="dash-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/card/${data.clientSlug}`)}`}
                alt="Business Card QR"
                style={{ width: 100, height: 100, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/card/${data.clientSlug}` : `/card/${data.clientSlug}`}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)' }}
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/card/${data.clientSlug}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    className="btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)' }}
                    onClick={() => {
                      const url = `${window.location.origin}/card/${data.clientSlug}`;
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
                      fetch(qrUrl).then(r => r.blob()).then(blob => {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `business-card-qr-${data.clientSlug}.png`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      });
                    }}
                  >
                    <Download size={14} /> Download QR
                  </button>
                  <a
                    href={`/card/${data.clientSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', textDecoration: 'none' }}
                  >
                    <User size={14} /> Open Digital Card <ExternalLink size={12} />
                  </a>
                  <button
                    className="btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)' }}
                    onClick={() => router.push('/dashboard/settings/qr-links')}
                  >
                    <QrCode size={14} /> All QR & Links
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* AI Assistant — two-layer toggle gated */}
      {!((data?.dashboardTilesHidden || []) as string[]).includes('ai_assistant') && (
        <ChatBubble />
      )}
    </div>
  );
}
