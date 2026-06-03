import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Clock, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

function MetricCard({ label, value, sub, icon: Icon, color, bg }) {
  return (
    <div className={`rounded-xl border border-border bg-white shadow-sm p-5 flex items-start gap-4`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-[#111827] truncate">{value}</p>
        {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function CashFlowPage() {
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Cash Flow', 'Invoiced vs received summary for the period');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    apiClient.get('/cash-flow/summary')
      .then(r => setSummary(r.data.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const fmt = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const collectionRate = summary && summary.total_invoiced > 0
    ? Math.round((summary.total_received / summary.total_invoiced) * 100)
    : 0;

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-white shadow-sm p-5 h-24 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : !summary ? (
        <p className="text-center text-sm text-[#9CA3AF] py-16">No cash flow data available.</p>
      ) : (
        <>
          {/* Period badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5 text-xs text-[#6B7280] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            Period: <span className="font-medium text-[#374151]">{summary.period_start} → {summary.period_end}</span>
            <span className="mx-1 text-[#D1D5DB]">·</span>
            <span className="font-medium text-[#374151]">{summary.currency}</span>
          </div>

          {/* Primary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <MetricCard
              label="Total Invoiced"
              value={fmt(summary.total_invoiced)}
              sub="All invoices in period"
              icon={FileText}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <MetricCard
              label="Total Received"
              value={fmt(summary.total_received)}
              sub={`${collectionRate}% collection rate`}
              icon={TrendingUp}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <MetricCard
              label="Outstanding"
              value={fmt(summary.total_outstanding)}
              sub="Awaiting payment"
              icon={TrendingDown}
              color="text-amber-600"
              bg="bg-amber-50"
            />
          </div>

          {/* Invoice counts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricCard
              label="Paid Invoices"
              value={summary.paid_count ?? 0}
              icon={CheckCircle}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <MetricCard
              label="Overdue Invoices"
              value={summary.overdue_count ?? 0}
              icon={AlertCircle}
              color="text-red-600"
              bg="bg-red-50"
            />
            <MetricCard
              label="Draft Invoices"
              value={summary.draft_count ?? 0}
              icon={Clock}
              color="text-gray-500"
              bg="bg-gray-100"
            />
          </div>

          {/* Collection progress bar */}
          <div className="rounded-xl border border-border bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#374151]">Collection Progress</p>
              <span className="text-sm font-semibold text-[#111827]">{collectionRate}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(collectionRate, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#9CA3AF]">
              <span>Received: {fmt(summary.total_received)}</span>
              <span>Invoiced: {fmt(summary.total_invoiced)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
