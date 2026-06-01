/**
 * CashFlow.jsx  —  Analytical Dashboard Edition
 *
 * Drop-in replacement for the existing plain-table Cash Flow page.
 *
 * Features added vs original:
 *  - KPI stat cards (Total Invoiced, Total Received, Outstanding, Collection Rate)
 *  - Revenue vs Received area chart (monthly)
 *  - Invoice status donut chart
 *  - Monthly outstanding bar chart
 *  - Period date-range picker (wires up to your existing API)
 *  - Currency selector
 *
 * Dependencies (already in your stack): Recharts, Tailwind CSS, lucide-react
 *
 * API wiring:
 *   Replace the `useCashFlowData` hook internals with your TanStack Query fetch
 *   against  GET /api/cash-flow?from=...&to=...&currency=...
 *   The component expects the shape defined in `MOCK_DATA` below.
 */

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────
// Mock data — replace with real API response
// ─────────────────────────────────────────────
const MOCK_SUMMARY = {
  totalInvoiced: 284500,
  totalReceived: 198200,
  outstanding: 86300,
  overdueInvoices: 4,
  paidInvoices: 17,
  draftInvoices: 3,
  collectionRate: 69.7, // %
};

const MOCK_MONTHLY = [
  { month: "Jan", invoiced: 38000, received: 31000, outstanding: 7000 },
  { month: "Feb", invoiced: 42000, received: 29000, outstanding: 13000 },
  { month: "Mar", invoiced: 51000, received: 44000, outstanding: 7000 },
  { month: "Apr", invoiced: 34000, received: 34000, outstanding: 0 },
  { month: "May", invoiced: 60500, received: 38200, outstanding: 22300 },
  { month: "Jun", invoiced: 59000, received: 22000, outstanding: 37000 },
];

const MOCK_STATUS = [
  { name: "Paid", value: 17, color: "#22c55e" },
  { name: "Overdue", value: 4, color: "#ef4444" },
  { name: "Draft", value: 3, color: "#94a3b8" },
  { name: "Sent", value: 6, color: "#3b82f6" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "INR"];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value) {
  return `${value.toFixed(1)}%`;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, subPositive, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </span>
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-xl ${color}`}
        >
          <Icon size={18} className="text-white" />
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && (
        <p
          className={`text-xs font-medium flex items-center gap-1 ${
            subPositive ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {subPositive ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          {sub}
        </p>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmt(p.value, currency)}
        </p>
      ))}
    </div>
  );
};

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <span style={{ color: d.payload.color }} className="font-semibold">
        {d.name}
      </span>
      : {d.value} invoices
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CashFlow() {
  // Date range — default: first day of current month → today
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [currency, setCurrency] = useState("USD");
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Wire this up to your real TanStack Query / API call ──
  // const { data, isLoading } = useQuery(["cashflow", from, to, currency, refreshKey], ...)
  const summary = MOCK_SUMMARY;
  const monthly = MOCK_MONTHLY;
  const statusData = MOCK_STATUS;

  const totalInvoices = useMemo(
    () => statusData.reduce((acc, s) => acc + s.value, 0),
    [statusData]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cash Flow</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Financial overview &amp; payment analytics
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm shadow-sm">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-slate-700 focus:outline-none bg-transparent"
            />
            <span className="text-slate-400 mx-1">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-slate-700 focus:outline-none bg-transparent"
            />
          </div>

          {/* Currency */}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Invoiced"
          value={fmt(summary.totalInvoiced, currency)}
          sub={`${totalInvoices} invoices total`}
          subPositive={true}
          color="bg-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Total Received"
          value={fmt(summary.totalReceived, currency)}
          sub={`${pct(summary.collectionRate)} collection rate`}
          subPositive={summary.collectionRate >= 70}
          color="bg-emerald-500"
        />
        <StatCard
          icon={Clock}
          label="Outstanding"
          value={fmt(summary.outstanding, currency)}
          sub={`${summary.overdueInvoices} overdue invoice${summary.overdueInvoices !== 1 ? "s" : ""}`}
          subPositive={false}
          color="bg-amber-500"
        />
        <StatCard
          icon={FileText}
          label="Draft Invoices"
          value={summary.draftInvoices}
          sub={`${summary.paidInvoices} paid this period`}
          subPositive={true}
          color="bg-violet-500"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area Chart — Revenue vs Received (spans 2 cols) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Revenue vs Received — Monthly
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInvoiced" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-slate-600 capitalize">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="invoiced"
                name="Invoiced"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#gradInvoiced)"
              />
              <Area
                type="monotone"
                dataKey="received"
                name="Received"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#gradReceived)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — Invoice Status */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Invoice Status Breakdown
          </h2>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto font-semibold text-slate-700">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bar Chart — Monthly Outstanding ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Monthly Outstanding Balance
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Summary Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Period Summary</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {from} → {to} · {currency}
          </p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[
              { label: "Total Invoiced", value: fmt(summary.totalInvoiced, currency), highlight: false },
              { label: "Total Received", value: fmt(summary.totalReceived, currency), highlight: false },
              { label: "Outstanding", value: fmt(summary.outstanding, currency), highlight: true },
              { label: "Collection Rate", value: pct(summary.collectionRate), highlight: false },
              { label: "Overdue Invoices", value: summary.overdueInvoices, highlight: summary.overdueInvoices > 0 },
              { label: "Paid Invoices", value: summary.paidInvoices, highlight: false },
              { label: "Draft Invoices", value: summary.draftInvoices, highlight: false },
            ].map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-slate-50 last:border-0 ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                <td className="px-5 py-3 text-slate-600">{row.label}</td>
                <td
                  className={`px-5 py-3 text-right font-semibold ${
                    row.highlight ? "text-amber-600" : "text-slate-800"
                  }`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
