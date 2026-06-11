import { useEffect, useState } from 'react';
import { FileText, RefreshCw, ExternalLink } from 'lucide-react';
import { fetchDocuments } from '../api/documents';
import { useOrganization } from '../context/OrganizationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

const TYPE_COLORS = {
  invoice: 'bg-blue-100 text-blue-700',
  po:      'bg-purple-100 text-purple-700',
  receipt: 'bg-green-100 text-green-700',
};

const SYNC_COLORS = {
  synced:  'bg-emerald-100 text-emerald-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed:  'bg-red-100 text-red-700',
};

export default function DocumentsPage() {
  const meta = usePageMeta('Documents', 'Invoice files and attachments');
  const { organizationId } = useOrganization();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setDocs(data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title={meta.title}
          organizationName={meta.organizationName}
          description={meta.description}
        />
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-[#6B7280] hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#9CA3AF]">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-[#D1D5DB]" />
            <p className="text-[#6B7280]">No documents yet.</p>
            <p className="mt-1 text-sm text-[#9CA3AF]">Documents are auto-logged when invoices or POs are created.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                <th className="px-6 py-3">Filename</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Linked Invoice</th>
                <th className="px-6 py-3">OneDrive</th>
                <th className="px-6 py-3">Sync</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-[#111827]">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#9CA3AF]" />
                      {doc.filename}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#374151]">{doc.customer_name || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[doc.document_type] || 'bg-gray-100 text-gray-600'}`}>
                      {doc.document_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#374151]">{doc.linked_invoice_number || '—'}</td>
                  <td className="px-6 py-4">
                    {doc.onedrive_url ? (
                      <a href={doc.onedrive_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SYNC_COLORS[doc.sync_status] || 'bg-gray-100 text-gray-600'}`}>
                      {doc.sync_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#6B7280]">
                    {new Date(doc.created_at).toLocaleDateString()}
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
