import { Building2, ChevronDown, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import { useOrganization } from '../../context/OrganizationContext';

/**
 * @param {'default' | 'dashboard'} variant — dashboard uses a full-width prominent select
 */
export default function OrganizationSwitcher({ className = '', variant = 'default' }) {
  const {
    organizations,
    organization,
    organizationId,
    setOrganizationId,
    loading,
    error,
    refreshOrganizations,
  } = useOrganization();

  if (loading && organizations.length === 0) {
    return (
      <div className={`text-sm text-[#6B7280] ${className}`}>Loading organizations…</div>
    );
  }

  if (error && organizations.length === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}. Try again or restart Docker (<code className="text-xs">docker compose restart nginx web</code>).
        </div>
        <Button size="sm" variant="secondary" onClick={refreshOrganizations}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${className}`}>
        No organizations yet. An admin can add them under Settings → Organizations.
      </div>
    );
  }

  const isDashboard = variant === 'dashboard';

  return (
    <div className={className}>
      <label
        className={
          isDashboard
            ? 'block'
            : 'flex items-center gap-2'
        }
      >
        <span
          className={
            isDashboard
              ? 'mb-2 flex items-center gap-1.5 text-sm font-medium text-[#374151]'
              : 'flex items-center gap-1.5 text-xs font-medium text-[#6B7280]'
          }
        >
          <Building2 className="h-4 w-4 text-primary" />
          {isDashboard ? 'Select organization' : 'Organization'}
        </span>
        <div className={isDashboard ? 'relative max-w-lg' : 'relative min-w-[12rem] flex-1 sm:min-w-[16rem]'}>
          <select
            value={organizationId ?? ''}
            onChange={(e) => setOrganizationId(e.target.value ? Number(e.target.value) : null)}
            className={
              isDashboard
                ? 'w-full appearance-none rounded-lg border-2 border-primary/30 bg-white py-3 pl-4 pr-10 text-base font-semibold text-[#111827] shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25'
                : 'w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-9 text-sm font-medium text-[#111827] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            }
            aria-label="Select organization"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className={
              isDashboard
                ? 'pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary'
                : 'pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]'
            }
          />
        </div>
      </label>
      {isDashboard && organization && (
        <p className="mt-2 text-sm text-[#6B7280]">
          Viewing data for <span className="font-semibold text-[#111827]">{organization.name}</span>
          . Change this to update invoices, customers, and all page headers.
        </p>
      )}
      {!isDashboard && organization?.legal_name && organization.legal_name !== organization.name && (
        <span className="mt-1 hidden text-xs text-[#9CA3AF] lg:inline">{organization.legal_name}</span>
      )}
    </div>
  );
}
