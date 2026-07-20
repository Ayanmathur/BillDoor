'use client';

import { useState, useEffect } from 'react';
import { fetchClientsAction, resetClientPasswordAction, updateClientDetailsAction } from './actions';
import { KeyRound, Check, Loader2, X, UserPen } from 'lucide-react';
import './clients.css';

interface ClientRecord {
  id: string;
  username: string;
  business_name: string;
  slug: string;
  google_place_id: string;
  about: string;
  status: string;
  created_at: string;
  deleted_at: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetModalClient, setResetModalClient] = useState<ClientRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [editModalClient, setEditModalClient] = useState<ClientRecord | null>(null);
  const [editData, setEditData] = useState({ businessName: '', slug: '', googlePlaceId: '', about: '' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    async function load() {
      const { clients } = await fetchClientsAction();
      setClients(clients || []);
      setLoading(false);
    }
    load();
  }, []);

  const filteredClients = clients.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.business_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetModalClient || !newPassword) return;

    setResetting(true);
    const result = await resetClientPasswordAction(resetModalClient.id, newPassword);
    setResetting(false);

    if (result.error) {
      alert(result.error);
    } else {
      alert(`Password for ${resetModalClient.username} reset successfully.`);
      setResetModalClient(null);
      setNewPassword('');
    }
  }

  function openEditModal(client: ClientRecord) {
    setEditModalClient(client);
    setEditData({
      businessName: client.business_name || '',
      slug: client.slug || '',
      googlePlaceId: client.google_place_id || '',
      about: client.about || ''
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editModalClient) return;

    setEditing(true);
    const result = await updateClientDetailsAction({
      clientId: editModalClient.id,
      ...editData
    });
    setEditing(false);

    if (result.error) {
      alert(result.error);
    } else {
      alert(`Details for ${editModalClient.username} updated successfully.`);
      setEditModalClient(null);
      
      // Reload clients
      const { clients: newClients } = await fetchClientsAction();
      setClients(newClients || []);
    }
  }

  return (
    <div className="clients-page">
      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="dash-card-title" style={{ margin: 0 }}>Manage Clients</h2>
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', minWidth: 200 }}
          />
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Business Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.username}</strong>
                    </td>
                    <td>{client.business_name}</td>
                    <td>
                      <span className={`badge badge-${client.status === 'active' ? 'success' : client.status === 'revoked' ? 'error' : 'warning'}`}>
                        {client.status}
                      </span>
                      {client.deleted_at && <span className="badge badge-error" style={{ marginLeft: 8 }}>Deleted</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-icon"
                          title="Reset Password"
                          onClick={() => setResetModalClient(client)}
                        >
                          <KeyRound size={16} /> Reset
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit Details"
                          onClick={() => openEditModal(client)}
                        >
                          <UserPen size={16} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>No clients found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetModalClient && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Reset Password</h3>
              <button className="btn-icon" onClick={() => setResetModalClient(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleResetSubmit}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                  Resetting password for <strong>{resetModalClient.username}</strong>.
                </p>
                
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 8 }}>
                  New Password
                </label>
                <input
                  type="text" // using text so admin can see what they type easily
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                  placeholder="Enter new password"
                  autoComplete="off"
                  required
                  autoFocus
                />
              </div>

              <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setResetModalClient(null)} disabled={resetting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={resetting || !newPassword}>
                  {resetting ? <Loader2 size={16} className="spinner" /> : <><Check size={16} /> Confirm Reset</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {editModalClient && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Client Details</h3>
              <button className="btn-icon" onClick={() => setEditModalClient(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                  Editing details for <strong>{editModalClient.username}</strong>.
                </p>
                
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 4 }}>Business Name</label>
                <input
                  type="text"
                  value={editData.businessName}
                  onChange={(e) => setEditData({ ...editData, businessName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}
                  required
                />

                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 4 }}>URL Slug</label>
                <input
                  type="text"
                  value={editData.slug}
                  onChange={(e) => setEditData({ ...editData, slug: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}
                  required
                />

                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 4 }}>Google Place ID</label>
                <input
                  type="text"
                  value={editData.googlePlaceId}
                  onChange={(e) => setEditData({ ...editData, googlePlaceId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}
                />

                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 4 }}>About</label>
                <textarea
                  value={editData.about}
                  onChange={(e) => setEditData({ ...editData, about: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 12, minHeight: 80 }}
                />
              </div>

              <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setEditModalClient(null)} disabled={editing}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editing}>
                  {editing ? <Loader2 size={16} className="spinner" /> : <><Check size={16} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
