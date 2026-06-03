import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Clock,
  CheckCircle, FileText, RefreshCw, AlertTriangle,
} from "lucide-react";
import apiClient from "../api/client";
import PageHeader from "../components/ui/PageHeader";
import { usePageMeta } from "../hooks/usePageMeta";

// ─── helpers ──────────────────────────────────────────────────────────────────

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "INR"];

function fmt(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, subPositive, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${color}`}>
          <Icon size={18} className="text-white" />
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && (
        <p className={`text-xs font-medium flex items-center gap-1 ${subPositive ? "text-emerald-600" : "text-red-500"}`}>
          {subPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {sub}
        </p>
      )}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label, currency }) => {
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
      <span style={{ color: d.payload.color }} className="font-semibold">{d.name}</span>
      {": "}{d.value} invoices
    </div>
  );
};

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`} />;
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const meta = usePageMeta("Cash Flow", "Invoiced vs received summary for the period");

  const [from, setFrom] = useState(firstOfMonthISO);
  const [to, setTo] = useState(todayISO);
  const [currency, setCurrency] = useState("USD");

  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, monRes] = await Promise.all([
        apiClient.get("/cash-flow/summary", {
          params: { start: from, end: to, currency },
        }),
        apiClient.get("/cash-flow/monthly", {
          params: { months: 6, currency },
        }),
      ]);
      setSummary(sumRes.data.data);
      setMonthly(monRes.data.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load cash flow data.");
    } finally {
      setLoading(false);
    }
  }, [from, to, currency]);

  useEffect(() => { load(); }, [load]);

  // Build donut data from summary counts
  const statusData = summary
    ? [
        { name: "Paid",    value: summary.paid_count,    color: "#22c55e" },
        { name: "Overdue", value: summary.overdue_count, color: "#ef4444" },
        { name: "Draft",   value: summary.draft_count,   color: "#94a3b8" },
        {
          name: "Other",
          value: Math.max(
            0,
            // sent + received + cancelled — we only have the three counts above
            // so "Other" = total invoices implied by totals minus the known ones
            0
          ),
          color: "#3b82f6",
        },
      ].filter((s) => s.value > 0)
    : [];

  const collectionRate =
    summary && Number(summary.total_invoiced) > 0
      ? ((Number(summary.total_received) / Number(summary.total_invoiced)) * 100).toFixed(1)
      : null;

  return (
    <div className="p-6 min-h-screen bg-slate-50 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cash Flow</h1>
          <p className="text-sm text-slate-500 mt-0.5">Financial overview &amp; payment analytics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm shadow-sm">
            <input
              type="date" value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-slate-700 focus:outline-none bg-transparent"
            />
            <span className="text-slate-400 mx-1">→</span>
            <input
              type="date" value={to}
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
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {/* Refresh */}
          <button
            onClick={load}
            className="flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : summary ? (
          <>
            <StatCard
              icon={DollarSign} label="Total Invoiced"
              value={fmt(summary.total_invoiced, currency)}
              sub={`${summary.paid_count + summary.overdue_count + summary.draft_count} invoices tracked`}
              subPositive color="bg-blue-500"
            />
            <StatCard
              icon={CheckCircle} label="Total Received"
              value={fmt(summary.total_received, currency)}
              sub={collectionRate ? `${collectionRate}% collection rate` : "No data yet"}
              subPositive={Number(collectionRate) >= 70}
              color="bg-emerald-500"
            />
            <StatCard
              icon={Clock} label="Outstanding"
              value={fmt(summary.total_outstanding, currency)}
              sub={`${summary.overdue_count} overdue invoice${summary.overdue_count !== 1 ? "s" : ""}`}
              subPositive={false}
              color="bg-amber-500"
            />
            <StatCard
              icon={FileText} label="Draft Invoices"
              value={summary.draft_count}
              sub={`${summary.paid_count} paid this period`}
              subPositive color="bg-violet-500"
            />
          </>
        ) : null}
      </div>

      {/* Charts row: Area + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Revenue vs Received — Last 6 Months</h2>
          {loading ? (
            <Skeleton className="h-60" />
          ) : monthly.length > 0 ? (
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
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Legend formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                <Area type="monotone" dataKey="invoiced" name="Invoiced"
                  stroke="#3b82f6" strokeWidth={2} fill="url(#gradInvoiced)" />
                <Area type="monotone" dataKey="received" name="Received"
                  stroke="#22c55e" strokeWidth={2} fill="url(#gradReceived)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-16 text-center">No data for this period.</p>
          )}
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Invoice Status Breakdown</h2>
          {loading ? (
            <Skeleton className="flex-1 min-h-[180px]" />
          ) : statusData.length > 0 ? (
            <>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto font-semibold text-slate-700">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No invoice data.</p>
          )}
        </div>
      </div>

      {/* Bar chart — outstanding */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Outstanding Balance</h2>
        {loading ? (
          <Skeleton className="h-52" />
        ) : monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-12 text-center">No data for this period.</p>
        )}
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Period Summary</h2>
          <p className="text-xs text-slate-400 mt-0.5">{from} → {to} · {currency}</p>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
        ) : summary ? (
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: "Total Invoiced",   value: fmt(summary.total_invoiced, currency),   hi: false },
                { label: "Total Received",   value: fmt(summary.total_received, currency),   hi: false },
                { label: "Outstanding",      value: fmt(summary.total_outstanding, currency), hi: true  },
                { label: "Collection Rate",  value: collectionRate ? `${collectionRate}%` : "—", hi: false },
                { label: "Overdue Invoices", value: summary.overdue_count, hi: summary.overdue_count > 0 },
                { label: "Paid Invoices",    value: summary.paid_count,    hi: false },
                { label: "Draft Invoices",   value: summary.draft_count,   hi: false },
              ].map((row, i) => (
                <tr key={row.label}
                  className={`border-b border-slate-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                  <td className="px-5 py-3 text-slate-600">{row.label}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${row.hi ? "text-amber-600" : "text-slate-800"}`}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-slate-400">No data available.</p>
        )}
      </div>
    </div>
  );
}
