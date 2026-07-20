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
  CalendarPlus, Loader2, IndianRupee,
} from 'lucide-react';
import { fetchDashboardData } from './actions';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

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

        <div className="dash-card">
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
        <div className="dash-card" onClick={() => router.push('/dashboard/billit')} style={{ cursor: 'pointer' }}>
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
      </div>
    </div>
  );
}
