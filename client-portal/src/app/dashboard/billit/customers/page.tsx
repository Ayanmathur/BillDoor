'use client';

/**
 * Billit — Customers Screen (§5.4)
 *
 * Shared customer list (deduplicated per phone per client).
 * Searchable by name/phone. Date-filterable (Today/Week/Month/Custom).
 * Click-through to single customer history.
 * Also the WhatsApp broadcast audience picker.
 * Deliberately lightweight — no tags, no notes, no pipeline. Operations platform, not CRM.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Users, Phone, Calendar, IndianRupee, ChevronRight,
  Loader2, MessageSquare, ArrowLeft,
} from 'lucide-react';
import { fetchCustomersAction, fetchCustomerDetailAction } from './actions';

type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loyaltyMap, setLoyaltyMap] = useState<Record<string, number>>({});
  const [loyaltyGoal, setLoyaltyGoal] = useState(0);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerBills, setCustomerBills] = useState<any[]>([]);
  const [customerReviews, setCustomerReviews] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const getDateFilters = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today': { const d = now.toISOString().split('T')[0]; return { dateFrom: d, dateTo: d }; }
      case 'week': { return { dateFrom: new Date(now.getTime() - 7 * 864e5).toISOString().split('T')[0], dateTo: now.toISOString().split('T')[0] }; }
      case 'month': { return { dateFrom: new Date(now.getTime() - 30 * 864e5).toISOString().split('T')[0], dateTo: now.toISOString().split('T')[0] }; }
      case 'custom': return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
      default: return {};
    }
  }, [dateRange, customFrom, customTo]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const filters = { ...getDateFilters(), search: search || undefined };
    const result = await fetchCustomersAction(filters);
    if (result.customers) { setCustomers(result.customers as Customer[]); setTotal(result.total); }
    if (result.loyaltyMap) setLoyaltyMap(result.loyaltyMap);
    if (result.loyaltyGoal) setLoyaltyGoal(result.loyaltyGoal);
    setLoyaltyEnabled(result.loyaltyEnabled || false);
    setLoading(false);
  }, [getDateFilters, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  async function openDetail(customer: Customer) {
    setDetailLoading(true);
    setSelectedCustomer(customer);
    const result = await fetchCustomerDetailAction(customer.id);
    if (result.bills) setCustomerBills(result.bills);
    if (result.reviews) setCustomerReviews(result.reviews);
    setDetailLoading(false);
  }

  // Detail view
  if (selectedCustomer) {
    return (
      <div>
        <button className="quick-action-btn" onClick={() => setSelectedCustomer(null)} style={{ marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={14} /> Back to Customers
        </button>
        <div className="settings-section">
          <h3 className="settings-section-title" style={{ marginBottom: 'var(--space-3)' }}>
            <Users size={18} /> {selectedCustomer.name}
            {/* Customer Value Tag */}
            <span style={{
              marginLeft: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: (selectedCustomer.total_visits >= 10 || selectedCustomer.total_spent >= 5000) ? 'hsl(38 90% 90%)' : 'var(--color-bg-secondary)',
              color: (selectedCustomer.total_visits >= 10 || selectedCustomer.total_spent >= 5000) ? 'hsl(38 80% 30%)' : 'var(--color-text-tertiary)',
              fontWeight: 'var(--weight-medium)',
            }}>
              {(selectedCustomer.total_visits >= 10 || selectedCustomer.total_spent >= 5000) ? 'Top Customer' : 'Regular'}
            </span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="dash-card" style={{ padding: 'var(--space-3)' }}>
              <div className="dash-card-label"><Phone size={12} /> Phone</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginTop: 4 }}>{selectedCustomer.phone}</div>
            </div>
            <div className="dash-card" style={{ padding: 'var(--space-3)' }}>
              <div className="dash-card-label">Total Visits</div>
              <div className="dash-card-value" style={{ fontSize: 'var(--text-lg)' }}>{selectedCustomer.total_visits}</div>
            </div>
            <div className="dash-card" style={{ padding: 'var(--space-3)' }}>
              <div className="dash-card-label">Total Spent</div>
              <div className="dash-card-value" style={{ fontSize: 'var(--text-lg)' }}>₹{selectedCustomer.total_spent.toLocaleString('en-IN')}</div>
            </div>
            <div className="dash-card" style={{ padding: 'var(--space-3)' }}>
              <div className="dash-card-label">Last Visit</div>
              <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>
                {selectedCustomer.last_visit_at ? new Date(selectedCustomer.last_visit_at).toLocaleDateString('en-IN') : 'Never'}
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}><Loader2 size={20} className="spinner" /></div>
          ) : (
            <>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>Bill History</h4>
              {customerBills.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>No bills yet.</p>
              ) : (
                <div style={{ marginBottom: 'var(--space-4)', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {customerBills.map((bill: any) => (
                    <div key={bill.id} style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-medium)' }}>{bill.bill_number}</span>
                      <span>₹{Number(bill.grand_total).toLocaleString('en-IN')}</span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>{new Date(bill.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>Reviews</h4>
              {customerReviews.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>No reviews yet.</p>
              ) : (
                <div style={{ background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {customerReviews.map((r: any) => (
                    <div key={r.id} style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: r.stars >= 4 ? 'hsl(38 90% 50%)' : 'var(--color-error)' }}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
                      {r.feedback_text && <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>— {r.feedback_text}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header + Search + Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input className="input-field" placeholder="Search name or phone..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, fontSize: 'var(--text-sm)' }} />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {(['today', 'week', 'month', 'all'] as DateRange[]).map((range) => (
            <button key={range} className={`settings-tab ${dateRange === range ? 'active' : ''}`}
              style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)', borderBottom: 'none', borderRadius: 'var(--radius-md)', background: dateRange === range ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)' }}
              onClick={() => setDateRange(range)}>
              {range === 'today' ? 'Today' : range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'All'}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input type="date" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', width: 130 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span style={{ fontSize: 'var(--text-xs)' }}>to</span>
            <input type="date" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', width: 130 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {total} customer{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}><Loader2 size={24} className="spinner" /></div>
      ) : customers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-tertiary)' }}>
          <Users size={40} style={{ marginBottom: 'var(--space-2)', opacity: 0.3 }} />
          <p>No customers yet. Create a bill to start building your list.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Visits</th>
                <th>Total Spent</th>
                <th>Last Visit</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                  <td style={{ fontWeight: 'var(--weight-medium)' }}>
                    {c.name}
                    {/* Customer Value Tag */}
                    {(c.total_visits >= 10 || c.total_spent >= 5000) && (
                      <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'hsl(38 90% 90%)', color: 'hsl(38 80% 30%)', fontWeight: 500 }}>Top</span>
                    )}
                    {/* Loyalty Progress */}
                    {loyaltyEnabled && loyaltyGoal > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 500, fontFamily: 'monospace' }}>
                        {loyaltyMap[c.id] || 0}/{loyaltyGoal}
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{c.phone}</td>
                  <td>{c.total_visits}</td>
                  <td>₹{c.total_spent.toLocaleString('en-IN')}</td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                  <td><ChevronRight size={14} color="var(--color-text-tertiary)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
