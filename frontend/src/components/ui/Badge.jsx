import { cn } from '../../utils/cn';
import { STATUS_COLORS } from '../../utils/status';

export default function StatusBadge({ status, className }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.Draft;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors.bg,
        colors.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {status}
    </span>
  );
}

export function RoleBadge({ role }) {
  const styles = {
    Admin: 'bg-primary-light text-primary',
    Entry: 'bg-accent-light text-accent',
    Readonly: 'bg-gray-100 text-[#6B7280]',
  };

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[role] || styles.Readonly,
      )}
    >
      {role}
    </span>
  );
}

export function AlertBadge({ status }) {
  const styles = {
    'On Track': 'bg-green-50 text-status-received',
    'Due Soon': 'bg-amber-50 text-status-pending',
    Overdue: 'bg-red-50 text-status-overdue',
  };

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status] || 'bg-gray-100 text-[#6B7280]',
      )}
    >
      {status}
    </span>
  );
}
