'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, AlertTriangle, Check, Trash2, Edit, ExternalLink,
  ChevronLeft, ChevronRight, Loader2, X, Filter, Printer, MessageCircle
} from 'lucide-react';
import { fetchBillsAction, voidBillAction, finalizeDraftAction, deleteDraftAction } from '../create/actions';
import { fetchBillWhatsAppTemplateAction } from '../settings/actions';
import './bills.css';

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

  useEffect(() => {
    loadBills();
  }, [filter, page]);

  async function loadBills() {
    setLoading(true);
    const offset = (page - 1) * limit;
    const result = await fetchBillsAction({ status: filter === 'All' ? undefined : filter.toLowerCase(), limit, offset });
    if (result.bills) {
      setBills(result.bills);
      setTotalCount(result.total || 0);
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

  async function handleResendWhatsApp(bill: any) {
    try {
      const templateRes = await fetchBillWhatsAppTemplateAction();
      const billUrl = `${window.location.origin}/bill/${bill.billSlug}`;
      const rawTemplate = templateRes.template?.content as string | undefined;
      let message = rawTemplate || `Hi {customer_name}, here is your bill from {shop_name}: {bill_link}`;
      message = message
        .replace(/\{customer_name\}/g, bill.customerName || 'Customer')
        .replace(/\{shop_name\}/g, 'our store')
        .replace(/\{bill_link\}/g, billUrl)
        .replace(/\{bill_number\}/g, bill.billNumber || '')
        .replace(/\{grand_total\}/g, Number(bill.grandTotal || 0).toLocaleString('en-IN'))
        .replace(/\{review_link\}/g, billUrl);
      const encoded = encodeURIComponent(message);
      const phone = bill.customerPhone ? bill.customerPhone.replace(/\D/g, '') : '';
      if (phone) {
        window.location.href = `https://wa.me/91${phone.replace(/^91/, '')}?text=${encoded}`;
      } else {
        window.location.href = `https://wa.me/?text=${encoded}`;
      }
    } catch {
      alert('Failed to load WhatsApp template.');
    }
  }

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="bills-page">
      <div className="bills-header">
        <h1><FileText size={28} style={{ color: 'var(--color-primary)' }} /> Bills</h1>
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
                  <tr>
                    <td>
                      <span className={bill.status === 'voided' ? 'bill-number-voided' : ''}>
                        {bill.billNumber}
                      </span>
                    </td>
                    <td>{bill.customerName || 'Walk-in'}</td>
                    <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                    <td>₹{Number(bill.grandTotal || 0).toFixed(2)}</td>
                    <td>
                      <span className={`bill-status-badge ${bill.status || 'draft'}`}>
                        {bill.status || 'draft'}
                      </span>
                    </td>
                    <td>
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
                                <button className="bills-action-btn" title="Resend on WhatsApp" onClick={() => handleResendWhatsApp(bill)}>
                                  <MessageCircle size={16} />
                                </button>
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
    </div>
  );
}
