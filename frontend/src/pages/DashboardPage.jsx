import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, TrendingUp, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import OrganizationSwitcher from '../components/organization/OrganizationSwitcher';

const COVER_SRC = '/cover.png';

function StatCard({ icon: Icon, label, value, color, to }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#111827]">{value ?? '—'}</p>
        <p className="text-sm text-[#6B7280]">{label}</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { organizationId, organization } = useOrganization();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const orgLabel = organization?.name || 'No organization selected';
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    if (!organizationId) return;
    apiClient.get('/cash-flow/summary').then(r => setSummary(r.data.data)).catch(() => setSummary(null));
    apiClient.get('/invoices').then(r => setInvoices(r.data.data?.slice(0, 5) || [])).catch(() => setInvoices([]));
  }, [organizationId]);

  const statusColor = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    received: 'bg-green-100 text-green-700',
    paid: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="p-8">
      <div
        className="relative mb-8 overflow-hidden rounded-xl bg-cover bg-center shadow-md"
        style={{ backgroundImage: `url(${COVER_SRC})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1f3f]/85 via-[#0d2847]/55 to-[#0b1f3f]/30" />
        <div className="relative px-6 py-10 md:px-10 md:py-12">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Welcome back, {firstName} 👋
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/95 md:text-base">
            {orgLabel} — Here&apos;s your invoice overview for this month
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Working as</p>
        <OrganizationSwitcher variant="dashboard" />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Total Invoiced" value={summary ? `$${Number(summary.total_invoiced).toLocaleString()}` : null} color="bg-primary" to="/invoices" />
        <StatCard icon={FileText} label="Total Received" value={summary ? `$${Number(summary.total_received).toLocaleString()}` : null} color="bg-emerald-500" to="/invoices" />
        <StatCard icon={AlertCircle} label="Overdue" value={summary?.overdue_count} color="bg-red-500" to="/invoices?status=overdue" />
        <StatCard icon={Users} label="Drafts" value={summary?.draft_count} color="bg-amber-400" to="/invoices?status=draft" />
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-[#111827]">Recent Invoices — {organization?.name || '…'}</h2>
          <Link to="/invoices" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[#9CA3AF]">No invoices yet for this organization</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-[#6B7280]">
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Due</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-[#111827]">{inv.invoice_number}</td>
                  <td className="px-6 py-3">${Number(inv.amount).toLocaleString()} {inv.currency}</td>
                  <td className="px-6 py-3 text-[#6B7280]">{inv.due_date}</td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[inv.status] || ''}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
