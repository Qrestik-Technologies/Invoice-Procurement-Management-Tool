import { cn } from '../../utils/cn';

export default function Card({ children, className, padding = true }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-card shadow-card',
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div>
        {title && <h3 className="text-base font-semibold text-[#111827]">{title}</h3>}
        {description && (
          <p className="mt-0.5 text-sm text-[#6B7280]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
