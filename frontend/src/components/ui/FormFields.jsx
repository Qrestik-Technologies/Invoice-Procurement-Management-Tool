import { cn } from '../../utils/cn';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function Input({ label, error, className, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[#374151]">
          {label}
        </label>
      )}
      <input className={cn(inputClass, error && 'border-red-500')} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[#374151]">
          {label}
        </label>
      )}
      <select className={cn(inputClass, error && 'border-red-500')} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[#374151]">
          {label}
        </label>
      )}
      <textarea
        className={cn(inputClass, 'min-h-[80px] resize-y', error && 'border-red-500')}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Label({ children, className }) {
  return (
    <label className={cn('mb-1.5 block text-sm font-medium text-[#374151]', className)}>
      {children}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-gray-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {label && <span className="text-sm text-[#374151]">{label}</span>}
    </label>
  );
}
