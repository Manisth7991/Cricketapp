import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import { ApiClientError } from '@/services/api';
import { cn } from '@/utils/cn';
import { Button } from './Button';
import { Spinner } from './Spinner';

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-ink-soft',
        className,
      )}
      role="status"
    >
      <Spinner className="size-7 text-primary-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-600">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Something went wrong. Please try again.';
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const offline = error instanceof ApiClientError && error.code === 'NETWORK_ERROR';
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div
      className={cn('flex flex-col items-center px-6 py-14 text-center', className)}
      role="alert"
    >
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-ink">
        {title ?? (offline ? "You're offline" : "Couldn't load this")}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{errorMessage(error)}</p>
      {onRetry && (
        <Button
          variant="outline"
          className="mt-5"
          onClick={onRetry}
          leftIcon={<RefreshCw className="size-4" />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineAlert({
  tone = 'red',
  title,
  children,
  icon,
  className,
}: {
  tone?: 'red' | 'amber' | 'green' | 'blue';
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    red: 'bg-red-50 text-red-800 ring-red-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    green: 'bg-primary-50 text-primary-900 ring-primary-200',
    blue: 'bg-accent-50 text-accent-700 ring-accent-100',
  };
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl p-3.5 text-sm ring-1 ring-inset',
        tones[tone],
        className,
      )}
      role={tone === 'red' ? 'alert' : 'status'}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}
