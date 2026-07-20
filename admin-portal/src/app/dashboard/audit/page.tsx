'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ScrollText, 
  Download, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  X,
  Search
} from 'lucide-react';
import { fetchAuditLogsAction, fetchAuditActionsListAction } from './actions';
import './audit.css';

interface AuditLog {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter states
  const [actorType, setActorType] = useState('');
  const [actionQuery, setActionQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ipSearch, setIpSearch] = useState('');
  
  // Metadata options
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchActionsList = useCallback(async () => {
    try {
      const { actions } = await fetchAuditActionsListAction();
      setAvailableActions(actions || []);
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    }
  }, []);

  const fetchLogs = useCallback(async (currentPage: number = 1) => {
    setIsLoading(true);
    try {
      const response = await fetchAuditLogsAction({
        page: currentPage,
        actorType: actorType || undefined,
        action: actionQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        ipSearch: ipSearch || undefined,
      });

      if (!response.error) {
        setLogs(response.logs);
        setTotalCount(response.totalCount);
        setPage(response.page || 1);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [actorType, actionQuery, dateFrom, dateTo, ipSearch]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchActionsList(),
        fetchLogs(1)
      ]);
    };
    init();
  }, [fetchActionsList, fetchLogs]);

  const handleApplyFilters = () => {
    setPage(1);
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setActorType('');
    setActionQuery('');
    setDateFrom('');
    setDateTo('');
    setIpSearch('');
    // State updates are async, so we'll fetch with empty params directly
    setPage(1);
    setIsLoading(true);
    fetchAuditLogsAction({ page: 1 }).then(response => {
      if (!response.error) {
        setLogs(response.logs);
        setTotalCount(response.totalCount);
        setPage(response.page || 1);
      }
      setIsLoading(false);
    });
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatActionString = (str: string) => {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const truncateId = (id: string | null) => {
    if (!id) return '-';
    return `${id.substring(0, 8)}...`;
  };

  const exportCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['Time', 'Actor Type', 'Actor ID', 'Action', 'Target', 'IP Address', 'User Agent'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => {
        return [
          `"${log.createdAt}"`,
          `"${log.actorType}"`,
          `"${log.actorId}"`,
          `"${log.action}"`,
          `"${log.target || ''}"`,
          `"${log.ipAddress || ''}"`,
          `"${(log.userAgent || '').replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="audit-container">
      <div className="audit-header">
        <div className="audit-header-title">
          <ScrollText size={28} />
          <span>Audit Log</span>
        </div>
        <button onClick={exportCSV} className="audit-export-btn" disabled={logs.length === 0}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="audit-filters">
        <div className="audit-filter-group">
          <label>Actor Type</label>
          <select value={actorType} onChange={e => setActorType(e.target.value)}>
            <option value="">All</option>
            <option value="admin">Admin</option>
            <option value="client">Client</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className="audit-filter-group">
          <label>Action</label>
          <select value={actionQuery} onChange={e => setActionQuery(e.target.value)}>
            <option value="">All Actions</option>
            {availableActions.map(action => (
              <option key={action} value={action}>
                {formatActionString(action)}
              </option>
            ))}
          </select>
        </div>

        <div className="audit-filter-group">
          <label>Date From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>

        <div className="audit-filter-group">
          <label>Date To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        <div className="audit-filter-group">
          <label>IP Address</label>
          <input 
            type="text" 
            placeholder="Search IP..." 
            value={ipSearch} 
            onChange={e => setIpSearch(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
          />
        </div>

        <div className="audit-filter-actions">
          <button className="audit-apply-btn" onClick={handleApplyFilters}>
            <Filter size={16} />
            Apply Filters
          </button>
          <button className="audit-clear-btn" onClick={handleClearFilters}>
            <X size={16} />
            Clear
          </button>
        </div>
      </div>

      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP Address</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="audit-empty">
                    <Loader2 className="audit-empty-icon" size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <h3>Loading Logs</h3>
                    <p>Fetching audit records from the database...</p>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="audit-empty">
                    <Search className="audit-empty-icon" size={48} />
                    <h3>No audit logs found</h3>
                    <p>Try adjusting your filters or search terms.</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`audit-actor-badge ${log.actorType}`}>
                          {log.actorType.charAt(0).toUpperCase() + log.actorType.slice(1)}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #9ca3af)' }}>
                          {truncateId(log.actorId)}
                        </span>
                      </div>
                    </td>
                    <td className="audit-action-cell">{formatActionString(log.action)}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}>{truncateId(log.target)}</span></td>
                    <td>{log.ipAddress || '-'}</td>
                    <td>
                      <button 
                        className="audit-expand-btn"
                        onClick={() => toggleRowExpansion(log.id)}
                        aria-label="Toggle details"
                      >
                        {expandedRows.has(log.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </td>
                  </tr>
                  
                  {expandedRows.has(log.id) && (
                    <tr className="audit-metadata-row">
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div className="audit-metadata-container">
                          <div className="audit-metadata-grid">
                            <div className="audit-metadata-item">
                              <span className="audit-metadata-label">Full Actor ID</span>
                              <span className="audit-metadata-value">{log.actorId}</span>
                            </div>
                            {log.target && (
                              <div className="audit-metadata-item">
                                <span className="audit-metadata-label">Full Target ID</span>
                                <span className="audit-metadata-value">{log.target}</span>
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="audit-metadata-item">
                                <span className="audit-metadata-label">User Agent</span>
                                <span className="audit-metadata-value">{log.userAgent}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="audit-metadata-item" style={{ marginTop: '8px' }}>
                            <span className="audit-metadata-label" style={{ marginBottom: '4px' }}>Metadata Payload</span>
                            <pre className="audit-metadata-json">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="audit-pagination">
        <div className="audit-pagination-info">
          Showing page {page} of {totalPages} ({totalCount} total records)
        </div>
        <div className="audit-pagination-controls">
          <button 
            className="audit-pagination-btn"
            disabled={page <= 1 || isLoading}
            onClick={() => fetchLogs(page - 1)}
          >
            Previous
          </button>
          <button 
            className="audit-pagination-btn"
            disabled={page >= totalPages || isLoading}
            onClick={() => fetchLogs(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
