'use client';

import React, { useEffect, useState } from 'react';
import { 
  Globe, Monitor, Search, BarChart3, Palette, Share2,
  HeadphonesIcon, MessageCircle, Calendar, ExternalLink, 
  Check, Clock, Loader2, Plus, QrCode, Contact
} from 'lucide-react';
import { 
  fetchAdminWhatsAppAction, 
  fetchClientWebsiteAction, 
  fetchServiceRequestsAction, 
  createServiceRequestAction,
  fetchPortfolioItemsAction
} from './actions';
import { formatWhatsAppPhone } from '@/shared/validation';
import ChatBubble from '@/components/ai-assistant/chat-bubble';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
    FB?: { XFBML: { parse: () => void } };
  }
}

import './services.css';

const SERVICES = [
  {
    id: 'website',
    title: 'Custom Website',
    description: 'Professional, SEO-optimized websites built for your brand.',
    icon: Globe,
  },
  {
    id: 'seo',
    title: 'SEO Optimization',
    description: 'Improve your search rankings and get discovered easily.',
    icon: Search,
  },
  {
    id: 'ads',
    title: 'Digital Marketing',
    description: 'Targeted ad campaigns on Google, Facebook, and Instagram.',
    icon: BarChart3,
  },
  {
    id: 'branding',
    title: 'Brand Identity',
    description: 'Logos, color palettes, and visual guidelines for your business.',
    icon: Palette,
  },
  {
    id: 'social_media_management',
    title: 'Social Media Management',
    description: 'Professional management of your social media — content planning, posting, engagement, and growth.',
    icon: Share2,
  },
  {
    id: 'support',
    title: 'Technical Support',
    description: 'Priority assistance for your digital infrastructure.',
    icon: Monitor,
  },
  {
    id: 'qr_menu_design',
    title: 'QR Menu Design',
    description: 'Custom designed digital QR menus for your business.',
    icon: QrCode,
  },
  {
    id: 'business_card_design',
    title: 'Business Card Design',
    description: 'Professional business card designs for your team.',
    icon: Contact,
  }
];

export default function ServicesPage() {
  const [adminPhone, setAdminPhone] = useState('919422880355');
  const [clientWebsite, setClientWebsite] = useState<string | null>(null);
  const [directoryAccessEnabled, setDirectoryAccessEnabled] = useState<boolean>(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [activePortfolioTab, setActivePortfolioTab] = useState('all');
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [waRes, webRes, reqRes, portRes] = await Promise.all([
        fetchAdminWhatsAppAction(),
        fetchClientWebsiteAction(),
        fetchServiceRequestsAction(),
        fetchPortfolioItemsAction()
      ]);
      if (waRes.phone) setAdminPhone(waRes.phone);
      if (webRes.url) setClientWebsite(webRes.url);
      if (webRes.directoryAccessEnabled !== undefined) setDirectoryAccessEnabled(webRes.directoryAccessEnabled);
      if (reqRes.requests) setRequests(reqRes.requests);
      if (portRes.items) setPortfolioItems(portRes.items);
      setLoading(false);
      setPortfolioLoading(false);
    }
    loadData();
  }, []);

  // Embed Scripts Setup
  useEffect(() => {
    // Instagram
    if (!document.getElementById('instagram-embed-script')) {
      const s = document.createElement('script');
      s.id = 'instagram-embed-script';
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      document.body.appendChild(s);
    }
    // Facebook
    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script');
      s.id = 'facebook-jssdk';
      s.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0';
      s.async = true;
      s.crossOrigin = 'anonymous';
      document.body.appendChild(s);
    }
  }, []);

  // Process embeds when portfolio changes
  useEffect(() => {
    if (!portfolioLoading) {
      setTimeout(() => {
        if (window.instgrm) window.instgrm.Embeds.process();
        if (window.FB) window.FB.XFBML.parse();
      }, 500);
    }
  }, [portfolioItems, activePortfolioTab, portfolioLoading]);

  const filteredPortfolio = activePortfolioTab === 'all' 
    ? portfolioItems 
    : portfolioItems.filter(i => i.category === activePortfolioTab);

  const PortfolioPreview = ({ item }: { item: any }) => {
    switch (item.category) {
      case 'website':
        return (
          <a href={item.externalLink} target="_blank" rel="noreferrer" className="portfolio-link">
            <img src={`https://api.microlink.io/?url=${encodeURIComponent(item.externalLink)}&screenshot=true&embed=image.url`} alt={item.title} />
          </a>
        );
      case 'reel':
        return (
          <blockquote className="instagram-media" data-instgrm-permalink={item.externalLink} data-instgrm-version="14">
            <a href={item.externalLink}>View on Instagram</a>
          </blockquote>
        );
      case 'facebook_post':
        return (
          <div className="fb-post" data-href={item.externalLink} data-width="auto"></div>
        );
      case 'generic':
      default:
        return (
          <a href={item.externalLink || '#'} target="_blank" rel="noreferrer" className="portfolio-generic-card">
            <h4>{item.title}</h4>
            {item.description && <p>{item.description}</p>}
          </a>
        );
    }
  };

  const getRequestStatus = (serviceId: string) => {
    const activeReq = requests.find(r => r.serviceType === serviceId && r.status !== 'done');
    if (activeReq) return activeReq.status;
    const doneReq = requests.find(r => r.serviceType === serviceId && r.status === 'done');
    if (doneReq) return 'done';
    return null;
  };

  const handleAction = async (serviceId: string, title: string) => {
    const status = getRequestStatus(serviceId);
    const targetPhone = adminPhone || '919422880355';
    const cleanPhone = formatWhatsAppPhone(targetPhone);

    // Priority Support: direct WhatsApp, no service_request record
    if (serviceId === 'support') {
      const msg = encodeURIComponent(`Hi, I need priority support for my account.`);
      const waUrl = `https://wa.me/${cleanPhone}?text=${msg}`;
      const win = window.open(waUrl, '_blank');
      if (!win) window.location.href = waUrl;
      return;
    }
    
    if (!status || status === 'done') {
      // Pre-open window synchronously to bypass popup blockers
      const waWin = window.open('about:blank', '_blank');
      
      setActionLoading(serviceId);
      const res = await createServiceRequestAction({ serviceType: serviceId });
      setActionLoading(null);
      
      const msg = encodeURIComponent(`Hi, I would like to request the ${title} service.`);
      const waUrl = `https://wa.me/${cleanPhone}?text=${msg}`;

      if (res.success) {
        const reqRes = await fetchServiceRequestsAction();
        if (reqRes.requests) setRequests(reqRes.requests);
        
        if (waWin) {
          waWin.location.href = waUrl;
        } else {
          window.location.href = waUrl;
        }
      } else {
        if (waWin) waWin.close();
        alert(res.error || 'Failed to create request');
      }
    } else {
      // Message button (already requested, following up with admin)
      const msg = encodeURIComponent(`Hi, I am following up on my ${title} service request.`);
      const waUrl = `https://wa.me/${cleanPhone}?text=${msg}`;
      const win = window.open(waUrl, '_blank');
      if (!win) window.location.href = waUrl;
    }
  };

  const renderBadge = (status: string | null) => {
    switch (status) {
      case 'requested':
        return <span className="service-badge requested"><Clock size={12} /> Requested</span>;
      case 'in_progress':
        return <span className="service-badge in-progress"><Loader2 size={12} className="spin" /> In Progress</span>;
      case 'done':
        return <span className="service-badge done"><Check size={12} /> Done</span>;
      default:
        return <span className="service-badge new"><Plus size={12} /> New</span>;
    }
  };

  const getButtonText = (status: string | null) => {
    if (!status) return 'Request';
    if (status === 'done') return 'Request Again';
    return 'Message';
  };

  const openMeeting = () => {
    window.open('https://cal.com/orbitex', '_blank');
  };

  if (loading) {
    return (
      <div className="services-loading-state">
        <Loader2 className="spin" size={32} />
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="services-header">
        <div className="services-header-text">
          <h1>Orbitex Services</h1>
          <p>Grow your business with our premium digital services.</p>
        </div>
        {clientWebsite && (
          <div className="website-tooltip-container">
            <a href={clientWebsite} target="_blank" rel="noreferrer" className="website-tooltip-trigger">
              <Globe />
              <span>Your Website</span>
            </a>
            <div className="website-tooltip-box">
              <div className="website-tooltip-content">
                <ExternalLink />
                <span>{clientWebsite}</span>
              </div>
              <div className="website-tooltip-arrow"></div>
            </div>
          </div>
        )}
      </div>

      <div className="services-grid">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const status = getRequestStatus(service.id);
          const isActLoading = actionLoading === service.id;

          return (
            <div key={service.id} className="service-card">
              <div className="service-card-header">
                <div className="service-icon-wrapper">
                  <Icon size={24} />
                </div>
                {renderBadge(status)}
              </div>
              
              <h3 className="service-title">{service.title}</h3>
              <p className="service-desc">{service.description}</p>

              <div className="service-actions">
                <button
                  onClick={() => handleAction(service.id, service.title)}
                  disabled={isActLoading}
                  className="btn btn-primary btn-service-main"
                >
                  {isActLoading ? <Loader2 size={16} className="spin" /> : null}
                  {!isActLoading && (!status || status === 'done') ? <Plus size={16} /> : null}
                  {!isActLoading && status && status !== 'done' ? <MessageCircle size={16} /> : null}
                  {getButtonText(status)}
                </button>
                <button 
                  onClick={openMeeting}
                  className="btn btn-secondary btn-service-meeting"
                  title="Book Meeting"
                >
                  <Calendar size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portfolio Showcase */}
      {portfolioItems.length > 0 && (
        <div className="portfolio-showcase">
          <h2 className="portfolio-showcase-title">Our Work</h2>
          <div className="portfolio-tabs">
            {['all', 'website', 'reel', 'facebook_post', 'generic'].map(tab => {
              const count = tab === 'all' ? portfolioItems.length : portfolioItems.filter(i => i.category === tab).length;
              if (tab !== 'all' && count === 0) return null;
              return (
                <button key={tab} className={`portfolio-tab ${activePortfolioTab === tab ? 'active' : ''}`}
                  onClick={() => setActivePortfolioTab(tab)}>
                  {tab === 'all' ? 'All' : tab === 'website' ? 'Websites' : tab === 'reel' ? 'Reels' : tab === 'facebook_post' ? 'Social' : 'Design'}
                  <span className="portfolio-tab-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="portfolio-grid">
            {filteredPortfolio.map(item => (
              <div key={item.id} className="portfolio-card">
                <PortfolioPreview item={item} />
                <div className="portfolio-card-info">
                  <h4>{item.title}</h4>
                  {item.description && <p>{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="support-banner">
        <div className="support-banner-content">
          <h2>
            <HeadphonesIcon size={24} /> Priority Support
          </h2>
          <p>
            Our team is available 24/7 for technical assistance, billing inquiries, and custom requests.
          </p>
        </div>
        <button 
          onClick={() => {
            const targetPhone = adminPhone || '919422880355';
            const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Hi, I need support with my account.')}`;
            const win = window.open(waUrl, '_blank');
            if (!win) window.location.href = waUrl;
          }}
          className="btn-support-chat"
        >
          <MessageCircle size={20} />
          Chat on WhatsApp
        </button>
      </div>

      {/* Orbitex Official Channels & Directory */}
      <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
            Orbitex Digital Network
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            Visit orbitex.in or browse our public merchant directory
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="https://orbitex.in" target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Globe size={14} /> orbitex.in <ExternalLink size={12} />
          </a>
          {directoryAccessEnabled && (
            <a href="/directory" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Share2 size={14} /> View Client Directory
            </a>
          )}
        </div>
      </div>

      <ChatBubble />
    </div>
  );
}
