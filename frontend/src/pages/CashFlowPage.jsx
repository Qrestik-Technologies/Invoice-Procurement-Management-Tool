import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle, FileText,
  AlertCircle, DollarSign, BarChart2, Calendar, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import apiClient from '../api/client';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmt(v) {
  const n = Number(v || 0);
  const sym = '$';
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}K`;
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtFull(v) {
  const sym = '$';
  return `${sym}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function pct(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return Math.round((Number(numerator) / Number(denominator)) * 100);
}

const STATUS_COLORS = {
  draft:      'bg-gray-100 text-gray-600',
  sent:       'bg-blue-100 text-blue-700',
  received:   'bg-green-100 text-green-700',
  paid:       'bg-emerald-100 text-emerald-700',
  overdue:    'bg-red-100 text-red-700',
  cancelled:  'bg-gray-100 text-gray-500',
  dispatched: 'bg-purple-100 text-purple-700',
  pending:    'bg-yellow-100 text-yellow-700',
};

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, color, bg, trend }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm p-5 flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-[#111827] truncate">{value}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {sub && <p className="text-xs text-[#9CA3AF]">{sub}</p>}
          {trend != null && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0
                ? <ArrowUpRight className="h-3 w-3" />
                : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bar Chart (pure SVG) ──────────────────────────────────────────────────────

function BarChart({ data }) {
  if (!data || data.length === 0) return null;

  const W = 620, H = 200, PAD = { top: 16, right: 16, bottom: 40, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap(d => [d.invoiced, d.received]), 1);
  const barGroupW = innerW / data.length;
  const barW = Math.min(barGroupW * 0.28, 22);
  const gap = barW * 0.4;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    val: maxVal * t,
    y: PAD.top + innerH * (1 - t),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {/* Y grid lines + labels */}
      {yTicks.map(({ val, y }) => (
        <g key={y}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#F3F4F6" strokeWidth="1" />
          <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
            {fmt(val)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const cx = PAD.left + barGroupW * i + barGroupW / 2;
        const x1 = cx - gap / 2 - barW;
        const x2 = cx + gap / 2;

        const invH = (d.invoiced / maxVal) * innerH;
        const recH = (d.received / maxVal) * innerH;
        const baseY = PAD.top + innerH;

        return (
          <g key={d.month}>
            {/* Invoiced bar */}
            <rect
              x={x1} y={baseY - invH} width={barW} height={Math.max(invH, 1)}
              rx="3" fill="#BFDBFE"
            />
            {/* Received bar */}
            <rect
              x={x2} y={baseY - recH} width={barW} height={Math.max(recH, 1)}
              rx="3" fill="#34D399"
            />
            {/* X label */}
            <text
              x={cx} y={H - PAD.bottom + 14}
              textAnchor="middle" fontSize="10" fill="#9CA3AF"
            >
              {d.month}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left}, ${H - 8})`}>
        <rect width="10" height="10" rx="2" fill="#BFDBFE" />
        <text x="14" y="9" fontSize="10" fill="#6B7280">Invoiced</text>
        <rect x="72" width="10" height="10" rx="2" fill="#34D399" />
        <text x="86" y="9" fontSize="10" fill="#6B7280">Received</text>
      </g>
    </svg>
  );
}

// ── Receivables Table ─────────────────────────────────────────────────────────

function ReceivablesTable({ invoices }) {
  if (!invoices || invoices.length === 0) {
    return (
      <p className="text-xs text-[#9CA3AF] py-6 text-center">No open receivables for this period.</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs font-medium text-[#6B7280]">
          <th className="pb-2 pr-4">Customer</th>
          <th className="pb-2 pr-4">Amount</th>
          <th className="pb-2 pr-4">Due Date</th>
          <th className="pb-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="border-b border-border last:border-0">
            <td className="py-2.5 pr-4 font-medium text-[#111827]">{inv.customer || '—'}</td>
            <td className="py-2.5 pr-4 text-[#374151]">{fmtFull(inv.amount)}</td>
            <td className="py-2.5 pr-4 text-[#6B7280]">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {inv.due_date || '—'}
              </span>
            </td>
            <td className="py-2.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                {inv.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const { organizationId } = useOrganization();
  const meta = usePageMeta('Cash Flow', 'Invoiced vs received summary for the period');
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    apiClient.get("/cash-flow/summary").then(r => r.data.data).catch(() => null).then(s => {
      setSummary(s);
      setMonthly([]);
    }).finally(() => setLoading(false));
  }, [organizationId]);

  const collectionRate = pct(summary?.total_received, summary?.total_invoiced);

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
            <span className="font-medium text-[#374151]">USD</span>
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
              trend={collectionRate}
              icon={TrendingUp}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <MetricCard
              label="Outstanding"
              value={fmt(summary.total_outstanding)}
              sub="Awaiting payment"
              trend={summary.total_outstanding > 0 ? -pct(summary.total_outstanding, summary.total_invoiced) : 0}
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

          {/* Chart + Receivables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

            {/* Bar chart */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-[#6B7280]" />
                <p className="text-sm font-medium text-[#374151]">Invoiced vs Received (6 months)</p>
              </div>
              <BarChart data={monthly} />
            </div>

            {/* Receivables table */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-4 w-4 text-[#6B7280]" />
                <p className="text-sm font-medium text-[#374151]">Open Receivables</p>
              </div>
              <ReceivablesTable invoices={summary.invoices} />
            </div>
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
              <span>Received: {fmtFull(summary.total_received)}</span>
              <span>Invoiced: {fmtFull(summary.total_invoiced)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
