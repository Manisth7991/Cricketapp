import { Link } from 'react-router';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import type { RegistrationDTO } from '@playlocal/shared';
import { RegistrationStatusBadge } from './Badges';
import { TournamentBanner } from './TournamentBanner';
import { Button } from '@/components/ui/Button';
import { formatDateRange, timeAgo } from '@/utils/format';

export function RegistrationCard({
  reg,
  onWithdraw,
}: {
  reg: RegistrationDTO;
  onWithdraw?: (r: RegistrationDTO) => void;
}) {
  const t = reg.tournament;
  const canWithdraw =
    onWithdraw &&
    ['pending', 'confirmed', 'waitlisted'].includes(reg.status) &&
    t?.registrationDeadline &&
    new Date(t.registrationDeadline).getTime() > Date.now();

  return (
    <article className="card flex flex-col overflow-hidden sm:flex-row">
      {t && (
        <Link to={`/tournaments/${t.id}`} className="sm:w-48 sm:shrink-0" tabIndex={-1} aria-hidden>
          <TournamentBanner
            src={t.banner}
            sport={t.sport}
            alt=""
            sizes="(min-width: 640px) 192px, 100vw"
            aspect={16 / 7}
            className="h-full sm:aspect-auto"
          />
        </Link>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link to={t ? `/tournaments/${t.id}` : '#'} className="font-semibold hover:underline">
            {t?.name ?? 'Tournament unavailable'}
          </Link>
          <RegistrationStatusBadge status={reg.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Users className="size-4" aria-hidden /> {reg.team?.name}
          </span>
          {t && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />{' '}
              {formatDateRange(t.startDate, t.endDate)}
            </span>
          )}
          {t?.venue.city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {t.venue.city}
            </span>
          )}
        </div>
        {reg.status === 'waitlisted' && reg.waitlistPosition && (
          <p className="text-sm font-medium text-accent-700">
            #{reg.waitlistPosition} on the waitlist
          </p>
        )}
        {reg.decisionReason && (reg.status === 'cancelled' || reg.status === 'withdrawn') && (
          <p className="text-sm text-ink-soft">Reason: {reg.decisionReason}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-ink-faint">Updated {timeAgo(reg.updatedAt)}</span>
          {canWithdraw && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onWithdraw(reg)}
            >
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
