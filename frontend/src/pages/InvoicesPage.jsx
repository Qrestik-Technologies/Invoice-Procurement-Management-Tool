import { useEffect, useState } from 'react';
import { Plus, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import NewInvoiceModal from '../components/NewInvoiceModal';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function InvoicesPage() {
  const { user } = useAuth();

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Load invoices
  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    apiClient
      .get(`/invoices${params}`)
      .then((r) => setInvoices(r.data.data || []))
      .catch(() => {});
  };

  // Load data
  useEffect(() => {
    load();
    apiClient
      .get('/customers')
      .then((r) => setCustomers(r.data.data || []))
      .catch(() => {});
  }, [statusFilter]);

  // Export
  const handleExport = async () => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const res = await apiClient.get(`/invoices/export/excel${params}`, {
      responseType: 'blob',
    });

    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // NEW: handle invoice creation WITH FILES
  const handleCreateInvoice = async (data) => {
    try {
      const formData = new FormData();

      formData.append('invoice_number', data.invoiceNumber);
      formData.append('customer_id', Number(data.customer));
      formData.append('amount', Number(data.amount));
      formData.append('currency', data.currency);
      formData.append('issue_date', data.issueDate);
      formData.append('due_date', data.dueDate);
      formData.append('description', data.description || '');

      // attachments
      (data.attachments || []).forEach((file) => {
        formData.append('files', file);
      });

      await apiClient.post('/invoices', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Invoice created');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create invoice');
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'entry';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#111827]">Invoices</h1>

        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>

          {canEdit && (
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        {['', 'draft', 'sent', 'received', 'overdue', 'paid', 'cancelled'].map(
          (s) => (
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
          )
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {invoices.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#9CA3AF]">
            No invoices found
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-[#6B7280]">
                {[
                  'Invoice #',
                  'Customer',
                  'Amount',
                  'Issue Date',
                  'Due Date',
                  'Status',
                ].map((h) => (
                  <th key={h} className="px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border last:border-0 hover:bg-gray-50"
                >
                  <td className="px-5 py-3 font-medium text-[#111827]">
                    {inv.invoice_number}
                  </td>

                  <td className="px-5 py-3 text-[#6B7280]">
                    {customers.find((c) => c.id === inv.customer_id)?.name ||
                      inv.customer_id}
                  </td>

                  <td className="px-5 py-3">
                    ${Number(inv.amount).toLocaleString()} {inv.currency}
                  </td>

                  <td className="px-5 py-3 text-[#6B7280]">
                    {inv.issue_date}
                  </td>

                  <td className="px-5 py-3 text-[#6B7280]">
                    {inv.due_date}
                  </td>

                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[inv.status] || ''
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* NEW MODAL (FULL UPGRADED VERSION) */}
      <NewInvoiceModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreateInvoice}
        customers={customers}
        nextInvoiceNumber={`INV-${String(invoices.length + 1).padStart(3, '0')}`}
      />
    </div>
  );
}
