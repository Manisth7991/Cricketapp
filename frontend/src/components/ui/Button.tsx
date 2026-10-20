import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-xl transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-primary-700 text-white shadow-sm shadow-primary-900/10 hover:bg-primary-800',
  accent: 'bg-accent-600 text-white shadow-sm hover:bg-accent-700',
  secondary: 'bg-primary-50 text-primary-800 hover:bg-primary-100',
  outline: 'bg-white text-ink ring-1 ring-inset ring-line hover:bg-slate-50',
  ghost: 'text-ink-soft hover:bg-slate-100 hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

// Every size keeps a ≥44px touch target on mobile.
const sizes: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-6 text-base',
  icon: 'size-11',
};

export function buttonClasses(
  variant: Variant = 'primary',
  size: Size = 'md',
  fullWidth = false,
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant,
  size,
  loading,
  fullWidth,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, fullWidth, className as string)} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
