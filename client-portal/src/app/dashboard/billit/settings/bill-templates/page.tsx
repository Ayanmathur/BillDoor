'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Edit3, Trash2, Save, X, Loader2, FileText,
  Braces, CheckCircle, Circle,
} from 'lucide-react';
import {
  fetchBillTemplatesAction,
  createBillTemplateAction,
  updateBillTemplateAction,
  deleteBillTemplateAction,
  setDefaultTemplateAction,
} from './actions';
import '../../../whatsapp/whatsapp.css';

interface BillTemplate {
  id: string;
  name: string;
  content: string;
  isDefaultFirstVisit: boolean;
  isDefaultRepeatVisit: boolean;
  createdAt: string;
}

const AVAILABLE_VARS = [
  { key: '{customer_name}', desc: 'Recipient\'s name' },
  { key: '{business_name}', desc: 'Your business name' },
  { key: '{bill_link}', desc: 'Link to digital bill' },
  { key: '{bill_number}', desc: 'Bill number' },
  { key: '{grand_total}', desc: 'Total bill amount' },
  { key: '{review_link}', desc: 'Link to leave a review' },
  { key: '{appointment_link}', desc: 'Link to book an appointment' },
];

export default function BillTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<BillTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');

  async function loadTemplates() {
    const res = await fetchBillTemplatesAction();
    if (res.templates) setTemplates(res.templates);
    setLoading(false);
  }

  useEffect(() => { loadTemplates(); }, []);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormContent('');
    setError('');
  }

  function startEdit(t: BillTemplate) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormContent(t.content);
    setShowForm(true);
  }

  function insertVariable(varKey: string) {
    setFormContent(prev => prev + varKey);
  }

  async function handleSave() {
    if (!formName.trim() || !formContent.trim()) {
      setError('Name and content are required.');
      return;
    }
    setSaving(true);
    setError('');

    const result = editingId
      ? await updateBillTemplateAction(editingId, { name: formName, content: formContent })
      : await createBillTemplateAction({ name: formName, content: formContent });

    if (result.error) { setError(result.error); setSaving(false); return; }
    resetForm();
    setSaving(false);
    await loadTemplates();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    await deleteBillTemplateAction(id);
    await loadTemplates();
  }

  async function handleSetDefault(id: string, type: 'first_visit' | 'repeat_visit') {
    await setDefaultTemplateAction(id, type);
    await loadTemplates();
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/billit/settings')}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)', fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={16} /> Back to Billit Settings
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>
            Bill Templates
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            Manage templates for bill WhatsApp messages. Set defaults for first-visit and repeat customers.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} /> New Template
        </button>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          {error}
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="settings-section" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="settings-section-title">
            {editingId ? <Edit3 size={18} /> : <Plus size={18} />}
            {editingId ? 'Edit Template' : 'New Template'}
            <button onClick={resetForm} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
              <X size={18} />
            </button>
          </h3>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Template Name
            </label>
            <input
              className="input-field"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. First Visit Welcome"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Message Content
            </label>
            <textarea
              className="input-field"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Hi {customer_name}, here is your bill from {business_name}..."
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'inherit', width: '100%' }}
            />
          </div>

          {/* Variable Helper */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Braces size={12} /> Available variables (click to insert):
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {AVAILABLE_VARS.map(v => (
                <button
                  key={v.key}
                  className="wa-var-tag"
                  onClick={() => insertVariable(v.key)}
                  title={v.desc}
                  type="button"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {formContent && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Preview:</div>
              <div className="wa-template-preview">
                {formContent
                  .replace(/\{customer_name\}/g, 'Priya')
                  .replace(/\{business_name\}/g, 'Your Business')
                  .replace(/\{bill_link\}/g, 'https://example.com/bill/...')
                  .replace(/\{bill_number\}/g, 'BILL-20260724-001')
                  .replace(/\{grand_total\}/g, '1,500')
                  .replace(/\{review_link\}/g, 'https://example.com/review/...')
                  .replace(/\{appointment_link\}/g, 'https://example.com/book/...')
                }
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
            {editingId ? 'Update' : 'Create'} Template
          </button>
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          <Loader2 size={18} className="spinner" /> Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <FileText size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }} />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            No bill templates yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="wa-template-list">
          {templates.map(t => (
            <div key={t.id} className="wa-template-card">
              <div className="wa-template-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="wa-template-name">{t.name}</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {t.isDefaultFirstVisit && (
                      <span style={{ fontSize: '10px', background: 'var(--color-success-subtle)', color: 'var(--color-success)', padding: '2px 6px', borderRadius: '10px', fontWeight: 500 }}>
                        First Visit Default
                      </span>
                    )}
                    {t.isDefaultRepeatVisit && (
                      <span style={{ fontSize: '10px', background: 'var(--color-success-subtle)', color: 'var(--color-success)', padding: '2px 6px', borderRadius: '10px', fontWeight: 500 }}>
                        Repeat Visit Default
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                  <button
                    onClick={() => startEdit(t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="wa-template-preview">{t.content}</div>

              <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <button 
                  onClick={() => handleSetDefault(t.id, 'first_visit')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--text-xs)', 
                    color: t.isDefaultFirstVisit ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    fontWeight: t.isDefaultFirstVisit ? 500 : 400
                  }}
                >
                  {t.isDefaultFirstVisit ? <CheckCircle size={14} /> : <Circle size={14} />}
                  Set as default: first visit
                </button>
                <button 
                  onClick={() => handleSetDefault(t.id, 'repeat_visit')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--text-xs)', 
                    color: t.isDefaultRepeatVisit ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    fontWeight: t.isDefaultRepeatVisit ? 500 : 400
                  }}
                >
                  {t.isDefaultRepeatVisit ? <CheckCircle size={14} /> : <Circle size={14} />}
                  Set as default: repeat visit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
