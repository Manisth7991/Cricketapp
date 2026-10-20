import { Link, useSearchParams } from 'react-router';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import type { TournamentStatus } from '@playlocal/shared';
import { useAdminTournaments } from '@/hooks/useAdmin';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TournamentStatusBadge } from '@/components/tournament/Badges';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDateRange, timeAgo } from '@/utils/format';

const TABS: { value: TournamentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Live' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'draft', label: 'Drafts' },
];

/** `queue` = the verification queue (pending only, oldest first). */
export default function AdminTournamentsPage({ queue = false }: { queue?: boolean }) {
  useDocumentTitle(queue ? 'Verification queue' : 'Tournaments');
  const [params, setParams] = useSearchParams();
  const { bySlug } = useSports();
  const status = queue ? 'pending_verification' : (params.get('status') ?? 'all');
  const search = params.get('search') ?? '';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useAdminTournaments({
    status,
    search: search || undefined,
    page,
  });

  const set = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) n.set(k, v);
        else n.delete(k);
      }
      if (!('page' in patch)) n.delete('page');
      return n;
    });

  return (
    <div>
      <PageHeader
        title={queue ? 'Verification queue' : 'Tournaments'}
        subtitle={
          queue
            ? 'Oldest submissions first. Verify details before approving — approval publishes immediately.'
            : 'Every tournament on the platform.'
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!queue && (
          <Tabs
            label="Status"
            items={TABS}
            value={status as TournamentStatus | 'all'}
            onChange={(v) => set({ status: v === 'all' ? undefined : v })}
          />
        )}
        <SearchInput
          label="Search tournaments"
          placeholder="Search name or city"
          value={search}
          onChange={(v) => set({ search: v || undefined })}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState
            icon={<ClipboardCheck className="size-7" />}
            title={queue ? 'All caught up!' : 'No tournaments found'}
            description={queue ? 'There are no tournaments waiting for verification.' : undefined}
          />
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-line overflow-hidden">
            {data.items.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/admin/tournaments/${t.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50"
                >
                  <span className="hidden text-2xl sm:block" aria-hidden>
                    {bySlug.get(t.sport)?.icon ?? '🏆'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{t.name}</p>
                      <TournamentStatusBadge status={t.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-soft">
                      {sportLabel(bySlug, t.sport)} ·{' '}
                      {[t.venue.city, t.venue.state].filter(Boolean).join(', ') || 'No venue'} ·{' '}
                      {formatDateRange(t.startDate, t.endDate)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      by {t.organizer?.name ?? 'Unknown'} ·{' '}
                      {queue && t.submittedAt
                        ? `submitted ${timeAgo(t.submittedAt)}`
                        : `updated ${timeAgo(t.updatedAt)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
    </div>
  );
}

export function AdminVerificationPage() {
  return <AdminTournamentsPage queue />;
}
