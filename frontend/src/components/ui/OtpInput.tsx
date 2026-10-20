import type { Ref } from 'react';
import { OTP_LENGTH } from '@playlocal/shared';
import { cn } from '@/utils/cn';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires once all digits are entered (auto-submit). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  ref?: Ref<HTMLInputElement>;
  'aria-describedby'?: string;
}

/**
 * One native input (not 6 boxes): works with SMS autofill on iOS/Android
 * (`autocomplete="one-time-code"`), paste, screen readers and password managers.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  id,
  ref,
  ...aria
}: OtpInputProps) {
  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={OTP_LENGTH}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={aria['aria-describedby']}
      placeholder={'•'.repeat(OTP_LENGTH)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
        onChange(digits);
        if (digits.length === OTP_LENGTH) onComplete?.(digits);
      }}
      className={cn(
        'h-16 w-full rounded-2xl bg-white text-center font-mono text-3xl font-bold tracking-[0.6em] text-ink ring-1 ring-line ring-inset tabular',
        'placeholder:text-ink-faint/60 focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-slate-50',
        invalid && 'ring-red-400 focus:ring-red-500',
      )}
    />
  );
}
