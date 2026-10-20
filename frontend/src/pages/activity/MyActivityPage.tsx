import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, ClipboardList, Megaphone, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMyRegistrations } from '@/hooks/useRegistrations';
import { useMyTeams } from '@/hooks/useTeams';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentService } from '@/services/tournamentService';
import { qk } from '@/lib/queryKeys';
import { RegistrationCard } from '@/components/tournament/RegistrationCard';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';

function HubLink({
  to,
  icon,
  title,
  value,
  hint,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  value?: number;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink-soft">{hint}</p>
      </div>
      {value === undefined ? (
        <Skeleton className="h-7 w-8" />
      ) : (
        <span className="text-2xl font-bold text-ink tabular">{value}</span>
      )}
      <ChevronRight
        className="size-5 text-ink-faint transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export default function MyActivityPage() {
  useDocumentTitle('My activity');
  const regs = useMyRegistrations('active', 1);
  const teams = useMyTeams();
  const unread = useUnreadCount();
  const hosted = useQuery({
    queryKey: qk.tournaments.mine('all', 1),
    queryFn: () => tournamentService.mine({ status: 'all', page: 1, limit: 1 }),
  });

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <PageHeader
        title="My activity"
        subtitle="Your registrations, teams and tournaments in one place."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <HubLink
          to="/activity/registrations"
          icon={<ClipboardList className="size-6" />}
          title="My registrations"
          hint="Active registrations"
          value={regs.data?.meta.total}
        />
        <HubLink
          to="/teams"
          icon={<Users className="size-6" />}
          title="My teams"
          hint="Teams you captain"
          value={teams.data?.length}
        />
        <HubLink
          to="/my-tournaments"
          icon={<Megaphone className="size-6" />}
          title="My tournaments"
          hint="Tournaments you host"
          value={hosted.data?.meta.total}
        />
        <HubLink
          to="/notifications"
          icon={<Bell className="size-6" />}
          title="Notifications"
          hint="Unread updates"
          value={unread.data ?? (unread.isError ? 0 : undefined)}
        />
      </div>

      <section className="mt-10" aria-labelledby="recent-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-h" className="text-lg font-bold">
            Active registrations
          </h2>
          <Link
            to="/activity/registrations"
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            See all
          </Link>
        </div>
        {regs.isLoading ? (
          <Skeleton className="h-32 rounded-[var(--radius-card)]" />
        ) : !regs.data?.items.length ? (
          <div className="card">
            <EmptyState
              title="No active registrations"
              description="Find a tournament and register your team."
              action={<ButtonLink to="/explore">Explore tournaments</ButtonLink>}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {regs.data.items.slice(0, 3).map((r) => (
              <RegistrationCard key={r.id} reg={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
