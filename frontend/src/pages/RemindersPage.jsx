import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormFields';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

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

export default function RemindersPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Reminders', 'Scheduled payment follow-ups');
  const location = useLocation();

  const [reminders, setReminders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ invoice_id: '', scheduled_at: '', message: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  const load = () => apiClient.get('/invoices/reminders/scheduled').then(r => setReminders(r.data.data || [])).catch(() => setReminders([]));

  useEffect(() => {
    if (!organizationId) return;
    load();
    apiClient.get('/invoices').then(r => setInvoices(r.data.data || [])).catch(() => {});
  }, [organizationId]);

  // ── Auto-open modal if navigated from invoice creation ─────────────────
  useEffect(() => {
    const state = location.state;
    if (state?.prefill_invoice_id) {
      setForm(f => ({ ...f, invoice_id: String(state.prefill_invoice_id) }));
      setShowModal(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/invoices/${form.invoice_id}/reminders`, {
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        message: form.message || null,
      });
      toast.success('Reminder scheduled');
      setShowModal(false);
      setForm({ invoice_id: '', scheduled_at: '', message: '' });
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to schedule reminder';
      toast.error(msg);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
        action={canEdit ? (
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> New Reminder
          </Button>
        ) : null}
      />

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {reminders.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#9CA3AF]">No reminders scheduled</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-[#6B7280]">
                {['Invoice', 'Scheduled At', 'Status', 'Message'].map(h => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reminders.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-[#111827]">
                    {invoices.find(i => i.id === r.invoice_id)?.invoice_number || `#${r.invoice_id}`}
                  </td>
                  <td className="px-5 py-3 text-[#6B7280]">{new Date(r.scheduled_at).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    {r.sent_at
                      ? <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">Sent</span>
                      : <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-medium">Pending</span>}
                  </td>
                  <td className="px-5 py-3 text-[#6B7280]">{r.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="Schedule Reminder" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Select label="Invoice" value={form.invoice_id} onChange={set('invoice_id')} required>
              <option value="">Select invoice</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>{i.invoice_number}</option>
              ))}
            </Select>
            <Input
              label="Send At"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={set('scheduled_at')}
              required
            />
            <Input
              label="Message (optional)"
              value={form.message}
              onChange={set('message')}
              placeholder="e.g. Payment due reminder"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Schedule</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
