'use client';

import { useState, useEffect } from 'react';
import { Briefcase, RefreshCw, Loader2, Check } from 'lucide-react';
import { fetchAllServiceRequestsAction, updateServiceRequestStatusAction } from './actions';
import './services.css';

interface ServiceRequest {
  id: string;
  clientId: string;
  clientName: string;
  serviceType: string;
  status: 'requested' | 'in_progress' | 'done';
  description: string;
  createdAt: string;
  updatedAt: string;
}

const serviceTypeMapping: Record<string, string> = {
  website: 'Custom Website',
  seo: 'SEO',
  ads: 'Digital Marketing',
  branding: 'Brand Identity',
  support: 'Technical Support',
  social_media_management: 'Social Media Mgmt'
};

export default function ServicesPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    const { requests: data, error } = await fetchAllServiceRequestsAction();
    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'requested' | 'in_progress' | 'done') => {
    setUpdatingId(id);
    const { success, error } = await updateServiceRequestStatusAction({ id, status: newStatus });
    if (success) {
      setRequests(prev => 
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );
    } else {
      console.error(error);
    }
    setUpdatingId(null);
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="services-page">
      <div className="services-page-header">
        <h1>
          <Briefcase size={24} />
          Service Requests
        </h1>
        <button 
          className="btn btn-sm"
          onClick={fetchRequests}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      <div className="services-table-container">
        <table className="services-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Service Type</th>
              <th>Status</th>
              <th>Requested Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <Loader2 size={24} className="spin" />
                  </div>
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">No service requests yet</div>
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.clientName}</td>
                  <td>
                    <span className="service-type-label">
                      {serviceTypeMapping[req.serviceType] || req.serviceType}
                    </span>
                  </td>
                  <td>
                    <span className={`service-status-badge ${req.status}`}>
                      {req.status === 'in_progress' ? 'In Progress' : req.status}
                    </span>
                  </td>
                  <td>{getRelativeTime(req.createdAt)}</td>
                  <td>
                    <div className="service-actions-cell">
                      {req.status === 'requested' && (
                        <button
                          className="btn btn-sm btn-info action-btn"
                          onClick={() => handleUpdateStatus(req.id, 'in_progress')}
                          disabled={updatingId === req.id}
                        >
                          {updatingId === req.id ? <Loader2 size={14} className="spin" /> : 'Mark In Progress'}
                        </button>
                      )}
                      {req.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-success action-btn"
                          onClick={() => handleUpdateStatus(req.id, 'done')}
                          disabled={updatingId === req.id}
                        >
                          {updatingId === req.id ? <Loader2 size={14} className="spin" /> : 'Mark Done'}
                        </button>
                      )}
                      {req.status === 'done' && (
                        <Check size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
