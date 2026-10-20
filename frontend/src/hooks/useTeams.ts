import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlayerInput, TeamDTO, TeamInput } from '@playlocal/shared';
import { teamService } from '@/services/teamService';
import { qk } from '@/lib/queryKeys';

export function useMyTeams(sport?: string, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.teams.list(sport),
    queryFn: () => teamService.list(sport ? { sport } : {}),
    enabled: opts.enabled ?? true,
  });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: qk.teams.detail(id ?? ''),
    queryFn: () => teamService.get(id!),
    enabled: Boolean(id),
  });
}

/** Write the fresh team into the detail cache and invalidate lists (no extra GET). */
function useTeamCacheSync() {
  const qc = useQueryClient();
  return (team: TeamDTO) => {
    qc.setQueryData(qk.teams.detail(team.id), team);
    void qc.invalidateQueries({ queryKey: ['teams', 'list'] });
  };
}

export function useTeamMutations(teamId?: string) {
  const qc = useQueryClient();
  const sync = useTeamCacheSync();
  return {
    create: useMutation({
      mutationFn: (body: TeamInput) => teamService.create(body),
      onSuccess: sync,
    }),
    update: useMutation({
      mutationFn: (body: Partial<TeamInput>) => teamService.update(teamId!, body),
      onSuccess: sync,
    }),
    remove: useMutation({
      mutationFn: () => teamService.remove(teamId!),
      onSuccess: () => {
        qc.removeQueries({ queryKey: qk.teams.detail(teamId!) });
        void qc.invalidateQueries({ queryKey: qk.teams.all });
      },
    }),
    addPlayer: useMutation({
      mutationFn: (body: PlayerInput) => teamService.addPlayer(teamId!, body),
      onSuccess: sync,
    }),
    updatePlayer: useMutation({
      mutationFn: ({ playerId, body }: { playerId: string; body: PlayerInput }) =>
        teamService.updatePlayer(teamId!, playerId, body),
      onSuccess: sync,
    }),
    removePlayer: useMutation({
      mutationFn: (playerId: string) => teamService.removePlayer(teamId!, playerId),
      onSuccess: sync,
    }),
  };
}
