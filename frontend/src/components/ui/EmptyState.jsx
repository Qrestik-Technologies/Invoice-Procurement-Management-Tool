import { FileText } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from './Button';

export default function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-gray-50/50 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[#6B7280]">{description}</p>
      )}
      {action || (actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ))}
    </div>
  );
}
