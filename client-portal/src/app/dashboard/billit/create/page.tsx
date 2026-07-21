'use client';

/**
 * Billit — Create Bill (§5.4)
 *
 * Phone-first → customer lookup → reward code → typeahead/barcode → 
 * auto-calc → bill number → WhatsApp send → save/print
 *
 * Barcode scan: listens for HID-mode burst (inter-char <50ms + Enter).
 * Conditionally rendered only when barcode_enabled = true.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone, Search, Plus, Trash2, Send, Printer, Save, Loader2,
  Gift, Check, X, Barcode, MessageSquare, User,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import StandardCalculatorWidget from '@/components/calculator-widget';
import {
  lookupCustomerAction,
  lookupBarcodeAction,
  searchCatalogAction,
  validateRewardCodeAction,
  createBillAction,
  logWhatsAppSendAction,
  fetchBillSettingsAction,
} from './actions';
import './../billit.css';

interface LineItem {
  id: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  gstPercent: number;
  addedVia: 'manual' | 'search' | 'barcode';
}

interface SearchResult {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  gst_percent: number;
  barcode_value: string | null;
}

export default function CreateBillPage() {
  // Settings
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [clientSlug, setClientSlug] = useState('');
  const [hasGst, setHasGst] = useState(false);
  const [billWhatsAppTemplate, setBillWhatsAppTemplate] = useState('');

  // Customer
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerFound, setCustomerFound] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Line items
  const [items, setItems] = useState<LineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Reward
  const [rewardCode, setRewardCode] = useState('');
  const [rewardValid, setRewardValid] = useState<any>(null);
  const [rewardError, setRewardError] = useState('');
  const [rewardEnabled, setRewardEnabled] = useState(true);

  // Calculator
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  // Extra charges
  const [extraCharges, setExtraCharges] = useState(0);
  const [extraChargesNote, setExtraChargesNote] = useState('');

  // Bill result
  const [saving, setSaving] = useState(false);
  const [billResult, setBillResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Barcode scan detection
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const result = await fetchBillSettingsAction();
      if (result.settings) {
        setBarcodeEnabled(result.settings.barcode_enabled || false);
        setBusinessName(result.settings.business_name || '');
        setClientSlug(result.settings.slug || '');
        setHasGst(result.settings.has_gst || false);
        setBillWhatsAppTemplate(result.settings.bill_whatsapp_template || '');
        if (result.settings.reward_settings && result.settings.reward_settings.enabled === false) {
          setRewardEnabled(false);
        }
      }
    }
    loadSettings();

    // Check media query for mobile calculator portal
    const mql = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    setIsPortraitMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsPortraitMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Removed old GST calculator pre-fill code

  // Barcode scanner listener (HID mode: fast keystrokes + Enter)
  useEffect(() => {
    if (!barcodeEnabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3 && timeDiff < 100) {
        e.preventDefault();
        const scannedValue = barcodeBuffer.current;
        barcodeBuffer.current = '';
        handleBarcodeScan(scannedValue);
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 100) {
          barcodeBuffer.current = '';
        }
        barcodeBuffer.current += e.key;
        lastKeyTime.current = now;

        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        barcodeTimeout.current = setTimeout(() => { barcodeBuffer.current = ''; }, 200);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeEnabled]);

  // Keyboard shortcuts: Alt+C (clear), Alt+W (WhatsApp send), Alt+P (print)
  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if (!e.altKey) return;
      // Don't fire when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          handleClear();
          break;
        case 'w':
          e.preventDefault();
          handleWhatsAppDirectly();
          break;
        case 'p':
          e.preventDefault();
          handlePrintDirectly();
          break;
      }
    }
    
    function handleEnter(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.altKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'BUTTON') {
          e.preventDefault();
          addManualItem();
        }
      }
    }

    window.addEventListener('keydown', handleShortcut);
    window.addEventListener('keydown', handleEnter);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      window.removeEventListener('keydown', handleEnter);
    };
  });

  // Phone lookup
  async function handlePhoneLookup() {
    if (phone.replace(/\D/g, '').length < 10) return;
    setLookingUp(true);
    const result = await lookupCustomerAction(phone);
    if (result.customer) {
      setCustomerName(result.customer.name);
      setCustomerFound(true);
    } else {
      setCustomerFound(false);
    }
    setLookingUp(false);
  }

  // Barcode scan handler
  async function handleBarcodeScan(value: string) {
    const result = await lookupBarcodeAction(value);
    if (result.item) {
      addItemFromSearch(result.item, 'barcode');
    } else {
      setError(`No product matches barcode: ${value}`);
      setTimeout(() => setError(''), 3000);
    }
  }

  // Search catalog
  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const result = await searchCatalogAction(query);
    setSearchResults(result.items as SearchResult[]);
    setShowSearch(true);
  }

  function addItemFromSearch(item: SearchResult, via: 'search' | 'barcode') {
    // Check if already added — increment qty instead
    const existing = items.find(i => i.catalogItemId === item.id);
    if (existing) {
      setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      return;
    }

    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      catalogItemId: item.id,
      description: item.name,
      quantity: 1,
      unit: item.unit || 'pcs',
      unitPrice: item.price,
      discount: 0,
      gstPercent: item.gst_percent || 0,
      addedVia: via,
    }]);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  }

  function addManualItem() {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      discount: 0,
      gstPercent: 0,
      addedVia: 'manual',
    }]);
  }

  function updateItem(id: string, field: string, value: any) {
    setBillResult(null);
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeItem(id: string) {
    setBillResult(null);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  // Reward code
  async function handleValidateReward() {
    if (!rewardCode.trim()) return;
    setRewardError('');
    const result = await validateRewardCodeAction(rewardCode);
    if (result.error) { setRewardError(result.error); setRewardValid(null); return; }

    // For free_item rewards, check that the matching catalog item is in the bill
    if (result.reward?.type === 'free_item' && result.reward?.reward_catalog_item_id) {
      const matchingItem = items.find(i => i.catalogItemId === result.reward!.reward_catalog_item_id);
      if (!matchingItem) {
        setRewardError(`This reward is for "${result.reward.catalogItemName || 'a specific item'}" — add it to the bill first.`);
        setRewardValid(null);
        return;
      }
    }
    setRewardValid(result.reward);
  }

  // Calculations
  const subtotal = items.reduce((sum, i) => {
    const line = i.quantity * i.unitPrice - i.discount;
    return sum + Math.max(0, line);
  }, 0);

  const gstTotal = items.reduce((sum, i) => {
    const line = i.quantity * i.unitPrice - i.discount;
    return sum + Math.max(0, line) * (i.gstPercent / 100);
  }, 0);

  // For free_item rewards, zero out the matching line item price
  // For flat/percent discount, apply to bill total
  const rewardDiscount = rewardValid
    ? rewardValid.type === 'free_item'
      ? (() => {
          const match = items.find(i => i.catalogItemId === rewardValid.reward_catalog_item_id);
          return match ? match.unitPrice * 1 : 0; // Zero one unit of the free item
        })()
      : rewardValid.type === 'percent_discount'
        ? subtotal * (rewardValid.value / 100)
        : rewardValid.value
    : 0;

  const grandTotal = Math.max(0, subtotal + gstTotal - rewardDiscount + extraCharges);

  // Create bill
  async function handleCreateBill(asDraft = false) {
    if (!phone || !customerName || items.length === 0) {
      setError('Fill in customer phone, name, and at least one item.');
      return null;
    }
    setSaving(true); setError('');

    const result = await createBillAction({
      customerPhone: phone,
      customerName,
      lineItems: items.map(i => ({
        catalogItemId: i.catalogItemId,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        discount: i.discount,
        gstPercent: i.gstPercent,
        addedVia: i.addedVia,
      })),
      discountTotal: 0,
      extraCharges,
      extraChargesNote,
      rewardCodeId: rewardValid?.id,
      rewardDiscount,
      asDraft,
    });

    if (result.error) { setError(result.error); setSaving(false); return null; }
    setBillResult(result.bill);
    setSaving(false);
    return result.bill;
  }

  function getWhatsAppUrl(billToUse: any) {
    if (!billToUse) return '#';
    const appUrl = billToUse.billUrl.split('/bill/')[0];
    const reviewLink = clientSlug ? `${appUrl}/review/${clientSlug}` : '';
    let message: string;
    if (billWhatsAppTemplate) {
      message = billWhatsAppTemplate
        .replace(/\{customer_name\}/g, billToUse.customerName)
        .replace(/\{business_name\}/g, businessName)
        .replace(/\{bill_link\}/g, billToUse.billUrl)
        .replace(/\{bill_number\}/g, billToUse.billNumber || '')
        .replace(/\{grand_total\}/g, Number(billToUse.grandTotal).toLocaleString('en-IN'))
        .replace(/\{review_link\}/g, reviewLink);
    } else {
      message = `Hi ${billToUse.customerName}, here is your bill from ${businessName}.\nAmount: ₹${Number(billToUse.grandTotal).toLocaleString('en-IN')}.\nView Bill:\n${billToUse.billUrl}.\n\nYour support means the world to us! ❤️\n\nWe'd love your feedback\nPlease review us here:\n${reviewLink}\n\nThankYou!`;
    }
    const cleanPhone = billToUse.customerPhone.replace(/\D/g, '');
    return `https://wa.me/91${cleanPhone.replace(/^91/, '')}?text=${encodeURIComponent(message)}`;
  }

  async function handleWhatsAppDirectly() {
    let billToUse = billResult;
    let newTab: Window | null = null;
    
    if (!billToUse) {
      newTab = window.open('about:blank', '_blank'); // Open synchronously to bypass blocker
      billToUse = await handleCreateBill(false);
      if (!billToUse) {
        if (newTab) newTab.close();
        return;
      }
    }

    const waUrl = getWhatsAppUrl(billToUse);
    if (newTab) {
      newTab.location.href = waUrl;
    } else {
      window.open(waUrl, '_blank');
    }
    logWhatsAppSendAction(billToUse.id, billToUse.customerPhone);
  }

  async function handlePrintDirectly() {
    let billToUse = billResult;
    let newTab: Window | null = null;
    
    if (!billToUse) {
      newTab = window.open('about:blank', '_blank'); // Open synchronously to bypass blocker
      billToUse = await handleCreateBill(false);
      if (!billToUse) {
        if (newTab) newTab.close();
        return;
      }
    }
    
    const printUrl = `${billToUse.billUrl}?print=1`;
    if (newTab) {
      newTab.location.href = printUrl;
    } else {
      window.open(printUrl, '_blank');
    }
  }

  // Clear form
  function handleClear() {
    setPhone(''); setCustomerName(''); setCustomerFound(false); setItems([]);
    setRewardCode(''); setRewardValid(null); setRewardError('');
    setExtraCharges(0); setExtraChargesNote(''); setBillResult(null); setError('');
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{error}</div>
      )}

      {/* Step 1: Customer */}
      <div className="settings-section">
        <h3 className="settings-section-title"><User size={18} /> Customer</h3>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          
          {/* Phone */}
          <div className="billit-input-group">
            <div className="billit-input-wrapper has-prefix">
              <div className="billit-input-prefix">
                <select>
                  <option>IN</option>
                  <option>US</option>
                </select>
              </div>
              <input 
                className="billit-input-field" 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handlePhoneLookup} 
                data-has-value={phone.length > 0}
              />
              <label className="billit-input-label">Phone number</label>
              <div className="billit-input-underline"></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 20, marginTop: 4 }}>
              {lookingUp && <Loader2 size={14} className="spinner" style={{ color: 'var(--color-text-tertiary)' }} />}
              {customerFound && <Check size={14} style={{ color: 'var(--color-success)' }} />}
            </div>
          </div>

          {/* Name */}
          <div className="billit-input-group">
            <div className="billit-input-wrapper">
              <input 
                className="billit-input-field" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                data-has-value={customerName.length > 0}
              />
              <label className="billit-input-label">Customer Name {customerFound ? '(found)' : '*'}</label>
              <div className="billit-input-underline"></div>
            </div>
            <div style={{ height: 20, marginTop: 4 }}></div>
          </div>

        </div>
      </div>

      {/* Step 2: Reward Code (optional) */}
      {rewardEnabled && (
      <div className="settings-section">
        <h3 className="settings-section-title"><Gift size={18} /> Reward Code <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)', color: 'var(--color-text-tertiary)' }}>(optional)</span></h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input className="input-field" value={rewardCode} onChange={(e) => setRewardCode(e.target.value.toUpperCase())} placeholder="SAVE10-X4F9" style={{ flex: 1, fontFamily: 'monospace' }} />
          <button className="btn btn-primary" onClick={handleValidateReward} disabled={!rewardCode.trim()} style={{ whiteSpace: 'nowrap' }}>Apply</button>
        </div>
        {rewardError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>{rewardError}</p>}
        {rewardValid && (
          <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--color-success-subtle)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Check size={14} />
            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
              {rewardValid.source_type === 'loyalty_milestone' ? 'Loyalty' : 'Review'}
            </span>
            {rewardValid.type === 'free_item'
              ? `Free "${rewardValid.catalogItemName}" applied`
              : rewardValid.type === 'percent_discount'
                ? `${rewardValid.value}% off applied`
                : `₹${rewardValid.value} off applied`}
            <button onClick={() => { setRewardValid(null); setRewardCode(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        )}
      </div>
      )}

      {/* Step 3: Items */}
      <div className="settings-section">
        <h3 className="settings-section-title"><Search size={18} /> Items</h3>

        {/* Search + Barcode */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <input className="input-field" placeholder="Search products/services..." value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)} onFocus={() => searchQuery.length >= 2 && setShowSearch(true)} />
            {showSearch && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 10, maxHeight: 200, overflow: 'auto' }}>
                {searchResults.map((item) => (
                  <button key={item.id} onClick={() => addItemFromSearch(item, 'search')}
                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span>{item.name}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>₹{item.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {barcodeEnabled && (
            <div className="input-group" style={{ flex: '1 1 140px' }}>
              <input className="input-field" placeholder="Scan barcode..." style={{ paddingLeft: 8, fontSize: 'var(--text-xs)' }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) { await handleBarcodeScan(val); (e.target as HTMLInputElement).value = ''; }
                  }
                }} />
            </div>
          )}
          <button className="quick-action-btn" onClick={addManualItem} title="Add manual item">
            <Plus size={14} /> Manual
          </button>
        </div>

        {/* Line items table */}
        {items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Description</th>
                  <th style={{ width: 60, padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Qty</th>
                  <th style={{ width: 80, padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Price</th>
                  <th style={{ width: 70, padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Disc.</th>
                  <th style={{ width: 60, padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>GST%</th>
                  <th style={{ width: 80, padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>Total</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lineTotal = item.quantity * item.unitPrice - item.discount;
                  const gst = lineTotal * (item.gstPercent / 100);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-1)' }}>
                        <input className="input-field" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1) var(--space-2)' }} />
                      </td>
                      <td style={{ padding: 'var(--space-1)' }}>
                        <input className="input-field" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                          style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1)', textAlign: 'center', width: '100%' }} />
                      </td>
                      <td style={{ padding: 'var(--space-1)' }}>
                        <input className="input-field" type="number" min="0" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                          style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1)', textAlign: 'right', width: '100%' }} />
                      </td>
                      <td style={{ padding: 'var(--space-1)' }}>
                        <input className="input-field" type="number" min="0" value={item.discount} onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value))}
                          style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1)', textAlign: 'right', width: '100%' }} />
                      </td>
                      <td style={{ padding: 'var(--space-1)' }}>
                        <input className="input-field" type="number" min="0" max="100" value={item.gstPercent} onChange={(e) => updateItem(item.id, 'gstPercent', Number(e.target.value))}
                          style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1)', textAlign: 'center', width: '100%' }} />
                      </td>
                      <td style={{ padding: 'var(--space-1)', textAlign: 'right', fontWeight: 'var(--weight-medium)' }}>
                        ₹{(lineTotal + gst).toFixed(2)}
                      </td>
                      <td>
                        <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: 2 }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Extra charges */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>Extra Charges Note</label>
            <input className="input-field" value={extraChargesNote} onChange={(e) => setExtraChargesNote(e.target.value)} placeholder="Delivery, packing..." style={{ fontSize: 'var(--text-sm)' }} />
          </div>
          <div className="input-group" style={{ width: 100 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>Amount (₹)</label>
            <input className="input-field" type="number" min="0" value={extraCharges} onChange={(e) => setExtraCharges(Number(e.target.value))} style={{ fontSize: 'var(--text-sm)' }} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="settings-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {gstTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>GST</span>
              <span>₹{gstTotal.toFixed(2)}</span>
            </div>
          )}
          {rewardDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
              <span>Reward Discount</span>
              <span>−₹{rewardDiscount.toFixed(2)}</span>
            </div>
          )}
          {extraCharges > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{extraChargesNote || 'Extra Charges'}</span>
              <span>+₹{extraCharges.toFixed(2)}</span>
            </div>
          )}
          <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
            <span>Grand Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 'var(--space-4)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginRight: 'auto' }}>
          <button className="btn" onClick={handleClear} style={{ padding: '0 var(--space-2)' }} title="Clear (Alt+C)">
             <X size={14} />
          </button>
          <button className="btn" onClick={handleClear} title="New Bill (Alt+N)">
             <Plus size={14} /> New Bill
          </button>
        </div>

        {billResult && (
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-success)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', marginRight: 'var(--space-1)' }}>
            <Check size={16} style={{ marginRight: 4 }} /> {billResult.billNumber}
          </span>
        )}

        {billResult ? (
          <>
            <a href={`${billResult.billUrl}?print=1`} target="_blank" rel="noopener noreferrer" className="btn" title="Print (Alt+P)">
               <Printer size={14} /> Print
            </a>
            <a href={getWhatsAppUrl(billResult)} target="_blank" rel="noopener noreferrer" onClick={() => logWhatsAppSendAction(billResult.id, billResult.customerPhone)} className="btn btn-primary" style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} title="Send WhatsApp (Alt+W)">
               <MessageSquare size={14} /> Send WhatsApp
            </a>
          </>
        ) : (
          <>
            <button className="btn" onClick={handlePrintDirectly} disabled={saving || items.length === 0} title="Print (Alt+P)">
               <Printer size={14} /> Print
            </button>
            <button className="btn btn-primary" onClick={handleWhatsAppDirectly} disabled={saving || items.length === 0} style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} title="Send WhatsApp (Alt+W)">
               <MessageSquare size={14} /> Send WhatsApp
            </button>
          </>
        )}
        
        <button className="btn btn-primary" onClick={() => handleCreateBill(false)} disabled={saving || items.length === 0} title="Save (Alt+S)">
          {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save
        </button>
      </div>

      {/* Calculator Widget */}
      {isPortraitMobile ? (
        typeof document !== 'undefined' && document.getElementById('mobile-sidebar-widget-area') 
          ? createPortal(<StandardCalculatorWidget />, document.getElementById('mobile-sidebar-widget-area')!)
          : null
      ) : (
        <StandardCalculatorWidget />
      )}
    </div>
  );
}
