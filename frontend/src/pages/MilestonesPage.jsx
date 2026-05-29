import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { AlertBadge } from '../components/ui/Badge';
import { Input, Select, Textarea } from '../components/ui/FormFields';
import { fetchMilestones, createMilestone, deleteMilestone } from '../api/milestones';
import { fetchCustomers } from '../api/customers';
import { formatDate } from '../utils/format';
import { toDisplayAlert } from '../utils/status';
import { useAuth } from '../context/AuthContext';
import { canEdit } from '../utils/status';

const schema = z.object({
  project_name: z.string().min(1),
  customer_id: z.coerce.number().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  notes: z.string().optional(),
});

export default function MilestonesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const { data: milestones = [], isLoading } = useQuery({ queryKey: ['milestones'], queryFn: fetchMilestones });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const createMut = useMutation({
    mutationFn: createMilestone,
    onSuccess: () => { toast.success('Milestone added'); queryClient.invalidateQueries({ queryKey: ['milestones'] }); reset(); setModalOpen(false); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => { toast.success('Milestone deleted'); queryClient.invalidateQueries({ queryKey: ['milestones'] }); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Milestones" description="Track project milestones linked to invoices"
        action={canEdit(user?.role) && <Button icon={Plus} onClick={() => setModalOpen(true)}>Add Milestone</Button>} />
      {isLoading ? <Card><p className="p-8 text-center text-sm text-[#6B7280]">Loading…</p></Card>
        : milestones.length === 0 ? <EmptyState title="No milestones yet" description="Add project milestones to track deliverables." actionLabel="Add Milestone" onAction={() => setModalOpen(true)} />
        : (
          <Card padding={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase text-[#6B7280]">
                  {['Project Name', 'Customer', 'Start', 'End', 'Linked Invoice', 'Alert', 'Actions'].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {milestones.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/80">
                      <td className="px-5 py-3 font-medium">{m.project_name}</td>
                      <td className="px-5 py-3">{customers.find((c) => c.id === m.customer_id)?.name}</td>
                      <td className="px-5 py-3 text-[#6B7280]">{formatDate(m.start_date)}</td>
                      <td className="px-5 py-3 text-[#6B7280]">{formatDate(m.end_date)}</td>
                      <td className="px-5 py-3">{m.linked_invoice_number ? <span className="text-primary">{m.linked_invoice_number}</span> : '—'}</td>
                      <td className="px-5 py-3"><AlertBadge status={toDisplayAlert(m.alert_status)} /></td>
                      <td className="px-5 py-3">{canEdit(user?.role) && <button type="button" onClick={() => deleteMut.mutate(m.id)} className="rounded p-1.5 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Add Milestone">
        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Input label="Project Name" error={errors.project_name?.message} {...register('project_name')} />
          <Select label="Customer" error={errors.customer_id?.message} {...register('customer_id')}>
            <option value="">Select…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start Date" type="date" {...register('start_date')} />
            <Input label="End Date" type="date" {...register('end_date')} />
          </div>
          <Textarea label="Notes" {...register('notes')} />
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">Add Milestone</Button></div>
        </form>
      </Modal>
    </div>
  );
}
