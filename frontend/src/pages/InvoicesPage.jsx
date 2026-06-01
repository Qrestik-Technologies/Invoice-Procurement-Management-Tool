import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
} from '@tanstack/react-table';
import { Plus, Search, Eye, Pencil, Send, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import QueryError from '../components/ui/QueryError';
import { Input, Select } from '../components/ui/FormFields';
import NewInvoiceDrawer from '../components/invoices/NewInvoiceDrawer';
import InvoiceDetailDrawer from '../components/invoices/InvoiceDetailDrawer';
import { fetchInvoices, dispatchInvoice } from '../api/invoices';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/format';
import { canDispatch, toApiStatus, toDisplayStatus } from '../utils/status';

const STATUS_OPTIONS = ['Draft', 'Pending', 'Dispatched', 'Received', 'Overdue'];

export default function InvoicesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detailMode, setDetailMode] = useState('view');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params = useMemo(() => ({
    status: statusFilter ? toApiStatus(statusFilter) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [statusFilter, dateFrom, dateTo]);

  const { data: invoices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['invoices', params],
    queryFn: () => fetchInvoices(params),
  });

  const dispatchMut = useMutation({
    mutationFn: dispatchInvoice,
    onSuccess: () => {
      toast.success('Invoice dispatched');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Dispatch failed'),
  });

  const openDetail = (id, mode) => {
    setDetailId(id);
    setDetailMode(mode);
  };

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (i) => i.invoice_number?.toLowerCase().includes(q) || i.customer_name?.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const columns = useMemo(() => [
    { accessorKey: 'invoice_number', header: 'Invoice No', cell: ({ getValue }) => <span className="font-medium text-primary">{getValue()}</span> },
    { accessorKey: 'customer_name', header: 'Customer' },
    { accessorKey: 'invoice_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Amount', cell: ({ getValue }) => <span className="font-medium">{formatCurrency(Number(getValue()))}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={toDisplayStatus(getValue())} /> },
    { accessorKey: 'milestone_name', header: 'Milestone', cell: ({ getValue }) => <span className="max-w-[180px] truncate text-[#6B7280]">{getValue() || '—'}</span> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button type="button" title="View" onClick={() => openDetail(row.original.id, 'view')} className="rounded p-1.5 text-[#6B7280] hover:bg-gray-100 hover:text-primary"><Eye className="h-4 w-4" /></button>
          {canDispatch(user?.role) && (
            <>
              <button type="button" title="Edit" onClick={() => openDetail(row.original.id, 'edit')} className="rounded p-1.5 text-[#6B7280] hover:bg-gray-100 hover:text-primary"><Pencil className="h-4 w-4" /></button>
              <button type="button" title="Dispatch" onClick={() => dispatchMut.mutate(row.original.id)} className="rounded p-1.5 text-[#6B7280] hover:bg-gray-100 hover:text-accent"><Send className="h-4 w-4" /></button>
            </>
          )}
        </div>
      ),
    },
  ], [user, dispatchMut]);

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <div>
      <PageHeader title="Invoices" description="Create, track, and dispatch customer invoices"
        action={canDispatch(user?.role) && <Button icon={Plus} onClick={() => setDrawerOpen(true)}>New Invoice</Button>} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input type="text" placeholder="Search invoice no or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </Card>
      {isError ? (
        <QueryError message="Could not load invoices." onRetry={refetch} />
      ) : isLoading ? (
        <Card><p className="animate-pulse p-8 text-center text-sm text-[#6B7280]">Loading invoices…</p></Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="No invoices found" description={search || statusFilter ? 'Try adjusting your filters.' : 'No invoices yet — create your first one.'} actionLabel={canDispatch(user?.role) ? 'New Invoice' : undefined} onAction={() => setDrawerOpen(true)} />
      ) : (
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border bg-gray-50/80">
                    {hg.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                        {header.column.getCanSort() ? (
                          <button type="button" className="flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{ asc: <ChevronUp className="h-3 w-3" />, desc: <ChevronDown className="h-3 w-3" /> }[header.column.getIsSorted()] ?? null}
                          </button>
                        ) : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <NewInvoiceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <InvoiceDetailDrawer
        invoiceId={detailId}
        mode={detailMode}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
