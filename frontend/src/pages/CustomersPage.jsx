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

const EMPTY = { name: '', email: '', phone: '', address: '', tax_id: '', notes: '' };

export default function CustomersPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Customers', 'Client accounts for invoices and billing');
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  const load = () => apiClient.get('/customers').then(r => setCustomers(r.data.data || [])).catch(() => {});
  useEffect(() => {
    if (!organizationId) return;
    load();
  }, [organizationId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/customers', form);
      toast.success('Customer created');
      setShowModal(false);
      setForm(EMPTY);
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
        action={canEdit ? <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> New Customer</Button> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customers.length === 0 && <p className="col-span-full text-center text-sm text-[#9CA3AF] py-12">No customers yet</p>}
        {customers.map(c => (
          <div key={c.id} className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-semibold text-[#111827]">{c.name}</h3>
              {c.tax_id && <span className="text-xs text-[#9CA3AF]">TIN: {c.tax_id}</span>}
            </div>
            {c.email && <p className="text-xs text-[#6B7280]">✉ {c.email}</p>}
            {c.phone && <p className="text-xs text-[#6B7280]">☎ {c.phone}</p>}
            {c.address && <p className="mt-1 text-xs text-[#9CA3AF]">{c.address}</p>}
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="New Customer" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Name" value={form.name} onChange={set('name')} required placeholder="Acme Corp" />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="billing@acme.com" />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />
            <Input label="Address" value={form.address} onChange={set('address')} />
            <Input label="Tax ID" value={form.tax_id} onChange={set('tax_id')} />
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
