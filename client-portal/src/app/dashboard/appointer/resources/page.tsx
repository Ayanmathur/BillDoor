'use client';

/**
 * Appointer — Resources Management
 *
 * CRUD for resources (staff, chairs, rooms).
 * Same layout pattern as Billit Catalog.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Power, PowerOff, Loader2, Users2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchResourcesAction, addResourceAction, updateResourceAction, updateBusinessHoursAction } from './actions';

interface ResourceRow {
  id: string;
  name: string;
  active: boolean;
  business_hours: Record<string, { open: string; close: string } | null> | null;
  created_at: string;
}

export default function ResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Business hours edit
  const [expandedHoursId, setExpandedHoursId] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState<Record<string, { open: string; close: string } | null>>({});

  async function load() {
    const result = await fetchResourcesAction();
    if (result.error) setError(result.error);
    setResources(result.resources || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    const result = await addResourceAction({ name: newName.trim() });
    if (result.error) setError(result.error);
    else { setNewName(''); setShowAdd(false); await load(); }
    setSaving(false);
  }

  async function handleUpdate() {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    setError('');
    const result = await updateResourceAction({ id: editId, name: editName.trim() });
    if (result.error) setError(result.error);
    else { setEditId(null); await load(); }
    setSaving(false);
  }

  async function handleToggleActive(id: string, active: boolean) {
    setSaving(true);
    const result = await updateResourceAction({ id, active: !active });
    if (result.error) setError(result.error);
    else await load();
    setSaving(false);
  }

  function toggleHoursEdit(r: ResourceRow) {
    if (expandedHoursId === r.id) {
      setExpandedHoursId(null);
    } else {
      const defaultHours = r.business_hours || {};
      const newEditingHours: Record<string, { open: string; close: string } | null> = {};
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(day => {
        newEditingHours[day] = defaultHours[day] !== undefined ? defaultHours[day] : { open: '09:00', close: '18:00' };
      });
      setEditingHours(newEditingHours);
      setExpandedHoursId(r.id);
    }
  }

  async function handleSaveHours(id: string) {
    setSaving(true);
    setError('');
    const result = await updateBusinessHoursAction({ id, businessHours: editingHours });
    if (result.error) setError(result.error);
    else { setExpandedHoursId(null); await load(); }
    setSaving(false);
  }

  async function handleClearHours(id: string) {
    setSaving(true);
    setError('');
    const result = await updateBusinessHoursAction({ id, businessHours: null });
    if (result.error) setError(result.error);
    else { setExpandedHoursId(null); await load(); }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20vh' }}>
        <Loader2 size={24} className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn"
        onClick={() => router.push('/dashboard/appointer')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)' }}
      >
        <ArrowLeft size={16} /> Back to Appointer
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Users2 size={22} /> Resources
        </h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Plus size={16} /> Add Resource
        </button>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-subtle)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }} role="alert">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="input-group">
            <label className="input-label">Resource Name</label>
            <input
              className="input-field"
              placeholder="e.g. Chair 1, Dr. Smith, Room A"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
              style={{ fontSize: '16px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !newName.trim()}>
              {saving ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />} Add
            </button>
            <button className="btn" onClick={() => { setShowAdd(false); setNewName(''); }} style={{ border: '1px solid var(--color-border)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resource list */}
      {resources.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          No resources yet. Add your first resource (e.g. a chair, a room, or a staff member) to start booking appointments.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {resources.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', opacity: r.active ? 1 : 0.5,
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)' }}>
              {editId === r.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
                  <input
                    className="input-field"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                    autoFocus
                    style={{ fontSize: '16px', flex: 1, maxWidth: 300 }}
                  />
                  <button className="btn btn-primary" onClick={handleUpdate} disabled={saving} style={{ padding: 'var(--space-2) var(--space-3)' }}>Save</button>
                  <button className="btn" onClick={() => setEditId(null)} style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)' }}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)' }}>{r.name}</span>
                    {!r.active && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>(Inactive)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className="btn"
                      onClick={() => { setEditId(r.id); setEditName(r.name); }}
                      title="Edit"
                      style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleToggleActive(r.id, r.active)}
                      title={r.active ? 'Deactivate' : 'Reactivate'}
                      style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border)', color: r.active ? 'var(--color-error)' : 'var(--color-success)' }}
                    >
                      {r.active ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                  </div>
                </>
              )}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleHoursEdit(r)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    <Clock size={16} /> 
                    <span style={{ fontWeight: 'var(--weight-medium)' }}>Business Hours</span>
                    {!r.business_hours && <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>Always open (no hours set)</span>}
                  </div>
                  <button className="btn" style={{ padding: 'var(--space-1) var(--space-2)', border: '1px solid var(--color-border)' }}>
                    {expandedHoursId === r.id ? <ChevronUp size={14} /> : (r.business_hours ? <ChevronDown size={14} /> : 'Set Business Hours')}
                  </button>
                </div>

                {expandedHoursId === r.id && (
                  <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                      const dayData = editingHours[day];
                      const isOpen = dayData !== null;
                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', opacity: isOpen ? 1 : 0.5 }}>
                          <div style={{ width: 60, textTransform: 'capitalize', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{day}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={isOpen} onChange={(e) => {
                                const checked = e.target.checked;
                                setEditingHours({ ...editingHours, [day]: checked ? { open: '09:00', close: '18:00' } : null });
                              }} />
                              <span className="toggle-slider"></span>
                            </label>
                            Open
                          </div>
                          {isOpen && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <input type="time" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)', width: 110 }} value={dayData.open} onChange={(e) => setEditingHours({ ...editingHours, [day]: { ...dayData, open: e.target.value } })} />
                              <span>-</span>
                              <input type="time" className="input-field" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)', width: 110 }} value={dayData.close} onChange={(e) => setEditingHours({ ...editingHours, [day]: { ...dayData, close: e.target.value } })} />
                            </div>
                          )}
                          {!isOpen && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Closed</div>}
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                      <button className="btn btn-primary" onClick={() => handleSaveHours(r.id)} disabled={saving}>
                        {saving ? <Loader2 size={14} className="spinner" /> : 'Set Hours'}
                      </button>
                      <button className="btn" onClick={() => handleClearHours(r.id)} disabled={saving} style={{ border: '1px solid var(--color-border)', color: 'var(--color-error)' }}>
                        Clear Hours
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          ))}
        </div>
      )}
    </div>
  );
}
