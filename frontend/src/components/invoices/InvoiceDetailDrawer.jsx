import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import StatusBadge from '../ui/Badge';
import { Input, Select, Textarea } from '../ui/FormFields';
import { fetchInvoice, updateInvoice, markInvoiceReceived, downloadInvoicePdf } from '../../api/invoices';
import { fetchCustomers } from '../../api/customers';
import { fetchMilestones } from '../../api/milestones';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { canEdit, toDisplayStatus } from '../../utils/status';

export default function InvoiceDetailDrawer({ invoiceId, mode = 'view', open, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(mode === 'edit');
  const [form, setForm] = useState(null);
  const [payment, setPayment] = useState({ received_date: new Date().toISOString().split('T')[0], amount: '', notes: '' });

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => fetchInvoice(invoiceId),
    enabled: open && !!invoiceId,
  });

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers, enabled: open && editing });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: fetchMilestones, enabled: open && editing });

  useEffect(() => {
    if (invoice) {
      setForm({
        customer_id: String(invoice.customer_id),
        milestone_id: invoice.milestone_id ? String(invoice.milestone_id) : '',
        invoice_date: invoice.invoice_date,
        payment_terms: invoice.payment_terms || '',
        po_number: invoice.po_number || '',
        notes: invoice.notes || '',
        status: invoice.status,
      });
      setPayment((p) => ({ ...p, amount: String(invoice.total) }));
    }
  }, [invoice]);

  useEffect(() => {
    setEditing(mode === 'edit');
  }, [mode, invoiceId, open]);

  const updateMut = useMutation({
    mutationFn: (payload) => updateInvoice(invoiceId, payload),
    onSuccess: () => {
      toast.success('Invoice updated');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      setEditing(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Update failed'),
  });

  const receivedMut = useMutation({
    mutationFn: (payload) => markInvoiceReceived(invoiceId, payload),
    onSuccess: () => {
      toast.success('Invoice marked as received');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Failed to mark received'),
  });

  const canMarkReceived = invoice && ['dispatched', 'overdue', 'pending'].includes(invoice.status);

  const title = useMemo(() => {
    if (!invoice) return 'Invoice';
    return editing ? `Edit ${invoice.invoice_number}` : invoice.invoice_number;
  }, [invoice, editing]);

  const handleSave = () => {
    if (!form) return;
    updateMut.mutate({
      customer_id: Number(form.customer_id),
      milestone_id: form.milestone_id ? Number(form.milestone_id) : null,
      invoice_date: form.invoice_date,
      payment_terms: form.payment_terms,
      po_number: form.po_number || null,
      notes: form.notes || null,
    });
  };

  return (
    <Drawer open={open} onClose={onClose} title={title} width="max-w-2xl">
      {isLoading || !invoice ? (
        <p className="animate-pulse p-4 text-sm text-[#6B7280]">Loading invoice…</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={toDisplayStatus(invoice.status)} />
            <span className="text-sm text-[#6B7280]">{formatDate(invoice.invoice_date)}</span>
            <span className="text-sm font-semibold">{formatCurrency(Number(invoice.total))}</span>
            {invoice.has_pdf && (
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={() => downloadInvoicePdf(invoiceId, `${invoice.invoice_number}.pdf`)}
              >
                Download PDF
              </Button>
            )}
          </div>

          {editing && form ? (
            <div className="grid gap-4">
              <Select label="Customer" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Milestone" value={form.milestone_id} onChange={(e) => setForm({ ...form, milestone_id: e.target.value })}>
                <option value="">None</option>
                {milestones.filter((m) => String(m.customer_id) === form.customer_id).map((m) => (
                  <option key={m.id} value={m.id}>{m.project_name}</option>
                ))}
              </Select>
              <Input label="Invoice date" type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
              <Input label="Payment terms" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
              <Input label="PO number" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateMut.isPending}>Save changes</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-[#6B7280]">Customer</dt><dd className="font-medium">{invoice.customer_name}</dd></div>
              <div><dt className="text-[#6B7280]">Milestone</dt><dd>{invoice.milestone_name || '—'}</dd></div>
              <div><dt className="text-[#6B7280]">Payment terms</dt><dd>{invoice.payment_terms || '—'}</dd></div>
              <div><dt className="text-[#6B7280]">PO number</dt><dd>{invoice.po_number || '—'}</dd></div>
              {invoice.notes && <div><dt className="text-[#6B7280]">Notes</dt><dd>{invoice.notes}</dd></div>}
            </dl>
          )}

          {canMarkReceived && canEdit(user?.role) && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Mark payment received</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Received date" type="date" value={payment.received_date} onChange={(e) => setPayment({ ...payment, received_date: e.target.value })} />
                <Input label="Amount" type="number" step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                <Textarea className="sm:col-span-2" label="Notes" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} rows={2} />
              </div>
              <Button
                className="mt-3"
                icon={CheckCircle}
                onClick={() => receivedMut.mutate({
                  received_date: payment.received_date,
                  amount: Number(payment.amount),
                  notes: payment.notes || null,
                })}
                disabled={receivedMut.isPending || !payment.amount}
              >
                Mark received
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
