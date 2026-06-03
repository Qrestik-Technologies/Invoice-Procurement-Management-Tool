import { useEffect, useState, useRef } from 'react';
import { Plus, Download} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormFields';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const EMPTY_FORM = {
  invoice_number: '',
  customer_id: '',
  amount: '',
  currency: 'USD',
  issue_date: '',
  due_date: '',
  description: '',
};

// ── Fallback customers shown when the API returns nothing ──────────────────
const DEFAULT_CUSTOMERS = [
  { id: 1, name: 'Qrestik Technologies L.L.C' },
  { id: 2, name: 'Infinitum Global' },
];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold text-[#111827]">{title}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827]">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Invoices', 'Manage billing and payment records');
  const [invoices, setInvoices] = useState([]);

  // ── Initialise with DEFAULT_CUSTOMERS so the dropdown is never empty ──────
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);

  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef();

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    apiClient.get(`/invoices${params}`).then(r => setInvoices(r.data.data || [])).catch(() => {});
  };

  useEffect(() => {
    if (!organizationId) return;
    load();

    // ── Fetch customers; fall back to defaults if API returns nothing ─────
    apiClient
      .get('/customers')
      .then(r => {
        const apiCustomers = r.data.data || [];
        setCustomers(apiCustomers.length > 0 ? apiCustomers : DEFAULT_CUSTOMERS);
      })
      .catch(() => {
        setCustomers(DEFAULT_CUSTOMERS);
      });
  }, [statusFilter, organizationId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    const data = new FormData();
    data.append('file', file);

    setParsing(true);
    try {
      const res = await apiClient.post('/invoices/parse', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const f = res.data.data || res.data;

      // ── DEBUG: inspect every field the backend returns ─────────────────
      console.log('PARSED INVOICE:', f);

      setForm(prev => ({
        ...prev,
        invoice_number: f.invoice_number || prev.invoice_number,
        amount:         f.total          ? String(f.total)        : prev.amount,
        currency:       f.currency       || prev.currency,

        issue_date:
          f.invoice_date ||
          f.issue_date   ||
          prev.issue_date,

        due_date:
          f.due_date ||
          f.payment_due_date ||
          f.dueDate ||
          f.invoice_due_date ||
          '',

        description:
          f.summary ||
          f.description ||
          f.invoice_summary ||
          `Invoice from ${f.vendor_name || f.vendor || 'Vendor'}`,
      }));

      // ── Auto-select customer based on detected vendor name ───────────────
      const detectedName = (f.vendor_name || f.vendor || '').toLowerCase().trim();

      if (detectedName) {
        const customerMatch = customers.find(c => {
          const cName = c.name.toLowerCase();
          return detectedName.includes(cName) || cName.includes(detectedName);
        });

        if (customerMatch) {
          setForm(prev => ({ ...prev, customer_id: String(customerMatch.id) }));
        }
      }

      toast.success(`${f.vendor_name || 'Invoice'} parsed successfully`);

      if (f.missing_fields?.length) {
        toast(`Please fill in: ${f.missing_fields.join(', ')}`, { icon: '⚠️' });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not parse PDF');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/invoices', {
        ...form,
        customer_id: Number(form.customer_id),
        amount: Number(form.amount),
      });
      toast.success('Invoice created');
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      console.error('CREATE INVOICE ERROR:', err.response?.data);

      toast.error(
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        'Failed to create invoice'
      );
    }
  };

  const handleExport = async () => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const res = await apiClient.get(`/invoices/export/excel${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'invoices.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
        action={(
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}>
                <Plus className="h-4 w-4" /> New Invoice
              </Button>
            )}
          </div>
        )}
      />

      <div className="mb-4 flex gap-3">
        {['', 'draft', 'sent', 'received', 'overdue', 'paid', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-white border border-border text-[#6B7280] hover:border-primary hover:text-primary'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {invoices.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#9CA3AF]">No invoices found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-[#6B7280]">
                {['Invoice #', 'Customer', 'Amount', 'Issue Date', 'Due Date', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-[#111827]">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-[#6B7280]">{customers.find(c => c.id === inv.customer_id)?.name || inv.customer_id}</td>
                  <td className="px-5 py-3">${Number(inv.amount).toLocaleString()} {inv.currency}</td>
                  <td className="px-5 py-3 text-[#6B7280]">{inv.issue_date}</td>
                  <td className="px-5 py-3 text-[#6B7280]">{inv.due_date}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="New Invoice" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">

      
            {/* Parsed vendor summary removed */}

            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice #" value={form.invoice_number} onChange={set('invoice_number')} required placeholder="INV-001" />
              <Select label="Customer" value={form.customer_id} onChange={set('customer_id')} required>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={set('amount')} required />
              <Select label="Currency" value={form.currency} onChange={set('currency')}>
                {['USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}
              </Select>
              <Input label="Issue Date" type="date" value={form.issue_date} onChange={set('issue_date')} required />
              <Input label="Due Date" type="date" value={form.due_date} onChange={set('due_date')} required />
            </div>
            <Input label="Description" value={form.description} onChange={set('description')} placeholder="Optional" />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Create Invoice</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
