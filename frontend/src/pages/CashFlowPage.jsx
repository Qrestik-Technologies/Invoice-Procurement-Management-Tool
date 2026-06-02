import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

export default function CashFlowPage() {
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Cash Flow', 'Invoiced vs received summary for the period');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!organizationId) return;
    apiClient.get('/cash-flow/summary').then(r => setSummary(r.data.data)).catch(() => setSummary(null));
  }, [organizationId]);

  const fmt = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const rows = summary ? [
    ['Period', `${summary.period_start} → ${summary.period_end}`],
    ['Currency', summary.currency],
    ['Total Invoiced', fmt(summary.total_invoiced)],
    ['Total Received', fmt(summary.total_received)],
    ['Outstanding', fmt(summary.total_outstanding)],
    ['Overdue invoices', summary.overdue_count],
    ['Paid invoices', summary.paid_count],
    ['Draft invoices', summary.draft_count],
  ] : [];

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
      />
      <div className="max-w-lg rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {!summary ? <p className="px-6 py-12 text-center text-sm text-[#9CA3AF]">Loading…</p> : (
          <table className="w-full text-sm">
            <tbody>{rows.map(([label, value]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-[#374151]">{label}</td>
                <td className="px-5 py-3 text-right text-[#111827]">{value}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
