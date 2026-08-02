'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, AlertTriangle, Check, Trash2, Edit, ExternalLink,
  ChevronLeft, ChevronRight, Loader2, X, Filter, Printer, MessageSquare, Download
} from 'lucide-react';
import { fetchBillsAction, voidBillAction, finalizeDraftAction, deleteDraftAction, fetchBillSettingsAction, fetchBillsForBulkDownloadAction, logWhatsAppSendAction } from '../create/actions';
import { fetchBillWhatsAppTemplateAction } from '../settings/actions';
import { formatWhatsAppPhone } from '@/shared/validation';
import './bills.css';

type BulkDateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

export default function BillsPage() {
  const router = useRouter();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  
  // Modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBillNumber, setSelectedBillNumber] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Bulk Download state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkRange, setBulkRange] = useState<BulkDateRange>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [downloading, setDownloading] = useState(false);

  function getBulkDates() {
    const now = new Date();
    switch (bulkRange) {
      case 'today': {
        const d = now.toISOString().split('T')[0];
        return { dateFrom: d, dateTo: d };
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: weekAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: monthAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'year': {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: yearAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'custom':
        return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
      default:
        return {};
    }
  }

  async function handleBulkDownload() {
    setDownloading(true);
    const dates = getBulkDates();
    const result = await fetchBillsForBulkDownloadAction(dates);
    if (!result.bills || result.bills.length === 0) {
      alert('No bills found in the selected date range.');
      setDownloading(false);
      return;
    }

    // Format bills export CSV / printable bundle
    const headers = ['Bill Number', 'Date', 'Customer Name', 'Phone', 'Status', 'Subtotal', 'Discount', 'GST Total', 'Grand Total'];
    const rows = result.bills.map((b: any) => [
      b.bill_number,
      new Date(b.created_at).toLocaleString('en-IN'),
      `"${(b.customer?.name || '').replace(/"/g, '""')}"`,
      b.customer?.phone || '',
      b.status,
      b.subtotal || 0,
      b.discount_total || 0,
      b.gst_total || 0,
      b.grand_total || 0,
    ]);

    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
    setBulkModalOpen(false);
  }

  const [clientSettings, setClientSettings] = useState<any>(null);
  const [clientTemplate, setClientTemplate] = useState<string | null>(null);

  useEffect(() => {
    loadBills();
  }, [filter, page]);

  async function loadBills() {
    setLoading(true);
    const offset = (page - 1) * limit;
    const [result, settingsRes, templateRes] = await Promise.all([
      fetchBillsAction({ status: filter === 'All' ? undefined : filter.toLowerCase(), limit, offset }),
      fetchBillSettingsAction(),
      fetchBillWhatsAppTemplateAction(),
    ]);

    if (result.bills) {
      setBills(result.bills);
      setTotalCount(result.total || 0);
    }
    if (settingsRes.settings) {
      setClientSettings(settingsRes.settings);
    }
    if (templateRes.template?.content) {
      setClientTemplate(templateRes.template.content);
    }
    setLoading(false);
  }

  function openVoidModal(id: string, num: string) {
    setSelectedBillId(id);
    setSelectedBillNumber(num);
    setVoidReason('');
    setVoidModalOpen(true);
  }

  async function handleVoidConfirm() {
    if (!selectedBillId || voidReason.length < 5) return;
    setVoiding(true);
    await voidBillAction({ billId: selectedBillId, reason: voidReason });
    setVoiding(false);
    setVoidModalOpen(false);
    loadBills();
  }

  async function handleFinalize(id: string) {
    await finalizeDraftAction(id);
    loadBills();
  }

  async function handleDeleteDraft(id: string) {
    if (confirm('Are you sure you want to delete this draft?')) {
      await deleteDraftAction(id);
      loadBills();
    }
  }

  function buildWaUrl(bill: any) {
    const businessName = clientSettings?.business_name || 'our store';
    const clientSlug = clientSettings?.slug;
    const modulesEnabled = clientSettings?.modules_enabled || {};
    const appointerEnabled = modulesEnabled.appointer === true;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const billUrl = `${origin}/bill/${bill.billSlug}`;
    const reviewLink = clientSlug ? `${origin}/review/${clientSlug}` : '';
    const appointmentLink = (appointerEnabled && clientSlug) ? `${origin}/book/${clientSlug}` : '';

    let message = clientTemplate || `Hi {customer_name}, here is your bill from {business_name}.\nAmount: ₹{grand_total}.\nView Bill:\n{bill_link}.\n\nYour support means the world to us! ❤️\n\nWe'd love your feedback\nPlease review us here:\n{review_link}\n\nThankYou!`;

    message = message
      .replace(/\{customer_name\}/g, bill.customerName || 'Customer')
      .replace(/\{business_name\}/g, businessName)
      .replace(/\{bill_link\}/g, billUrl)
      .replace(/\{bill_number\}/g, bill.billNumber || '')
      .replace(/\{grand_total\}/g, Number(bill.grandTotal || 0).toLocaleString('en-IN'))
      .replace(/\{review_link\}/g, reviewLink);

    if (appointmentLink) {
      message = message.replace(/\{appointment_link\}/g, appointmentLink);
    } else {
      if (clientTemplate && clientTemplate.includes('{review_link}')) {
        message = message.replace(/\{appointment_link\}/g, reviewLink);
      } else {
        message = message
          .split('\n')
          .filter(line => !line.includes('{appointment_link}'))
          .join('\n');
      }
    }

    const phoneNum = formatWhatsAppPhone(bill.customerPhone);
    return phoneNum
      ? `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="bills-page">
      <div className="bills-header">
        <h1><FileText size={28} style={{ color: 'var(--color-primary)' }} /> Bills</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button className="quick-action-btn" onClick={() => setBulkModalOpen(true)} style={{ fontSize: 'var(--text-xs)' }}>
            <Download size={14} /> Bulk Download
          </button>
          <div className="bills-filter">
            <Filter size={16} color="#666" />
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
              <option value="All">All</option>
              <option value="Issued">Issued</option>
              <option value="Draft">Draft</option>
              <option value="Voided">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="spinner" size={32} /></div>
      ) : bills.length === 0 ? (
        <div className="bills-empty">
          <FileText size={48} color="#ccc" style={{ marginBottom: 16 }} />
          <p>No bills found.</p>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard/billit/create')}>
            Create your first bill!
          </button>
        </div>
      ) : (
        <div className="bills-table-container">
          <table className="bills-table">
            <thead>
              <tr>
                <th>Bill Number</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <Fragment key={bill.id}>
                  <tr className="bill-row">
                    <td className="col-bill-num">
                      <span className={bill.status === 'voided' ? 'bill-number-voided' : ''}>
                        {bill.billNumber}
                      </span>
                    </td>
                    <td className="col-customer">{bill.customerName || 'Walk-in'}</td>
                    <td className="col-date">{new Date(bill.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="col-amount">₹{Number(bill.grandTotal || 0).toFixed(2)}</td>
                    <td className="col-status">
                      <span className={`bill-status-badge ${bill.status || 'draft'}`}>
                        {bill.status || 'draft'}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="bills-actions">
                        {bill.status === 'issued' && (
                          <>
                            <button className="bills-action-btn void" title="Void" onClick={() => openVoidModal(bill.id, bill.billNumber)}>
                              <AlertTriangle size={16} />
                            </button>
                            {bill.billSlug && (
                              <>
                                <a href={`/bill/${bill.billSlug}`} target="_blank" rel="noopener noreferrer" className="bills-action-btn" title="View Bill">
                                  <ExternalLink size={16} />
                                </a>
                                <a href={`/bill/${bill.billSlug}?print=1`} target="_blank" rel="noopener noreferrer" className="bills-action-btn" title="Print Bill">
                                  <Printer size={16} />
                                </a>
                                <a href={buildWaUrl(bill)} target="_blank" rel="noopener noreferrer" className="bills-action-btn" title="Resend on WhatsApp" onClick={() => logWhatsAppSendAction(bill.id, bill.customerPhone)}>
                                  <MessageSquare size={16} />
                                </a>
                              </>
                            )}
                          </>
                        )}
                        {(bill.status === 'draft' || !bill.status) && (
                          <>
                            <button className="bills-action-btn" title="Finalize" onClick={() => handleFinalize(bill.id)}>
                              <Check size={16} color="green" />
                            </button>
                            <button className="bills-action-btn" title="Resume" onClick={() => router.push(`/dashboard/billit/create?draft=${bill.id}`)}>
                              <Edit size={16} />
                            </button>
                            <button className="bills-action-btn delete" title="Delete" onClick={() => handleDeleteDraft(bill.id)}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {bill.status === 'voided' && bill.billSlug && (
                          <a href={`/bill/${bill.billSlug}`} target="_blank" rel="noopener noreferrer" className="bills-action-btn" title="View Bill">
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                  {bill.status === 'voided' && bill.voidReason && (
                    <tr className="bill-void-row">
                      <td colSpan={6}>Void reason: {bill.voidReason}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          
          {totalCount > limit && (
            <div className="bills-pagination">
              <button 
                className="btn btn-secondary" 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span style={{ fontSize: 'var(--text-sm)' }}>Page {page} of {totalPages}</span>
              <button 
                className="btn btn-secondary" 
                disabled={page === totalPages} 
                onClick={() => setPage(p => p + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {voidModalOpen && (
        <div className="void-modal-overlay">
          <div className="void-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>Void Bill {selectedBillNumber}</h3>
              <button className="bills-action-btn" onClick={() => setVoidModalOpen(false)}><X size={20} /></button>
            </div>
            <p className="warning">
              This action cannot be undone. The bill will be marked as voided but kept in your records.
            </p>
            <textarea
              placeholder="Reason for voiding (min 5 chars)..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div className="void-modal-actions">
              <button className="btn btn-secondary" onClick={() => setVoidModalOpen(false)}>Cancel</button>
              <button 
                className="btn" 
                style={{ background: '#C62828', color: 'white' }}
                disabled={voidReason.length < 5 || voiding}
                onClick={handleVoidConfirm}
              >
                {voiding ? <Loader2 size={16} className="spinner" /> : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Download Modal (Step 4) */}
      {bulkModalOpen && (
        <div className="void-modal-overlay">
          <div className="void-modal" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Download size={18} /> Bulk Download Invoices</h3>
              <button className="bills-action-btn" onClick={() => setBulkModalOpen(false)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Select a date range to export invoices in bulk.
            </p>
            
            {/* Reused B1 Date Range Selector */}
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginBottom: 16 }}>
              {(['today', 'week', 'month', 'year', 'custom'] as BulkDateRange[]).map((range) => (
                <button
                  key={range}
                  className={`settings-tab ${bulkRange === range ? 'active' : ''}`}
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: bulkRange === range ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                  }}
                  onClick={() => setBulkRange(range)}
                >
                  {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'year' ? 'This Year' : 'Custom'}
                </button>
              ))}
            </div>

            {bulkRange === 'custom' && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 16 }}>
                <input type="date" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', flex: 1 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>to</span>
                <input type="date" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', flex: 1 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            )}

            <div className="void-modal-actions">
              <button className="btn btn-secondary" onClick={() => setBulkModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkDownload} disabled={downloading}>
                {downloading ? <Loader2 size={16} className="spinner" /> : <Download size={14} />} Export Invoices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
