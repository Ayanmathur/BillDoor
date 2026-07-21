'use client';

/**
 * Billit — Catalog Management (§5.4)
 *
 * Product/service list with add/edit/delete.
 * Typeahead search. Barcode field shown if client.barcode_enabled.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Edit3, Trash2, Package, Loader2, X, Save, Barcode, Printer, Download
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import './../billit.css';
import {
  fetchCatalogAction,
  addCatalogItemAction,
  updateCatalogItemAction,
  deleteCatalogItemAction,
} from './actions';

interface CatalogItem {
  id: string;
  name: string;
  type: string;
  price: number;
  unit: string | null;
  gst_percent: number;
  discount_type: string;
  discount_value: number;
  description: string | null;
  barcode_value: string | null;
  barcode_auto_generated: boolean;
  buffer_after_min: number;
}

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'product' | 'service'>('product');
  const [formPrice, setFormPrice] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formGst, setFormGst] = useState('0');
  const [formDiscountType, setFormDiscountType] = useState('₹');
  const [formDiscountValue, setFormDiscountValue] = useState('0');
  const [formFinalPrice, setFormFinalPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formBuffer, setFormBuffer] = useState('0');

  const loadItems = useCallback(async () => {
    const result = await fetchCatalogAction(search || undefined);
    if (result.items) setItems(result.items as CatalogItem[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { loadItems(); }, [loadItems]);

  function resetForm() {
    setFormName(''); setFormType('product'); setFormPrice(''); setFormUnit('');
    setFormGst('0'); setFormDiscountType('₹'); setFormDiscountValue('0'); setFormFinalPrice('');
    setFormDesc(''); setFormBarcode(''); setFormBuffer('0'); setEditingId(null);
    setShowForm(false); setError('');
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setFormName(item.name);
    setFormType(item.type as 'product' | 'service');
    setFormPrice(String(item.price));
    setFormUnit(item.unit || '');
    setFormGst(String(item.gst_percent));
    setFormDiscountType(item.discount_type || '₹');
    setFormDiscountValue(String(item.discount_value || 0));
    setFormDesc(item.description || '');
    setFormBarcode(item.barcode_value || '');
    setFormBuffer(String(item.buffer_after_min || 0));
    setShowForm(true);
    
    // Calc initial final price
    const base = Number(item.price) || 0;
    const gPct = Number(item.gst_percent) || 0;
    const dVal = Number(item.discount_value) || 0;
    let afterD = base;
    if (item.discount_type === '₹') afterD = base - dVal;
    else if (item.discount_type === '%') afterD = base * (1 - dVal / 100);
    setFormFinalPrice((afterD * (1 + gPct / 100)).toFixed(2));
  }

  function handleBaseParamsChange(p: string, dT: string, dV: string, g: string) {
    const base = Number(p) || 0;
    const gPct = Number(g) || 0;
    const dVal = Number(dV) || 0;
    let afterD = base;
    if (dT === '₹') afterD = base - dVal;
    else if (dT === '%') afterD = base * (1 - dVal / 100);
    setFormFinalPrice((afterD * (1 + gPct / 100)).toFixed(2));
  }

  function handleFinalPriceChange(val: string) {
    setFormFinalPrice(val);
    const finalP = Number(val) || 0;
    const gPct = Number(formGst) || 0;
    const dVal = Number(formDiscountValue) || 0;
    const dT = formDiscountType;
    
    const afterD = finalP / (1 + gPct / 100);
    let base = afterD;
    if (dT === '₹') base = afterD + dVal;
    else if (dT === '%') base = afterD / (1 - dVal / 100);
    
    setFormPrice(base.toFixed(2));
  }

  async function handleSave() {
    setSaving(true); setError('');
    const data = {
      name: formName,
      type: formType,
      price: Number(formPrice) || 0,
      unit: formUnit || undefined,
      gstPercent: Number(formGst) || 0,
      discountType: formDiscountType as '₹' | '%',
      discountValue: Number(formDiscountValue) || 0,
      description: formDesc || undefined,
      barcodeValue: formBarcode || undefined,
      bufferAfterMin: Number(formBuffer) || 0,
    };

    const result = editingId
      ? await updateCatalogItemAction(editingId, data)
      : await addCatalogItemAction(data);

    if (result.error) { setError(result.error); setSaving(false); return; }
    resetForm();
    setSaving(false);
    await loadItems();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item? It will be removed from future bills.')) return;
    await deleteCatalogItemAction(id);
    await loadItems();
  }

  /**
   * Print barcode label — Code128 SVG via JsBarcode
   * Sized for generic 40mm × 30mm label stock.
   */
  function handlePrintLabel(item: CatalogItem) {
    if (!item.barcode_value) return;

    // Create SVG barcode
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    JsBarcode(svg, item.barcode_value, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 12,
      font: 'monospace',
      margin: 4,
    });
    const svgHtml = svg.outerHTML;

    const labelHtml = `
      <div class="label">
        <div class="label-name">${item.name}</div>
        <div class="label-price">₹${item.price}</div>
        ${svgHtml}
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Labels — ${item.name}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body { margin: 0; font-family: Arial, sans-serif; background: #fff; }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(8, 1fr);
            height: 277mm; /* A4 height approx 297mm - 20mm margin */
            row-gap: 5mm;
            column-gap: 5mm;
          }
          .label {
            border: 1px dashed #ccc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2mm;
            text-align: center;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
          .label-name { 
            font-size: 14pt; 
            font-weight: bold; 
            margin-bottom: 2mm; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            max-width: 90%; 
          }
          .label-price { 
            font-size: 12pt; 
            color: #333; 
            margin-bottom: 2mm; 
          }
          svg { max-width: 90%; height: auto; }
          @media print {
            .label { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${Array(16).fill(labelHtml).join('')}
        </div>
        <script>
          window.onload = function() { 
            setTimeout(() => { window.print(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function handleDownloadBarcode(item: CatalogItem) {
    if (!item.barcode_value) return;
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    JsBarcode(svg, item.barcode_value, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      font: 'monospace',
      margin: 10,
    });
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode-${item.barcode_value}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, maxWidth: 320 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input className="input-field" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34, fontSize: 'var(--text-sm)' }} />
          </div>
        </div>
        <button className="btn-add-item" onClick={() => { resetForm(); setShowForm(true); }}>
          <span className="btn-add-text">Add Item</span>
          <span className="btn-add-icon"><Plus size={18} /></span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="settings-section" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="settings-section-title">
            {editingId ? <Edit3 size={18} /> : <Plus size={18} />}
            {editingId ? 'Edit Item' : 'Add Item'}
            <button onClick={resetForm} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}><X size={18} /></button>
          </h3>
          {error && <div style={{ padding: 'var(--space-2)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>{error}</div>}
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label">Name *</label>
              <input className="input-field" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Blueberry Muffin" />
            </div>
            <div className="input-group">
              <label className="input-label">Type</label>
              <select className="input-field" value={formType} onChange={(e) => setFormType(e.target.value as any)}>
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </div>
          </div>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label">Base Price (₹) *</label>
              <input className="input-field" type="number" min="0" step="0.01" value={formPrice} 
                onChange={(e) => {
                  setFormPrice(e.target.value);
                  handleBaseParamsChange(e.target.value, formDiscountType, formDiscountValue, formGst);
                }} placeholder="0.00" />
            </div>
            <div className="input-group" style={{ maxWidth: 100 }}>
              <label className="input-label">Disc. Type</label>
              <select className="input-field" value={formDiscountType} onChange={(e) => {
                setFormDiscountType(e.target.value);
                handleBaseParamsChange(formPrice, e.target.value, formDiscountValue, formGst);
              }}>
                <option value="₹">₹ Off</option>
                <option value="%">% Off</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Discount Value</label>
              <input className="input-field" type="number" min="0" value={formDiscountValue} 
                onChange={(e) => {
                  setFormDiscountValue(e.target.value);
                  handleBaseParamsChange(formPrice, formDiscountType, e.target.value, formGst);
                }} placeholder="0" />
            </div>
            <div className="input-group">
              <label className="input-label">GST %</label>
              <input className="input-field" type="number" min="0" max="100" value={formGst} 
                onChange={(e) => {
                  setFormGst(e.target.value);
                  handleBaseParamsChange(formPrice, formDiscountType, formDiscountValue, e.target.value);
                }} />
            </div>
          </div>
          <div className="settings-row" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
            <div className="input-group">
              <label className="input-label" style={{ color: 'var(--color-text)' }}>Final Selling Price (₹) <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'normal' }}>(Base - Disc + GST)</span></label>
              <input className="input-field" type="number" min="0" step="0.01" value={formFinalPrice} 
                onChange={(e) => handleFinalPriceChange(e.target.value)} placeholder="0.00" style={{ fontWeight: 'bold' }} />
            </div>
            <div className="input-group">
              <label className="input-label">Unit</label>
              <input className="input-field" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="pcs, kg, hr..." />
            </div>
          </div>
          <div className="settings-row">
            <div className="input-group">
              <label className="input-label"><Barcode size={14} style={{ verticalAlign: -2 }} /> Barcode</label>
              <input className="input-field" value={formBarcode} onChange={(e) => setFormBarcode(e.target.value)} placeholder="Auto-generated if empty" />
            </div>
          </div>
          <div className="settings-row full">
            <div className="input-group">
              <label className="input-label">Description</label>
              <input className="input-field" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional" />
            </div>
            {formType === 'service' && (
              <div className="input-group">
                <label className="input-label">Buffer time after service (min)</label>
                <input className="input-field" type="number" min="0" value={formBuffer} onChange={(e) => setFormBuffer(e.target.value)} />
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 'var(--space-2)' }}>
            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} {editingId ? 'Update' : 'Add'}
          </button>
        </div>
      )}

      {/* Items List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}>
          <Loader2 size={24} className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-tertiary)' }}>
          <Package size={40} style={{ marginBottom: 'var(--space-2)', opacity: 0.3 }} />
          <p>No items yet. Add your products or services to get started.</p>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Price</th>
                <th>GST</th>
                <th>Barcode</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'var(--weight-medium)' }}>
                    {item.name}
                    {item.unit && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 4 }}>/ {item.unit}</span>}
                  </td>
                  <td><span className={`status-badge ${item.type === 'product' ? 'active' : 'unused'}`}>{item.type}</span></td>
                  <td>₹{item.price.toLocaleString('en-IN')}</td>
                  <td>{item.gst_percent}%</td>
                  <td style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace' }}>
                    {item.barcode_value || <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                  </td>
                  <td>
                    <div className="action-row">
                      <button className="action-btn" title="Edit" onClick={() => startEdit(item)}><Edit3 size={14} /></button>
                      {item.barcode_value && (
                        <>
                          <button className="action-btn" title="Download Barcode" onClick={() => handleDownloadBarcode(item)}><Download size={14} /></button>
                          <button className="action-btn" title="Print Label" onClick={() => handlePrintLabel(item)}><Printer size={14} /></button>
                        </>
                      )}
                      <button className="action-btn danger" title="Delete" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
