'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, Check, X,
  AlertTriangle, Loader2, Edit3, Trash2, Save, IndianRupee, Camera,
} from 'lucide-react';
import {
  parseBulkImportFileAction,
  commitBulkCatalogItemsAction,
  BulkStagingRow,
} from './actions';

export default function BulkImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [importMethod, setImportMethod] = useState<'file' | 'paste' | 'ai_guide'>('file');
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  
  const [rows, setRows] = useState<BulkStagingRow[]>([]);
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [defaultGst, setDefaultGst] = useState(0);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'product' | 'service'>('product');
  const [editPrice, setEditPrice] = useState('');
  const [editGst, setEditGst] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async () => {
      const csvText = reader.result as string;
      const result = await parseBulkImportFileAction(csvText);

      if (result.error) {
        setError(result.error);
        setUploading(false);
        return;
      }

      setRows(result.rows);
      setBarcodeEnabled(result.barcodeEnabled);
      setDefaultGst(result.defaultGst);
      setStep('review');
      setUploading(false);
    };
    reader.readAsText(file);
  };

  const handleParsePastedText = async () => {
    if (!pastedText.trim()) {
      setError('Please paste CSV or tabular text first.');
      return;
    }
    setUploading(true);
    setError('');

    const result = await parseBulkImportFileAction(pastedText);
    if (result.error) {
      setError(result.error);
      setUploading(false);
      return;
    }

    setRows(result.rows);
    setBarcodeEnabled(result.barcodeEnabled);
    setDefaultGst(result.defaultGst);
    setStep('review');
    setUploading(false);
  };

  const aiPromptText = `You are an expert menu & catalog parser. Extract all product and service items from the attached image into clean CSV format.

CSV Header Format: Name, Price, Category, Type, GST, Barcode

Rules:
1. Name: Item title (e.g. Masala Chai, Haircut Service, Samosa). If items have variants like Full/Half, create separate entries (e.g. "Tandoori Chicken (Full)", "Tandoori Chicken (Half)").
2. Price: Numeric price in INR without currency symbols.
3. Category: Section or category header name (e.g. Beverages, Bakery, Snacks, Main Course, Hair Care, Salon Services).
4. Type: Must be either "product" or "service".
5. GST: Applicable GST percentage (e.g. 5, 12, 18) or leave blank if standard.
6. Barcode: Leave blank unless a specific barcode/SKU code is printed (e.g. BC-99123).

Return ONLY raw CSV text lines. Do not wrap in markdown code blocks or add explanations.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiPromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleDownloadTemplate = () => {
    const sample = [
      'Name, Price, Category, Type, GST, Barcode',
      'Masala Chai, 20, Beverages, product, 5,',
      'Haircut Service, 150, Salon Services, service, 18,',
      'Samosa, 15, Snacks, product, 5, BC-99123',
    ].join('\n');

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalog_bulk_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    const r = rows[index];
    setEditingIndex(index);
    setEditName(r.name);
    setEditType(r.type);
    setEditPrice(String(r.price));
    setEditGst(String(r.gstPercent));
    setEditBarcode(r.barcode);
    setEditCategory(r.category || '');
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const price = parseFloat(editPrice) || 0;
    const gst = parseFloat(editGst) || 0;

    setRows(prev => prev.map((r, i) =>
      i === editingIndex
        ? {
            ...r,
            name: editName.trim(),
            type: editType,
            price,
            gstPercent: gst,
            barcode: editBarcode.trim(),
            category: editCategory.trim(),
            hasTypeWarning: false,
          }
        : r
    ));
    setEditingIndex(null);
  };

  const handleCommit = async () => {
    if (!rows.length) return;
    setCommitting(true);
    setError('');

    const res = await commitBulkCatalogItemsAction(rows);
    if (res.error) {
      setError(res.error);
      setCommitting(false);
      return;
    }

    setStep('done');
    setCommitting(false);
  };

  return (
    <div style={{ maxWidth: 840 }}>
      <Link href="/dashboard/billit/catalog" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
        <ArrowLeft size={16} /> Back to Catalog
      </Link>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                <FileSpreadsheet size={22} color="var(--color-accent)" /> Bulk Product / Service Import
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, margin: 0 }}>
                Import items via CSV file, copy-paste AI text, or follow our AI menu scanner guide.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => router.push('/dashboard/billit/catalog/import')} style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}>
                <Camera size={14} /> Snap Menu Photo (Live Camera)
              </button>
              <button className="btn" onClick={handleDownloadTemplate} style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Download Sample Template
              </button>
            </div>
          </div>

          {/* Import Method Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-4)', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setImportMethod('file')}
              style={{
                padding: '8px 16px', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)',
                borderBottom: importMethod === 'file' ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: importMethod === 'file' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer'
              }}
            >
              📁 Upload CSV File
            </button>
            <button
              onClick={() => setImportMethod('paste')}
              style={{
                padding: '8px 16px', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)',
                borderBottom: importMethod === 'paste' ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: importMethod === 'paste' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer'
              }}
            >
              📋 Paste CSV / AI Text
            </button>
            <button
              onClick={() => setImportMethod('ai_guide')}
              style={{
                padding: '8px 16px', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)',
                borderBottom: importMethod === 'ai_guide' ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: importMethod === 'ai_guide' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer'
              }}
            >
              🤖 AI Prompt & Guide
            </button>
          </div>

          {/* Method 1: File Upload */}
          {importMethod === 'file' && (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8)',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--color-bg-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
              {uploading ? (
                <Loader2 size={32} className="spinner" style={{ color: 'var(--color-accent)' }} />
              ) : (
                <>
                  <Upload size={36} style={{ color: 'var(--color-accent)', marginBottom: 8 }} />
                  <div style={{ fontWeight: 'bold', fontSize: 'var(--text-md)' }}>Click to upload CSV spreadsheet</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    Expected columns: Name, Type, Price, GST, Barcode
                  </div>
                </>
              )}
            </div>
          )}

          {/* Method 2: Direct Paste CSV / AI Output */}
          {importMethod === 'paste' && (
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                Paste raw CSV text, Excel tab-separated rows, or AI-generated output from Gemini / ChatGPT / Grok below:
              </p>
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={`Name,Type,Price,GST,Barcode\nMasala Chai,product,20,5,\nHaircut Service,service,150,18,\nSamosa,product,15,,BC-99123`}
                rows={8}
                style={{
                  width: '100%', fontFamily: 'monospace', fontSize: 'var(--text-xs)', padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)'
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleParsePastedText}
                disabled={uploading || !pastedText.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {uploading ? <Loader2 size={16} className="spinner" /> : <Check size={16} />} Parse & Review Data
              </button>
            </div>
          )}

          {/* Method 3: AI Prompt & Guide */}
          {importMethod === 'ai_guide' && (
            <div>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', marginBottom: 'var(--space-3)' }}>
                Systematic AI Menu Scanner & CSV Import Instructions
              </h3>
              
              <ol style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, paddingLeft: 18, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                <li style={{ marginBottom: 6 }}>
                  <strong>Step 1: Open an AI Assistant app or website</strong><br />
                  Open <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>Gemini</a>, <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>ChatGPT</a>, <a href="https://grok.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>Grok</a>, or <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>Claude</a>.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>Step 2: Upload or Snap Menu Photo</strong><br />
                  Click the camera or image attachment icon in the AI chat box and attach your menu card or price list photo.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>Step 3: Copy and Paste the AI Prompt below</strong><br />
                  Copy the systematic prompt box below and send it to the AI alongside your image.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong>Step 4: Copy the AI CSV Output & Paste into BillDoor</strong><br />
                  Copy the generated CSV output, click the <strong>&quot;Paste CSV / AI Text&quot;</strong> tab above, paste the text, and click <strong>Parse & Review</strong>!
                </li>
              </ol>

              {/* Copyable AI Prompt Box */}
              <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold' }}>📋 Copyable AI Prompt (for Gemini / ChatGPT / Grok)</span>
                  <button
                    className="btn btn-primary"
                    onClick={handleCopyPrompt}
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {copiedPrompt ? <Check size={12} /> : <FileSpreadsheet size={12} />} {copiedPrompt ? 'Copied to Clipboard!' : 'Copy Prompt'}
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-text-secondary)', background: 'var(--color-bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                  {aiPromptText}
                </pre>
              </div>

              {/* Sample Template Structure Table Preview */}
              <div>
                <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
                  Sample Template Structure Reference:
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', border: '1px solid var(--color-border)' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 10px' }}>Name</th>
                        <th style={{ padding: '6px 10px' }}>Type</th>
                        <th style={{ padding: '6px 10px' }}>Price</th>
                        <th style={{ padding: '6px 10px' }}>GST</th>
                        <th style={{ padding: '6px 10px' }}>Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '6px 10px' }}>Masala Chai</td>
                        <td style={{ padding: '6px 10px' }}>product</td>
                        <td style={{ padding: '6px 10px' }}>20</td>
                        <td style={{ padding: '6px 10px' }}>5</td>
                        <td style={{ padding: '6px 10px', color: 'var(--color-text-tertiary)' }}>(blank)</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '6px 10px' }}>Haircut Service</td>
                        <td style={{ padding: '6px 10px' }}>service</td>
                        <td style={{ padding: '6px 10px' }}>150</td>
                        <td style={{ padding: '6px 10px' }}>18</td>
                        <td style={{ padding: '6px 10px', color: 'var(--color-text-tertiary)' }}>(blank)</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 10px' }}>Samosa</td>
                        <td style={{ padding: '6px 10px' }}>product</td>
                        <td style={{ padding: '6px 10px' }}>15</td>
                        <td style={{ padding: '6px 10px', color: 'var(--color-text-tertiary)' }}>(blank)</td>
                        <td style={{ padding: '6px 10px' }}>BC-99123</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'bold' }}>Review & Edit Import Staging List ({rows.length} items)</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                Blank GST auto-filled with default ({defaultGst}%). Verify rows before importing.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-secondary" onClick={() => setStep('upload')}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCommit} disabled={committing || rows.length === 0}>
                {committing ? <Loader2 size={16} className="spinner" /> : <Check size={16} />} Confirm & Import ({rows.length})
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Name</th>
                  <th style={{ padding: '8px' }}>Category</th>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>GST%</th>
                  {barcodeEnabled && <th style={{ padding: '8px' }}>Barcode</th>}
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)', background: r.hasTypeWarning ? 'var(--color-warning-subtle)' : 'transparent' }}>
                    {editingIndex === i ? (
                      <>
                        <td style={{ padding: '4px' }}>
                          <input className="input-field" value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: '2px 6px', fontSize: 'var(--text-xs)' }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input className="input-field" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Category" style={{ padding: '2px 6px', fontSize: 'var(--text-xs)', width: 110 }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <select className="input-field" value={editType} onChange={e => setEditType(e.target.value as any)} style={{ padding: '2px 6px', fontSize: 'var(--text-xs)' }}>
                            <option value="product">product</option>
                            <option value="service">service</option>
                          </select>
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input className="input-field" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ padding: '2px 6px', fontSize: 'var(--text-xs)', width: 70 }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input className="input-field" type="number" value={editGst} onChange={e => setEditGst(e.target.value)} style={{ padding: '2px 6px', fontSize: 'var(--text-xs)', width: 50 }} />
                        </td>
                        {barcodeEnabled && (
                          <td style={{ padding: '4px' }}>
                            <input className="input-field" value={editBarcode} onChange={e => setEditBarcode(e.target.value)} style={{ padding: '2px 6px', fontSize: 'var(--text-xs)' }} />
                          </td>
                        )}
                        <td style={{ padding: '4px', textAlign: 'right' }}>
                          <button className="btn btn-primary" onClick={handleSaveEdit} style={{ padding: '2px 6px' }}><Save size={12} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{r.name}</td>
                        <td style={{ padding: '8px' }}>
                          {r.category ? (
                            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontSize: 11, fontWeight: 600 }}>
                              {r.category}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontSize: 11 }}>General</span>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontSize: 10, fontWeight: 'bold',
                            background: r.hasTypeWarning ? 'var(--color-warning)' : 'var(--color-bg-secondary)',
                            color: r.hasTypeWarning ? '#000' : 'var(--color-text-secondary)',
                          }}>
                            {r.type} {r.hasTypeWarning ? '(Unclear)' : ''}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{r.price.toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{r.gstPercent}%</td>
                        {barcodeEnabled && <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.barcode}</td>}
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="bills-action-btn" onClick={() => handleStartEdit(i)} title="Edit"><Edit3 size={14} /></button>
                            <button className="bills-action-btn" onClick={() => handleDelete(i)} title="Delete" style={{ color: 'var(--color-error)' }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="settings-section" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <Check size={48} color="var(--color-success)" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>Bulk Import Completed!</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4, marginBottom: 16 }}>
            Successfully added {rows.length} items to your catalog.
          </p>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard/billit/catalog')}>
            Go to Catalog
          </button>
        </div>
      )}
    </div>
  );
}
