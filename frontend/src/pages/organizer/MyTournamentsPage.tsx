import { useSearchParams } from 'react-router';
import { Megaphone, Plus } from 'lucide-react';
import type { TournamentStatus } from '@playlocal/shared';
import { useMyTournaments } from '@/hooks/useMyTournaments';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  TournamentCard,
  TournamentGrid,
  TournamentGridSkeleton,
} from '@/components/tournament/TournamentCard';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/States';

const TABS: { value: TournamentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'published', label: 'Live' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'suspended', label: 'Suspended' },
];

export default function MyTournamentsPage() {
  useDocumentTitle('My tournaments');
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as TournamentStatus | 'all' | null) ?? 'all';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useMyTournaments(status, page);
  const counts =
    (data?.meta as unknown as { counts?: Record<string, number> } | undefined)?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Hide empty tabs (except All and the active one) to keep the bar short.
  const tabs = TABS.filter((t) => t.value === 'all' || t.value === status || counts[t.value]).map(
    (t) => ({
      ...t,
      count: t.value === 'all' ? total : counts[t.value],
    }),
  );

  return (
    <div className="container-page py-6 sm:py-8">
      <PageHeader
        title="My tournaments"
        subtitle="Tournaments you host. Drafts are private until you submit them."
        back="/activity"
        actions={
          <ButtonLink to="/create/tournament" leftIcon={<Plus className="size-4" />}>
            Host tournament
          </ButtonLink>
        }
      />
      {total > 0 && (
        <Tabs
          label="Filter by status"
          items={tabs}
          value={status}
          onChange={(v) => setParams(v === 'all' ? {} : { status: v })}
          className="mb-5"
        />
      )}
      {isLoading ? (
        <TournamentGridSkeleton count={3} />
      ) : isError ? (
        <div className="card">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState
            icon={<Megaphone className="size-7" />}
            title={status === 'all' ? "You haven't hosted a tournament yet" : 'Nothing here'}
            description="List your tournament for free and reach teams beyond your WhatsApp groups."
            action={<ButtonLink to="/create/tournament">Host a tournament</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <TournamentGrid>
            {data.items.map((t) => (
              <TournamentCard key={t.id} tournament={t} showStatus to={`/my-tournaments/${t.id}`} />
            ))}
          </TournamentGrid>
          <Pagination
            meta={data.meta}
            onPage={(p) => setParams({ ...(status !== 'all' ? { status } : {}), page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
