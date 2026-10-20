import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { qk } from '@/lib/queryKeys';

type ListParams = { page?: number; search?: string; status?: string };

export const useAdminStats = () =>
  useQuery({ queryKey: qk.admin.stats, queryFn: adminService.stats });

export const useAdminTournaments = (p: ListParams) =>
  useQuery({
    queryKey: qk.admin.tournaments(p),
    queryFn: () => adminService.tournaments({ ...p, limit: 20 } as never),
    placeholderData: keepPreviousData,
  });

export const useAdminTournament = (id?: string) =>
  useQuery({
    queryKey: qk.admin.tournament(id ?? ''),
    queryFn: () => adminService.tournament(id!),
    enabled: Boolean(id),
  });

export const useAdminUsers = (p: ListParams) =>
  useQuery({
    queryKey: qk.admin.users(p),
    queryFn: () => adminService.users({ ...p, limit: 20 }),
    placeholderData: keepPreviousData,
  });

export const useAdminTeams = (p: ListParams) =>
  useQuery({
    queryKey: qk.admin.teams(p),
    queryFn: () => adminService.teams({ ...p, limit: 20 }),
    placeholderData: keepPreviousData,
  });

export const useAdminReports = (p: ListParams) =>
  useQuery({
    queryKey: qk.admin.reports(p),
    queryFn: () => adminService.reports({ ...p, limit: 20 } as never),
    placeholderData: keepPreviousData,
  });

export const useAdminSports = () =>
  useQuery({ queryKey: qk.admin.sports, queryFn: adminService.sports });

/** Any admin write invalidates admin data + public tournament/sport caches. */
export function useAdminMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      void qc.invalidateQueries({ queryKey: qk.tournaments.all });
      void qc.invalidateQueries({ queryKey: qk.sports });
    },
  });
}
