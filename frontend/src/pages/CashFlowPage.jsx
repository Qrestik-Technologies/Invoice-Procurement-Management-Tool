import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import Card, { CardHeader } from '../components/ui/Card';
import StatusBadge from '../components/ui/Badge';
import { fetchCashFlowSummary } from '../api/cashflow';
import { formatCurrency, formatDate } from '../utils/format';
import { toDisplayStatus } from '../utils/status';

export default function CashFlowPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cashflow'], queryFn: fetchCashFlowSummary });

  return (
    <div>
      <PageHeader title="Cash Flow" description="Expected vs received payments — Subra view" />
      <Card className="mb-6">
        <CardHeader title="Monthly Cash Flow" description="Expected vs actual collections" />
        {isLoading ? <p className="py-12 text-center text-sm">Loading chart…</p> : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="expected" name="Expected" fill="#0C447C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="received" name="Received" fill="#0F6E56" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
      <Card padding={false} className="overflow-hidden">
        <div className="border-b px-5 py-4"><CardHeader title="Invoice Cash Flow Detail" className="mb-0" /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase text-[#6B7280]">
              {['Invoice No', 'Customer', 'Expected Date', 'Amount', 'Status'].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(data?.invoices || []).map((row) => (
                <tr key={row.invoice_id} className="hover:bg-gray-50/80">
                  <td className="px-5 py-3 font-medium text-primary">{row.invoice_number}</td>
                  <td className="px-5 py-3">{row.customer_name}</td>
                  <td className="px-5 py-3 text-[#6B7280]">{formatDate(row.expected_date)}</td>
                  <td className="px-5 py-3 font-medium">{formatCurrency(row.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={toDisplayStatus(row.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
