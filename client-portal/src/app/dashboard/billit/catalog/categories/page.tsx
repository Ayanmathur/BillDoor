'use client';

import { useState, useEffect, useCallback, DragEvent } from 'react';
import {
  GripVertical, Plus, Edit3, Trash2, Eye, EyeOff, ArrowLeft, Check, X, LayoutGrid, Search, Package, Loader2, ExternalLink, ChevronDown, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { fuzzyMatch } from '@/shared/fuzzy-search';
import './../../billit.css';
import {
  fetchCategoriesAction,
  addCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  assignItemCategoryAction,
  toggleItemCatalogVisibilityAction,
  toggleItemAvailabilityAction,
  fetchItemsWithCategoryAction
} from './actions';
import { fetchBillitSettingsAction } from './../../settings/actions';

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface Item {
  id: string;
  name: string;
  type: string;
  price: number;
  unit: string | null;
  category_id: string | null;
  show_in_catalog: boolean;
  is_available: boolean;
}

export default function BuildCategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clientSlug, setClientSlug] = useState<string | null>(null);

  // Drag state for categories
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);

  // Drag state for items
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catRes, itemRes, settingsRes] = await Promise.all([
      fetchCategoriesAction(),
      fetchItemsWithCategoryAction(),
      fetchBillitSettingsAction(),
    ]);
    
    if (catRes.error) setError(catRes.error);
    else if (catRes.categories) {
      setCategories(catRes.categories as Category[]);
      // Expand all by default
      const exp: Record<string, boolean> = {};
      catRes.categories.forEach((c: Category) => exp[c.id] = true);
      exp['uncategorized'] = true;
      setExpandedCategories(exp);
    }

    if (itemRes.error) setError(itemRes.error);
    else if (itemRes.items) setItems(itemRes.items as Item[]);

    if (settingsRes.settings?.slug) setClientSlug(settingsRes.settings.slug);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    const name = newCategoryName.trim();
    setAddingCategory(true);
    setError(null);
    
    // Optimistic
    const tempId = 'temp-' + Date.now();
    const newCat: Category = {
      id: tempId,
      name,
      display_order: categories.length
    };
    setCategories([...categories, newCat]);
    setNewCategoryName('');

    const res = await addCategoryAction({ name });
    if (res.error) {
      setError(res.error);
      setCategories(categories); // revert
    } else {
      // Reload to get real ID
      const catRes = await fetchCategoriesAction();
      if (catRes.categories) setCategories(catRes.categories as Category[]);
    }
    setAddingCategory(false);
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
  };

  const saveEditCategory = async (id: string) => {
    if (!editCategoryName.trim()) return;
    const name = editCategoryName.trim();
    
    // Optimistic
    const original = [...categories];
    setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
    setEditingCategoryId(null);

    const res = await updateCategoryAction({ id, name });
    if (res.error) {
      setError(res.error);
      setCategories(original);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Items will become uncategorized.')) return;
    
    // Optimistic
    const originalCats = [...categories];
    const originalItems = [...items];
    
    setCategories(categories.filter(c => c.id !== id));
    setItems(items.map(item => item.category_id === id ? { ...item, category_id: null } : item));

    const res = await deleteCategoryAction({ id });
    if (res.error) {
      setError(res.error);
      setCategories(originalCats);
      setItems(originalItems);
    }
  };

  // HTML5 DnD for Categories
  const handleCatDragStart = (e: DragEvent, id: string) => {
    setDraggedCategoryId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCatDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCatDrop = async (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCategoryId || draggedCategoryId === targetId) return;

    const draggedIndex = categories.findIndex(c => c.id === draggedCategoryId);
    const targetIndex = categories.findIndex(c => c.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;

    const newCategories = [...categories];
    const [dragged] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(targetIndex, 0, dragged);

    // Update display_order optimistically
    const updated = newCategories.map((c, idx) => ({ ...c, display_order: idx }));
    setCategories(updated);
    setDraggedCategoryId(null);

    const orderedIds = updated.map(c => c.id);
    const res = await reorderCategoriesAction({ orderedIds });
    if (res.error) {
      setError(res.error);
      setCategories(categories); // revert
    }
  };

  // Item Assignment
  const handleAssignItem = async (itemId: string, categoryId: string | null) => {
    // Optimistic
    const original = [...items];
    setItems(items.map(i => i.id === itemId ? { ...i, category_id: categoryId } : i));

    const res = await assignItemCategoryAction({ itemId, categoryId });
    if (res.error) {
      setError(res.error);
      setItems(original);
    }
  };

  // Toggle Item Visibility
  const handleToggleVisibility = async (itemId: string, show: boolean) => {
    const original = [...items];
    setItems(items.map(i => i.id === itemId ? { ...i, show_in_catalog: show } : i));

    const res = await toggleItemCatalogVisibilityAction({ itemId, show });
    if (res.error) {
      setError(res.error);
      setItems(original);
    }
  };

  // Toggle Item Availability
  const handleToggleAvailability = async (itemId: string, available: boolean) => {
    const original = [...items];
    setItems(items.map(i => i.id === itemId ? { ...i, is_available: available } : i));

    const res = await toggleItemAvailabilityAction({ itemId, available });
    if (res.error) {
      setError(res.error);
      setItems(original);
    }
  };

  // HTML5 DnD for Items
  const handleItemDragStart = (e: DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = (e: DragEvent, categoryId: string | null) => {
    e.preventDefault();
    if (!draggedItemId) return;
    const item = items.find(i => i.id === draggedItemId);
    if (!item || item.category_id === categoryId) {
      setDraggedItemId(null);
      return;
    }
    
    handleAssignItem(draggedItemId, categoryId);
    setDraggedItemId(null);
  };

  const toggleCategoryExpand = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = search
    ? items.filter(i => fuzzyMatch(search, i.name))
    : items;

  // Group items
  const groupedItems: Record<string, Item[]> = {};
  categories.forEach(c => groupedItems[c.id] = []);
  groupedItems['uncategorized'] = [];

  filteredItems.forEach(item => {
    if (item.category_id && groupedItems[item.category_id]) {
      groupedItems[item.category_id].push(item);
    } else {
      groupedItems['uncategorized'].push(item);
    }
  });

  return (
    <div style={{ paddingBottom: 'var(--space-8)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <Link href="/dashboard/billit/catalog" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to Catalog
        </Link>
        {clientSlug && (
          <a href={`/catalog/${clientSlug}`} target="_blank" rel="noopener noreferrer" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none' }}>
            <ExternalLink size={16} /> Preview Catalog
          </a>
        )}
      </div>

      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
        Build Category
      </h1>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-6)', flexDirection: 'column' }}>
        
        {/* 1. CATEGORY MANAGER */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <LayoutGrid size={18} /> Manage Categories
          </h2>
          
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <input
              type="text"
              className="input-field"
              placeholder="New Category Name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ flex: 1, maxWidth: '300px' }}
            />
            <button type="submit" className="btn-add-item" disabled={addingCategory || !newCategoryName.trim()}>
              {addingCategory ? <Loader2 size={16} className="spinner" /> : <><Plus size={16} /> Add</>}
            </button>
          </form>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}><Loader2 className="spinner" /></div>
          ) : categories.length === 0 ? (
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No categories created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {categories.map((cat) => {
                const count = items.filter(i => i.category_id === cat.id).length;
                const isEditing = editingCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleCatDragStart(e, cat.id)}
                    onDragOver={handleCatDragOver}
                    onDrop={(e) => handleCatDrop(e, cat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: draggedCategoryId === cat.id ? 'var(--color-bg-tertiary)' : 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      opacity: draggedCategoryId === cat.id ? 0.5 : 1,
                      cursor: isEditing ? 'default' : 'grab'
                    }}
                  >
                    {!isEditing && <GripVertical size={16} style={{ color: 'var(--color-text-tertiary)' }} />}
                    
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
                        <input
                          autoFocus
                          className="input-field"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditCategory(cat.id);
                            if (e.key === 'Escape') setEditingCategoryId(null);
                          }}
                          style={{ padding: '4px 8px' }}
                        />
                        <button className="action-btn" style={{ color: 'var(--color-success)' }} onClick={() => saveEditCategory(cat.id)}><Check size={16} /></button>
                        <button className="action-btn" onClick={() => setEditingCategoryId(null)}><X size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: 500, flex: 1, color: 'var(--color-text-primary)' }}>{cat.name}</span>
                        <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-bg-tertiary)', padding: '2px 8px', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
                          {count} item{count !== 1 && 's'}
                        </span>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button className="action-btn" onClick={() => startEditCategory(cat)}><Edit3 size={16} /></button>
                          <button className="action-btn danger" onClick={() => handleDeleteCategory(cat.id)}><Trash2 size={16} /></button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. ITEM ASSIGNMENT GRID */}
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 className="settings-section-title" style={{ margin: 0 }}>
              <Package size={18} /> Catalog Items
            </h2>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input 
                className="input-field" 
                placeholder="Search items..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34 }} 
              />
            </div>
          </div>

          {loading ? (
             <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}><Loader2 className="spinner" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[...categories, { id: 'uncategorized', name: 'Uncategorized', display_order: 9999 }].map(cat => {
                const groupItems = groupedItems[cat.id] || [];
                if (groupItems.length === 0 && cat.id === 'uncategorized' && !search) return null;
                
                const isExpanded = expandedCategories[cat.id];

                return (
                  <div 
                    key={cat.id}
                    onDragOver={handleItemDragOver}
                    onDrop={(e) => handleItemDrop(e, cat.id === 'uncategorized' ? null : cat.id)}
                    style={{
                      border: '1px dashed var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-bg-secondary)',
                      overflow: 'hidden'
                    }}
                  >
                    <div 
                      onClick={() => toggleCategoryExpand(cat.id)}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--color-bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {isExpanded ? <ChevronDown size={18} color="var(--color-text-tertiary)" /> : <ChevronRight size={18} color="var(--color-text-tertiary)" />}
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{cat.name}</span>
                        <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-bg-tertiary)', padding: '2px 8px', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
                          {groupItems.length}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        Drop items here
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: 'var(--space-2)' }}>
                        {groupItems.length === 0 ? (
                          <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                            No items in this category.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {groupItems.map(item => (
                              <div 
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleItemDragStart(e, item.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: 'var(--space-3)',
                                  background: 'var(--color-bg-primary)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 'var(--radius-md)',
                                  gap: 'var(--space-4)'
                                }}
                              >
                                <GripVertical size={16} style={{ color: 'var(--color-text-tertiary)', cursor: 'grab' }} />
                                
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.name}</span>
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                                    ₹{item.price.toLocaleString('en-IN')} {item.unit ? `/ ${item.unit}` : ''}
                                  </span>
                                </div>

                                <select 
                                  className="input-field"
                                  style={{ width: '150px', padding: '4px 8px', height: 'auto' }}
                                  value={item.category_id || ''}
                                  onChange={(e) => handleAssignItem(item.id, e.target.value || null)}
                                >
                                  <option value="">Uncategorized</option>
                                  {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>

                                <button 
                                  className="action-btn"
                                  onClick={() => handleToggleVisibility(item.id, !item.show_in_catalog)}
                                  title={item.show_in_catalog ? "Hide in Catalog" : "Show in Catalog"}
                                >
                                  {item.show_in_catalog ? <Eye size={18} style={{ color: 'var(--color-accent)' }} /> : <EyeOff size={18} style={{ color: 'var(--color-text-tertiary)' }} />}
                                </button>

                                <div 
                                  onClick={() => handleToggleAvailability(item.id, !item.is_available)}
                                  className={`status-badge ${item.is_available ? 'active' : 'inactive'}`}
                                  style={{ cursor: 'pointer', userSelect: 'none', width: '100px', textAlign: 'center', justifyContent: 'center' }}
                                >
                                  {item.is_available ? 'Available' : 'Not Available'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
