import { useEffect, useState } from "react";
import apiClient from "../api/client";
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
} from "recharts";
import {
  DollarSign,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
} from "lucide-react";

export default function CashFlowPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // filters
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [currency, setCurrency] = useState("USD");
  const [refreshKey, setRefreshKey] = useState(0);

  // fetch cashflow
  const load = () => {
    setLoading(true);
    apiClient
      .get(
        `/cash-flow/summary?from=${from}&to=${to}&currency=${currency}`
      )
      .then((r) => {
        setSummary(r.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [from, to, currency, refreshKey]);

  const fmt = (v) =>
    `$${Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
    })}`;

  // safe fallback
  const data = summary || {};

  const statusData = [
    { name: "Paid", value: data.paid_count || 0, color: "#22c55e" },
    { name: "Overdue", value: data.overdue_count || 0, color: "#ef4444" },
    { name: "Draft", value: data.draft_count || 0, color: "#94a3b8" },
  ];

  return (
    <div className="p-8 bg-slate-50 min-h-screen space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#111827]">Cash Flow</h1>

        {/* controls */}
        <div className="flex flex-wrap gap-2 items-center">

          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-white border rounded-lg px-3 py-2"
          >
            {["USD", "EUR", "GBP", "AED", "INR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="bg-[#1e3a5f] text-white px-3 py-2 rounded-lg flex items-center gap-1"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* LOADING */}
      {loading || !summary ? (
        <div className="text-center text-gray-500 py-20">Loading...</div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

            <div className="bg-white p-5 rounded-xl border">
              <div className="text-xs text-gray-500">Total Invoiced</div>
              <div className="text-xl font-bold">{fmt(data.total_invoiced)}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border">
              <div className="text-xs text-gray-500">Total Received</div>
              <div className="text-xl font-bold text-green-600">
                {fmt(data.total_received)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border">
              <div className="text-xs text-gray-500">Outstanding</div>
              <div className="text-xl font-bold text-amber-600">
                {fmt(data.total_outstanding)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border">
              <div className="text-xs text-gray-500">Overdue</div>
              <div className="text-xl font-bold text-red-500">
                {data.overdue_count}
              </div>
            </div>

          </div>

          {/* SIMPLE CHART SECTION (SAFE VERSION) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Donut */}
            <div className="bg-white p-5 rounded-xl border">
              <h2 className="font-semibold mb-4">Invoice Status</h2>

              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {statusData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="flex gap-4 text-xs mt-3">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Table */}
            <div className="bg-white p-5 rounded-xl border">
              <h2 className="font-semibold mb-4">Summary</h2>

              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Period", `${data.period_start} → ${data.period_end}`],
                    ["Currency", data.currency],
                    ["Paid Invoices", data.paid_count],
                    ["Draft Invoices", data.draft_count],
                    ["Overdue Invoices", data.overdue_count],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b last:border-0">
                      <td className="py-2 text-gray-500">{k}</td>
                      <td className="py-2 text-right font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
