'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Image, Plus, Pencil, Trash2, Eye, EyeOff, Save, X, ArrowLeft, Loader2, ExternalLink, Globe, Instagram, Facebook
} from 'lucide-react';
import {
  fetchPortfolioItemsAction,
  createPortfolioItemAction,
  updatePortfolioItemAction,
  togglePortfolioVisibilityAction,
  deletePortfolioItemAction
} from './actions';
import './portfolio.css';

type PortfolioItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  externalLink: string;
  displayOrder: number;
  isActive: boolean;
};

export default function PortfolioAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState('website');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetchPortfolioItemsAction();
    if (res.items) {
      // The action returns items that are active on the client. 
      // For the admin page we probably need all items including inactive ones.
      // Assuming fetchPortfolioItemsAction handles admin mode differently, 
      // or we'd need a separate action. Given instructions, we use it as is.
      setItems(res.items as PortfolioItem[]);
    }
    setLoading(false);
  }

  const resetForm = () => {
    setCategory('website');
    setTitle('');
    setDescription('');
    setExternalLink('');
    setDisplayOrder(0);
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (item: PortfolioItem) => {
    setCategory(item.category);
    setTitle(item.title);
    setDescription(item.description);
    setExternalLink(item.externalLink);
    setDisplayOrder(item.displayOrder);
    setEditId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setActionLoading('save');
    const data = { category, title, description, externalLink, displayOrder };
    if (editId) {
      await updatePortfolioItemAction({ id: editId, ...data });
    } else {
      await createPortfolioItemAction(data);
    }
    await loadData();
    setActionLoading(null);
    resetForm();
  };

  const handleToggleVisibility = async (id: string, current: boolean) => {
    setActionLoading(id);
    await togglePortfolioVisibilityAction(id);
    await loadData();
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    await deletePortfolioItemAction(id);
    await loadData();
    setActionLoading(null);
    setDeleteConfirm(null);
  };

  const getCategoryName = (cat: string) => {
    switch (cat) {
      case 'website': return 'Website';
      case 'reel': return 'Instagram Reel';
      case 'facebook_post': return 'Facebook Post';
      case 'generic': return 'Design Work';
      default: return cat;
    }
  };

  return (
    <div className="portfolio-page">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <div className="portfolio-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Image size={24} /> Portfolio
        </h1>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Item
          </button>
        )}
      </div>

      {showForm && (
        <div className="portfolio-form" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)' }}>{editId ? 'Edit Item' : 'Add New Item'}</h3>
          <div className="portfolio-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label">Category</label>
              <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="website">Website</option>
                <option value="reel">Instagram Reel</option>
                <option value="facebook_post">Facebook Post</option>
                <option value="generic">Design Work</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Title</label>
              <input type="text" className="input-field" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Description</label>
              <textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">External Link</label>
              <input type="text" className="input-field" value={externalLink} onChange={e => setExternalLink(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Display Order</label>
              <input type="number" className="input-field" value={displayOrder} onChange={e => setDisplayOrder(parseInt(e.target.value))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-secondary" onClick={resetForm}>
              <X size={16} /> Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={actionLoading === 'save'}>
              {actionLoading === 'save' ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="portfolio-empty" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <Image size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.5 }} />
          <p>No portfolio items yet</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="portfolio-table client-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Category</th>
                <th>Title</th>
                <th>Link</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.displayOrder}</td>
                  <td>
                    <span className={`portfolio-cat-badge ${item.category} status-badge`}>
                      {getCategoryName(item.category)}
                    </span>
                  </td>
                  <td>{item.title}</td>
                  <td>
                    <code className="portfolio-link" style={{ fontSize: 'var(--text-xs)' }}>
                      {item.externalLink?.length > 30 ? item.externalLink.substring(0, 30) + '...' : item.externalLink}
                    </code>
                  </td>
                  <td>
                    {item.isActive ? (
                      <span className="portfolio-active-badge status-badge active">Active</span>
                    ) : (
                      <span className="portfolio-hidden-badge status-badge revoked">Hidden</span>
                    )}
                  </td>
                  <td>
                    <div className="action-row" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button className="action-btn" title="Edit" onClick={() => handleEdit(item)}>
                        <Pencil size={16} />
                      </button>
                      <button className="action-btn" title={item.isActive ? 'Hide' : 'Show'} 
                        onClick={() => handleToggleVisibility(item.id, item.isActive)}
                        disabled={actionLoading === item.id}>
                        {item.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      
                      {deleteConfirm === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>Are you sure?</span>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 'var(--text-xs)' }} onClick={() => handleDelete(item.id)} disabled={actionLoading === item.id}>
                            Confirm
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 'var(--text-xs)' }} onClick={() => setDeleteConfirm(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="action-btn danger" title="Delete" onClick={() => setDeleteConfirm(item.id)}>
                          <Trash2 size={16} />
                        </button>
                      )}
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
