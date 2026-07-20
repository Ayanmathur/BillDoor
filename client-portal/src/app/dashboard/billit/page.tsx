'use client';

/**
 * Billit — Module Landing Page
 *
 * Quick-nav to Create Bill, Catalog, and Customers.
 * Doubles as a bill history / recent bills view.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Package, Users, FileText, Loader2, Settings, Calculator, X } from 'lucide-react';
import { fetchDistinctGstRatesAction } from './create/actions';
import './gst-calculator.css';

export default function BillitPage() {
  const router = useRouter();
  const [calcOpen, setCalcOpen] = useState(false);
  
  // Calculator state
  const [amount, setAmount] = useState<number | ''>('');
  const [rates, setRates] = useState<number[]>([0, 5, 12, 18, 28]);
  const [selectedRate, setSelectedRate] = useState<string>('18');
  const [customRate, setCustomRate] = useState<number | ''>('');
  const [isInclusive, setIsInclusive] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<"%" | "₹">("₹");
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadRates() {
      const res = await fetchDistinctGstRatesAction();
      if (res.rates) {
        const combined = Array.from(new Set([...res.rates, 0, 5, 12, 18, 28])).sort((a, b) => a - b);
        setRates(combined);
      }
    }
    loadRates();
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (calcOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setCalcOpen(false);
    }
  }, [calcOpen]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const actions = [
    { label: 'Create Bill', icon: <Plus size={20} />, route: '/dashboard/billit/create', desc: 'New invoice for a customer', accent: true },
    { label: 'Bills', icon: <FileText size={20} />, route: '/dashboard/billit/bills', desc: 'View all bills & drafts' },
    { label: 'Catalog', icon: <Package size={20} />, route: '/dashboard/billit/catalog', desc: 'Products & services' },
    { label: 'Customers', icon: <Users size={20} />, route: '/dashboard/billit/customers', desc: 'Search customers & history' },
    { label: 'Settings', icon: <Settings size={20} />, route: '/dashboard/billit/settings', desc: 'Barcode & preferences' },
  ];

  // Calculations
  const calculated = useMemo(() => {
    const amt = Number(amount) || 0;
    const rate = selectedRate === 'custom' ? (Number(customRate) || 0) : (Number(selectedRate) || 0);
    const discVal = Number(discountValue) || 0;

    let base = 0;
    let gst = 0;
    let subtotal = 0;

    if (isInclusive) {
      base = amt / (1 + rate / 100);
      gst = amt - base;
      subtotal = amt;
    } else {
      base = amt;
      gst = amt * (rate / 100);
      subtotal = base + gst;
    }

    const discountAmount = discountType === '%' ? subtotal * (discVal / 100) : discVal;
    const total = subtotal - discountAmount;

    return {
      base,
      gst,
      gstRate: rate,
      discountAmount,
      total
    };
  }, [amount, selectedRate, customRate, isInclusive, discountType, discountValue]);

  const handleUseInBill = () => {
    router.push(`/dashboard/billit/create?calcDesc=Calculator+Quote&calcAmount=${calculated.base.toFixed(2)}&calcGstPercent=${calculated.gstRate}&calcDiscount=${calculated.discountAmount.toFixed(2)}`);
  };

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

      <button className="calc-fab" onClick={() => setCalcOpen(true)} title="GST Calculator">
        <Calculator size={24} />
      </button>

      {calcOpen && <div className="calc-overlay" />}

      <div className={`calc-panel ${calcOpen ? 'open' : 'closed'}`} ref={panelRef}>
        <div className="calc-header">
          <h2>GST Calculator</h2>
          <button className="calc-close-btn" onClick={() => setCalcOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="calc-field">
          <label>Amount (₹)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')} 
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>

        <div className="calc-field">
          <label>GST Rate</label>
          <select value={selectedRate} onChange={(e) => setSelectedRate(e.target.value)}>
            {rates.map(r => (
              <option key={r} value={r.toString()}>{r}%</option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>

        {selectedRate === 'custom' && (
          <div className="calc-field">
            <label>Custom GST (%)</label>
            <input 
              type="number" 
              value={customRate} 
              onChange={(e) => setCustomRate(e.target.value ? Number(e.target.value) : '')} 
              placeholder="e.g. 18"
              min="0"
              step="0.1"
            />
          </div>
        )}

        <div className="calc-toggle-group">
          <button 
            className={`calc-toggle ${!isInclusive ? 'active' : ''}`}
            onClick={() => setIsInclusive(false)}
          >
            Exclusive
          </button>
          <button 
            className={`calc-toggle ${isInclusive ? 'active' : ''}`}
            onClick={() => setIsInclusive(true)}
          >
            Inclusive
          </button>
        </div>

        <div className="calc-discount-row">
          <div className="calc-field">
            <label>Discount</label>
            <input 
              type="number" 
              value={discountValue} 
              onChange={(e) => setDiscountValue(e.target.value ? Number(e.target.value) : '')} 
              placeholder="0"
              min="0"
            />
          </div>
          <div className="calc-discount-type">
            <button 
              className={discountType === '%' ? 'active' : ''} 
              onClick={() => setDiscountType('%')}
            >
              %
            </button>
            <button 
              className={discountType === '₹' ? 'active' : ''} 
              onClick={() => setDiscountType('₹')}
            >
              ₹
            </button>
          </div>
        </div>

        <div className="calc-result">
          <div className="calc-result-row">
            <span>Base Amount</span>
            <span>₹{calculated.base.toFixed(2)}</span>
          </div>
          <div className="calc-result-row">
            <span>GST ({calculated.gstRate}%)</span>
            <span>+₹{calculated.gst.toFixed(2)}</span>
          </div>
          {calculated.discountAmount > 0 && (
            <div className="calc-result-row">
              <span>Discount</span>
              <span style={{ color: '#ef4444' }}>-₹{calculated.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="calc-result-row total">
            <span>Final Total</span>
            <span>₹{calculated.total.toFixed(2)}</span>
          </div>
        </div>

        <button className="calc-use-btn" onClick={handleUseInBill}>
          Use in New Bill
        </button>
      </div>
    </div>
  );
}
