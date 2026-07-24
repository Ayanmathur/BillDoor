'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Edit3, Trash2, Save, X, Loader2, IndianRupee, Filter } from 'lucide-react';
import { fetchExpensesAction, createExpenseAction, updateExpenseAction, deleteExpenseAction } from './actions';

const CATEGORIES = ['rent', 'salary', 'supplies', 'utilities', 'marketing', 'general', 'other'];

interface Expense {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  note: string | null;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'general',
    note: '',
    expenseDate: new Date().toISOString().split('T')[0]
  });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const result = await fetchExpensesAction({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      category: filterCategory,
    });
    if (result.expenses) setExpenses(result.expenses as Expense[]);
    setLoading(false);
  }, [filterFrom, filterTo, filterCategory]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleSave = async () => {
    if (!formData.amount || !formData.category || !formData.expenseDate) return;
    setFormLoading(true);
    
    const payload = {
      amount: Number(formData.amount),
      category: formData.category,
      note: formData.note,
      expenseDate: formData.expenseDate,
    };

    if (editId) {
      await updateExpenseAction(editId, payload);
    } else {
      await createExpenseAction(payload);
    }
    
    setFormLoading(false);
    setShowForm(false);
    setEditId(null);
    setFormData({ amount: '', category: 'general', note: '', expenseDate: new Date().toISOString().split('T')[0] });
    loadExpenses();
  };

  const handleEdit = (exp: Expense) => {
    setFormData({
      amount: exp.amount.toString(),
      category: exp.category,
      note: exp.note || '',
      expenseDate: exp.expense_date,
    });
    setEditId(exp.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    await deleteExpenseAction(id);
    loadExpenses();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setFormData({ amount: '', category: 'general', note: '', expenseDate: new Date().toISOString().split('T')[0] });
  };

  const totalFiltered = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
        <button className="quick-action-btn" onClick={() => router.push('/dashboard/billit')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="settings-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Expense Log</h2>
        <button className="btn btn-primary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="settings-section" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Filter size={16} style={{ color: 'var(--color-text-tertiary)' }} />
            <input type="date" className="input-field" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="From Date" style={{ width: 140 }} />
            <span style={{ fontSize: 'var(--text-xs)' }}>to</span>
            <input type="date" className="input-field" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="To Date" style={{ width: 140 }} />
          </div>
          <select className="input-field" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: 140 }}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <button className="btn" onClick={loadExpenses}>Apply Filters</button>
        </div>
      </div>

      {showForm && (
        <div className="settings-section" style={{ marginBottom: 'var(--space-4)', border: '1px solid var(--color-accent-subtle)' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)' }}>
            {editId ? 'Edit Expense' : 'New Expense'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Date</label>
              <input type="date" className="input-field" value={formData.expenseDate} onChange={(e) => setFormData({...formData, expenseDate: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Amount (₹)</label>
              <div style={{ position: 'relative' }}>
                <IndianRupee size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                <input type="number" className="input-field" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} style={{ paddingLeft: 30 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Category</label>
              <select className="input-field" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Note (Optional)</label>
              <input type="text" className="input-field" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="What was this for?" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={formLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {formLoading ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} Save Expense
            </button>
            <button className="btn" onClick={handleCancel} disabled={formLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}><Loader2 size={24} className="spinner" /></div>
      ) : expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-tertiary)' }}>
          <p>No expenses found.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td style={{ fontSize: 'var(--text-xs)' }}>{new Date(exp.expense_date).toLocaleDateString('en-IN')}</td>
                  <td style={{ textTransform: 'capitalize' }}>{exp.category}</td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>{exp.note || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--weight-medium)' }}>₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleEdit(exp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}><Edit3 size={14} /></button>
                      <button onClick={() => handleDelete(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Summary Row */}
              <tr style={{ background: 'var(--color-bg-secondary)', borderTop: '2px solid var(--color-border)' }}>
                <td colSpan={3} style={{ fontWeight: 'var(--weight-semibold)', textAlign: 'right' }}>Total</td>
                <td style={{ textAlign: 'right', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)' }}>₹{totalFiltered.toLocaleString('en-IN')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
