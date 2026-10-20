import { Plus, Users } from 'lucide-react';
import { useMyTeams } from '@/hooks/useTeams';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TeamCard, TeamCardSkeleton } from '@/components/team/TeamCard';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/States';

export default function MyTeamsPage() {
  useDocumentTitle('My teams');
  const { data, isLoading, isError, error, refetch } = useMyTeams();

  return (
    <div className="container-page py-6 sm:py-8">
      <PageHeader
        title="My teams"
        subtitle="Teams you captain. Reuse them to register for any tournament."
        back="/activity"
        actions={
          <ButtonLink to="/teams/new" leftIcon={<Plus className="size-4" />}>
            New team
          </ButtonLink>
        }
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="card">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : !data?.length ? (
        <div className="card">
          <EmptyState
            icon={<Users className="size-7" />}
            title="You don't have a team yet"
            description="Create your team once, add your players, and you're ready to register for tournaments."
            action={<ButtonLink to="/teams/new">Create your first team</ButtonLink>}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </div>
      )}
    </div>
  );
}
