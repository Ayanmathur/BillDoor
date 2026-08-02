'use client';

/**
 * Menu Photo → Catalog Import Page
 *
 * Flow:
 * 1. Client uploads a menu photo
 * 2. Gemini OCR extracts {name, price} pairs
 * 3. Client reviews/edits the staging list
 * 4. Client picks bulk GST rate
 * 5. "Confirm & Import" commits to catalog_items
 *
 * NEVER auto-imports — mandatory human review.
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Upload, Camera, Loader2, Check, X,
  Edit3, Trash2, Save, AlertCircle, IndianRupee,
} from 'lucide-react';
import {
  extractMenuItemsAction,
  commitStagingItemsAction,
  discardStagingAction,
} from './actions';

interface StagingItem {
  name: string;
  price: number;
}

export default function MenuImportPage() {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');

  const [stagingId, setStagingId] = useState('');
  const [items, setItems] = useState<StagingItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [gstRate, setGstRate] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  // Live Camera Viewfinder State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
    setError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraFacing(facing);
      setIsCameraOpen(true);
      
      // Delay play to allow video DOM element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Could not access live camera. Please check browser permissions or select an image file.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const captureCameraPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', 0.9);
    const base64 = dataUrl.split(',')[1];
    
    stopCamera();
    setUploading(true);
    setError('');

    try {
      const result = await extractMenuItemsAction(base64, 'image/webp');
      if (result?.error) {
        setError(result.error);
        setUploading(false);
        return;
      }
      setStagingId(result.stagingId || '');
      setItems(result.items || []);
      setStep('review');
      setUploading(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to process camera photo.');
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      return;
    }

    setUploading(true);
    setError('');

    const reader = new FileReader();
    reader.onerror = () => {
      setError('Failed to read image file.');
      setUploading(false);
    };
    reader.onload = async () => {
      try {
        const rawResult = reader.result as string;
        const base64 = rawResult.includes(',') ? rawResult.split(',')[1] : rawResult;
        const mimeType = file.type || 'image/webp';
        
        const result = await extractMenuItemsAction(base64, mimeType);

        if (result?.error) {
          setError(result.error);
          setUploading(false);
          return;
        }

        setStagingId(result.stagingId || '');
        setItems(result.items || []);
        setStep('review');
        setUploading(false);
      } catch (err: any) {
        console.error('Menu import upload error:', err);
        setError(err?.message || 'Failed to process image. Please try again.');
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditName(items[index].name);
    setEditPrice(String(items[index].price));
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price) || price <= 0) return;

    setItems(prev => prev.map((item, i) =>
      i === editingIndex ? { name: editName.trim(), price } : item
    ));
    setEditingIndex(null);
  };

  const handleCommit = async () => {
    if (items.length === 0) return;
    setCommitting(true);
    setError('');

    const result = await commitStagingItemsAction({
      stagingId,
      items,
      gstRate,
    });

    if (result.error) {
      setError(result.error);
      setCommitting(false);
      return;
    }

    setImportedCount(result.count || items.length);
    setStep('done');
    setCommitting(false);
  };

  const handleDiscard = async () => {
    if (stagingId) await discardStagingAction(stagingId);
    setItems([]);
    setStagingId('');
    setStep('upload');
    setError('');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Link href="/dashboard/billit/catalog" className="btn" style={{ padding: 'var(--space-2)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
            Menu Photo Import
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Upload a menu photo and we&apos;ll extract items for your catalog
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-error)' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: 'var(--text-sm)' }}>{error}</span>
          </div>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="settings-section" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <Camera size={48} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 var(--space-2)' }}>
            Upload Your Menu Photo
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Take a clear photo of your menu, price list, or rate card.
            We&apos;ll extract item names and prices automatically.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.click();
                }
              }}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 size={16} className="spinner" /> Processing Image...</>
              ) : (
                <><Upload size={16} /> Choose Image File</>
              )}
            </button>

            <button
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-accent)', color: 'var(--color-accent)', background: 'var(--color-accent-subtle)' }}
              onClick={() => startCamera('environment')}
              disabled={uploading}
            >
              <Camera size={16} /> Open Camera Viewfinder
            </button>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-3)' }}>
            Supported formats: JPEG, PNG, WebP · Max size: 10MB
          </p>
        </div>
      )}

      {/* Live In-App Camera Viewfinder Modal */}
      {isCameraOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0, 0, 0, 0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-4)', color: '#ffffff'
        }}>
          {/* Header */}
          <div style={{ width: '100%', maxWidth: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: 'var(--text-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={20} color="var(--color-accent)" /> Live Menu Camera
            </div>
            <button
              onClick={stopCamera}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: 8, borderRadius: '50%', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Video Stream Container */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: 600, flex: 1, marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            borderRadius: 'var(--radius-lg)', background: '#000', border: '2px solid var(--color-border-subtle)'
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            
            {/* Target Guide Framing */}
            <div style={{
              position: 'absolute', inset: '10%', border: '2px dashed rgba(255, 255, 255, 0.5)',
              borderRadius: 'var(--radius-md)', pointerEvents: 'none', display: 'flex', alignItems: 'flex-start',
              justifyContent: 'center', padding: 12
            }}>
              <span style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                Center Menu Card Here
              </span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ width: '100%', maxWidth: 600, display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 12 }}>
            <button
              onClick={() => startCamera(cameraFacing === 'environment' ? 'user' : 'environment')}
              className="btn"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 'var(--text-xs)' }}
            >
              Flip Camera
            </button>

            <button
              onClick={captureCameraPhoto}
              style={{
                width: 68, height: 68, borderRadius: '50%', background: 'var(--color-accent)',
                border: '4px solid #ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)', transition: 'transform 0.1s ease'
              }}
              title="Snap Menu Photo"
            >
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #fff' }} />
            </button>

            <button
              onClick={stopCamera}
              className="btn"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 'var(--text-xs)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div>
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 className="settings-section-title" style={{ margin: 0 }}>
                Review Extracted Items ({items.length})
              </h2>
              <button className="btn" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }} onClick={handleDiscard}>
                <X size={14} /> Discard All
              </button>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Review and edit items below. Delete any incorrect entries before importing.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th style={{ textAlign: 'right' }}>Price (₹)</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      {editingIndex === index ? (
                        <>
                          <td>
                            <input
                              type="text"
                              className="input-field"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: 'var(--text-sm)' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              className="input-field"
                              value={editPrice}
                              onChange={e => setEditPrice(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: 'var(--text-sm)', width: 100 }}
                            />
                          </td>
                          <td>
                            <button className="btn-icon" onClick={handleSaveEdit} title="Save">
                              <Save size={14} />
                            </button>
                            <button className="btn-icon" onClick={() => setEditingIndex(null)} title="Cancel">
                              <X size={14} />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{item.name}</td>
                          <td style={{ textAlign: 'right' }}>₹{item.price.toLocaleString('en-IN')}</td>
                          <td>
                            <button className="btn-icon" onClick={() => handleStartEdit(index)} title="Edit">
                              <Edit3 size={14} />
                            </button>
                            <button className="btn-icon" onClick={() => handleDeleteItem(index)} title="Delete" style={{ color: 'var(--color-error)' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-4)' }}>
                All items removed. <button className="btn" onClick={handleDiscard} style={{ fontSize: 'var(--text-sm)' }}>Start Over</button>
              </p>
            )}
          </div>

          {/* GST Rate + Commit */}
          {items.length > 0 && (
            <div className="settings-section" style={{ marginTop: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>
                Apply GST Rate (all items)
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                {[0, 5, 12, 18, 28].map(rate => (
                  <button
                    key={rate}
                    className={`btn ${gstRate === rate ? 'btn-primary' : ''}`}
                    style={{ fontSize: 'var(--text-sm)' }}
                    onClick={() => setGstRate(rate)}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleCommit}
                disabled={committing}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {committing ? (
                  <><Loader2 size={16} className="spinner" /> Importing...</>
                ) : (
                  <><Check size={16} /> Confirm & Import {items.length} Items</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <div className="settings-section" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <Check size={48} style={{ color: 'var(--color-success)', marginBottom: 'var(--space-3)' }} />
          <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 var(--space-2)' }}>
            {importedCount} items imported!
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Your catalog has been updated with the imported items.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Link href="/dashboard/billit/catalog" className="btn btn-primary">
              View Catalog
            </Link>
            <button className="btn" onClick={() => { setStep('upload'); setItems([]); setStagingId(''); setImportedCount(0); }}>
              Import Another Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
