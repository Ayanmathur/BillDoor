'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { fetchTallyExportDataAction } from './actions';

export default function TallyExportPage() {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [periodValue, setPeriodValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<any[]>([]);

  // Generate last 12 months
  const months = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    };
  });

  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const quarters = [
    { label: `Q1 (Apr-Jun ${currentYear})`, value: `${currentYear}-Q1` },
    { label: `Q2 (Jul-Sep ${currentYear})`, value: `${currentYear}-Q2` },
    { label: `Q3 (Oct-Dec ${currentYear})`, value: `${currentYear}-Q3` },
    { label: `Q4 (Jan-Mar ${currentYear + 1})`, value: `${currentYear}-Q4` },
  ];

  useEffect(() => {
    if (periodType === 'monthly') {
      setPeriodValue(months[0].value);
    } else {
      const m = now.getMonth();
      const q = m >= 3 && m <= 5 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 11 ? 3 : 4;
      setPeriodValue(`${currentYear}-Q${q}`);
    }
  }, [periodType]);

  const getDateRange = () => {
    if (periodType === 'monthly') {
      const [y, m] = periodValue.split('-');
      const dateFrom = `${y}-${m}-01`;
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      const dateTo = `${y}-${m}-${lastDay}`;
      return { dateFrom, dateTo };
    } else {
      const [y, q] = periodValue.split('-');
      const year = Number(y);
      if (q === 'Q1') return { dateFrom: `${year}-04-01`, dateTo: `${year}-06-30` };
      if (q === 'Q2') return { dateFrom: `${year}-07-01`, dateTo: `${year}-09-30` };
      if (q === 'Q3') return { dateFrom: `${year}-10-01`, dateTo: `${year}-12-31` };
      return { dateFrom: `${year + 1}-01-01`, dateTo: `${year + 1}-03-31` };
    }
  };

  const loadData = useCallback(async () => {
    if (!periodValue) return;
    setLoading(true);
    const { dateFrom, dateTo } = getDateRange();
    const result = await fetchTallyExportDataAction(dateFrom, dateTo);
    setBills(result.bills || []);
    setLoading(false);
  }, [periodType, periodValue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportTallyCsv = () => {
    if (!bills.length) return;

    const headers = [
      'Date',
      'Voucher Type',
      'Voucher No',
      'Party Ledger Name',
      'GSTIN/UIN',
      'Taxable Value',
      'CGST Amount',
      'SGST Amount',
      'IGST Amount',
      'Total Amount',
    ];

    const rows = bills.map((b) => {
      const d = new Date(b.created_at).toLocaleDateString('en-IN');
      const gstHalf = (b.gst_total || 0) / 2;
      return [
        d,
        'Sales',
        b.bill_number,
        `"${(b.customer?.name || 'Cash Sales').replace(/"/g, '""')}"`,
        '',
        (b.subtotal || 0).toFixed(2),
        gstHalf.toFixed(2),
        gstHalf.toFixed(2),
        '0.00',
        (b.grand_total || 0).toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tally_sales_export_${periodValue}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Link href="/dashboard/billit/reports" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <FileSpreadsheet size={20} color="var(--color-primary)" /> Tally-Compatible Sales Export
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Export sales vouchers formatted for standard Tally ERP/Prime import.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleExportTallyCsv} disabled={loading || bills.length === 0}>
            <Download size={16} /> Export Tally CSV
          </button>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className={`btn ${periodType === 'monthly' ? 'btn-primary' : ''}`} onClick={() => setPeriodType('monthly')}>Monthly</button>
            <button className={`btn ${periodType === 'quarterly' ? 'btn-primary' : ''}`} onClick={() => setPeriodType('quarterly')}>Quarterly</button>
          </div>

          <select className="input-field" value={periodValue} onChange={(e) => setPeriodValue(e.target.value)} style={{ width: 220 }}>
            {periodType === 'monthly'
              ? months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)
              : quarters.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
          </select>
        </div>

        {/* Preview Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <Loader2 size={24} className="spinner" />
          </div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-secondary)' }}>
            No sales records found for this period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Voucher No</th>
                  <th style={{ padding: '8px' }}>Party Ledger</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Taxable</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>CGST</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>SGST</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {bills.slice(0, 15).map((b) => {
                  const gstHalf = (b.gst_total || 0) / 2;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '8px' }}>{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace' }}>{b.bill_number}</td>
                      <td style={{ padding: '8px' }}>{b.customer?.name || 'Cash Sales'}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₹{(b.subtotal || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₹{gstHalf.toFixed(2)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₹{gstHalf.toFixed(2)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{(b.grand_total || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {bills.length > 15 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 8, textAlign: 'center' }}>
                Showing first 15 of {bills.length} vouchers. Click Export Tally CSV to download complete file.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
