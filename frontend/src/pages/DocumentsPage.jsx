import { usePageMeta } from '../hooks/usePageMeta';
import PageHeader from '../components/ui/PageHeader';

export default function DocumentsPage() {
  const meta = usePageMeta('Documents', 'Invoice files and attachments');

  return (
    <div className="p-8">
      <PageHeader
        title={meta.title}
        organizationName={meta.organizationName}
        description={meta.description}
      />
      <div className="rounded-xl border border-border bg-white p-12 text-center shadow-sm">
        <p className="text-[#9CA3AF]">Document management coming soon.</p>
        <p className="mt-1 text-sm text-[#9CA3AF]">Upload invoices and attach them to OneDrive via the Invoices page.</p>
      </div>
    </div>
  );
}
