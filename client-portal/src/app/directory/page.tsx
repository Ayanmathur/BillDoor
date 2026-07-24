'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Search, ExternalLink, CreditCard, Calendar, Loader2 } from 'lucide-react';
import PoweredByFooter from '@/components/powered-by-footer';
import { fetchPublicDirectoryAction, ListedClient } from './actions';

export default function PublicDirectoryPage() {
  const [clients, setClients] = useState<ListedClient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchPublicDirectoryAction();
      setClients(res.clients || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = clients.filter(c =>
    c.businessName.toLowerCase().includes(search.toLowerCase()) ||
    c.about.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-secondary, #f9fafb)', paddingBottom: '80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-6, 24px) var(--space-4, 16px)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8, 32px)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl, 28px)', fontWeight: 'var(--weight-bold, 700)', color: 'var(--color-text-primary, #111827)', marginBottom: 'var(--space-2, 8px)' }}>
            Client Directory
          </h1>
          <p style={{ fontSize: 'var(--text-base, 16px)', color: 'var(--color-text-secondary, #4b5563)', maxWidth: 500, margin: '0 auto' }}>
            Discover businesses powered by BillDoor & Orbitex platform.
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 'var(--space-6, 24px)', maxWidth: 450, margin: '0 auto var(--space-6, 24px)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary, #9ca3af)' }} />
            <input
              type="text"
              placeholder="Search businesses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-border, #e5e7eb)',
                background: '#fff',
                fontSize: 'var(--text-sm, 14px)',
              }}
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Loader2 size={28} className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--color-border, #e5e7eb)' }}>
            <Building2 size={36} style={{ color: 'var(--color-text-tertiary, #9ca3af)', marginBottom: 8 }} />
            <p style={{ color: 'var(--color-text-secondary, #4b5563)', margin: 0 }}>No businesses listed yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            {filtered.map(c => (
              <div
                key={c.id}
                style={{
                  background: '#fff',
                  borderRadius: 'var(--radius-lg, 12px)',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  padding: 'var(--space-5, 20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: 'var(--color-brand-subtle, #e0e7ff)',
                      color: 'var(--color-brand, #4f46e5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 18,
                    }}>
                      {c.businessName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-base, 16px)', fontWeight: 'var(--weight-bold, 700)', margin: 0, color: 'var(--color-text-primary, #111827)' }}>
                        {c.businessName}
                      </h3>
                    </div>
                  </div>
                  {c.about && (
                    <p style={{
                      fontSize: 'var(--text-sm, 14px)',
                      color: 'var(--color-text-secondary, #4b5563)',
                      lineClamp: 2,
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      display: '-webkit-box',
                      overflow: 'hidden',
                      marginBottom: 16,
                    }}>
                      {c.about}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border, #f3f4f6)' }}>
                  <Link
                    href={`/card/${c.slug}`}
                    className="btn"
                    style={{ flex: 1, fontSize: 'var(--text-xs, 12px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <CreditCard size={14} /> Card
                  </Link>
                  <Link
                    href={`/book/${c.slug}`}
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 'var(--text-xs, 12px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Calendar size={14} /> Book
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <PoweredByFooter />
    </div>
  );
}
