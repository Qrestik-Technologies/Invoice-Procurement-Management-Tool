import { cn } from '../../utils/cn';

export default function PageHeader({
  title,
  description,
  organizationName,
  action,
  showOrganization = true,
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {showOrganization && organizationName && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {organizationName}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[#6B7280]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, subtext, trend, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-5 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[#6B7280]">{label}</p>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
      {(subtext || trend) && (
        <p className={cn('mt-1 text-xs', trend === 'up' ? 'text-status-received' : trend === 'down' ? 'text-status-overdue' : 'text-[#6B7280]')}>
          {subtext}
        </p>
      )}
    </div>
  );
}
