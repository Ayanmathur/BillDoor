'use client';

/**
 * WhatsApp Auto — Hub Page
 *
 * Three quick-action cards: Settings, Templates, Broadcast.
 * Shows connection status, template count, and last campaign.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings, FileText, Send, Wifi, WifiOff, AlertTriangle,
  MessageSquare, ChevronRight,
} from 'lucide-react';
import { fetchWhatsAppSettingsAction } from './settings/actions';
import { fetchBroadcastTemplatesAction } from './templates/actions';
import { fetchCampaignHistoryAction } from './broadcast/actions';
import './whatsapp.css';

interface HubData {
  connectionStatus: 'connected' | 'disconnected' | 'error';
  automationEnabled: boolean;
  monthlyMessageCount: number;
  qualityRating: string;
  templateCount: number;
  lastCampaign: { templateName: string; recipientCount: number; sentAt: string } | null;
}

export default function WhatsAppAutoPage() {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [settingsRes, templatesRes, campaignsRes] = await Promise.all([
        fetchWhatsAppSettingsAction(),
        fetchBroadcastTemplatesAction(),
        fetchCampaignHistoryAction(),
      ]);

      const activeTemplates = (templatesRes.templates || []).filter(
        (t: { isActive: boolean }) => t.isActive
      );
      const lastCamp = (campaignsRes.campaigns || [])[0] || null;

      setData({
        connectionStatus: settingsRes.config?.connectionStatus || 'disconnected',
        automationEnabled: settingsRes.config?.automationEnabled || false,
        monthlyMessageCount: settingsRes.config?.monthlyMessageCount || 0,
        qualityRating: settingsRes.config?.qualityRating || 'unknown',
        templateCount: activeTemplates.length,
        lastCampaign: lastCamp
          ? {
              templateName: lastCamp.templateName,
              recipientCount: lastCamp.recipientCount,
              sentAt: lastCamp.sentAt || lastCamp.createdAt,
            }
          : null,
      });
      setLoading(false);
    }
    load();
  }, []);

  const statusIcon = data?.connectionStatus === 'connected'
    ? <Wifi size={20} />
    : data?.connectionStatus === 'error'
      ? <AlertTriangle size={20} />
      : <WifiOff size={20} />;

  const statusText = data?.connectionStatus === 'connected'
    ? 'Connected'
    : data?.connectionStatus === 'error'
      ? 'Error'
      : 'Disconnected';

  return (
    <div>
      {/* Module Header */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Templates, broadcasts &amp; automated messaging via the official WhatsApp Business Cloud API.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          Loading...
        </div>
      ) : (
        <div className="wa-hub-grid">
          {/* Settings Card */}
          <Link href="/dashboard/whatsapp/settings" className="wa-hub-card">
            <div className="wa-hub-card-icon settings">
              <Settings size={22} />
            </div>
            <div className="wa-hub-card-title">Settings</div>
            <div className="wa-hub-card-desc">
              API credentials, connection status, quality rating, and automation toggle.
            </div>
            <div className="wa-hub-card-meta">
              <span className={`wa-status-dot ${data?.connectionStatus || 'disconnected'}`} />
              {statusIcon}
              <span>{statusText}</span>
              {data?.automationEnabled && (
                <span style={{ marginLeft: 'auto', color: 'var(--color-success)', fontSize: 'var(--text-xs)' }}>
                  Auto ON
                </span>
              )}
              <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* Templates Card */}
          <Link href="/dashboard/whatsapp/templates" className="wa-hub-card">
            <div className="wa-hub-card-icon templates">
              <FileText size={22} />
            </div>
            <div className="wa-hub-card-title">Broadcast Templates</div>
            <div className="wa-hub-card-desc">
              Create and manage message templates for broadcast campaigns.
            </div>
            <div className="wa-hub-card-meta">
              <MessageSquare size={14} />
              <span>{data?.templateCount || 0} active template{data?.templateCount !== 1 ? 's' : ''}</span>
              <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* Broadcast Card */}
          <Link href="/dashboard/whatsapp/broadcast" className="wa-hub-card">
            <div className="wa-hub-card-icon broadcast">
              <Send size={22} />
            </div>
            <div className="wa-hub-card-title">New Broadcast</div>
            <div className="wa-hub-card-desc">
              Send a campaign to opted-in customers. Audience pulled from Billit &amp; Appointer records.
            </div>
            <div className="wa-hub-card-meta">
              {data?.lastCampaign ? (
                <span>
                  Last: &ldquo;{data.lastCampaign.templateName}&rdquo; → {data.lastCampaign.recipientCount} recipients
                </span>
              ) : (
                <span>No campaigns sent yet</span>
              )}
              <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>
        </div>
      )}

      {/* Monthly Stats Bar */}
      {!loading && data && (
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div className="wa-stat-card">
            <div>
              <div className="wa-stat-value">{data.monthlyMessageCount}</div>
              <div className="wa-stat-label">Messages this month</div>
            </div>
          </div>
          <div className="wa-stat-card">
            <div>
              <div className="wa-stat-value">
                <span className={`wa-quality-badge ${data.qualityRating.toLowerCase()}`}>
                  {data.qualityRating}
                </span>
              </div>
              <div className="wa-stat-label">Quality Rating</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
