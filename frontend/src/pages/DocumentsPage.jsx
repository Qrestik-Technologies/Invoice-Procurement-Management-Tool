import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, FileText, Cloud, CloudOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import QueryError from '../components/ui/QueryError';
import { fetchDocuments, uploadDocument, downloadDocument } from '../api/documents';
import { formatDateTime } from '../utils/format';
import { toDisplaySync, canEdit } from '../utils/status';
import { useAuth } from '../context/AuthContext';

function SyncBadge({ status }) {
  const map = {
    synced: { icon: Cloud, cls: 'bg-green-50 text-status-received' },
    pending: { icon: Loader2, cls: 'bg-amber-50 text-status-pending' },
    failed: { icon: CloudOff, cls: 'bg-red-50 text-status-overdue' },
  };
  const { icon: Icon, cls } = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className={`h-3 w-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
      OneDrive {toDisplaySync(status)}
    </span>
  );
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  });

  const uploadMut = useMutation({
    mutationFn: (file) => uploadDocument(file),
    onSuccess: () => { toast.success('Document uploaded'); queryClient.invalidateQueries({ queryKey: ['documents'] }); },
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Upload failed'),
  });

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && canEdit(user?.role)) uploadMut.mutate(file);
  }, [uploadMut, user]);

  return (
    <div>
      <PageHeader title="Documents" description="Upload invoice PDFs with OneDrive sync" />
      {canEdit(user?.role) && (
        <Card className="mb-6">
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center ${dragOver ? 'border-primary bg-primary-light/40' : 'border-border'}`}>
            <Upload className="mx-auto h-10 w-10 text-[#9CA3AF]" />
            <p className="mt-3 text-sm font-medium">Drag and drop PDF or DOCX files here</p>
            <input type="file" accept=".pdf,.docx" className="mt-4 text-xs" onChange={(e) => e.target.files?.[0] && uploadMut.mutate(e.target.files[0])} />
          </div>
        </Card>
      )}
      {isError ? (
        <QueryError message="Could not load documents." onRetry={refetch} />
      ) : isLoading ? (
        <Card><p className="p-8 text-center text-sm">Loading…</p></Card>
      ) : documents.length === 0 ? (
        <EmptyState title="No documents uploaded" />
      ) : (
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50/80 text-left text-xs uppercase text-[#6B7280]">
                {['Filename', 'Linked Invoice', 'Uploaded By', 'Date', 'OneDrive', 'Download'].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/80">
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4" />{doc.filename}</div></td>
                    <td className="px-5 py-3 text-primary">{doc.linked_invoice_number || '—'}</td>
                    <td className="px-5 py-3">{doc.uploader_name}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{formatDateTime(doc.created_at)}</td>
                    <td className="px-5 py-3"><SyncBadge status={doc.sync_status} /></td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc.id, doc.filename)}
                        className="flex items-center gap-1 text-xs hover:text-primary"
                      >
                        <Download className="h-4 w-4" />Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
