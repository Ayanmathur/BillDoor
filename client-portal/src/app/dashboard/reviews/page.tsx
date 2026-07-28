'use client';

/**
 * BillDoor — Client Review Dashboard (§5.3)
 *
 * QR code (download), shortened review link (copy),
 * ratings table (date, stars, feedback), date range filter,
 * XLSX export, archive vs read distinction, 4-5★ vs 1-3★ funnel.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  QrCode, Copy, Check, Download, Star, Archive, Eye, Filter,
  FileSpreadsheet, Loader2, ExternalLink, ChevronDown,
} from 'lucide-react';
import {
  fetchReviewsAction,
  markReviewReadAction,
  archiveReviewAction,
  fetchReviewLinkAction,
  fetchReviewsForExportAction,
  fetchReviewFlowSettingsAction,
  updateReviewFlowSettingsAction,
} from './actions';

import './reviews.css';

type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

interface Review {
  id: string;
  stars: number;
  feedback_text: string | null;
  source: string;
  created_at: string;
  read: boolean;
  archived: boolean;
}

export default function ReviewsDashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Settings & Compliance state
  const [connectWithClient, setConnectWithClient] = useState(true);
  const [whatsappContact, setWhatsappContact] = useState(true);
  const [customResolutionText, setCustomResolutionText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const getDateFilters = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today': {
        const d = now.toISOString().split('T')[0];
        return { dateFrom: d, dateTo: d };
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: weekAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: monthAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'custom':
        return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
      default:
        return {};
    }
  }, [dateRange, customFrom, customTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const filters = getDateFilters();
    const [reviewResult, linkResult, flowSettingsResult] = await Promise.all([
      fetchReviewsAction({ ...filters, archived: showArchived }),
      fetchReviewLinkAction(),
      fetchReviewFlowSettingsAction(),
    ]);
    if (reviewResult.reviews) setReviews(reviewResult.reviews as Review[]);
    if (reviewResult.stats) setStats(reviewResult.stats);
    if (linkResult.slug) setLinkInfo(linkResult);
    if (flowSettingsResult.settings) {
      setConnectWithClient(flowSettingsResult.settings.connectWithClient);
      setWhatsappContact(flowSettingsResult.settings.whatsappContact);
      setCustomResolutionText(flowSettingsResult.settings.customResolutionText);
    }
    setLoading(false);
  }, [getDateFilters, showArchived]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSaveSettings() {
    setSavingSettings(true);
    await updateReviewFlowSettingsAction({
      connectWithClient,
      whatsappContact,
      customResolutionText,
    });
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  }

  async function handleMarkRead(id: string) {
    setActionLoading(id);
    await markReviewReadAction(id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, read: true } : r));
    setActionLoading(null);
  }

  async function handleArchive(id: string) {
    setActionLoading(id);
    await archiveReviewAction(id);
    setReviews(prev => prev.filter(r => r.id !== id));
    setActionLoading(null);
  }

  async function handleCopyLink() {
    if (!linkInfo?.reviewUrl) return;
    await navigator.clipboard.writeText(linkInfo.reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleExportXlsx() {
    const filters = getDateFilters();
    const result = await fetchReviewsForExportAction(filters.dateFrom, filters.dateTo);
    if (!result.data) return;

    // Generate CSV (lightweight, no dependency needed)
    const headers = ['Date', 'Stars', 'Feedback', 'Source', 'Read', 'Archived'];
    const rows = result.data.map((r: any) => [
      new Date(r.created_at).toLocaleString('en-IN'),
      r.stars,
      `"${(r.feedback_text || '').replace(/"/g, '""')}"`,
      r.source,
      r.read ? 'Yes' : 'No',
      r.archived ? 'Yes' : 'No',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reviews-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderStars(count: number) {
    return (
      <span style={{ color: count >= 4 ? 'hsl(38 90% 50%)' : count >= 3 ? 'var(--color-warning)' : 'var(--color-error)', letterSpacing: 1 }}>
        {'★'.repeat(count)}{'☆'.repeat(5 - count)}
      </span>
    );
  }

  return (
    <div>
      {/* Row 1: QR Card + Funnel Card in one row */}
      <div className="reviews-top-row">
        {/* QR Card */}
        <div className="dash-card" style={{ textAlign: 'center', justifyContent: 'center' }}>
          {linkInfo?.reviewUrl ? (
            <img
              id="review-qr-img"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkInfo.reviewUrl)}&margin=8`}
              alt="Review QR Code"
              width={100}
              height={100}
              style={{ borderRadius: 'var(--radius-md)', margin: '0 auto var(--space-2)', display: 'block' }}
            />
          ) : (
            <div style={{ width: 100, height: 100, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-2)' }}>
              <QrCode size={60} strokeWidth={1} color="var(--color-text-tertiary)" />
            </div>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Scan to review</span>
          <button
            className="quick-action-btn"
            style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', justifyContent: 'center' }}
            onClick={() => {
              if (!linkInfo?.reviewUrl) return;
              const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(linkInfo.reviewUrl)}&margin=16&format=png`;
              const a = document.createElement('a');
              a.href = url;
              a.download = `review-qr-${linkInfo.slug || 'code'}.png`;
              a.target = '_blank';
              a.click();
            }}
          >
            <Download size={12} /> Download QR
          </button>
        </div>

        {/* Funnel Card */}
        <div className="dash-card" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <span className="dash-card-label">Funnel</span>
          {stats && stats.total > 0 ? (
            <>
              <div style={{ marginTop: 'var(--space-2)', width: '100%' }}>
                <div style={{ background: 'var(--color-success)', height: 8, borderRadius: 4, width: `${Math.max(10, (stats.positive / stats.total) * 100)}%`, marginBottom: 6 }} />
                <div style={{ background: 'var(--color-error)', height: 8, borderRadius: 4, width: `${Math.max(10, (stats.negative / stats.total) * 100)}%` }} />
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                {Math.round((stats.positive / stats.total) * 100)}% positive
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
              No review data yet
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Review Link + Stats Card below */}
      <div className="dash-card reviews-link-stats-card">
        <div>
          <span className="dash-card-label">Your Review Link</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
            <code style={{ fontSize: 'var(--text-sm)', background: 'var(--color-bg-primary)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', flex: '1 1 0%', minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {linkInfo?.reviewUrl || '...'}
            </code>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn" onClick={handleCopyLink} title="Copy link" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text, #ffffff)', border: 'none' }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              {linkInfo?.reviewUrl && (
                <a href={linkInfo.reviewUrl} target="_blank" rel="noopener noreferrer" className="btn" title="Open link" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', textDecoration: 'none', backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text, #ffffff)', border: 'none' }}>
                  <ExternalLink size={16} />
                  Open
                </a>
              )}
            </div>
          </div>
        </div>
        {stats && (
          <div className="reviews-stats-flex">
            <div>
              <div className="dash-card-value">{stats.avgRating} ★</div>
              <div className="dash-card-sub">{stats.total} reviews</div>
            </div>
            <div>
              <div className="dash-card-value" style={{ color: 'var(--color-success)' }}>{stats.positive}</div>
              <div className="dash-card-sub">4-5★</div>
            </div>
            <div>
              <div className="dash-card-value" style={{ color: 'var(--color-error)', fontSize: 'var(--text-lg)' }}>{stats.negative}</div>
              <div className="dash-card-sub">1-3★</div>
            </div>
            {stats.unread > 0 && (
              <div>
                <div className="dash-card-value" style={{ color: 'var(--color-accent)' }}>{stats.unread}</div>
                <div className="dash-card-sub">Unread</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Flow Settings & Compliance Controls */}
      <div className="dash-card" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <span className="dash-card-label" style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>Review Flow & Google Compliance Settings</span>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              Configure 1–3 star private feedback resolution & Google Policy compliance pathways.
            </div>
          </div>
          <button
            className="btn"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text, #ffffff)', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {savingSettings ? <Loader2 size={14} className="spinner" /> : settingsSaved ? <Check size={14} /> : null}
            {settingsSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
          {/* Toggle 1: Connect with Client */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Connect with Client</span>
              <input
                type="checkbox"
                checked={connectWithClient}
                onChange={(e) => setConnectWithClient(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Enables the <code style={{ fontSize: 11, background: 'var(--color-bg-primary)', padding: '2px 4px', borderRadius: 4 }}>&quot;Looking for public assistance options?&quot;</code> link for 1–3 star feedback.
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: 6, fontWeight: 'var(--weight-medium)', display: 'flex', alignItems: 'center', gap: 4 }}>
              ✓ Recommended to prevent Google review gating liability.
            </div>
          </div>

          {/* Toggle 2: WhatsApp Contact */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>WhatsApp Resolution Card</span>
              <input
                type="checkbox"
                checked={whatsappContact}
                onChange={(e) => setWhatsappContact(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Displays the green <code style={{ fontSize: 11, background: 'var(--color-bg-primary)', padding: '2px 4px', borderRadius: 4 }}>&quot;Contact Business via WhatsApp&quot;</code> card inside your resolution box.
            </div>
          </div>

          {/* Custom Resolution Text Area */}
          <div style={{ gridColumn: '1 / -1', background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <label style={{ display: 'block', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Custom Resolution Message (1–3 Stars)
            </label>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
              Message displayed to customers inside the resolution box. If left blank, default text will be used.
            </div>
            <textarea
              value={customResolutionText}
              onChange={(e) => setCustomResolutionText(e.target.value)}
              placeholder="Our management personally reviews all private notes within 2 hours to resolve issues directly."
              rows={2}
              style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontSize: 'var(--text-xs)', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="reviews-filter-bar">
        <div className="reviews-filter-group">
          {(['today', 'week', 'month', 'all'] as DateRange[]).map((range) => (
            <button key={range} className={`settings-tab ${dateRange === range ? 'active' : ''}`}
              style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)', borderBottom: 'none', borderRadius: 'var(--radius-md)', background: dateRange === range ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)' }}
              onClick={() => setDateRange(range)}>
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
          <button className={`settings-tab ${dateRange === 'custom' ? 'active' : ''}`}
            style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)', borderBottom: 'none', borderRadius: 'var(--radius-md)', background: dateRange === 'custom' ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)' }}
            onClick={() => setDateRange('custom')}>
            Custom
          </button>
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', width: 130 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>to</span>
            <input type="date" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', width: 130 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div className="reviews-actions-right">
          <button className="quick-action-btn" onClick={() => setShowArchived(!showArchived)} style={{ fontSize: 'var(--text-xs)' }}>
            <Archive size={12} /> {showArchived ? 'Active' : 'Archived'}
          </button>
          <button className="quick-action-btn" onClick={handleExportXlsx} style={{ fontSize: 'var(--text-xs)' }}>
            <FileSpreadsheet size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Reviews Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}>
          <Loader2 size={24} className="spinner" />
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-tertiary)' }}>
          <Star size={40} style={{ marginBottom: 'var(--space-2)', opacity: 0.3 }} />
          <p>{showArchived ? 'No archived reviews.' : 'No reviews yet. Share your QR code to start collecting feedback.'}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                cursor: review.feedback_text ? 'pointer' : 'default',
                background: !review.read ? 'var(--color-accent-subtle)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onClick={() => {
                if (review.feedback_text) setExpandedRow(expandedRow === review.id ? null : review.id);
                if (!review.read) handleMarkRead(review.id);
              }}
            >
              {/* Unread dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: review.read ? 'transparent' : 'var(--color-accent)', flexShrink: 0, marginTop: 6 }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2 }}>
                  <span style={{ fontSize: 'var(--text-sm)' }}>{renderStars(review.stars)}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {new Date(review.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {review.feedback_text && <ChevronDown size={12} style={{ color: 'var(--color-text-tertiary)', transform: expandedRow === review.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                </div>
                {review.feedback_text && expandedRow === review.id && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 'var(--space-1)', padding: 'var(--space-2)', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    {review.feedback_text}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!showArchived && (
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                  {!review.read && (
                    <button className="action-btn" title="Mark read" onClick={(e) => { e.stopPropagation(); handleMarkRead(review.id); }}
                      disabled={actionLoading === review.id} style={{ padding: 2 }}>
                      <Eye size={14} />
                    </button>
                  )}
                  <button className="action-btn" title="Archive" onClick={(e) => { e.stopPropagation(); handleArchive(review.id); }}
                    disabled={actionLoading === review.id} style={{ padding: 2 }}>
                    <Archive size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
