import { Link } from 'react-router';
import { ArrowRight, ClipboardCheck, Flag, Trophy, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAdminStats } from '@/hooks/useAdmin';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

function Tile({
  icon,
  label,
  value,
  hint,
  to,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint?: string;
  to?: string;
  accent?: string;
}) {
  const body = (
    <>
      <div
        className={`grid size-11 place-items-center rounded-xl ${accent ?? 'bg-primary-50 text-primary-700'}`}
      >
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-ink-soft">{label}</p>
      <p className="mt-0.5 text-3xl font-bold tracking-tight tabular">
        {value.toLocaleString('en-IN')}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </>
  );
  return to ? (
    <Link
      to={to}
      className="card group relative p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      {body}
      <ArrowRight
        className="absolute top-5 right-5 size-4 text-ink-faint transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

export default function AdminDashboardPage() {
  useDocumentTitle('Admin dashboard');
  const { data, isLoading, isError, error, refetch } = useAdminStats();
  const { bySlug } = useSports();

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform health at a glance." />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              icon={<ClipboardCheck className="size-5" />}
              label="Awaiting verification"
              value={data.tournaments.pending_verification}
              hint="Review oldest first"
              to="/admin/verification"
              accent="bg-amber-50 text-amber-700"
            />
            <Tile
              icon={<Flag className="size-5" />}
              label="Open reports"
              value={data.reports.open}
              hint={`${data.reports.underReview} under review`}
              to="/admin/reports"
              accent="bg-red-50 text-red-600"
            />
            <Tile
              icon={<Trophy className="size-5" />}
              label="Live tournaments"
              value={data.tournaments.published}
              hint={`${data.tournaments.total} total`}
              to="/admin/tournaments"
            />
            <Tile
              icon={<Users className="size-5" />}
              label="Users"
              value={data.users.total}
              hint={`+${data.users.newLast7Days} this week · ${data.users.blocked} blocked`}
              to="/admin/users"
              accent="bg-accent-50 text-accent-700"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card p-5" aria-labelledby="lifecycle-h">
              <h2 id="lifecycle-h" className="font-semibold">
                Tournaments by status
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {(
                  [
                    ['draft', 'Drafts'],
                    ['pending_verification', 'Pending'],
                    ['published', 'Live'],
                    ['rejected', 'Rejected'],
                    ['suspended', 'Suspended'],
                    ['completed', 'Completed'],
                    ['cancelled', 'Cancelled'],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k}>
                    <dt className="text-ink-soft">{label}</dt>
                    <dd className="text-lg font-semibold tabular">{data.tournaments[k]}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="card p-5" aria-labelledby="activity-h">
              <h2 id="activity-h" className="font-semibold">
                Activity
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-ink-soft">Registrations (7 days)</dt>
                  <dd className="text-lg font-semibold tabular">{data.registrations.last7Days}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Registrations (all time)</dt>
                  <dd className="text-lg font-semibold tabular">{data.registrations.total}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Teams</dt>
                  <dd className="text-lg font-semibold tabular">{data.teams.total}</dd>
                </div>
              </dl>
              <h3 className="mt-6 text-sm font-semibold">Top sports (live + completed)</h3>
              {data.tournamentsBySport.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">No tournaments yet.</p>
              ) : (
                <ol className="mt-2 divide-y divide-line text-sm">
                  {data.tournamentsBySport.map((s, i) => (
                    <li key={s.sport} className="flex items-center justify-between py-2">
                      <span>
                        <span className="mr-2 text-ink-faint tabular">{i + 1}.</span>
                        {bySlug.get(s.sport)?.icon} {sportLabel(bySlug, s.sport)}
                      </span>
                      <span className="font-semibold tabular">{s.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
