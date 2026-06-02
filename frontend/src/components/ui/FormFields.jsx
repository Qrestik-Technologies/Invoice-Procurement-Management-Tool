export function Input({ label, error, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[#374151]">{label}</label>
      )}
      <input
        {...props}
        className={`w-full rounded-lg border py-2 px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          error ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'
        } ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', rows = 3, ...props }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[#374151]">{label}</label>
      )}
      <textarea
        rows={rows}
        {...props}
        className={`w-full rounded-lg border py-2 px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          error ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'
        } ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[#374151]">{label}</label>
      )}
      <select
        {...props}
        className={`w-full rounded-lg border border-border py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
      />
      <span>
        <span className="block text-sm font-medium text-[#374151]">{label}</span>
        {description && <span className="block text-xs text-[#6B7280]">{description}</span>}
      </span>
    </label>
  );
}
