import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/utils/cn';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Show a back button; string = explicit fallback route. */
  back?: boolean | string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <button
            type="button"
            onClick={() =>
              window.history.length > 1
                ? navigate(-1)
                : navigate(typeof back === 'string' ? back : '/')
            }
            className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white hover:text-ink"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-soft sm:text-[15px]">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
