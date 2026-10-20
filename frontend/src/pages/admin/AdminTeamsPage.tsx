import { useSearchParams } from 'react-router';
import { UsersRound } from 'lucide-react';
import { useAdminTeams } from '@/hooks/useAdmin';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDate, plural } from '@/utils/format';

export default function AdminTeamsPage() {
  useDocumentTitle('Teams');
  const { sports, bySlug } = useSports();
  const [params, setParams] = useSearchParams();
  const sport = params.get('sport') ?? '';
  const search = params.get('search') ?? '';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useAdminTeams({
    status: sport || undefined,
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
      <PageHeader title="Teams" subtitle="All teams created on PlayLocal." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          label="Search teams"
          placeholder="Team name"
          value={search}
          onChange={(v) => set({ search: v || undefined })}
        />
        <Select
          aria-label="Filter by sport"
          className="sm:max-w-48"
          value={sport}
          onChange={(e) => set({ sport: e.target.value || undefined })}
        >
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState icon={<UsersRound className="size-7" />} title="No teams found" />
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-line overflow-hidden">
            {data.items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4">
                <Avatar name={t.name} src={t.logo} size="md" square />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-sm text-ink-soft">
                    {bySlug.get(t.sport)?.icon} {sportLabel(bySlug, t.sport)} ·{' '}
                    {plural(t.playerCount, 'player')} · captain {t.captain?.name ?? '—'}
                  </p>
                </div>
                <span className="hidden text-xs text-ink-faint sm:block">
                  Created {formatDate(t.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
