import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
} from 'recharts';
import PageHeader, { StatCard } from '../components/ui/PageHeader';
import Card, { CardHeader } from '../components/ui/Card';
import StatusBadge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { AlertBadge } from '../components/ui/Badge';
import { TableSkeleton, StatCardSkeleton } from '../components/ui/Skeleton';
import { fetchDashboardStats, fetchUpcomingMilestones } from '../api/dashboard';
import { fetchInvoices } from '../api/invoices';
import { formatCurrency, formatDate } from '../utils/format';
import { toDisplayAlert, toDisplayStatus } from '../utils/status';

const CHART_COLORS = {
  draft: '#6B7280',
  reviewed: '#D97706',
  pending: '#D97706',
  dispatched: '#2563EB',
  received: '#16A34A',
  overdue: '#DC2626',
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  });
  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-milestones'],
    queryFn: () => fetchUpcomingMilestones(7),
  });
  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => fetchInvoices(),
  });

  const loading = statsLoading || invLoading;
  const recent = invoices.slice(0, 10);
  const breakdown = stats?.status_breakdown
    ? Object.entries(stats.status_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Overview of your invoice activity" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="mt-6"><Card><TableSkeleton rows={4} cols={5} /></Card></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your invoice activity and upcoming milestones" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Invoices" value={stats?.total_invoices ?? 0} subtext="All time across customers" />
        <StatCard label="Pending Payment" value={formatCurrency(stats?.pending_amount ?? 0)} subtext="Awaiting customer payment" />
        <StatCard label="Overdue" value={stats?.overdue_count ?? 0} subtext="Require immediate follow-up" trend="down" />
        <StatCard label="Received This Month" value={formatCurrency(stats?.received_this_month ?? 0)} subtext="Current month collections" trend="up" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Invoice Status Breakdown" description="Current distribution by status" />
          {breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B7280]">No invoice data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={breakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
                  {breakdown.map((entry) => (
                    <Cell key={entry.name} fill={CHART_COLORS[entry.name] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} invoices`, toDisplayStatus(name)]} />
                <Legend formatter={(v) => toDisplayStatus(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="lg:col-span-3 overflow-hidden" padding={false}>
          <div className="border-b border-border px-5 py-4">
            <CardHeader title="Recent Invoices" description="Last 10 invoices" action={<Link to="/invoices"><Button variant="ghost" size="sm">View all</Button></Link>} className="mb-0" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/80 text-left text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  <th className="px-5 py-3">Invoice No</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/80">
                    <td className="px-5 py-3 font-medium text-primary">{inv.invoice_number}</td>
                    <td className="px-5 py-3">{inv.customer_name}</td>
                    <td className="px-5 py-3 font-medium">{formatCurrency(Number(inv.total))}</td>
                    <td className="px-5 py-3"><StatusBadge status={toDisplayStatus(inv.status)} /></td>
                    <td className="px-5 py-3 text-[#6B7280]">{formatDate(inv.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Upcoming Milestones" description="Due in the next 7 days" action={<Link to="/milestones"><Button variant="ghost" size="sm">View milestones</Button></Link>} />
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6B7280]">No milestones due in the next 7 days</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-lg border border-border p-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{m.project_name}</p>
                  <p className="text-sm text-[#6B7280]">{m.customer_name} · Due {formatDate(m.end_date)}{m.linked_invoice_number ? ` · ${m.linked_invoice_number}` : ''}</p>
                </div>
                <AlertBadge status={toDisplayAlert(m.alert_status)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
