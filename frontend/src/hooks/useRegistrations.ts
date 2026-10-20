import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegistrationInput } from '@playlocal/shared';
import { registrationService } from '@/services/registrationService';
import { tournamentService } from '@/services/tournamentService';
import { qk } from '@/lib/queryKeys';

export function useMyRegistrations(status: string, page: number) {
  return useQuery({
    queryKey: qk.registrations.mine(status, page),
    queryFn: () => registrationService.mine({ status: status as never, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
}

export function useMyRegistrationsFor(tournamentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.tournaments.myRegistrationsFor(tournamentId ?? ''),
    queryFn: () => tournamentService.myRegistrationsFor(tournamentId!),
    enabled: Boolean(tournamentId) && enabled,
  });
}

export function useTournamentRegistrations(tournamentId: string | undefined) {
  return useQuery({
    queryKey: qk.tournaments.registrations(tournamentId ?? ''),
    queryFn: () => tournamentService.registrations(tournamentId!),
    enabled: Boolean(tournamentId),
  });
}

/** Registration changes ripple into counts on tournament pages and lists — invalidate them together. */
function useInvalidateRegistrationData() {
  const qc = useQueryClient();
  return (tournamentId?: string) => {
    void qc.invalidateQueries({ queryKey: qk.registrations.all });
    void qc.invalidateQueries({ queryKey: qk.tournaments.all });
    void qc.invalidateQueries({ queryKey: qk.notifications.unread });
    if (tournamentId) void qc.invalidateQueries({ queryKey: qk.tournaments.detail(tournamentId) });
  };
}

export function useRegistrationMutations() {
  const invalidate = useInvalidateRegistrationData();
  return {
    register: useMutation({
      mutationFn: ({ tournamentId, body }: { tournamentId: string; body: RegistrationInput }) =>
        registrationService.register(tournamentId, body),
      onSuccess: (r) => invalidate(r.tournamentId),
    }),
    withdraw: useMutation({
      mutationFn: (id: string) => registrationService.withdraw(id),
      onSuccess: (r) => invalidate(r.tournamentId),
    }),
    confirm: useMutation({
      mutationFn: (id: string) => registrationService.confirm(id),
      onSuccess: (r) => invalidate(r.tournamentId),
    }),
    decline: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
        registrationService.decline(id, reason),
      onSuccess: (r) => invalidate(r.tournamentId),
    }),
  };
}
