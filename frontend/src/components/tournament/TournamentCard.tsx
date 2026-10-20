import { memo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, MapPin, Trophy } from 'lucide-react';
import type { TournamentDTO } from '@playlocal/shared';
import { useSports, sportLabel } from '@/hooks/useSports';
import { deadlineLabel, formatDateRange, formatDistance, formatPrize } from '@/utils/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { AvailabilityBadge, TournamentStatusBadge, VerifiedBadge } from './Badges';
import { TournamentBanner } from './TournamentBanner';
import { cn } from '@/utils/cn';

interface Props {
  tournament: TournamentDTO;
  /** Owner/admin views show lifecycle status instead of availability. */
  showStatus?: boolean;
  to?: string;
  priority?: boolean;
}

function CapacityBar({ registered, max }: { registered: number; max?: number }) {
  if (!max) return null;
  const pct = Math.min(100, Math.round((registered / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className={cn(
            'h-full rounded-full',
            pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium whitespace-nowrap text-ink-soft tabular">
        {registered}/{max} teams
      </span>
    </div>
  );
}

export const TournamentCard = memo(function TournamentCard({
  tournament: t,
  showStatus,
  to,
  priority,
}: Props) {
  const { bySlug } = useSports();
  const href = to ?? `/tournaments/${t.id}`;
  const distance = formatDistance(t.distanceKm);
  const deadline =
    t.availability === 'open' || t.availability === 'waitlist'
      ? deadlineLabel(t.registrationDeadline)
      : undefined;

  return (
    <article className="card group relative flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]">
      <div className="relative">
        <TournamentBanner
          src={t.banner}
          sport={t.sport}
          sportIcon={bySlug.get(t.sport)?.icon}
          alt=""
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          priority={priority}
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink shadow-sm">
            {bySlug.get(t.sport)?.icon} {sportLabel(bySlug, t.sport)}
          </span>
          {t.verified && <VerifiedBadge className="bg-white/95 shadow-sm" />}
        </div>
        {t.prizeMoney > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-xl bg-ink/80 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm">
            <Trophy className="size-4 text-amber-300" aria-hidden />
            <span className="tabular">{formatPrize(t.prizeMoney)}</span>
            <span className="font-medium text-white/70">prize</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <h3 className="line-clamp-2 text-lg leading-snug font-bold text-ink">
          <Link
            to={href}
            className="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:rounded-[var(--radius-card)] focus-visible:after:ring-2 focus-visible:after:ring-primary-600"
          >
            {t.name}
          </Link>
        </h3>
        <dl className="flex flex-col gap-1.5 text-sm text-ink-soft">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Dates</dt>
            <CalendarDays className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <dd className="font-medium text-ink">{formatDateRange(t.startDate, t.endDate)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <dd className="truncate">
              {[t.venue.city, t.venue.state].filter(Boolean).join(', ') || 'Venue TBA'}
              {distance && <span className="font-semibold text-accent-700"> · {distance}</span>}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <CapacityBar registered={t.registeredCount} max={t.maxTeams} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {showStatus ? (
                <TournamentStatusBadge status={t.status} />
              ) : (
                <AvailabilityBadge availability={t.availability} short />
              )}
              {deadline && !showStatus && (
                <span className="truncate text-xs font-medium text-ink-soft">{deadline}</span>
              )}
            </div>
            <span
              className="flex shrink-0 items-center text-sm font-semibold text-primary-700 group-hover:text-primary-800"
              aria-hidden
            >
              View details{' '}
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
});

export function TournamentCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <Skeleton className="aspect-video rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-1.5 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  );
}

export function TournamentGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3', className)}>
      {children}
    </div>
  );
}

export function TournamentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <TournamentGrid>
      {Array.from({ length: count }, (_, i) => (
        <TournamentCardSkeleton key={i} />
      ))}
    </TournamentGrid>
  );
}
