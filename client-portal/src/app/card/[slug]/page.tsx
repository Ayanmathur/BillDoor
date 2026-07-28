'use client';

import { useState, useEffect, use } from 'react';
import {
  MapPin, Phone, Globe, Instagram, Linkedin, Twitter, MessageCircle, ExternalLink, Star, Calendar,
  ShoppingBag, Download, Loader2, User, Receipt, Star as StarIcon, CalendarClock, Store, Cake,
  Scissors, Stethoscope, GraduationCap, Building2, Utensils, Heart
} from 'lucide-react';
import PoweredByFooter from '@/components/powered-by-footer';
import { fetchBusinessCardAction } from './actions';
import './card.css';

function CardBackground() {
  const icons = [Receipt, StarIcon, CalendarClock, Store, Cake, Scissors, Stethoscope, GraduationCap, Building2, Utensils, Heart];
  const pattern = Array.from({ length: 40 }).map((_, i) => {
    const Icon = icons[i % icons.length];
    const top = `${((i * 17) % 100)}%`;
    const left = `${((i * 23) % 100)}%`;
    const size = 24 + ((i * 7) % 24);
    const opacity = 0.03 + (((i * 3) % 5) * 0.01);
    const rotation = ((i * 45) % 360);
    return (
      <div key={i} style={{ position: 'absolute', top, left, opacity, transform: `rotate(${rotation}deg)` }}>
        <Icon size={size} color="currentColor" />
      </div>
    );
  });

  return (
    <div className="login-background-pattern" style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      color: 'var(--color-text-primary)'
    }}>
      {pattern}
    </div>
  );
}

export default function BusinessCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchBusinessCardAction(slug);
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
  }, [slug]);

  if (loading) {
    return (
      <div className="card-page">
        <div className="card-loading">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error === 'temporarily_unavailable') {
    return (
      <div className="card-page">
        <div className="card-unavailable">
          <h2>Temporarily Unavailable</h2>
          <p>This business profile is currently not accessible.</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-page">
        <div className="card-unavailable">
          <h2>Business Not Found</h2>
          <p>{error || 'Profile not found.'}</p>
        </div>
      </div>
    );
  }

  const { client, activeLinks } = data;

  const handleSaveContact = () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${client.business_name || ''}
ORG:${client.business_name || ''}
TEL;TYPE=WORK:${client.phone || ''}
ADR;TYPE=WORK:;;${client.address || ''};;;;
URL:${client.website_url || ''}
END:VCARD`;
    
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${client.business_name || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-page" style={{ position: 'relative' }}>
      <CardBackground />
      <div className="card-container" style={{ position: 'relative', zIndex: 10 }}>
        <div className="card-header">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.business_name} className="card-logo" />
          ) : (
            <div className="card-logo-initial">
              {client.business_name ? client.business_name.charAt(0).toUpperCase() : <User size={32} />}
            </div>
          )}
          <h1 className="card-title">{client.business_name}</h1>
          {client.about && <p className="card-about">{client.about}</p>}
          {client.owner_name && <p className="card-owner">{client.owner_name}</p>}
        </div>

        <div className="card-contact-info">
          {client.phone && (
            <a href={`tel:${client.phone}`} className="card-info-row">
              <Phone size={18} className="card-info-icon" />
              <span>{client.phone}</span>
            </a>
          )}
          {client.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card-info-row"
              title="Open location in Google Maps"
            >
              <MapPin size={18} className="card-info-icon" />
              <span>{client.address}</span>
              <ExternalLink size={12} style={{ opacity: 0.6, marginLeft: 'auto' }} />
            </a>
          )}
        </div>

        <div className="card-social-row">
          {client.instagram_url && (
            <a href={client.instagram_url} target="_blank" rel="noopener noreferrer" className="card-social-icon">
              <Instagram size={24} />
            </a>
          )}
          {client.facebook_url && (
            <a href={client.facebook_url} target="_blank" rel="noopener noreferrer" className="card-social-icon">
              <ExternalLink size={24} />
            </a>
          )}
          {client.x_url ? (
            <a href={client.x_url} target="_blank" rel="noopener noreferrer" className="card-social-icon">
              <Twitter size={24} />
            </a>
          ) : null}
          {client.linkedin_url && (
            <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" className="card-social-icon">
              <Linkedin size={24} />
            </a>
          )}
          {client.website_url && (
            <a href={client.website_url} target="_blank" rel="noopener noreferrer" className="card-social-icon">
              <Globe size={24} />
            </a>
          )}
          {client.whatsapp_url && (
            <a href={client.whatsapp_url} target="_blank" rel="noopener noreferrer" className="card-social-icon">
              <MessageCircle size={24} />
            </a>
          )}
        </div>

        <div className="card-action-links">
          {activeLinks.reviewActive && (
            <a href={`/review/${slug}`} className="card-module-link">
              <Star size={18} />
              Review us
            </a>
          )}
          {activeLinks.appointmentActive && (
            <a href={`/book/${slug}`} className="card-module-link">
              <Calendar size={18} />
              Book an appointment
            </a>
          )}
          {activeLinks.catalogActive && (
            <a href={`/catalog/${slug}`} className="card-module-link">
              <ShoppingBag size={18} />
              View catalog
            </a>
          )}
        </div>

        <button onClick={handleSaveContact} className="card-save-btn">
          <Download size={18} />
          Save Contact
        </button>
      </div>

      <PoweredByFooter />
    </div>
  );
}
