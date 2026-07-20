'use client';

/**
 * Appointer — Book Appointment / Add Walk-in
 *
 * Phone-first customer lookup (same as Billit).
 * Walk-in mode auto-finds the best gap via findWalkInSlotAction.
 * Overlap guard runs server-side — never silently double-books.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarPlus, Search, Loader2, Check, Clock, UserPlus,
} from 'lucide-react';
import {
  lookupCustomerForAppointerAction,
  createAppointmentAction,
  fetchServicesAction,
} from './actions';
import { fetchResourcesAction } from '../resources/actions';
import { findWalkInSlotAction } from '../actions';

interface ServiceItem { id: string; name: string; default_resource_id: string | null; default_duration_min: number | null; price: number; }
interface ResourceItem { id: string; name: string; active: boolean; }

export default function CreateAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Form
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerFound, setCustomerFound] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const [resourceId, setResourceId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [isWalkin, setIsWalkin] = useState(false);
  const [notes, setNotes] = useState('');
  const [serviceName, setServiceName] = useState('');

  // Walk-in slot suggestion
  const [walkinSlot, setWalkinSlot] = useState<any>(null);
  const [walkinQueue, setWalkinQueue] = useState<any>(null);
  const [findingSlot, setFindingSlot] = useState(false);

  useEffect(() => {
    async function load() {
      const [resResult, svcResult] = await Promise.all([
        fetchResourcesAction(),
        fetchServicesAction(),
      ]);
      const activeResources = (resResult.resources || []).filter((r: any) => r.active);
      setResources(activeResources);
      setServices(svcResult.services || []);
      if (activeResources.length > 0) setResourceId(activeResources[0].id);
      setLoading(false);
    }
    load();
  }, []);

  // Phone lookup
  async function handlePhoneLookup() {
    if (phone.replace(/\D/g, '').length < 10) return;
    setLookingUp(true);
    const result = await lookupCustomerForAppointerAction(phone);
    if (result.customer) {
      setCustomerName(result.customer.name);
      setCustomerFound(true);
    } else {
      setCustomerFound(false);
    }
    setLookingUp(false);
  }

  // Service selection → auto-fill resource + duration
  function handleServiceChange(svcId: string) {
    setServiceId(svcId);
    const svc = services.find((s) => s.id === svcId);
    if (svc) {
      if (svc.default_resource_id && resources.some((r) => r.id === svc.default_resource_id)) {
        setResourceId(svc.default_resource_id);
      }
      if (svc.default_duration_min) setDurationMin(svc.default_duration_min);
      setServiceName(svc.name);
    } else {
      setServiceName('');
    }
  }

  // Walk-in → auto-find gap
  async function handleWalkinToggle(on: boolean) {
    setIsWalkin(on);
    if (on) {
      setDate(new Date().toISOString().split('T')[0]);
      setFindingSlot(true);
      setWalkinSlot(null);
      setWalkinQueue(null);
      const result = await findWalkInSlotAction({
        resourceId: resourceId || undefined,
        durationMin,
      });
      if (result.slot) {
        setWalkinSlot(result.slot);
        setTime(result.slot.slotStart.substring(11, 16));
        if (result.slot.resourceId) setResourceId(result.slot.resourceId);
      } else if (result.queue) {
        setWalkinQueue(result.queue);
      }
      setFindingSlot(false);
    }
  }

  // Submit
  async function handleSubmit() {
    setError('');
    if (!customerName.trim()) { setError('Customer name is required.'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setError('Valid phone number required.'); return; }
    if (!resourceId) { setError('Select a resource.'); return; }
    if (!time && !isWalkin) { setError('Select a time.'); return; }

    const slotStart = walkinSlot && isWalkin
      ? walkinSlot.slotStart
      : `${date}T${time}:00`;
    const slotEnd = walkinSlot && isWalkin
      ? walkinSlot.slotEnd
      : new Date(new Date(slotStart).getTime() + durationMin * 60000).toISOString();

    setSaving(true);
    const result = await createAppointmentAction({
      customerName: customerName.trim(),
      customerPhone: phone,
      resourceId,
      slotStart,
      slotEnd,
      durationMin,
      isWalkin,
      serviceName: serviceName || undefined,
      notes: notes || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(isWalkin ? 'Walk-in added!' : 'Appointment booked!');
      setTimeout(() => router.push('/dashboard/appointer'), 1200);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '15vh' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          You need at least one active resource before booking appointments.
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/dashboard/appointer/resources')}>
          <UserPlus size={16} /> Add Resources
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <button
        className="btn"
        onClick={() => router.push('/dashboard/appointer')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <CalendarPlus size={22} /> {isWalkin ? 'Add Walk-in' : 'Book Appointment'}
      </h2>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-subtle)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Check size={16} /> {success}
        </div>
      )}

      {/* Walk-in toggle */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <button
          className={!isWalkin ? 'btn btn-primary' : 'btn'}
          onClick={() => handleWalkinToggle(false)}
          style={!isWalkin ? {} : { border: '1px solid var(--color-border)' }}
        >
          Booking
        </button>
        <button
          className={isWalkin ? 'btn btn-primary' : 'btn'}
          onClick={() => handleWalkinToggle(true)}
          style={isWalkin ? {} : { border: '1px solid var(--color-border)' }}
        >
          Walk-in
        </button>
      </div>

      {/* Customer lookup */}
      <div className="input-group">
        <label className="input-label">Customer Phone</label>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="input-field"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setCustomerFound(false); }}
            onBlur={handlePhoneLookup}
            onKeyDown={(e) => e.key === 'Enter' && handlePhoneLookup()}
            style={{ flex: 1, fontSize: '16px' }}
          />
          <button className="btn" onClick={handlePhoneLookup} disabled={lookingUp} style={{ border: '1px solid var(--color-border)' }}>
            {lookingUp ? <Loader2 size={14} className="spinner" /> : <Search size={14} />}
          </button>
        </div>
        {customerFound && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)' }}>Existing customer found</span>}
      </div>

      <div className="input-group" style={{ marginTop: 'var(--space-3)' }}>
        <label className="input-label">Customer Name</label>
        <input className="input-field" placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ fontSize: '16px' }} />
      </div>

      {/* Service (optional) */}
      {services.length > 0 && (
        <div className="input-group" style={{ marginTop: 'var(--space-3)' }}>
          <label className="input-label">Service (optional)</label>
          <select className="input-field" value={serviceId} onChange={(e) => handleServiceChange(e.target.value)} style={{ fontSize: '16px' }}>
            <option value="">— No service —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.default_duration_min || 30} min, ₹{s.price})</option>
            ))}
          </select>
        </div>
      )}

      {/* Resource */}
      <div className="input-group" style={{ marginTop: 'var(--space-3)' }}>
        <label className="input-label">Resource</label>
        <select className="input-field" value={resourceId} onChange={(e) => setResourceId(e.target.value)} style={{ fontSize: '16px' }}>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Date & Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
        <div className="input-group">
          <label className="input-label">Date</label>
          <input
            className="input-field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isWalkin}
            style={{ fontSize: '16px' }}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Time</label>
          <input
            className="input-field"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={isWalkin && !!walkinSlot}
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>

      {/* Duration */}
      <div className="input-group" style={{ marginTop: 'var(--space-3)' }}>
        <label className="input-label">Duration (minutes)</label>
        <input className="input-field" type="number" min={5} max={480} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 30)} style={{ fontSize: '16px' }} />
      </div>

      {/* Walk-in slot result */}
      {isWalkin && findingSlot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <Loader2 size={14} className="spinner" /> Finding available slot...
        </div>
      )}
      {isWalkin && walkinSlot && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-success-subtle)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
          <Clock size={14} style={{ verticalAlign: -2 }} /> Slot found: {new Date(walkinSlot.slotStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – {new Date(walkinSlot.slotEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} on {walkinSlot.resourceName}
        </div>
      )}
      {isWalkin && walkinQueue && !walkinSlot && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-warning-subtle)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-warning)' }}>
          <Clock size={14} style={{ verticalAlign: -2 }} /> No gap available. Next available ~{new Date(walkinQueue.estimatedAvailable).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} on {walkinQueue.resourceName}. You can override the time above.
        </div>
      )}

      {/* Notes */}
      <div className="input-group" style={{ marginTop: 'var(--space-3)' }}>
        <label className="input-label">Notes (optional)</label>
        <input className="input-field" placeholder="Internal notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ fontSize: '16px' }} />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={saving}
        style={{ width: '100%', marginTop: 'var(--space-4)', justifyContent: 'center', fontSize: '16px' }}
      >
        {saving ? <Loader2 size={16} className="spinner" /> : <CalendarPlus size={16} />}
        {isWalkin ? ' Add Walk-in' : ' Book Appointment'}
      </button>
    </div>
  );
}
