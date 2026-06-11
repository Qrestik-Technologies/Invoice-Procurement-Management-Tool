import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/FormFields';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold text-[#111827]">{title}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827]">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const EMPTY = {
  name: '', email: '', phone: '',
  address: '', ship_to_address: '',
  payment_terms: '', template_type: 'standard',
};

const PAYMENT_TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on Receipt'];

export default function CustomersPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Customers', 'Client accounts for invoices and billing');
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  const load = () => apiClient.get('/customers').then(r => setCustomers(r.data.data || [])).catch(() => {});
  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({
      name: c.name || '', email: c.email || '', phone: c.phone || '',
      address: c.address || '', ship_to_address: c.ship_to_address || '',
      payment_terms: c.payment_terms || '', template_type: c.template_type || 'standard',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiClient.put(`/customers/${editing}`, form);
        toast.success('Customer updated');
      } else {
        await apiClient.post('/customers', form);
        toast.success('Customer created');
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
        action={canEdit ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New Customer</Button> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customers.length === 0 && (
          <p className="col-span-full text-center text-sm text-[#9CA3AF] py-12">No customers yet</p>
        )}
        {customers.map(c => (
          <div
            key={c.id}
            onClick={() => canEdit && openEdit(c)}
            className={`rounded-xl border border-border bg-white p-5 shadow-sm ${canEdit ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition' : ''}`}
          >
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-semibold text-[#111827]">{c.name}</h3>
              {c.payment_terms && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {c.payment_terms}
                </span>
              )}
            </div>
            {c.email && <p className="text-xs text-[#6B7280]">✉ {c.email}</p>}
            {c.phone && <p className="text-xs text-[#6B7280]">☎ {c.phone}</p>}
            {c.address && (
              <div className="mt-2 border-t border-border pt-2">
                <p className="text-xs font-medium text-[#9CA3AF]">Bill To</p>
                <p className="text-xs text-[#6B7280]">{c.address}</p>
              </div>
            )}
            {c.ship_to_address && (
              <div className="mt-1">
                <p className="text-xs font-medium text-[#9CA3AF]">Ship To</p>
                <p className="text-xs text-[#6B7280]">{c.ship_to_address}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Customer' : 'New Customer'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Name" value={form.name} onChange={set('name')} required placeholder="Acme Corp" />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} required placeholder="billing@acme.com" />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Payment Terms</label>
              <select
                value={form.payment_terms}
                onChange={set('payment_terms')}
                className="w-full rounded-lg border border-border py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select terms…</option>
                {PAYMENT_TERMS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">Bill To Address</label>
              <textarea
                value={form.address}
                onChange={set('address')}
                rows={2}
                placeholder="123 Main St, City, Country"
                className="w-full rounded-lg border border-border py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                Ship To Address
                <span className="ml-1 text-xs text-[#9CA3AF]">(required for EMCOR)</span>
              </label>
              <textarea
                value={form.ship_to_address}
                onChange={set('ship_to_address')}
                rows={2}
                placeholder="456 Delivery Ave, City, Country"
                className="w-full rounded-lg border border-border py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Create'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
