'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Check, CheckCircle2, AlertCircle, Info, CalendarCheck2, CheckCheck, Filter } from 'lucide-react';
import { Notification } from '@/shared/types';
import { fetchNotificationsAction, dismissNotificationAction, markNotificationReadAction, markAllReadAction } from './actions';
import './notifications.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');

  useEffect(() => {
    async function load() {
      const result = await fetchNotificationsAction();
      setNotifications((result.notifications || []) as Notification[]);
      setLoading(false);
    }
    load();
  }, []);

  const notifySync = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notifications-updated'));
    }
  };

  async function handleDismiss(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
    notifySync();
    await dismissNotificationAction(id);
  }

  async function handleToggleRead(id: string, read: boolean) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read } : n));
    notifySync();
    await markNotificationReadAction(id, read);
  }

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    notifySync();
    await markAllReadAction();
  }

  function getRelativeTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  }

  function getCardTheme(type: string) {
    switch (type) {
      case 'bill_sent':
      case 'appointment_completed':
        return { colorClass: 'success', icon: <CheckCircle2 size={20} /> };
      case 'bill_failed':
      case 'whatsapp_disconnected':
        return { colorClass: 'error', icon: <X size={20} /> };
      case 'appointment_reminder':
      case 'appointment_no_show':
      case 'subscription_due':
        return { colorClass: 'warning', icon: <AlertCircle size={20} /> };
      case 'appointment_booked':
        return { colorClass: 'info', icon: <CalendarCheck2 size={20} /> };
      case 'orbitex_update':
      case 'service_status_change':
        return { colorClass: 'info', icon: <Info size={20} /> };
      default:
        return { colorClass: 'info', icon: <Info size={20} /> };
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <span className="spinner" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  const filteredNotifications = notifications.filter(n => filter === 'all' || !n.read);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Bell size={24} color="var(--color-accent)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', margin: 0 }}>Notifications</h2>
          </div>
          {unreadCount > 0 && (
            <span style={{ 
              background: 'var(--color-accent)', 
              color: 'var(--color-accent-text, #fff)', 
              fontSize: '12px', 
              fontWeight: 700, 
              padding: '2px 8px', 
              borderRadius: '50px' 
            }}>
              {unreadCount} new
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ 
            display: 'flex', 
            background: 'var(--color-bg-secondary)', 
            padding: '3px', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid var(--color-border)' 
          }}>
            <button
              onClick={() => setFilter('unread')}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'unread' ? 'var(--color-bg-primary)' : 'transparent',
                color: filter === 'unread' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                boxShadow: filter === 'unread' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'all' ? 'var(--color-bg-primary)' : 'transparent',
                color: filter === 'all' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                boxShadow: filter === 'all' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              All ({notifications.length})
            </button>
          </div>

          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllRead}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--space-1)', 
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 600
              }}
            >
              <CheckCheck size={18} />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '10vh', color: 'var(--color-text-tertiary)' }}>
          <Bell size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.2 }} />
          <p style={{ fontSize: 'var(--text-md)', margin: 0 }}>
            {filter === 'unread' ? 'No unread notifications. You are all caught up!' : 'No notifications found.'}
          </p>
        </div>
      ) : (
        <div className="notification-grid">
          {filteredNotifications.map(notif => {
            const theme = getCardTheme(notif.type);
            const timeAgo = getRelativeTime(notif.createdAt);
            
            return (
              <div key={notif.id} className={`notification-card ${theme.colorClass} ${notif.read ? 'read' : ''}`}>
                <div className="notification-icon-container">
                  {theme.icon}
                </div>

                <div className="notification-message-container">
                  <p className="notification-title">{notif.title}</p>
                  <p className="notification-sub-text">{notif.message}</p>
                  <span className="notification-meta">{timeAgo}</span>
                </div>

                <div className="notification-actions">
                  <button 
                    onClick={() => handleToggleRead(notif.id, !notif.read)}
                    className="notification-cross-icon" 
                    title={notif.read ? 'Mark as unread' : 'Mark as read'}
                    style={{ color: notif.read ? 'var(--color-text-tertiary)' : 'var(--color-accent)' }}
                  >
                    <Check size={18} />
                  </button>
                  <button 
                    onClick={() => handleDismiss(notif.id)}
                    className="notification-cross-icon" 
                    title="Dismiss notification"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
