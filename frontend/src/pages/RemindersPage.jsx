import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

export default function RemindersPage() {
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Reminders', 'Scheduled payment follow-ups');
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    if (!organizationId) return;
    apiClient.get('/reminders').then(r => setReminders(r.data.data || [])).catch(() => setReminders([]));
  }, [organizationId]);

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
      />
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {reminders.length === 0 ? <p className="px-6 py-12 text-center text-sm text-[#9CA3AF]">No reminders scheduled</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-[#6B7280]">
              {['Invoice', 'Scheduled At', 'Sent At', 'Message'].map(h => <th key={h} className="px-5 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{reminders.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="px-5 py-3">#{r.invoice_id}</td>
                <td className="px-5 py-3 text-[#6B7280]">{new Date(r.scheduled_at).toLocaleString()}</td>
                <td className="px-5 py-3">{r.sent_at ? <span className="text-green-600">Sent</span> : <span className="text-amber-500">Pending</span>}</td>
                <td className="px-5 py-3 text-[#6B7280]">{r.message || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
