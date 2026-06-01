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
