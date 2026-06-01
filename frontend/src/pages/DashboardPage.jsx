import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, TrendingUp, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

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
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    apiClient.get('/cash-flow/summary').then(r => setSummary(r.data.data)).catch(() => {});
    apiClient.get('/invoices').then(r => setInvoices(r.data.data?.slice(0, 5) || [])).catch(() => {});
  }, []);

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Here's your invoice overview for this month</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Total Invoiced" value={summary ? `$${Number(summary.total_invoiced).toLocaleString()}` : null} color="bg-primary" to="/invoices" />
        <StatCard icon={FileText} label="Total Received" value={summary ? `$${Number(summary.total_received).toLocaleString()}` : null} color="bg-emerald-500" to="/invoices" />
        <StatCard icon={AlertCircle} label="Overdue" value={summary?.overdue_count} color="bg-red-500" to="/invoices?status=overdue" />
        <StatCard icon={Users} label="Drafts" value={summary?.draft_count} color="bg-amber-400" to="/invoices?status=draft" />
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-[#111827]">Recent Invoices</h2>
          <Link to="/invoices" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[#9CA3AF]">No invoices yet</p>
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
