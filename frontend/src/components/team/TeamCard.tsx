import { memo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, MapPin, Users } from 'lucide-react';
import type { TeamDTO } from '@playlocal/shared';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSports, sportLabel } from '@/hooks/useSports';

export const TeamCard = memo(function TeamCard({ team }: { team: TeamDTO }) {
  const { bySlug } = useSports();
  return (
    <Link
      to={`/teams/${team.id}`}
      className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      <Avatar name={team.name} src={team.logo} size="lg" square />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{team.name}</p>
        <p className="mt-0.5 text-sm text-ink-soft">
          {bySlug.get(team.sport)?.icon} {sportLabel(bySlug, team.sport)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {team.playerCount}{' '}
            {team.playerCount === 1 ? 'player' : 'players'}
          </span>
          {team.location?.city && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {team.location.city}
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
});

export function TeamCardSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4" aria-hidden>
      <Skeleton className="size-14 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}
