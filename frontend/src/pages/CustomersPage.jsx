import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Phone, Building2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { Input, Select, Textarea } from '../components/ui/FormFields';
import { fetchCustomers, createCustomer } from '../api/customers';
import { formatCurrency } from '../utils/format';
import { toApiTemplate, toDisplayTemplate } from '../utils/status';
import { useAuth } from '../context/AuthContext';
import { canEdit } from '../utils/status';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  template_type: z.enum(['standard', 'emcor']),
  ship_to_address: z.string().optional(),
});

export default function CustomersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const { data: customers = [], isLoading } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers });
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { template_type: 'standard' },
  });
  const templateType = watch('template_type');

  const createMut = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => { toast.success('Customer added'); queryClient.invalidateQueries({ queryKey: ['customers'] }); reset(); setModalOpen(false); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Customers" description="Manage customer accounts and invoice templates"
        action={canEdit(user?.role) && <Button icon={Plus} onClick={() => setModalOpen(true)}>Add Customer</Button>} />
      {isLoading ? <Card><p className="p-8 text-center text-sm">Loading…</p></Card>
        : customers.length === 0 ? <EmptyState title="No customers yet" actionLabel="Add Customer" onAction={() => setModalOpen(true)} />
        : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {customers.map((c) => (
              <Card key={c.id} className="hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light"><Building2 className="h-5 w-5 text-primary" /></div>
                </div>
                <h3 className="mt-3 font-semibold">{c.name}</h3>
                <div className="mt-3 space-y-1.5 text-sm text-[#6B7280]">
                  <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>
                  {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.template_type === 'emcor' ? 'bg-accent-light text-accent' : 'bg-gray-100'}`}>{toDisplayTemplate(c.template_type)} Template</span>
                  <span className="text-sm font-semibold">{formatCurrency(c.total_invoiced || 0)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Customer">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Input label="Company Name" {...register('name')} />
          <Input label="Email" type="email" {...register('email')} />
          <Input label="Phone" {...register('phone')} />
          <Select label="Template" {...register('template_type')}>
            <option value="standard">Standard</option>
            <option value="emcor">EMCOR</option>
          </Select>
          {templateType === 'emcor' && <Textarea label="Ship To Address" {...register('ship_to_address')} />}
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">Add Customer</Button></div>
        </form>
      </Modal>
    </div>
  );
}
