'use client';
// HARD RULE: name + price only. No photos, no categories, no custom branding, no multi-page.
// Want more? "Request from Orbitex Services" footer handles that upsell.

import { useEffect, useState } from 'react';
import { Search, MessageCircle, Loader2, Package, ShoppingBag } from 'lucide-react';
import { fetchCatalogAction } from './actions';
import './catalog.css';

export default function CatalogPage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<{ business?: any; items?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchCatalogAction(params.slug);
        if (res.error) {
          setError(res.error);
        } else {
          setData(res);
        }
      } catch (err) {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug]);

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

  const filteredItems = (data.items || []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="catalog-page">
      <div className="catalog-container">
        <div className="catalog-header">
          <h1>{data.business.name}</h1>
          <p>Digital Catalog</p>
        </div>

        {(data.items || []).length > 10 && (
          <div className="catalog-filter-container">
            <Search size={18} className="catalog-filter-icon" />
            <input
              type="text"
              placeholder="Search items..."
              className="catalog-filter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="catalog-empty">
            <Package size={32} style={{ color: '#9ca3af', marginBottom: '8px' }} />
            <h3>No items found</h3>
            <p>Try a different search term.</p>
          </div>
        ) : (
          <div className="catalog-list">
            {filteredItems.map((item, i) => {
              const waText = encodeURIComponent(
                data.business.template.replace('{item_name}', item.name)
              );
              const waLink = `https://wa.me/${data.business.phone.replace(/[^0-9]/g, '')}?text=${waText}`;

              return (
                <div key={i} className="catalog-item">
                  <div className="catalog-item-info">
                    <h3 className="catalog-item-name">{item.name}</h3>
                    <div className="catalog-item-price">
                      ₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      {item.unit ? ` / ${item.unit}` : ''}
                    </div>
                    {item.type && (
                      <span className="catalog-item-type">{item.type}</span>
                    )}
                  </div>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="catalog-ask-btn"
                  >
                    <MessageCircle size={14} />
                    Ask
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="catalog-footer">
        <p>
          Want a full online store with photos? Ask {data.business.name} about <a href="https://orbitex.in" target="_blank" rel="noopener noreferrer">Orbitex Services</a>
        </p>
        <p className="catalog-powered">Powered by BillDoor</p>
      </div>
    </div>
  );
}
