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
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  
  const [rows, setRows] = useState<BulkStagingRow[]>([]);
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [defaultGst, setDefaultGst] = useState(0);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'product' | 'service'>('product');
  const [editPrice, setEditPrice] = useState('');
  const [editGst, setEditGst] = useState('');
  const [editBarcode, setEditBarcode] = useState('');

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

  const handleDownloadTemplate = () => {
    const sample = [
      'Name,Type,Price,GST,Barcode',
      'Masala Chai,product,20,5,',
      'Haircut Service,service,150,18,',
      'Samosa,product,15,,BC-99123',
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
    <div style={{ maxWidth: 800 }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <FileSpreadsheet size={22} color="var(--color-accent)" /> Bulk Product / Service Import
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Upload a CSV file containing your items to import them in bulk into your catalog.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => router.push('/dashboard/billit/catalog/import')} style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Camera size={14} /> Snap Menu Photo (Camera)
              </button>
              <button className="btn" onClick={handleDownloadTemplate} style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Download Sample Template
              </button>
            </div>
          </div>

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
