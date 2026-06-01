import { useRef } from 'react';

/**
 * Branded card shell shared by all auth screens.
 * Matches the existing LoginPage styling (surface bg, Q logo, shadow-card).
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white shadow-lg">
            Q
          </div>
          <h1 className="text-2xl font-semibold text-[#111827]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
        </div>

        <div className="rounded-xl border border-border bg-white p-8 shadow-card">{children}</div>

        {footer && <p className="mt-5 text-center text-sm text-[#6B7280]">{footer}</p>}
      </div>
    </div>
  );
}

/**
 * Controlled 6-box numeric OTP input.
 * `value` is the source-of-truth string; `onChange` receives the digits string.
 * Supports paste, auto-advance, and backspace-to-previous.
 */
export function OtpInput({ value, onChange, length = 6 }) {
  const refs = useRef([]);

  const handleChange = (i, e) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1); // last typed digit
    const arr = value.padEnd(length, ' ').split('');
    arr[i] = digit || ' ';
    onChange(arr.join('').replace(/ /g, '').slice(0, length));
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-12 rounded-lg border border-border text-center text-lg font-semibold text-[#111827] transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      ))}
    </div>
  );
}
