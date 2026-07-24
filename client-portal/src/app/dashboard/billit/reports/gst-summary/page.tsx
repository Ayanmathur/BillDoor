'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { fetchGstSummaryAction } from '../actions';

interface GstRow {
  rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  total_tax: number;
}

export default function GstSummaryPage() {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [periodValue, setPeriodValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GstRow[]>([]);
  
  // Generate last 12 months
  const months = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    };
  });

  // Current FY Quarters
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const quarters = [
    { label: `Q1 (Apr-Jun ${currentYear})`, value: `${currentYear}-Q1` },
    { label: `Q2 (Jul-Sep ${currentYear})`, value: `${currentYear}-Q2` },
    { label: `Q3 (Oct-Dec ${currentYear})`, value: `${currentYear}-Q3` },
    { label: `Q4 (Jan-Mar ${currentYear + 1})`, value: `${currentYear}-Q4` },
  ];

  // Set default period on mount
  useEffect(() => {
    if (periodType === 'monthly') {
      setPeriodValue(months[0].value);
    } else {
      // Find current quarter
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
    
    // We assume fetchGstSummaryAction takes an object or dates and returns standard rates
    // If it doesn't exist yet, we handle a possible graceful failure.
    try {
      const result = await fetchGstSummaryAction(dateFrom, dateTo);
      if (result && result.rateGroups) {
        setData(result.rateGroups);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error(err);
      setData([]);
    }
    setLoading(false);
  }, [periodType, periodValue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportXlsx = () => {
    if (!data.length) return;
    
    // Using CSV pattern from Review Flow
    const headers = ['GST Rate', 'Taxable Value (Rs)', 'CGST (Rs)', 'SGST (Rs)', 'Total Tax (Rs)'];
    const rows = data.map(r => [
      `${r.rate}%`,
      r.taxable_value.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.total_tax.toFixed(2)
    ]);
    
    const totalsRow = [
      'Total',
      data.reduce((sum, r) => sum + r.taxable_value, 0).toFixed(2),
      data.reduce((sum, r) => sum + r.cgst, 0).toFixed(2),
      data.reduce((sum, r) => sum + r.sgst, 0).toFixed(2),
      data.reduce((sum, r) => sum + r.total_tax, 0).toFixed(2),
    ];
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(',')), totalsRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-summary-${periodValue}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalTaxable = data.reduce((sum, r) => sum + r.taxable_value, 0);
  const totalCgst = data.reduce((sum, r) => sum + r.cgst, 0);
  const totalSgst = data.reduce((sum, r) => sum + r.sgst, 0);
  const totalTax = data.reduce((sum, r) => sum + r.total_tax, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Link href="/dashboard/billit/reports" className="btn" style={{ padding: 'var(--space-2)' }}>
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>GST Summary</h1>
      </div>

      <div className="dash-card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ minWidth: 200, flex: 1 }}>
            <label className="input-label">Period Type</label>
            <select className="input-field" value={periodType} onChange={(e) => {
              setPeriodType(e.target.value as 'monthly' | 'quarterly');
            }}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          
          <div className="input-group" style={{ minWidth: 200, flex: 1 }}>
            <label className="input-label">Select {periodType === 'monthly' ? 'Month' : 'Quarter'}</label>
            <select className="input-field" value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
              {periodType === 'monthly' ? (
                months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)
              ) : (
                quarters.map(q => <option key={q.value} value={q.value}>{q.label}</option>)
              )}
            </select>
          </div>
          
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={handleExportXlsx} disabled={loading || data.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Download size={16} /> Export XLSX
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}>
          <Loader2 size={24} className="spinner" />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <FileSpreadsheet size={40} style={{ marginBottom: 'var(--space-2)', opacity: 0.3 }} />
          <p>No bills found for this period.</p>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>GST Rate</th>
                <th style={{ textAlign: 'right' }}>Taxable Value (₹)</th>
                <th style={{ textAlign: 'right' }}>CGST (₹)</th>
                <th style={{ textAlign: 'right' }}>SGST (₹)</th>
                <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.rate}>
                  <td style={{ fontWeight: 'var(--weight-medium)' }}>{row.rate}%</td>
                  <td style={{ textAlign: 'right' }}>₹{row.taxable_value.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{row.cgst.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{row.sgst.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{row.total_tax.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-bg-secondary)', fontWeight: 'var(--weight-bold)' }}>
                <td>Totals</td>
                <td style={{ textAlign: 'right' }}>₹{totalTaxable.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>₹{totalCgst.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>₹{totalSgst.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>₹{totalTax.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
