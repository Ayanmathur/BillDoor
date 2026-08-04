'use client';
// HARD RULE: name + price only. No photos, no custom branding, no multi-page.
// Categories are organizational (usability), not visual (design polish).
// Want more? "Request from Orbitex Services" footer handles that upsell.

import { useState, useEffect, useMemo, use } from 'react';
import { Search, MessageCircle, Loader2, Package, Check, ChevronDown, ChevronRight } from 'lucide-react';
import PoweredByFooter from '@/components/powered-by-footer';
import { fuzzyMatch } from '@/shared/fuzzy-search';
import { fetchCatalogAction } from './actions';
import { formatWhatsAppPhone } from '@/shared/validation';
import './catalog.css';

interface CatalogItem {
  name: string;
  price: number;
  type: string;
  unit: string;
  available: boolean;
  categoryName: string | null;
  categoryOrder: number;
}

interface CategoryGroup {
  name: string;
  order: number;
  items: CatalogItem[];
}

export default function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<{ business?: any; items?: CatalogItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchCatalogAction(slug);
        if (res.error) {
          setError(res.error);
        } else {
          setData(res);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => 
      fuzzyMatch(search, item.name) || 
      (item.categoryName ? fuzzyMatch(search, item.categoryName) : false)
    );
  }, [data?.items, search]);

  // Group items by category
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, CategoryGroup>();

    for (const item of filteredItems) {
      const key = item.categoryName || '__uncategorized__';
      if (!groups.has(key)) {
        groups.set(key, {
          name: item.categoryName || 'Other',
          order: item.categoryName ? item.categoryOrder : 9999,
          items: [],
        });
      }
      groups.get(key)!.items.push(item);
    }

    // Sort groups by order, "Other" last
    return Array.from(groups.values()).sort((a, b) => a.order - b.order);
  }, [filteredItems]);

  const hasCategories = useMemo(() => {
    if (!data?.items) return false;
    return data.items.some(i => i.categoryName !== null);
  }, [data?.items]);

  function toggleItem(itemName: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  }

  function toggleCategory(groupName: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function buildWhatsAppLink() {
    if (!data?.business || selected.size === 0) return '#';

    const selectedNames = Array.from(selected);
    const template = data.business.template;
    let messageText: string;

    if (selectedNames.length === 1) {
      // Single item — use template as-is with {item_name} substitution
      messageText = template.replace('{item_name}', selectedNames[0]);
    } else {
      // Multi-item — build numbered list and substitute into {item_name}
      const itemList = selectedNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
      messageText = template.replace('{item_name}', `\n${itemList}\n`);
    }

    const waText = encodeURIComponent(messageText);
    const phone = formatWhatsAppPhone(data.business.phone);
    return `https://wa.me/${phone}?text=${waText}`;
  }

  if (loading) {
    return (
      <div className="catalog-page">
        <div className="catalog-loading">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading catalog...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="catalog-page">
        <div className="catalog-unavailable">
          <h2>Unavailable</h2>
          <p>{error || 'Catalog not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <div className="catalog-container">
        <div className="catalog-header">
          {data.business.logo_url && (
            <img
              src={data.business.logo_url}
              alt={data.business.name}
              style={{
                maxWidth: 180,
                maxHeight: 72,
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                margin: '0 auto 12px',
                display: 'block',
                borderRadius: 'var(--radius-md)',
              }}
            />
          )}
          <h1>{data.business.name}</h1>
          <p>Digital Catalog</p>
        </div>

        <div className="catalog-filter-container">
          <Search size={18} className="catalog-filter-icon" />
          <input
            type="text"
            placeholder="Search items or categories..."
            className="catalog-filter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="catalog-empty">
            <Package size={32} style={{ color: '#9ca3af', marginBottom: '8px' }} />
            <h3>No items found</h3>
            <p>Try a different search term.</p>
          </div>
        ) : hasCategories ? (
          /* Grouped by category */
          <div className="catalog-grouped">
            {categoryGroups.map((group) => {
              const isCollapsed = collapsedCategories.has(group.name) && !search.trim();
              return (
                <div key={group.name} className="catalog-category-group">
                  <div
                    className="catalog-category-header"
                    onClick={() => toggleCategory(group.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(group.name); } }}
                  >
                    <span className="catalog-category-chevron">
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </span>
                    <span className="catalog-category-name">{group.name}</span>
                    <span className="catalog-category-count">{group.items.length}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="catalog-list">
                      {group.items.map((item, i) => (
                        <CatalogItemCard
                          key={`${group.name}-${i}`}
                          item={item}
                          isSelected={selected.has(item.name)}
                          onToggle={() => toggleItem(item.name)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Flat list (no categories configured) */
          <div className="catalog-list">
            {filteredItems.map((item, i) => (
              <CatalogItemCard
                key={i}
                item={item}
                isSelected={selected.has(item.name)}
                onToggle={() => toggleItem(item.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selection bar — appears when items selected */}
      {selected.size > 0 && (
        <div className="catalog-selection-bar">
          <button className="catalog-selection-clear" onClick={clearSelection}>
            ✕ Clear
          </button>
          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="catalog-selection-ask"
          >
            <MessageCircle size={16} />
            Ask Now — {selected.size}
          </a>
        </div>
      )}

      {/* Footer — hidden when selection bar is visible */}
      {selected.size === 0 && (
        <div className="catalog-footer">
          <PoweredByFooter />
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Individual catalog item card
 * ============================================================ */
function CatalogItemCard({
  item,
  isSelected,
  onToggle,
}: {
  item: CatalogItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const isAvailable = item.available;

  return (
    <div
      className={`catalog-item ${!isAvailable ? 'catalog-item--unavailable' : ''} ${isSelected ? 'catalog-item--selected' : ''}`}
      onClick={isAvailable ? onToggle : undefined}
      role={isAvailable ? 'button' : undefined}
      tabIndex={isAvailable ? 0 : undefined}
      onKeyDown={isAvailable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
    >
      <div className="catalog-item-info">
        <h3 className="catalog-item-name">{item.name}</h3>
        <div className="catalog-item-price">
          ₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          {item.unit ? ` / ${item.unit}` : ''}
        </div>
        <div className="catalog-item-meta">
          {item.type && (
            <span className="catalog-item-type">{item.type}</span>
          )}
          <span className={`catalog-availability-badge ${isAvailable ? 'catalog-availability-badge--available' : 'catalog-availability-badge--unavailable'}`}>
            {isAvailable ? 'Available' : 'Not Available'}
          </span>
        </div>
      </div>

      <div className="catalog-item-action">
        {isAvailable ? (
          <div className={`catalog-item-checkbox ${isSelected ? 'catalog-item-checkbox--checked' : ''}`}>
            {isSelected && <Check size={14} />}
          </div>
        ) : (
          <span className="catalog-item-na-label">N/A</span>
        )}
      </div>
    </div>
  );
}
