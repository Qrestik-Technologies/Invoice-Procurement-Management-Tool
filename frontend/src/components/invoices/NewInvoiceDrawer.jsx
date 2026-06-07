import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import { Input, Select, Textarea } from '../ui/FormFields';
import { fetchCustomers } from '../../api/customers';
import { fetchMilestones } from '../../api/milestones';
import { createInvoice } from '../../api/invoices';
import { uploadDocument } from '../../api/documents';
import { formatCurrency } from '../../utils/format';
import { cn } from '../../utils/cn';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Required'),
  qty: z.coerce.number().min(1),
  rate: z.coerce.number().min(0),
});

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  milestoneId: z.string().optional(),
  invoiceDate: z.string().min(1, 'Required'),
  lineItems: z.array(lineItemSchema).min(1),
  notes: z.string().optional(),
});

const defaultLineItem = { description: '', qty: 1, rate: 0 };
const MISSING_FIELD_MAP = {
  invoice_number: 'invoiceDate',
  invoice_date: 'invoiceDate',
  customer_name: 'customerId',
  total: 'lineItems',
};

export default function NewInvoiceDrawer({ open, onClose }) {
  const queryClient = useQueryClient();
  const [taxRate] = useState(0.0825);
  const [missingFields, setMissingFields] = useState([]);
  const [uploading, setUploading] = useState(false);

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers, enabled: open });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: fetchMilestones, enabled: open });

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: '',
      milestoneId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      lineItems: [{ ...defaultLineItem }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const lineItems = watch('lineItems');
  const customerId = watch('customerId');

  const { subtotal, tax, total } = useMemo(() => {
    const sub = lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0);
    const taxAmt = sub * taxRate;
    return { subtotal: sub, tax: taxAmt, total: sub + taxAmt };
  }, [lineItems, taxRate]);

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      toast.success('Invoice saved');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      reset();
      setMissingFields([]);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to save invoice'),
  });

  const buildPayload = (data, status) => ({
    customer_id: Number(data.customerId),
    milestone_id: data.milestoneId ? Number(data.milestoneId) : null,
    invoice_date: data.invoiceDate,
    line_items: lineItems.map((item) => ({
      description: item.description,
      qty: Number(item.qty),
      rate: Number(item.rate),
      amount: Number(item.qty) * Number(item.rate),
    })),
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    notes: data.notes,
    status,
  });

  const onSubmit = (data, status) => createMut.mutate(buildPayload(data, status));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadDocument(file);
      const parsed = result.parse_result;
      if (parsed.invoice_date) setValue('invoiceDate', parsed.invoice_date);
      if (parsed.customer_name) {
        const match = customers.find((c) => c.name.toLowerCase().includes(parsed.customer_name.toLowerCase()));
        if (match) setValue('customerId', String(match.id));
      }
      if (parsed.line_items?.length) {
        setValue('lineItems', parsed.line_items.map((li) => ({
          description: li.description,
          qty: li.qty,
          rate: li.rate,
        })));
      }
      if (parsed.notes) setValue('notes', parsed.notes);
      setMissingFields(parsed.missing_fields || []);
      toast.success(parsed.missing_fields?.length ? 'Partial parse — review highlighted fields' : 'Invoice parsed successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => { reset(); setMissingFields([]); onClose(); };
  const customerMilestones = milestones.filter((m) => String(m.customer_id) === customerId);

  const fieldError = (name) => {
    const apiMissing = missingFields.some((f) => MISSING_FIELD_MAP[f] === name || f === name);
    return apiMissing ? 'Could not extract from document' : errors[name]?.message;
  };

  return (
    <Drawer open={open} onClose={handleClose} title="New Invoice" width="max-w-2xl">
      <form className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          {/* Upload zone — auto-fills form fields below */}
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/40">
            <Upload className="mx-auto h-8 w-8 text-[#9CA3AF]" />
            <p className="mt-2 text-sm font-medium">Upload Invoice PDF</p>
            <p className="text-xs text-[#6B7280]">Auto-fills fields from parsed document</p>
            <input type="file" accept=".pdf,.docx" className="mt-3 text-xs" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <p className="mt-2 text-xs text-primary">Parsing document…</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Customer" error={fieldError('customerId')} className={cn(missingFields.includes('customer_name') && 'ring-2 ring-red-300 rounded-lg')} {...register('customerId')}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Linked Milestone" {...register('milestoneId')}>
              <option value="">None</option>
              {customerMilestones.map((m) => <option key={m.id} value={m.id}>{m.project_name}</option>)}
            </Select>
          </div>
          <Input label="Invoice Date" type="date" error={fieldError('invoiceDate')} className={cn(missingFields.includes('invoice_date') && 'ring-2 ring-red-300')} {...register('invoiceDate')} />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[#374151]">Line Items</label>
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => append({ ...defaultLineItem })}>Add row</Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => {
                const qty = Number(lineItems[index]?.qty) || 0;
                const rate = Number(lineItems[index]?.rate) || 0;
                return (
                  <div key={field.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-5"><Input label={index === 0 ? 'Description' : undefined} {...register(`lineItems.${index}.description`)} /></div>
                    <div className="sm:col-span-2"><Input label={index === 0 ? 'Qty' : undefined} type="number" min="1" {...register(`lineItems.${index}.qty`)} /></div>
                    <div className="sm:col-span-2"><Input label={index === 0 ? 'Rate' : undefined} type="number" step="0.01" {...register(`lineItems.${index}.rate`)} /></div>
                    <div className="sm:col-span-2"><p className="py-2 text-sm font-medium">{formatCurrency(qty * rate)}</p></div>
                    <div className="sm:col-span-1">{fields.length > 1 && <button type="button" onClick={() => remove(index)} className="rounded p-2 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</div>
                  </div>
                );
              })}
            </div>
            {missingFields.includes('total') && <p className="mt-1 text-xs text-red-600">Total could not be extracted — verify line items</p>}
          </div>
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#6B7280]">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Tax (8.25%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
          </div>
          <Textarea label="Notes" {...register('notes')} />
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/40">
            <Upload className="mx-auto h-8 w-8 text-[#9CA3AF]" />
            <p className="mt-2 text-sm font-medium">Upload Invoice PDF</p>
            <p className="text-xs text-[#6B7280]">Auto-fills fields from parsed document</p>
            <input type="file" accept=".pdf,.docx" className="mt-3 text-xs" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <p className="mt-2 text-xs text-primary">Parsing document…</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="button" variant="secondary" onClick={handleSubmit((d) => onSubmit(d, 'draft'))} disabled={createMut.isPending}>Save as Draft</Button>
          <Button type="button" onClick={handleSubmit((d) => onSubmit(d, 'pending'))} disabled={createMut.isPending}>Submit Invoice</Button>
        </div>
      </form>
    </Drawer>
  );
}
