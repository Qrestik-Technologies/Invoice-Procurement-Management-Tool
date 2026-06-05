import { useEffect, useState, useRef } from 'react';
import { Plus, Download, Upload, Loader2 } from 'lucide-react';
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

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  INR: '₹',
  SAR: 'SAR ',
};

const EMPTY_FORM = {
  invoice_number: '',
  customer_id: '',
  subtotal: '',
  tax: '',
  total: '',
  currency: 'USD',
  invoice_date: '',
  due_date: '',
  notes: '',
};

const DEFAULT_CUSTOMERS = [
  { id: 1, name: 'Qrestik Technologies L.L.C' },
  { id: 2, name: 'Infinitum Global' },
];

function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

function extractErrorMessage(err, fallback = 'Something went wrong') {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => `${d.loc?.slice(-1)[0] ?? 'field'}: ${d.msg}`).join(' · ');
  return fallback;
}

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
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [parsing, setParsing] = useState(false);
  const [parsedVendor, setParsedVendor] = useState(null);
  const fileRef = useRef();

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    apiClient.get(`/invoices${params}`).then(r => setInvoices(r.data.data || [])).catch(() => {});
  };

  useEffect(() => {
    if (!organizationId) return;
    load();
    apiClient.get('/customers')
      .then(r => { const d = r.data.data || []; setCustomers(d.length > 0 ? d : DEFAULT_CUSTOMERS); })
      .catch(() => setCustomers(DEFAULT_CUSTOMERS));
  }, [statusFilter, organizationId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) { toast.error('Please upload a PDF file'); return; }
    const data = new FormData();
    data.append('file', file);
    setParsing(true);
    setParsedVendor(null);
    try {
      const res = await apiClient.post('/invoices/parse', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      const f = res.data.data || res.data;
      setForm(prev => ({
        ...prev,
        invoice_number: f.invoice_number || prev.invoice_number,
        subtotal: f.subtotal != null ? String(f.subtotal) : prev.subtotal,
        tax: f.tax != null ? String(f.tax) : prev.tax,
        total: f.total != null ? String(f.total) : prev.total,
        currency: f.currency || prev.currency,
        invoice_date: f.invoice_date ? String(f.invoice_date) : prev.invoice_date,
        notes: f.vendor_name ? `${f.vendor_name}${f.period_start ? ` — ${f.period_start} to ${f.period_end}` : ''}` : prev.notes,
      }));
      const detectedName = (f.vendor_name || f.vendor || '').toLowerCase().trim();
      if (detectedName) {
        const match = customers.find(c => { const n = c.name.toLowerCase(); return detectedName.includes(n) || n.includes(detectedName); });
        if (match) setForm(prev => ({ ...prev, customer_id: String(match.id) }));
      }
      setParsedVendor({
        vendor: f.vendor,
        vendor_name: f.vendor_name,
        po_number: f.po_number,
        bank_iban: f.bank_iban,
        bank_swift: f.bank_swift,
        bank_routing: f.bank_routing,
        bank_account: f.bank_account_number,
        bank_name: f.bank_name,
        bank_fein: f.bank_fein,
        bank_email: f.bank_email,
        period_start: f.period_start,
        period_end: f.period_end,
        sku: f.sku,
        missing: f.missing_fields || [],
      });
      toast.success(`${f.vendor_name || 'Invoice'} parsed successfully`);
      if (f.missing_fields?.length) toast(`Please fill in: ${f.missing_fields.join(', ')}`, { icon: '⚠️' });
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not parse PDF'));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/invoices', {
        invoice_number: form.invoice_number,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        currency: form.currency,
        invoice_date: form.invoice_date,
        due_date: form.due_date,
        subtotal: Number(form.subtotal || 0),
        tax: Number(form.tax || 0),
        total: Number(form.total || 0),
        notes: form.notes || null,
      });
      toast.success('Invoice created');
      setShowModal(false);
      setForm(EMPTY_FORM);
      setParsedVendor(null);
      load();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to create invoice'));
    }
  };

  const handleExport = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiClient.get(`/invoices/export/excel${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = 'invoices.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Export failed'));
    }
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
              <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setParsedVendor(null); setShowModal(true); }}>
                <Plus className="h-4 w-4" /> New Invoice
              </Button>
            )}
          </div>
        )}
      />

      <div className="mb-4 flex gap-3">
        {['', 'draft', 'sent', 'received', 'overdue', 'paid', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-white border border-border text-[#6B7280] hover:border-primary hover:text-primary'
            }`}
          >
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
                {['Invoice #', 'Customer', 'Total', 'Invoice Date', 'Due Date', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-[#111827]">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-[#6B7280]">
                    {customers.find(c => c.id === inv.customer_id)?.name || inv.customer_id}
                  </td>
                  <td className="px-5 py-3">
                    {currencySymbol(inv.currency)}{Number(inv.total).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-[#6B7280]">{inv.invoice_date}</td>
                  <td className="px-5 py-3 text-[#6B7280]">{inv.due_date}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || ''}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="New Invoice" onClose={() => { setShowModal(false); setParsedVendor(null); }}>
          <form onSubmit={handleCreate} className="space-y-4">

            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-gray-50 px-4 py-3">
              <Upload className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
              <span className="text-xs text-[#6B7280]">Auto-fill from PDF</span>
              <label className="ml-auto cursor-pointer">
                <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors">
                  {parsing
                    ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Parsing…</span>
                    : 'Upload PDF'}
                </span>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={parsing} />
              </label>
            </div>

            {parsedVendor && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs space-y-1">
                <p className="font-medium text-green-800">✓ Detected: {parsedVendor.vendor_name || parsedVendor.vendor}</p>
                {parsedVendor.po_number && <p className="text-green-700">PO: {parsedVendor.po_number}</p>}
                {parsedVendor.period_start && <p className="text-green-700">Period: {parsedVendor.period_start} → {parsedVendor.period_end}</p>}
                {(parsedVendor.bank_iban || parsedVendor.bank_account) && (
                  <div className="mt-2 border-t border-green-200 pt-2 space-y-0.5">
                    <p className="font-medium text-green-800">Remittance</p>
                    {parsedVendor.bank_name && <p className="text-green-700">Bank: {parsedVendor.bank_name}</p>}
                    {parsedVendor.bank_account && <p className="text-green-700">Account: {parsedVendor.bank_account}</p>}
                    {parsedVendor.bank_iban && <p className="text-green-700">IBAN: {parsedVendor.bank_iban}</p>}
                    {parsedVendor.bank_swift && <p className="text-green-700">Swift: {parsedVendor.bank_swift}</p>}
                    {parsedVendor.bank_routing && <p className="text-green-700">Routing: {parsedVendor.bank_routing}</p>}
                  </div>
                )}
                {parsedVendor.missing?.length > 0 && (
                  <p className="text-amber-600 mt-1">⚠ Fill manually: {parsedVendor.missing.join(', ')}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input label="Invoice #" value={form.invoice_number} onChange={set('invoice_number')} required placeholder="INV-001" />
              <Select label="Customer" value={form.customer_id} onChange={set('customer_id')}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Subtotal" type="number" step="0.01" value={form.subtotal} onChange={set('subtotal')} placeholder="0.00" />
              <Input label="Tax" type="number" step="0.01" value={form.tax} onChange={set('tax')} placeholder="0.00" />
              <Input label="Total" type="number" step="0.01" value={form.total} onChange={set('total')} required placeholder="0.00" />
              <Select label="Currency" value={form.currency} onChange={set('currency')}>
                {['USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}
              </Select>
              <Input label="Invoice Date" type="date" value={form.invoice_date} onChange={set('invoice_date')} required />
              <Input label="Due Date" type="date" value={form.due_date} onChange={set('due_date')} required />
            </div>

            <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional" />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setShowModal(false); setParsedVendor(null); }}>Cancel</Button>
              <Button type="submit">Create Invoice</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
