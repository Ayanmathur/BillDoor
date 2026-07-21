'use client';

/**
 * Public Self-Booking Page (/book/[slug])
 *
 * No auth required. Customer selects service → resource → date → slot → books.
 * Same overlap guard and customer upsert as staff-side booking.
 */

import { useState, useEffect, use } from 'react';
import {
  Calendar, Clock, User, Phone, Loader2, Check, ArrowRight,
  MessageCircle, MapPin, FileText,
} from 'lucide-react';
import {
  fetchBookingInfoAction,
  fetchAvailableSlotsAction,
  createPublicBookingAction,
} from './actions';
import './booking.css';

interface Service {
  id: string;
  name: string;
  defaultResourceId: string | null;
  defaultDurationMin: number;
  bufferAfterMin: number;
  price: number;
}

interface Resource {
  id: string;
  name: string;
  businessHours: Record<string, { open: string; close: string } | null> | null;
}

interface SlotOption {
  start: string;
  end: string;
}

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Client info
  const [businessName, setBusinessName] = useState('');
  const [clientId, setClientId] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // Booking flow
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsClosed, setSlotsClosed] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    slotStart: string;
    serviceName?: string;
  } | null>(null);

  // Load business info
  useEffect(() => {
    async function load() {
      const result = await fetchBookingInfoAction(slug);
      if (result.error || !result.client) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setBusinessName(result.client.businessName);
      setClientId(result.client.id);
      setResources(result.resources || []);
      setServices(result.services || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // When service is selected, auto-pick default resource
  useEffect(() => {
    if (selectedService?.defaultResourceId) {
      setSelectedResourceId(selectedService.defaultResourceId);
    } else if (resources.length === 1) {
      setSelectedResourceId(resources[0].id);
    }
  }, [selectedService, resources]);

  // Fetch available slots when resource + date change
  useEffect(() => {
    if (!selectedResourceId || !selectedDate || !selectedService || !clientId) {
      setAvailableSlots([]);
      return;
    }

    async function fetchSlots() {
      setSlotsLoading(true);
      setSlotsClosed(false);
      setSelectedSlot(null);
      const result = await fetchAvailableSlotsAction({
        clientId,
        resourceId: selectedResourceId,
        date: selectedDate,
        durationMin: selectedService!.defaultDurationMin,
        bufferMin: selectedService!.bufferAfterMin,
      });
      if (result.closed) {
        setSlotsClosed(true);
        setAvailableSlots([]);
      } else {
        setAvailableSlots(result.slots || []);
      }
      setSlotsLoading(false);
    }
    fetchSlots();
  }, [selectedResourceId, selectedDate, selectedService, clientId]);

  async function handleBook() {
    if (!selectedSlot || !selectedService || !customerName || !customerPhone) return;
    setSubmitting(true);
    setError('');

    const result = await createPublicBookingAction({
      clientId,
      resourceId: selectedResourceId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.replace(/\D/g, ''),
      slotStart: selectedSlot.start,
      slotEnd: selectedSlot.end,
      durationMin: selectedService.defaultDurationMin,
      bufferMin: selectedService.bufferAfterMin,
      serviceName: selectedService.name,
      notes: notes.trim() || undefined,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess({
      slotStart: selectedSlot.start,
      serviceName: selectedService.name,
    });
    setSubmitting(false);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="booking-page">
        <div className="booking-container">
          <div className="booking-loading">
            <Loader2 size={20} className="spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (notFound) {
    return (
      <div className="booking-page">
        <div className="booking-container">
          <div className="booking-not-found">
            <MapPin size={40} />
            <h2>Business Not Found</h2>
            <p>This booking link may be invalid or the business is temporarily unavailable.</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="booking-page">
        <div className="booking-container">
          <div className="booking-header">
            <h1>{businessName}</h1>
          </div>
          <div className="booking-step">
            <div className="booking-success">
              <div className="booking-success-icon">
                <Check size={28} />
              </div>
              <h2>Booking Confirmed!</h2>
              <p>
                {success.serviceName && <><strong>{success.serviceName}</strong> on </>}
                {formatDate(success.slotStart.split('T')[0])} at {formatTime(success.slotStart)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine current step completeness
  const step1Done = !!selectedService;
  const step2Done = !!selectedResourceId && !!selectedDate && !!selectedSlot;
  const step3Ready = step1Done && step2Done;
  const canSubmit = step3Ready && customerName.trim().length >= 2 && customerPhone.replace(/\D/g, '').length >= 10;

  // Min date = today
  const minDate = new Date().toISOString().split('T')[0];
  // Max date = 30 days from now
  const maxDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  return (
    <div className="booking-page">
      <div className="booking-container">
        {/* Header */}
        <div className="booking-header">
          <h1>{businessName}</h1>
          <p>Book an appointment online</p>
          <div className="booking-powered">Powered by BillDoor</div>
        </div>

        {error && <div className="booking-error">{error}</div>}

        {/* Step 1: Select Service */}
        <div className="booking-step">
          <div className="booking-step-header">
            <div className={`booking-step-number ${step1Done ? 'done' : ''}`}>
              {step1Done ? <Check size={14} /> : '1'}
            </div>
            <div className="booking-step-title">Select a Service</div>
          </div>
          <div className="service-grid">
            {services.map((s) => (
              <div
                key={s.id}
                className={`service-card ${selectedService?.id === s.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedService(s);
                  setSelectedSlot(null);
                }}
              >
                <div className="service-card-info">
                  <h3>{s.name}</h3>
                  <p>{s.defaultDurationMin} min{s.bufferAfterMin > 0 ? ` + ${s.bufferAfterMin} min buffer` : ''}</p>
                </div>
                <div className="service-card-price">
                  ₹{Number(s.price).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
                No services available for online booking.
              </p>
            )}
          </div>
        </div>

        {/* Step 2: Pick Date & Time */}
        {step1Done && (
          <div className="booking-step">
            <div className="booking-step-header">
              <div className={`booking-step-number ${step2Done ? 'done' : ''}`}>
                {step2Done ? <Check size={14} /> : '2'}
              </div>
              <div className="booking-step-title">Pick Date & Time</div>
            </div>

            {/* Resource select (only if multiple) */}
            {resources.length > 1 && (
              <div className="booking-form-group">
                <label>
                  <User size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Choose Staff / Resource
                </label>
                <select
                  className="resource-select"
                  value={selectedResourceId}
                  onChange={(e) => {
                    setSelectedResourceId(e.target.value);
                    setSelectedSlot(null);
                  }}
                >
                  <option value="">Select...</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date */}
            <div className="booking-form-group">
              <label>
                <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Date
              </label>
              <input
                type="date"
                className="date-input"
                value={selectedDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot(null);
                }}
              />
            </div>

            {/* Time slots */}
            {selectedResourceId && selectedDate && (
              <div className="booking-form-group">
                <label>
                  <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Available Times
                </label>
                {slotsLoading ? (
                  <div className="booking-loading" style={{ minHeight: '80px' }}>
                    <Loader2 size={16} className="spin" />
                    Checking availability...
                  </div>
                ) : slotsClosed ? (
                  <div className="time-slots-closed">
                    Closed on {formatDate(selectedDate)}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="time-slots-empty">
                    No available slots on this date. Try another day.
                  </div>
                ) : (
                  <div className="time-slots-grid">
                    {availableSlots.map((slot, i) => (
                      <button
                        key={i}
                        className={`time-slot-btn ${selectedSlot?.start === slot.start ? 'selected' : ''}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {formatTime(slot.start)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Your Details */}
        {step3Ready && (
          <div className="booking-step">
            <div className="booking-step-header">
              <div className="booking-step-number">3</div>
              <div className="booking-step-title">Your Details</div>
            </div>

            {/* Summary */}
            <div className="booking-summary">
              <div className="booking-summary-row">
                <span>Service</span>
                <span>{selectedService!.name}</span>
              </div>
              <div className="booking-summary-row">
                <span>Date</span>
                <span>{formatDate(selectedDate)}</span>
              </div>
              <div className="booking-summary-row">
                <span>Time</span>
                <span>{formatTime(selectedSlot!.start)} – {formatTime(selectedSlot!.end)}</span>
              </div>
              <div className="booking-summary-row">
                <span>Duration</span>
                <span>{selectedService!.defaultDurationMin} min</span>
              </div>
              {resources.length > 1 && (
                <div className="booking-summary-row">
                  <span>With</span>
                  <span>{resources.find(r => r.id === selectedResourceId)?.name}</span>
                </div>
              )}
            </div>

            <div className="booking-form-group">
              <label>Your Name *</label>
              <input
                type="text"
                placeholder="Full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="booking-form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                maxLength={15}
              />
            </div>

            <div className="booking-form-group">
              <label>Notes (optional)</label>
              <textarea
                placeholder="Any special requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <button
              className="booking-cta"
              disabled={!canSubmit || submitting}
              onClick={handleBook}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Booking...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Confirm Booking
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
