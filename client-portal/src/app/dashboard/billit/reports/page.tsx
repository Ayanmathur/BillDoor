'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, IndianRupee, TrendingUp, TrendingDown, Minus, 
  Calendar, FileSpreadsheet, Loader2 
} from 'lucide-react';
import { fetchRevenueReportAction } from './actions';
import { fetchExpenseSummaryAction } from '../expenses/actions';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

function ReportsDashboardContent() {
  const searchParams = useSearchParams();
  const initialRange = (searchParams.get('range') as DateRange) || 'month';
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);

  const getDateFilters = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today': {
        const d = now.toISOString().split('T')[0];
        return { dateFrom: d, dateTo: d };
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: weekAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        return { dateFrom: monthStart, dateTo: now.toISOString().split('T')[0] };
      }
      case 'year': {
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        return { dateFrom: yearStart, dateTo: now.toISOString().split('T')[0] };
      }
      case 'custom':
        return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
      default:
        return {};
    }
  }, [dateRange, customFrom, customTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { dateFrom, dateTo } = getDateFilters();
    try {
      const [revRes, expRes] = await Promise.all([
        fetchRevenueReportAction(dateFrom || '', dateTo || ''),
        fetchExpenseSummaryAction(dateFrom || '', dateTo || '').catch(() => ({ totalExpenses: 0 })),
      ]);
      setRevenueData(revRes);
      setExpenseData(expRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getDateFilters]);

  useEffect(() => {
    if (dateRange !== 'custom' || (customFrom && customTo)) {
      loadData();
    }
  }, [dateRange, customFrom, customTo, loadData]);

  const totalRev = revenueData?.totalRevenue || 0;
  const totalExp = expenseData?.totalExpenses ?? (expenseData?.summary ? Object.values(expenseData.summary as Record<string, number>).reduce((a, b) => a + b, 0) : 0);
  const estimatedNet = totalRev - totalExp;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Link href="/dashboard/billit" className="quick-action-btn" style={{ padding: '6px' }}>
            <ArrowLeft size={18} />
          </Link>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>Reports & Analytics</h1>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="settings-section" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Calendar size={16} style={{ color: 'var(--color-text-tertiary)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {(['today', 'week', 'month', 'year', 'custom'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`btn ${dateRange === range ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', textTransform: 'capitalize' }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            <input type="date" className="input-field" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }} />
            <span style={{ fontSize: 'var(--text-xs)' }}>to</span>
            <input type="date" className="input-field" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }} />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Loader2 size={24} className="spinner" />
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="dashboard-grid" style={{ marginBottom: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="dash-card" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div className="dash-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="dash-card-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total Revenue</span>
                <div className="dash-card-icon" style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="dash-card-value" style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)' }}>₹{totalRev.toLocaleString('en-IN')}</div>
              <div className="dash-card-sub" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>{revenueData?.billCount || 0} bills in period</div>
            </div>

            <div className="dash-card" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div className="dash-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="dash-card-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total Expenses</span>
                <div className="dash-card-icon" style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
                  <TrendingDown size={18} />
                </div>
              </div>
              <div className="dash-card-value" style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)' }}>₹{totalExp.toLocaleString('en-IN')}</div>
              <div className="dash-card-sub" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>Recorded business expenses</div>
            </div>

            <div className="dash-card" style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <div className="dash-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="dash-card-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600 }}>Estimated Net P/L</span>
                <div className="dash-card-icon" style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-elevated)', color: estimatedNet >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {estimatedNet >= 0 ? <TrendingUp size={18} /> : <Minus size={18} />}
                </div>
              </div>
              <div className="dash-card-value" style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: estimatedNet >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                ₹{estimatedNet.toLocaleString('en-IN')}
              </div>
              <div className="dash-card-sub" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>Revenue minus Expenses</div>
            </div>
          </div>
        </>
      )}

      {/* Reports Navigation Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <Link 
          href="/dashboard/billit/expenses" 
          className="settings-section"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'inherit', background: 'var(--color-bg-elevated)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)' }}>
              <IndianRupee size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Expense Log</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Track and manage expenses</div>
            </div>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600 }}>Manage →</span>
        </Link>

        <Link 
          href="/dashboard/billit/reports/gst-summary" 
          className="settings-section"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'inherit', background: 'var(--color-bg-elevated)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)' }}>
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>GST Summary</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Rate-wise breakdown & XLSX</div>
            </div>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600 }}>View →</span>
        </Link>

        <Link 
          href="/dashboard/billit/reports/tally-export" 
          className="settings-section"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'inherit', background: 'var(--color-bg-elevated)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)' }}>
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Tally Export</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Sales vouchers for Tally</div>
            </div>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600 }}>Export →</span>
        </Link>
      </div>
    </div>
  );
}

export default function ReportsDashboard() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={24} className="spinner" /></div>}>
      <ReportsDashboardContent />
    </Suspense>
  );
}
