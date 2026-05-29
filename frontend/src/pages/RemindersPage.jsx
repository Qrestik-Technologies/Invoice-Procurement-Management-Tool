import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Send } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { fetchReminders } from '../api/reminders';
import { formatDateTime } from '../utils/format';
import { toDisplayReminderType } from '../utils/status';

function DeliveryBadge({ status }) {
  const ok = status === 'delivered';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ok ? 'bg-green-50 text-status-received' : 'bg-red-50 text-status-overdue'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? 'Delivered' : 'Failed'}
    </span>
  );
}

export default function RemindersPage() {
  const { data: reminders = [], isLoading } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders });

  return (
    <div>
      <PageHeader title="Reminders" description="Sent reminders and internal approval queue" />
      <Card className="mb-6">
        <CardHeader title="Pending Approvals" description="Phase 1 — internal review before customer dispatch" />
        <p className="py-4 text-center text-sm text-[#6B7280]">No reminders awaiting approval</p>
      </Card>
      <Card padding={false} className="overflow-hidden">
        <div className="border-b border-border px-5 py-4"><CardHeader title="Sent Reminders" className="mb-0" /></div>
        {isLoading ? <p className="p-8 text-center text-sm">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase text-[#6B7280]">
                {['Invoice No', 'Customer', 'Sent At', 'Type', 'Status'].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {reminders.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-5 py-3 font-medium text-primary">{r.invoice_number}</td>
                    <td className="px-5 py-3">{r.customer_name}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{formatDateTime(r.sent_at)}</td>
                    <td className="px-5 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{toDisplayReminderType(r.reminder_type)}</span></td>
                    <td className="px-5 py-3"><DeliveryBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
