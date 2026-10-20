import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { MapPin, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import type { PlayerDTO } from '@playlocal/shared';
import { LIMITS } from '@playlocal/shared';
import { useTeam, useTeamMutations } from '@/hooks/useTeams';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PlayerRow } from '@/components/team/PlayerRow';
import { PlayerFormModal } from '@/components/team/PlayerFormModal';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
  errorMessage,
} from '@/components/ui/States';
import { safeNext } from '@/components/layout/Guards';

export default function TeamDetailsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const next = params.get('next');
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { bySlug } = useSports();
  const { data: team, isLoading, isError, error, refetch } = useTeam(id);
  const m = useTeamMutations(id);
  useDocumentTitle(team?.name ?? 'Team');

  const [editing, setEditing] = useState<PlayerDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<PlayerDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError || !team)
    return (
      <div className="container-page py-10">
        <div className="card">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      </div>
    );

  const isCaptain = user?.id === team.captainId || user?.role === 'admin';
  const full = team.playerCount >= LIMITS.maxPlayersPerTeam;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <PageHeader
        back="/teams"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={team.name} src={team.logo} size="lg" square />
            <span className="min-w-0">
              <span className="block truncate">{team.name}</span>
              <span className="mt-0.5 block text-sm font-medium text-ink-soft">
                {bySlug.get(team.sport)?.icon} {sportLabel(bySlug, team.sport)}
                {team.location?.city && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {team.location.city}
                  </span>
                )}
              </span>
            </span>
          </span>
        }
        actions={
          isCaptain && (
            <ButtonLink
              to={`/teams/${team.id}/edit`}
              variant="outline"
              size="sm"
              leftIcon={<Pencil className="size-4" />}
            >
              Edit team
            </ButtonLink>
          )
        }
      />

      {isNew && (
        <InlineAlert tone="green" className="mb-5" title="Team created!">
          Add your players below.{' '}
          {next && (
            <Link to={safeNext(next)} className="font-semibold underline">
              Continue registration →
            </Link>
          )}
        </InlineAlert>
      )}

      {team.description && <p className="mb-5 text-ink-soft">{team.description}</p>}

      <section className="card overflow-hidden" aria-labelledby="players-h">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
          <h2 id="players-h" className="flex items-center gap-2 font-semibold">
            <Users className="size-5 text-primary-700" aria-hidden /> Players
            <span className="rounded-full bg-slate-100 px-2 text-xs text-ink-soft tabular">
              {team.playerCount}/{LIMITS.maxPlayersPerTeam}
            </span>
          </h2>
          {isCaptain && (
            <Button
              size="sm"
              variant="secondary"
              disabled={full}
              leftIcon={<UserPlus className="size-4" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add player
            </Button>
          )}
        </div>
        {team.players.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="size-7" />}
            title="No players yet"
            description="Add the players who will play for this team. Organisers see this roster when you register."
          />
        ) : (
          <ul className="divide-y divide-line">
            {team.players.map((p, i) => (
              <PlayerRow
                key={p.id}
                player={p}
                index={i}
                onEdit={
                  isCaptain
                    ? (pl) => {
                        setEditing(pl);
                        setFormOpen(true);
                      }
                    : undefined
                }
                onRemove={isCaptain ? setRemoving : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {next && !isNew && (
        <ButtonLink to={safeNext(next)} className="mt-5" fullWidth>
          Continue registration
        </ButtonLink>
      )}

      {isCaptain && (
        <div className="mt-10 border-t border-line pt-6">
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            leftIcon={<Trash2 className="size-4" />}
            onClick={() => setDeleting(true)}
          >
            Delete team
          </Button>
        </div>
      )}

      <PlayerFormModal
        open={formOpen}
        player={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) await m.updatePlayer.mutateAsync({ playerId: editing.id, body: values });
          else await m.addPlayer.mutateAsync(values);
          toast.success(editing ? 'Player updated' : 'Player added');
        }}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They will no longer appear on this team's roster."
        confirmLabel="Remove"
        tone="danger"
        loading={m.removePlayer.isPending}
        onConfirm={async () => {
          try {
            await m.removePlayer.mutateAsync(removing!.id);
            toast.success('Player removed');
            setRemoving(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this team?"
        description="This cannot be undone. Teams with active tournament registrations can't be deleted."
        confirmLabel="Delete team"
        tone="danger"
        loading={m.remove.isPending}
        onConfirm={async () => {
          try {
            await m.remove.mutateAsync();
            toast.success('Team deleted');
            navigate('/teams', { replace: true });
          } catch (e) {
            toast.error(errorMessage(e));
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
