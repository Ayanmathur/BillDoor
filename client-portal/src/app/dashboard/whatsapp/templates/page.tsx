'use client';

/**
 * WhatsApp Broadcast Templates Page
 *
 * CRUD for broadcast templates ONLY.
 * Billit and Appointer templates are managed from their own settings.
 * Variable helper shows available placeholders.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Edit3, Trash2, Save, X, Loader2, FileText,
  Eye, EyeOff, Braces,
} from 'lucide-react';
import {
  fetchBroadcastTemplatesAction,
  createBroadcastTemplateAction,
  updateBroadcastTemplateAction,
  deleteBroadcastTemplateAction,
} from './actions';
import '../whatsapp.css';

interface Template {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

const AVAILABLE_VARS = [
  { key: '{customer_name}', desc: 'Recipient\'s name' },
  { key: '{shop_name}', desc: 'Your business name' },
];

export default function WhatsAppTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');

  async function loadTemplates() {
    const res = await fetchBroadcastTemplatesAction();
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

  function startEdit(t: Template) {
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
      ? await updateBroadcastTemplateAction(editingId, { name: formName, content: formContent })
      : await createBroadcastTemplateAction({ name: formName, content: formContent });

    if (result.error) { setError(result.error); setSaving(false); return; }
    resetForm();
    setSaving(false);
    await loadTemplates();
  }

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this template? It will no longer be available for broadcasts.')) return;
    await deleteBroadcastTemplateAction(id);
    await loadTemplates();
  }

  async function handleToggleActive(t: Template) {
    await updateBroadcastTemplateAction(t.id, {
      name: t.name,
      content: t.content,
      isActive: !t.isActive,
    });
    await loadTemplates();
  }

  const activeTemplates = templates.filter(t => t.isActive);
  const inactiveTemplates = templates.filter(t => !t.isActive);

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/whatsapp')}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)', fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={16} /> Back to WhatsApp Auto
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>
            Broadcast Templates
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            Only broadcast templates. Billit &amp; Appointer templates are managed from their modules.
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
              placeholder="e.g. Weekend Offer"
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
              placeholder="Hey {customer_name}! Visit {shop_name} this week for..."
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
                  .replace(/\{shop_name\}/g, 'Your Business')}
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
      ) : activeTemplates.length === 0 && inactiveTemplates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <FileText size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }} />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            No broadcast templates yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="wa-template-list">
          {activeTemplates.map(t => (
            <div key={t.id} className="wa-template-card">
              <div className="wa-template-header">
                <div className="wa-template-name">{t.name}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => handleToggleActive(t)}
                    title="Deactivate"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-success)' }}
                  >
                    <Eye size={16} />
                  </button>
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
            </div>
          ))}

          {/* Inactive templates */}
          {inactiveTemplates.length > 0 && (
            <>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Inactive
              </div>
              {inactiveTemplates.map(t => (
                <div key={t.id} className="wa-template-card" style={{ opacity: 0.6 }}>
                  <div className="wa-template-header">
                    <div className="wa-template-name">{t.name}</div>
                    <button
                      onClick={() => handleToggleActive(t)}
                      title="Reactivate"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                    >
                      <EyeOff size={16} />
                    </button>
                  </div>
                  <div className="wa-template-preview">{t.content}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
