import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Horizontally scrollable segmented tabs (mobile friendly). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0',
        className,
      )}
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
              active
                ? 'bg-ink text-white'
                : 'bg-white text-ink-soft ring-1 ring-inset ring-line hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular',
                  active ? 'bg-white/20' : 'bg-slate-100',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
