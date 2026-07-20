'use client';

/**
 * Appointer — Merged "Today" Timeline View
 *
 * One timeline per resource showing booked + walk-in appointments.
 * "Running Late" flag in warning color for overdue booked slots.
 * Quick actions: Mark Complete, No-Show, Cancel, Send Reminder (wa.me).
 * Auto-refresh every 60s + auto-flag no-shows + fire reminders.
 *
 * Does NOT affect any other module — only replaces the Appointer placeholder.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock, Plus, Users2, ChevronLeft, ChevronRight, Loader2,
  Check, XCircle, Clock, Send, AlertTriangle, Settings,
} from 'lucide-react';
import {
  fetchTodayAppointmentsAction,
  updateAppointmentStatusAction,
  flagNoShowsAction,
  fireRemindersAction,
  fetchAppointerSettingsAction,
} from './actions';

interface ApptItem {
  id: string;
  resourceId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  slotStart: string;
  slotEnd: string;
  estimatedDurationMin: number;
  status: string;
  reminderSent: boolean;
  reminder5Sent: boolean;
  notes: string | null;
  serviceName: string | null;
}

interface ResourceGroup {
  resourceId: string;
  resourceName: string;
  appointments: ApptItem[];
}

export default function AppointerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [businessName, setBusinessName] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    const [result, settings] = await Promise.all([
      fetchTodayAppointmentsAction(dateStr),
      fetchAppointerSettingsAction(),
    ]);
    setGroups(result.groups || []);
    setBusinessName(settings.settings?.business_name || '');
    setLoading(false);
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 60s: re-fetch, flag no-shows, fire reminders, update clock
  useEffect(() => {
    const interval = setInterval(async () => {
      setNow(new Date());
      await flagNoShowsAction();
      await fireRemindersAction();
      await load();
    }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // Date navigation
  function shiftDate(days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    setDateStr(d.toISOString().split('T')[0]);
    setLoading(true);
  }

  const isToday = dateStr === new Date().toISOString().split('T')[0];

  // Status actions
  async function handleStatusChange(apptId: string, status: 'completed' | 'no_show' | 'cancelled') {
    setUpdating(apptId);
    await updateAppointmentStatusAction({ id: apptId, status });
    await load();
    setUpdating(null);
  }

  // WhatsApp reminder
  function handleSendReminder(appt: ApptItem) {
    const slotTime = new Date(appt.slotStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const template = `Hi ${appt.customerName}, reminder: your appointment at ${businessName} is at ${slotTime}. See you soon!`;
    const waUrl = `https://wa.me/${appt.customerPhone}?text=${encodeURIComponent(template)}`;
    window.open(waUrl, '_blank');
  }

  // Status styling
  function getStatusStyle(status: string, slotStart: string) {
    const isLate = status === 'booked' && new Date(slotStart) < now;
    if (status === 'completed') return { bg: 'var(--color-bg-tertiary)', border: 'var(--color-border-subtle)', opacity: 0.6, badge: '✓ Done', badgeColor: 'var(--color-success)' };
    if (status === 'no_show') return { bg: 'var(--color-error-subtle)', border: 'var(--color-error)', opacity: 0.7, badge: '✗ No-Show', badgeColor: 'var(--color-error)' };
    if (status === 'cancelled') return { bg: 'var(--color-bg-tertiary)', border: 'var(--color-border-subtle)', opacity: 0.4, badge: '— Cancelled', badgeColor: 'var(--color-text-tertiary)' };
    if (status === 'walkin') return { bg: 'var(--color-bg-elevated)', border: 'var(--color-accent)', opacity: 1, badge: '⚡ Walk-in', badgeColor: 'var(--color-accent)', dashed: true };
    if (isLate) return { bg: 'var(--color-warning-subtle)', border: 'var(--color-warning)', opacity: 1, badge: '⚠ Running Late', badgeColor: 'var(--color-warning)' };
    return { bg: 'var(--color-bg-elevated)', border: 'var(--color-accent)', opacity: 1, badge: '● Booked', badgeColor: 'var(--color-accent)' };
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  // No resources → prompt to create
  if (groups.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '15vh' }}>
        <CalendarClock size={40} style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-3)' }} />
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>Set Up Appointer</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', maxWidth: 320, margin: '0 auto var(--space-4)' }}>
          Add your first resource (staff, chair, room) to start managing appointments.
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/dashboard/appointer/resources')} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Users2 size={16} /> Add Resources
        </button>
      </div>
    );
  }

  const totalAppts = groups.reduce((sum, g) => sum + g.appointments.length, 0);
  const activeAppts = groups.reduce((sum, g) => sum + g.appointments.filter(a => a.status === 'booked' || a.status === 'walkin').length, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <CalendarClock size={22} /> Appointer
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn" onClick={() => router.push('/dashboard/appointer/settings')} style={{ border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Settings size={14} /> Settings
          </button>
          <button className="btn" onClick={() => router.push('/dashboard/appointer/resources')} style={{ border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Users2 size={14} /> Resources
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard/appointer/create')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Plus size={16} /> Book
          </button>
        </div>
      </div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <button className="btn" onClick={() => shiftDate(-1)} style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)' }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>
            {isToday ? 'Today' : new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {activeAppts} active · {totalAppts} total
          </div>
        </div>
        <button className="btn" onClick={() => shiftDate(1)} style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)' }}>
          <ChevronRight size={16} />
        </button>
        {!isToday && (
          <button className="btn" onClick={() => { setDateStr(new Date().toISOString().split('T')[0]); setLoading(true); }} style={{ border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}>
            Today
          </button>
        )}
      </div>

      {/* Timeline per resource */}
      <div style={{ display: 'grid', gridTemplateColumns: groups.length > 1 ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr', gap: 'var(--space-4)' }}>
        {groups.map((group) => (
          <div key={group.resourceId} style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
            {/* Resource header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>{group.resourceName}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {group.appointments.filter(a => a.status === 'booked' || a.status === 'walkin').length} active
              </span>
            </div>

            {/* Appointment blocks */}
            {group.appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                No appointments
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {group.appointments.map((appt) => {
                  const style = getStatusStyle(appt.status, appt.slotStart);
                  const startTime = new Date(appt.slotStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  const endTime = new Date(appt.slotEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  const isActive = appt.status === 'booked' || appt.status === 'walkin';

                  return (
                    <div
                      key={appt.id}
                      style={{
                        padding: 'var(--space-3)',
                        background: style.bg,
                        border: `${style.dashed ? '2px dashed' : '1px solid'} ${style.border}`,
                        borderRadius: 'var(--radius-md)',
                        opacity: style.opacity,
                        textDecoration: appt.status === 'cancelled' ? 'line-through' : 'none',
                      }}
                    >
                      {/* Top line: time + badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)' }}>
                          <Clock size={12} style={{ verticalAlign: -2, marginRight: 2 }} /> {startTime} – {endTime}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: style.badgeColor }}>
                          {style.badge}
                        </span>
                      </div>

                      {/* Customer + service */}
                      <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>
                        {appt.customerName}
                      </div>
                      {appt.serviceName && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                          {appt.serviceName} · {appt.estimatedDurationMin} min
                        </div>
                      )}
                      {appt.notes && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)', fontStyle: 'italic' }}>
                          {appt.notes}
                        </div>
                      )}

                      {/* Quick actions (only for active appointments) */}
                      {isActive && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <button
                            className="btn"
                            onClick={() => handleStatusChange(appt.id, 'completed')}
                            disabled={updating === appt.id}
                            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)', border: '1px solid var(--color-success)', color: 'var(--color-success)' }}
                          >
                            {updating === appt.id ? <Loader2 size={10} className="spinner" /> : <Check size={10} />} Done
                          </button>
                          <button
                            className="btn"
                            onClick={() => handleStatusChange(appt.id, 'no_show')}
                            disabled={updating === appt.id}
                            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)', border: '1px solid var(--color-error)', color: 'var(--color-error)' }}
                          >
                            <XCircle size={10} /> No-Show
                          </button>
                          <button
                            className="btn"
                            onClick={() => handleStatusChange(appt.id, 'cancelled')}
                            disabled={updating === appt.id}
                            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)', border: '1px solid var(--color-text-tertiary)', color: 'var(--color-text-tertiary)' }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            onClick={() => handleSendReminder(appt)}
                            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)', border: '1px solid var(--color-info)', color: 'var(--color-info)' }}
                            title="Send WhatsApp reminder"
                          >
                            <Send size={10} /> Remind
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
