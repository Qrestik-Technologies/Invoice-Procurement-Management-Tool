import { useEffect, useState } from 'react';
import apiClient from '../api/client';

export default function CashFlowPage() {
  const [summary, setSummary] = useState(null);
  useEffect(() => { apiClient.get('/cash-flow/summary').then(r => setSummary(r.data.data)).catch(() => {}); }, []);
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
      <h1 className="mb-6 text-2xl font-bold text-[#111827]">Cash Flow</h1>
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
