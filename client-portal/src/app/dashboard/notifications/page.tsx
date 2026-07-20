'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Check, CheckCircle2, AlertCircle, Info, CalendarCheck2, CheckCheck } from 'lucide-react';
import { Notification } from '@/shared/types';
import { fetchNotificationsAction, dismissNotificationAction, markNotificationReadAction, markAllReadAction } from './actions';
import './notifications.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await fetchNotificationsAction();
      setNotifications((result.notifications || []) as Notification[]);
      setLoading(false);
    }
    load();
  }, []);

  async function handleDismiss(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await dismissNotificationAction(id);
  }

  async function handleToggleRead(id: string, read: boolean) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read } : n));
    await markNotificationReadAction(id, read);
  }

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Bell size={24} color="var(--color-accent)" />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)' }}>Notifications</h2>
        </div>
        
        {notifications.some(n => !n.read) && (
          <button 
            onClick={handleMarkAllRead}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--space-2)', 
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500
            }}
          >
            <CheckCheck size={18} />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '10vh', color: 'var(--color-text-tertiary)' }}>
          <Bell size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.2 }} />
          <p>You are all caught up.</p>
        </div>
      ) : (
        <div className="notification-grid">
          {notifications.map(notif => {
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
                    title="Dismiss"
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
