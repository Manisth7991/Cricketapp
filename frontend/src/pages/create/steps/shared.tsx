import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import type { TournamentDTO } from '@playlocal/shared';
import { PUBLISHED_EDITABLE_FIELDS } from '@playlocal/shared';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

export const STEPS = [
  { key: 'basic', label: 'Basics' },
  { key: 'location', label: 'Location' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'rules', label: 'Fees & rules' },
  { key: 'review', label: 'Review' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

export interface StepProps {
  tournament?: TournamentDTO;
  /** Navigate to the next step after a successful save. */
  onSaved: (t: TournamentDTO) => void;
  onBack?: () => void;
}

/** Published tournaments may only change a few fields (mirrors the API rule). */
export function isLocked(t: TournamentDTO | undefined, field: string): boolean {
  if (!t || t.status !== 'published') return false;
  return !(PUBLISHED_EDITABLE_FIELDS as readonly string[]).includes(field);
}

export function StepProgress({
  current,
  onJump,
  reachable,
}: {
  current: StepKey;
  onJump?: (k: StepKey) => void;
  reachable: boolean;
}) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Tournament setup progress" className="mb-6">
      <p className="mb-2 text-sm font-medium text-ink-soft sm:hidden">
        Step {idx + 1} of {STEPS.length} · <span className="text-ink">{STEPS[idx]!.label}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 sm:hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-primary-600 transition-[width] duration-300"
          style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="hidden items-center gap-2 sm:flex">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          const clickable = reachable && onJump && !active;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onJump?.(s.key)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full text-sm font-semibold',
                  clickable && 'hover:text-primary-700',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full text-xs font-bold',
                    done
                      ? 'bg-primary-700 text-white'
                      : active
                        ? 'bg-ink text-white'
                        : 'bg-slate-200 text-ink-soft',
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn('whitespace-nowrap', active ? 'text-ink' : 'text-ink-soft')}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function LockedNote() {
  return (
    <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
      <Lock className="size-3.5" aria-hidden /> Some fields are locked because this tournament is
      already published.
    </p>
  );
}

export function StepFooter({
  onBack,
  submitting,
  label = 'Save & continue',
  disabled,
}: {
  onBack?: () => void;
  submitting: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="sticky bottom-16 z-10 -mx-4 mt-6 flex gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
      {onBack && (
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
      )}
      <Button
        type="submit"
        loading={submitting}
        disabled={disabled}
        className="ml-auto flex-1 md:flex-none"
      >
        {label}
      </Button>
    </div>
  );
}
