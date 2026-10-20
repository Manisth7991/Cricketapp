import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TournamentDraftInput, TournamentDTO, TournamentStatus } from '@playlocal/shared';
import { tournamentService } from '@/services/tournamentService';
import { qk } from '@/lib/queryKeys';

export function useMyTournaments(status: TournamentStatus | 'all', page: number) {
  return useQuery({
    queryKey: qk.tournaments.mine(status, page),
    queryFn: () => tournamentService.mine({ status, page, limit: 12 }),
    placeholderData: keepPreviousData,
  });
}

/** Owner-side mutations; responses are written straight into the detail cache. */
export function useTournamentMutations() {
  const qc = useQueryClient();
  const sync = (t: TournamentDTO) => {
    qc.setQueryData(qk.tournaments.detail(t.id), t);
    void qc.invalidateQueries({ queryKey: ['tournaments', 'mine'] });
    void qc.invalidateQueries({ queryKey: ['tournaments', 'list'] });
  };
  return {
    createDraft: useMutation({
      mutationFn: (body: TournamentDraftInput) => tournamentService.createDraft(body),
      onSuccess: sync,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<TournamentDraftInput> }) =>
        tournamentService.update(id, body),
      onSuccess: sync,
    }),
    submit: useMutation({
      mutationFn: (id: string) => tournamentService.submit(id),
      onSuccess: sync,
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        tournamentService.cancel(id, reason),
      onSuccess: sync,
    }),
    complete: useMutation({
      mutationFn: (id: string) => tournamentService.complete(id),
      onSuccess: sync,
    }),
    remove: useMutation({
      mutationFn: (id: string) => tournamentService.remove(id),
      onSuccess: (_d, id) => {
        qc.removeQueries({ queryKey: qk.tournaments.detail(id) });
        void qc.invalidateQueries({ queryKey: ['tournaments', 'mine'] });
      },
    }),
  };
}
