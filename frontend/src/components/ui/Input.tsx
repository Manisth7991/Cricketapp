import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, Ref } from 'react';
import { cn } from '@/utils/cn';

export const controlClasses =
  'w-full rounded-xl bg-white px-3.5 text-[15px] text-ink ring-1 ring-inset ring-line placeholder:text-ink-faint transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500 aria-[invalid=true]:ring-red-400 aria-[invalid=true]:focus:ring-red-500 disabled:bg-slate-50 disabled:text-ink-soft';

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(controlClasses, 'h-11', className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      className={cn(controlClasses, 'min-h-28 py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ref,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      ref={ref}
      className={cn(controlClasses, 'select-chevron h-11 appearance-none pr-10', className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; ref?: Ref<HTMLInputElement> }) {
  return (
    <label
      className={cn('flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink', className)}
    >
      <input
        ref={ref}
        type="checkbox"
        className="size-5 rounded-md accent-primary-600"
        {...props}
      />
      {label}
    </label>
  );
}
