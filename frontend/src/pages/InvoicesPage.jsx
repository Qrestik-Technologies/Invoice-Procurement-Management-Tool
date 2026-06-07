import { useEffect, useState, useRef } from 'react';
import { Plus, Download, Upload, Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/FormFields';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

const STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  sent:       'bg-blue-100 text-blue-700',
  received:   'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  overdue:    'bg-red-100 text-red-700',
  cancelled:  'bg-gray-100 text-gray-500',
  dispatched: 'bg-purple-100 text-purple-700',
  pending:    'bg-yellow-100 text-yellow-700',
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', AED: 'AED ', INR: '₹', SAR: 'SAR ',
};

const EMPTY_FORM = {
  invoice_number: '', organization_id: '', subtotal: '', tax: '',
  amount: '', currency: 'USD', issue_date: '', due_date: '', notes: '',
};

const ALLOWED_CUSTOMERS = ['infinitum global', 'inginitum global', 'qrestik technologies'];

const DEFAULT_CUSTOMERS = [
  { id: 1, name: 'Qrestik Technologies' },
  { id: 2, name: 'Infinitum Global' },
];

function currencySymbol(code) { return CURRENCY_SYMBOLS[code] || `${code} `; }

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

// ── Upload & Save Zone ────────────────────────────────────────────────────────

function UploadSaveZone({ onSaved }) {
  const [state, setState] = useState('idle'); // idle | uploading | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      toast.error('Only PDF and DOCX files are supported');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    setState('uploading');
    setResult(null);
    setErrorMsg('');
    try {
      const res = await apiClient.post('/invoices/parse-and-save', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const parsed = res.data.data?.parse_result || {};
      setResult({ ...parsed, document_id: res.data.data?.document_id });
      setState('success');
      toast.success('Invoice saved successfully');
      if (parsed.missing_fields?.length) {
        toast(`Missing fields: ${parsed.missing_fields.join(', ')}`, { icon: '⚠️' });
      }
      onSaved?.();
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Upload failed'));
      setState('error');
      toast.error(extractErrorMessage(err, 'Upload failed'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  if (state === 'success' && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              {result.vendor_name || result.vendor || 'Invoice'} saved
            </p>
            <p className="text-xs text-green-700">Document ID: {result.document_id}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-gray-50 px-4 py-3 text-xs space-y-1">
          {result.invoice_number && <p><span className="text-[#6B7280]">Invoice #:</span> <span className="font-medium">{result.invoice_number}</span></p>}
          {result.invoice_date && <p><span className="text-[#6B7280]">Date:</span> <span className="font-medium">{result.invoice_date}</span></p>}
          {result.total != null && <p><span className="text-[#6B7280]">Total:</span> <span className="font-medium">{result.currency || 'USD'} {Number(result.total).toLocaleString()}</span></p>}
          {result.customer_name && <p><span className="text-[#6B7280]">Customer:</span> <span className="font-medium">{result.customer_name}</span></p>}
        </div>

        {result.line_items?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] mb-1">Line items</p>
            <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-border text-[#6B7280]">
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.line_items.map((li, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{li.description}</td>
                    <td className="px-3 py-2 text-right">{li.qty}</td>
                    <td className="px-3 py-2 text-right">{li.rate}</td>
                    <td className="px-3 py-2 text-right">{li.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.missing_fields?.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Missing fields — fill manually: <span className="font-medium">{result.missing_fields.join(', ')}</span>
            </p>
          </div>
        )}

        <button
          onClick={() => { setState('idle'); setResult(null); }}
          className="text-xs text-primary hover:underline"
        >
          Upload another
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
        <button
          onClick={() => { setState('idle'); setErrorMsg(''); }}
          className="text-xs text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed transition-colors ${
        dragging ? 'border-primary bg-primary/5' : 'border-border bg-gray-50'
      } flex flex-col items-center justify-center gap-3 px-6 py-12 text-center`}
    >
      {state === 'uploading' ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-[#6B7280]">Parsing and saving invoice…</p>
        </>
      ) : (
        <>
          <div className="rounded-full bg-white border border-border p-3">
            <FileText className="h-6 w-6 text-[#6B7280]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#111827]">Drop your invoice here</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">PDF or DOCX, up to 20MB</p>
          </div>
          <label className="cursor-pointer">
            <span className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors">
              Browse file
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </label>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Invoices', 'Manage billing and payment records');
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [newInvDragging, setNewInvDragging] = useState(false);

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

  const handleNewInvFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext)) { toast.error('Only PDF and DOCX files are supported'); return; }
    const data = new FormData();
    data.append('file', file);
    setUploadParsing(true);
    try {
      const res = await apiClient.post('/invoices/parse-and-save', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      const parsed = res.data.data?.parse_result || {};

      // Map vendor field directly to org ID
      const vendorKey = parsed.vendor || '';
      const orgId = vendorKey === 'infinitum' ? '10' : vendorKey === 'qrestik' ? '11' : '';
      const amountVal = parsed.total ?? parsed.subtotal ?? 0;

      setForm(f => ({
        ...f,
        invoice_number: parsed.invoice_number || f.invoice_number,
        subtotal: parsed.subtotal != null ? String(parsed.subtotal) : f.subtotal,
        tax: parsed.tax != null ? String(parsed.tax) : f.tax,
        amount: amountVal ? String(amountVal) : f.amount,
        currency: parsed.currency || f.currency,
        issue_date: parsed.invoice_date ? String(parsed.invoice_date) : f.issue_date,
        due_date: parsed.due_date ? String(parsed.due_date) : f.due_date,
        notes: parsed.notes || f.notes,
        organization_id: orgId || f.organization_id,
      }));
      toast.success(parsed.missing_fields?.length ? 'Partial parse — review highlighted fields' : 'Invoice parsed — review and save');
      if (parsed.missing_fields?.length) toast(`Fill manually: ${parsed.missing_fields.join(', ')}`, { icon: '⚠️' });
      load();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Upload failed');
      if (err?.response?.status === 409) {
        toast.error('Duplicate invoice — this invoice number already exists', { icon: '🚫' });
      } else {
        toast.error(msg);
      }
    } finally {
      setUploadParsing(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/invoices', {
        invoice_number: form.invoice_number,
        customer_id: form.organization_id ? Number(form.organization_id) : null,
        currency: form.currency,
        invoice_date: form.issue_date,
        due_date: form.due_date,
        subtotal: Number(form.subtotal || 0),
        tax: Number(form.tax || 0),
        total: Number(form.amount || 0),
        amount: Number(form.amount || 0),
        issue_date: form.issue_date,
        notes: form.notes || null,
      });
      toast.success('Invoice created');
      setShowModal(false);
      setForm(EMPTY_FORM);
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
              <>
<Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}>
                  <Plus className="h-4 w-4" /> New Invoice
                </Button>
              </>
            )}
          </div>
        )}
      />

      <div className="mb-4 flex gap-3 flex-wrap">
        {['', 'draft', 'sent', 'received', 'overdue', 'paid', 'dispatched', 'pending', 'cancelled'].map(s => (
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
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="rounded-full bg-gray-100 p-4">
              <FileText className="h-7 w-7 text-[#9CA3AF]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#111827]">No invoices found</p>
              <p className="text-xs text-[#9CA3AF] mt-1">Upload your first invoice to get started</p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-1 rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Upload your first invoice
              </button>
            )}
          </div>
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
                    {customers.find(c => c.id === inv.customer_id)?.name || inv.customer_name || '—'}
                  </td>
                  <td className="px-5 py-3 text-[#6B7280]">
                    <span className="text-xs text-[#9CA3AF] mr-0.5">{currencySymbol(inv.currency)}</span>
                    {Number(inv.total ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-[#6B7280]">{inv.invoice_date || '—'}</td>
                  <td className="px-5 py-3 text-[#6B7280]">{inv.due_date || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Invoice Modal */}
      {showUploadModal && (
        <Modal title="Upload Invoice" onClose={() => setShowUploadModal(false)}>
          <UploadSaveZone onSaved={() => { load(); }} />
        </Modal>
      )}

      {/* New Invoice Modal */}
      {showModal && (
        <Modal title="New Invoice" onClose={() => { setShowModal(false); setUploadParsing(false); }}>
          <div className="space-y-4">
            {/* Upload zone to auto-fill */}
            <div
              onDragOver={(e) => { e.preventDefault(); setNewInvDragging(true); }}
              onDragLeave={() => setNewInvDragging(false)}
              onDrop={(e) => { e.preventDefault(); setNewInvDragging(false); handleNewInvFile(e.dataTransfer.files[0]); }}
              className={`rounded-xl border-2 border-dashed transition-colors ${newInvDragging ? 'border-primary bg-primary/5' : 'border-border bg-gray-50'} flex flex-col items-center justify-center gap-2 px-4 py-5 text-center`}
            >
              {uploadParsing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-xs text-[#6B7280]">Parsing invoice…</p>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 text-[#9CA3AF]" />
                  <p className="text-xs text-[#6B7280]">Drop a PDF/DOCX to auto-fill fields below</p>
                  <label className="cursor-pointer">
                    <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors">
                      Browse file
                    </span>
                    <input type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={(e) => handleNewInvFile(e.target.files[0])} />
                  </label>
                </>
              )}
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Invoice #" value={form.invoice_number} onChange={set('invoice_number')} required placeholder="INV-001" />
                <Select label="Organization" value={form.organization_id} onChange={set('organization_id')} required>
                  <option value="">Select organization</option>
                  <option value="10">Infinitum Global</option>
                  <option value="11">Qrestik Technologies</option>
                </Select>
                <Input label="Subtotal" type="number" step="0.01" value={form.subtotal} onChange={set('subtotal')} placeholder="0.00" />
                <Input label="Tax" type="number" step="0.01" value={form.tax} onChange={set('tax')} placeholder="0.00" />
                <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={set('amount')} required placeholder="0.00" />
                <Select label="Currency" value={form.currency} onChange={set('currency')}>
                  {['USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c}>{c}</option>)}
                </Select>
                <Input label="Invoice Date" type="date" value={form.issue_date} onChange={set('issue_date')} required />
                <Input label="Due Date" type="date" value={form.due_date} onChange={set('due_date')} required />
              </div>
              <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional" />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => { setShowModal(false); setUploadParsing(false); }}>Cancel</Button>
                <Button type="submit">Create Invoice</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
