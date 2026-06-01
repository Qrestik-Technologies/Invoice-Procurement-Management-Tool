export default function Button({
  children,
  type = 'button',
  className = '',
  size = 'md',
  variant = 'primary',
  disabled = false,
  onClick,
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90 disabled:bg-primary/50',
    secondary: 'bg-white border border-border text-[#374151] hover:bg-gray-50 disabled:opacity-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
