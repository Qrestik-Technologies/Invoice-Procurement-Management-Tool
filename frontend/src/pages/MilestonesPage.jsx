import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormFields';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold text-[#111827]">{title}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827]">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function MilestonesPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Milestones', 'Track delivery and payment milestones');
  const [milestones, setMilestones] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ invoice_id: '', title: '', description: '', due_date: '', amount: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  const load = () => apiClient.get('/milestones').then(r => setMilestones(r.data.data || [])).catch(() => {});
  useEffect(() => {
    if (!organizationId) return;
    load();
    apiClient.get('/invoices').then(r => setInvoices(r.data.data || [])).catch(() => {});
  }, [organizationId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/milestones', { ...form, invoice_id: Number(form.invoice_id), amount: form.amount ? Number(form.amount) : undefined });
      toast.success('Milestone created');
      setShowModal(false);
      setForm({ invoice_id: '', title: '', description: '', due_date: '', amount: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
        action={canEdit ? <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> New Milestone</Button> : null}
      />
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {milestones.length === 0 ? <p className="px-6 py-12 text-center text-sm text-[#9CA3AF]">No milestones</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-[#6B7280]">
              {['Title', 'Invoice', 'Amount', 'Due Date', 'Status'].map(h => <th key={h} className="px-5 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{milestones.map(m => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-[#111827]">{m.title}</td>
                <td className="px-5 py-3 text-[#6B7280]">#{m.invoice_id}</td>
                <td className="px-5 py-3">{m.amount ? `$${Number(m.amount).toLocaleString()}` : '—'}</td>
                <td className="px-5 py-3 text-[#6B7280]">{m.due_date || '—'}</td>
                <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[m.status]||''}`}>{m.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {showModal && (
        <Modal title="New Milestone" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Select label="Invoice" value={form.invoice_id} onChange={set('invoice_id')} required>
              <option value="">Select invoice</option>
              {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number}</option>)}
            </Select>
            <Input label="Title" value={form.title} onChange={set('title')} required />
            <Input label="Due Date" type="date" value={form.due_date} onChange={set('due_date')} />
            <Input label="Amount (optional)" type="number" step="0.01" value={form.amount} onChange={set('amount')} />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
