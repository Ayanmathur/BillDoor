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
  Phone, Search, Plus, Trash2, Printer, Save, Loader2,
  Gift, Check, X, Barcode, MessageSquare, User, Camera,
  ZoomIn, ZoomOut, Zap,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import StandardCalculatorWidget from '@/components/calculator-widget';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import {
  lookupCustomerAction,
  lookupBarcodeAction,
  searchCatalogAction,
  validateRewardCodeAction,
  createBillAction,
  logWhatsAppSendAction,
  fetchBillSettingsAction,
  previewNextBillNumberAction,
  saveAndAddUncatalogedItemAction,
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
  barcodeValue?: string | null;
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
  const [barcodeEnabled, setBarcodeEnabled] = useState(true);
  const [cameraBarcodeEnabled, setCameraBarcodeEnabled] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [uncatalogedBarcode, setUncatalogedBarcode] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  async function handleContinuousScan(code: string) {
    const clean = code.trim();
    const result = await lookupBarcodeAction(clean);
    if (result.item) {
      addItemFromSearch(result.item, 'barcode');
      return { success: true, name: result.item.name, price: result.item.price };
    }
    setUncatalogedBarcode(clean);
    return { success: false, code: clean };
  }

  const [businessName, setBusinessName] = useState('');
  const [clientSlug, setClientSlug] = useState('');
  const [hasGst, setHasGst] = useState(false);
  const [billWhatsAppTemplate, setBillWhatsAppTemplate] = useState('');
  const [posModeEnabled, setPosModeEnabled] = useState(false);

  // Multi-template (Step 2/3)
  const [autoSelectTemplate, setAutoSelectTemplate] = useState(false);
  const [firstVisitTemplate, setFirstVisitTemplate] = useState<string | null>(null);
  const [repeatVisitTemplate, setRepeatVisitTemplate] = useState<string | null>(null);
  const [appointerEnabled, setAppointerEnabled] = useState(false);
  const [customerTotalVisits, setCustomerTotalVisits] = useState<number | null>(null);
  const [manualTemplateOverride, setManualTemplateOverride] = useState<string | null>(null);

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
  const [rewardEnabled, setRewardEnabled] = useState(false);

  // Calculator
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  // Dynamic GST & Discount state for Shop Calculator
  const [defaultGstPercent, setDefaultGstPercent] = useState(18);
  const [defaultDiscountVal, setDefaultDiscountVal] = useState(10);
  const [defaultDiscountType, setDefaultDiscountType] = useState<'percent' | 'flat'>('percent');

  // Extra charges
  const [extraCharges, setExtraCharges] = useState(0);
  const [extraChargesNote, setExtraChargesNote] = useState('');

  // Bill result
  const [saving, setSaving] = useState(false);
  const isCreatingRef = useRef(false);
  const [billResult, setBillResult] = useState<any>(null);
  const [previewBillNumber, setPreviewBillNumber] = useState<string>('');
  const [error, setError] = useState('');

  // Barcode scan detection
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function init() {
      const [{ settings }, preview] = await Promise.all([
        fetchBillSettingsAction(),
        previewNextBillNumberAction()
      ]);
      if (settings) {
        setBarcodeEnabled(settings.barcode_enabled || false);
        setCameraBarcodeEnabled(settings.bill_settings?.camera_barcode_enabled === true);
        setBusinessName(settings.business_name || '');
        setClientSlug(settings.slug || '');
        setHasGst(settings.has_gst || false);
        setBillWhatsAppTemplate(settings.bill_whatsapp_template || '');
        setPosModeEnabled(settings.bill_settings?.pos_mode_enabled === true);

        if (settings.bill_settings) {
          if (settings.bill_settings.default_gst_percent) setDefaultGstPercent(settings.bill_settings.default_gst_percent);
          if (settings.bill_settings.default_discount) setDefaultDiscountVal(settings.bill_settings.default_discount);
          if (settings.bill_settings.default_discount_type) setDefaultDiscountType(settings.bill_settings.default_discount_type);
        }
        // Multi-template state (defaults to off — no change for existing clients)
        setAutoSelectTemplate(settings.billit_auto_select_template ?? false);
        setFirstVisitTemplate(settings.first_visit_template ?? null);
        setRepeatVisitTemplate(settings.repeat_visit_template ?? null);
        setAppointerEnabled(settings.appointer_enabled ?? false);
        if (settings.reward_settings && settings.reward_settings.enabled !== false) {
          setRewardEnabled(true);
        }
      }
    }
    init();

    // Check media query for mobile calculator portal
    const mql = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    setIsPortraitMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsPortraitMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Dismiss search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Hardware Barcode scanner hook (USB & Bluetooth HID mode)
  useBarcodeScanner({
    onScan: useCallback((code: string) => {
      handleBarcodeScan(code);
    }, []),
    enabled: barcodeEnabled,
    minLength: 3,
    maxInterCharDelayMs: 80,
    suppressWhenTyping: true,
  });

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
          handleWhatsAppDirectly(window.open('about:blank', '_blank'));
          break;
        case 'p':
          e.preventDefault();
          handlePrintDirectly(window.open('about:blank', '_blank'));
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
      setCustomerTotalVisits(result.customer.total_visits ?? 0);
    } else {
      setCustomerFound(false);
      setCustomerTotalVisits(null);
    }
    setLookingUp(false);
  }

  // Barcode scan handler
  async function handleBarcodeScan(value: string) {
    if (!value || !value.trim()) return;
    const clean = value.trim();
    const result = await lookupBarcodeAction(clean);
    if (result.item) {
      addItemFromSearch(result.item, 'barcode');
    } else {
      setUncatalogedBarcode(clean);
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
    setItems(prev => {
      const existing = prev.find(i => 
        (item.id && i.catalogItemId && i.catalogItemId === item.id) ||
        (item.barcode_value && i.barcodeValue && i.barcodeValue.trim().toLowerCase() === item.barcode_value.trim().toLowerCase()) ||
        (i.description && i.description.trim().toLowerCase() === item.name.trim().toLowerCase())
      );

      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }

      return [...prev, {
        id: crypto.randomUUID(),
        catalogItemId: item.id,
        description: item.name,
        quantity: 1,
        unit: item.unit || 'pcs',
        unitPrice: item.price,
        discount: 0,
        gstPercent: item.gst_percent || 0,
        barcodeValue: item.barcode_value,
        addedVia: via,
      }];
    });

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
    if (isCreatingRef.current) return billResult; // Prevent duplicate execution
    
    if (!phone || !customerName || items.length === 0) {
      setError('Fill in customer phone, name, and at least one item.');
      return null;
    }
    
    isCreatingRef.current = true;
    setSaving(true); setError('');

    const result = await createBillAction({
      billId: billResult?.id,
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

    if (result.error) { 
      setError(result.error); 
      setSaving(false); 
      isCreatingRef.current = false;
      return null; 
    }
    setBillResult(result.bill);
    setSaving(false);
    isCreatingRef.current = false; // Allow further saves if they start a new bill (wait, handleClear handles new bill)
    return result.bill;
  }

  // Auto-save draft when phone and items are valid
  useEffect(() => {
    if (phone.replace(/\D/g, '').length >= 10 && items.length > 0 && !saving && !isCreatingRef.current) {
      const timer = setTimeout(() => {
        // Only auto-save if bill hasn't been issued yet
        if (!billResult || billResult.billNumber.startsWith('DRAFT')) {
          handleCreateBill(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, items, extraCharges, rewardValid, customerName]);

  function getWhatsAppUrl(billToUse: any) {
    if (!billToUse) return '#';
    const appUrl = billToUse.billUrl.split('/bill/')[0];
    const reviewLink = clientSlug ? `${appUrl}/review/${clientSlug}` : '';
    const appointmentLink = (appointerEnabled && clientSlug) ? `${appUrl}/book/${clientSlug}` : '';

    // Determine which template to use:
    // 1. Manual override ("Use this template" button) takes priority
    // 2. Auto-select by visit type (if enabled and defaults are set)
    // 3. Fallback: legacy single template from whatsapp_templates
    let chosenTemplate: string | null = manualTemplateOverride;

    if (!chosenTemplate && autoSelectTemplate) {
      // total_visits was already incremented by createBillAction, so:
      // - If customer was new (total_visits was 0), it's now 1 → first visit
      // - If customer already had visits, it's > 1 → repeat visit
      const visitsBeforeBill = customerTotalVisits ?? 0;
      const isFirstVisit = visitsBeforeBill === 0;
      if (isFirstVisit && firstVisitTemplate) {
        chosenTemplate = firstVisitTemplate;
      } else if (!isFirstVisit && repeatVisitTemplate) {
        chosenTemplate = repeatVisitTemplate;
      }
      // If no matching default template is set, fall through to legacy
    }

    // Final fallback: legacy single template
    if (!chosenTemplate) {
      chosenTemplate = billWhatsAppTemplate;
    }

    let message: string;
    if (chosenTemplate) {
      message = chosenTemplate
        .replace(/\{customer_name\}/g, billToUse.customerName)
        .replace(/\{business_name\}/g, businessName)
        .replace(/\{bill_link\}/g, billToUse.billUrl)
        .replace(/\{bill_number\}/g, billToUse.billNumber || '')
        .replace(/\{grand_total\}/g, Number(billToUse.grandTotal).toLocaleString('en-IN'))
        .replace(/\{review_link\}/g, reviewLink);

      // {appointment_link} fallback rule:
      // If Appointer is ON → replace with actual link.
      // If Appointer is OFF → fall back to {review_link} if present in template,
      //   otherwise drop the entire line containing {appointment_link}.
      if (appointmentLink) {
        message = message.replace(/\{appointment_link\}/g, appointmentLink);
      } else {
        // Appointer is off — apply fallback
        if (chosenTemplate.includes('{review_link}')) {
          // Template already has {review_link} rendered, replace appointment link with review link
          message = message.replace(/\{appointment_link\}/g, reviewLink);
        } else {
          // No {review_link} in template either — drop lines containing {appointment_link}
          message = message
            .split('\n')
            .filter(line => !line.includes('{appointment_link}'))
            .join('\n');
        }
      }
    } else {
      message = `Hi ${billToUse.customerName}, here is your bill from ${businessName}.\nAmount: ₹${Number(billToUse.grandTotal).toLocaleString('en-IN')}.\nView Bill:\n${billToUse.billUrl}.\n\nYour support means the world to us! ❤️\n\nWe'd love your feedback\nPlease review us here:\n${reviewLink}\n\nThankYou!`;
    }
    const cleanPhone = billToUse.customerPhone ? billToUse.customerPhone.replace(/\D/g, '') : '';
    const phoneNum = cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : '';

    return phoneNum
      ? `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }

  async function handleWhatsAppDirectly(newTab: Window | null) {
    let billToUse = billResult;
    
    if (!billToUse) {
      billToUse = await handleCreateBill(false);
      if (!billToUse) {
        if (newTab && !newTab.closed) newTab.close();
        return;
      }
    }

    const waUrl = getWhatsAppUrl(billToUse);
    if (newTab && !newTab.closed) {
      newTab.location.href = waUrl;
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
    logWhatsAppSendAction(billToUse.id, billToUse.customerPhone);
  }

  async function handlePrintDirectly(newTab: Window | null) {
    let billToUse = billResult;
    
    if (!billToUse) {
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
    setCustomerTotalVisits(null); setManualTemplateOverride(null);
    isCreatingRef.current = false;
    previewNextBillNumberAction().then(p => { if (p) setPreviewBillNumber(p); });
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {posModeEnabled && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-accent)',
          color: 'var(--color-accent-text, #ffffff)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-4)',
          boxShadow: 'var(--shadow-md)',
          position: 'sticky',
          top: 56,
          zIndex: 15,
        }}>
          <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold', opacity: 0.9 }}>POS Running Total</span>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, fontFamily: 'monospace' }}>₹{grandTotal.toFixed(2)}</span>
        </div>
      )}

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
          <div ref={searchRef} style={{ position: 'relative', flex: '1 1 200px' }}>
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
            <div className="input-group" style={{ flex: '1 1 160px', position: 'relative' }}>
              <input className="input-field" placeholder="Scan barcode..." data-barcode-capture="true" style={{ paddingLeft: 8, paddingRight: cameraBarcodeEnabled ? 32 : 8, fontSize: 'var(--text-xs)' }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      e.preventDefault();
                      await handleBarcodeScan(val);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }} />
              {cameraBarcodeEnabled && (
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(!showCameraScanner)}
                  title={showCameraScanner ? 'Close Camera Scanner' : 'Scan with Camera'}
                  style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: showCameraScanner ? 'var(--color-error)' : 'var(--color-accent)',
                    padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {showCameraScanner ? <X size={16} /> : <Camera size={16} />}
                </button>
              )}
            </div>
          )}
          <button className="quick-action-btn" onClick={addManualItem} title="Add manual item">
            <Plus size={14} /> Manual
          </button>
        </div>

        {/* Line items table */}
        {items.length > 0 && (
          <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', marginBottom: 'var(--space-3)' }}>
            <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', minWidth: 160 }}>Description</th>
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
                      <td style={{ padding: 'var(--space-1)', minWidth: 160 }}>
                        <input className="input-field" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-1) var(--space-2)', width: '100%' }} />
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
      <div className="create-bill-action-bar" style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 'var(--space-4)', alignItems: 'flex-start' }}>
        <div className="action-bar-left-group" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginRight: 'auto' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleClear} style={{ padding: '0 var(--space-2)' }} title="Clear (Alt+C)">
               <X size={14} /> {posModeEnabled && <span style={{ fontSize: 10, background: 'var(--color-bg-secondary)', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontFamily: 'monospace' }}>Alt+C</span>}
            </button>
            <button className="btn" onClick={handleClear} title="New Bill (Alt+C)">
               <Plus size={14} /> New Bill
            </button>
          </div>

          {/* Send WhatsApp Button under Clear and New Bill */}
          {billResult ? (
            <a href={getWhatsAppUrl(billResult)} target="_blank" rel="noopener noreferrer" className="btn btn-primary whatsapp-btn-mobile" style={{ backgroundColor: '#25D366', borderColor: '#25D366', alignSelf: 'flex-start' }} title="Send WhatsApp (Alt+W)" onClick={() => { logWhatsAppSendAction(billResult.id, billResult.customerPhone); if (billResult.billNumber.startsWith('DRAFT')) handleCreateBill(false); }}>
               <MessageSquare size={14} /> Send WhatsApp {posModeEnabled && <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontFamily: 'monospace' }}>Alt+W</span>}
            </a>
          ) : (
            <button className="btn btn-primary whatsapp-btn-mobile" onClick={() => handleWhatsAppDirectly(window.open('about:blank', '_blank'))} disabled={saving || items.length === 0} style={{ backgroundColor: '#25D366', borderColor: '#25D366', alignSelf: 'flex-start' }} title="Send WhatsApp (Alt+W)">
               <MessageSquare size={14} /> Send WhatsApp {posModeEnabled && <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontFamily: 'monospace' }}>Alt+W</span>}
            </button>
          )}
        </div>

        <div className="action-bar-right-group" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          {(billResult || previewBillNumber) && (
            <span style={{ fontWeight: 'var(--weight-bold)', color: billResult ? 'var(--color-success)' : '#888', fontFamily: 'monospace', display: 'flex', alignItems: 'center', marginRight: 'var(--space-1)' }}>
              {billResult ? <Check size={16} style={{ marginRight: 4 }} /> : <span style={{ fontSize: 12, marginRight: 4 }}>NEW</span>} 
              {billResult ? billResult.billNumber : previewBillNumber}
            </span>
          )}

          {billResult ? (
            <a href={`${billResult.billUrl}?print=1`} target="_blank" rel="noopener noreferrer" className="btn" title="Print (Alt+P)" onClick={() => { if (billResult.billNumber.startsWith('DRAFT')) handleCreateBill(false); }}>
               <Printer size={14} /> Print {posModeEnabled && <span style={{ fontSize: 10, background: 'var(--color-bg-secondary)', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontFamily: 'monospace' }}>Alt+P</span>}
            </a>
          ) : (
            <button className="btn" onClick={() => handlePrintDirectly(window.open('about:blank', '_blank'))} disabled={saving || items.length === 0} title="Print (Alt+P)">
               <Printer size={14} /> Print {posModeEnabled && <span style={{ fontSize: 10, background: 'var(--color-bg-secondary)', padding: '1px 5px', borderRadius: 4, marginLeft: 4, fontFamily: 'monospace' }}>Alt+P</span>}
            </button>
          )}
          
          <button className="btn btn-primary" onClick={() => handleCreateBill(false)} disabled={saving || items.length === 0} title="Save (Alt+C)">
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save
          </button>
        </div>
      </div>

      {/* Calculator Widget */}
      {isPortraitMobile ? (
        typeof document !== 'undefined' && document.getElementById('mobile-sidebar-widget-area') 
          ? createPortal(
              <StandardCalculatorWidget
                defaultGstPercent={defaultGstPercent}
                defaultDiscountPercent={defaultDiscountVal}
                defaultDiscountType={defaultDiscountType}
              />,
              document.getElementById('mobile-sidebar-widget-area')!
            )
          : null
      ) : (
        <StandardCalculatorWidget
          defaultGstPercent={defaultGstPercent}
          defaultDiscountPercent={defaultDiscountVal}
          defaultDiscountType={defaultDiscountType}
        />
      )}
      {/* Camera Barcode Scanner Modal with Body Scroll Lock & Isolated Stream */}
      {showCameraScanner && (
        <CameraBarcodeModal
          onScan={handleContinuousScan}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Save Uncataloged Barcode Modal */}
      {uncatalogedBarcode && (
        <SaveUncatalogedProductModal
          barcodeValue={uncatalogedBarcode}
          onSaveAndAdd={(item) => addItemFromSearch(item, 'barcode')}
          onClose={() => setUncatalogedBarcode(null)}
        />
      )}
    </div>
  );
}

interface CameraBarcodeModalProps {
  onScan: (code: string) => Promise<{ success: boolean; name?: string; price?: number; code?: string }>;
  onClose: () => void;
}

function CameraBarcodeModal({ onScan, onClose }: CameraBarcodeModalProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const lastScanTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Body scroll lock on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleScanCode = async (code: string) => {
    if (!code || !code.trim()) return;
    const clean = code.trim();
    const res = await onScan(clean);
    if (res.success && res.name) {
      setScanFeedback({ text: `✅ Added: ${res.name} (₹${res.price})` });
      setTimeout(() => setScanFeedback(null), 2500);
    } else {
      setScanFeedback({ text: `⚠️ No product found for barcode: ${res.code || clean}`, isError: true });
      setTimeout(() => setScanFeedback(null), 3000);
    }
  };

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let isMounted = true;

    async function initScanner() {
      try {
        const scannerElement = document.getElementById('camera-scanner-view');
        if (!scannerElement || !isMounted) return;

        scanner = new Html5Qrcode('camera-scanner-view', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
          },
          (decodedText) => {
            if (decodedText && decodedText.trim()) {
              const clean = decodedText.trim();
              const now = Date.now();
              if (lastScanTimeRef.current.code === clean && now - lastScanTimeRef.current.time < 1500) {
                return;
              }
              lastScanTimeRef.current = { code: clean, time: now };
              handleScanCode(clean);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error('Camera scanner start error:', err);
      }
    }

    const timer = setTimeout(initScanner, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scanner) {
        try {
          if (scanner.isScanning) {
            scanner.stop();
          }
        } catch {}
      }
    };
  }, []);

  return (
    <div className="void-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="void-modal" style={{ maxWidth: 440, width: '92%', textAlign: 'center', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}><Camera size={16} /> Live Camera Barcode Scanner</h3>
          <button className="bills-action-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div id="camera-scanner-view" style={{ width: '100%', minHeight: 220, background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />

        {scanFeedback && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: scanFeedback.isError ? 'var(--color-error-subtle, rgba(239,68,68,0.15))' : 'var(--color-success-subtle, rgba(16,185,129,0.15))', color: scanFeedback.isError ? 'var(--color-error, #ef4444)' : 'var(--color-success, #10b981)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
            {scanFeedback.text}
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Or type/scan barcode (e.g. BLU003)"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualBarcode.trim()) {
                handleScanCode(manualBarcode.trim());
                setManualBarcode('');
              }
            }}
            className="input-field"
            style={{ flex: 1, fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (manualBarcode.trim()) {
                handleScanCode(manualBarcode.trim());
                setManualBarcode('');
              }
            }}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            Add Product
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Continuous multi-scan active
          </span>
          <button className="btn btn-primary" onClick={onClose} style={{ fontSize: 'var(--text-xs)' }}>
            Done / Close Camera
          </button>
        </div>
      </div>
    </div>
  );
}

interface SaveUncatalogedModalProps {
  barcodeValue: string;
  onSaveAndAdd: (item: SearchResult) => void;
  onClose: () => void;
}

function SaveUncatalogedProductModal({ barcodeValue, onSaveAndAdd, onClose }: SaveUncatalogedModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [gstPercent, setGstPercent] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Lock body scroll on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter a product name.'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) { setError('Please enter a valid price.'); return; }

    setSaving(true);
    setError('');
    const res = await saveAndAddUncatalogedItemAction({
      name: name.trim(),
      price: parsedPrice,
      barcodeValue,
      unit,
      gstPercent: parseFloat(gstPercent) || 0,
    });

    if (res.item) {
      onSaveAndAdd(res.item);
      onClose();
    } else {
      setError(res.error || 'Failed to save product to catalog.');
      setSaving(false);
    }
  };

  return (
    <div className="void-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="void-modal" style={{ maxWidth: 420, width: '92%', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
            <Barcode size={16} style={{ color: 'var(--color-accent)' }} /> New Product Barcode Detected
          </h3>
          <button className="bills-action-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ background: 'var(--color-bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Barcode:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>{barcodeValue}</span>
        </div>

        {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Product Name *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Dairy Milk Silk 150g"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: 'var(--text-xs)' }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="100"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ fontSize: 'var(--text-xs)' }}
              />
            </div>
            <div style={{ width: 85 }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Unit</label>
              <select
                className="input-field"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ fontSize: 'var(--text-xs)', padding: '6px' }}
              >
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="pack">pack</option>
              </select>
            </div>
            <div style={{ width: 75 }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>GST %</label>
              <input
                type="number"
                className="input-field"
                placeholder="0"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
                style={{ fontSize: 'var(--text-xs)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: 'var(--text-xs)' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 'var(--text-xs)' }}>
              {saving ? <Loader2 size={14} className="spinner" /> : <Check size={14} />} Add to Bill & Save to Catalog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
