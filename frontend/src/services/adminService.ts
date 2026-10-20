import type {
  AdminStatsDTO,
  ReportDTO,
  ReportStatus,
  SportDTO,
  SportInput,
  TeamDTO,
  TournamentDTO,
  TournamentStatus,
  UserDTO,
  UserStatus,
} from '@playlocal/shared';
import { cleanParams, get, getPage, patch, post } from './api';

type ListParams = { page?: number; limit?: number; search?: string; status?: string };

export const adminService = {
  stats: () => get<AdminStatsDTO>('/admin/stats'),
  tournaments: (params: ListParams & { status?: TournamentStatus | 'all' }) =>
    getPage<TournamentDTO>('/admin/tournaments', { params: cleanParams(params) }),
  tournament: (id: string) => get<TournamentDTO>(`/admin/tournaments/${id}`),
  approve: (id: string) => post<TournamentDTO>(`/admin/tournaments/${id}/approve`),
  reject: (id: string, reason: string) =>
    post<TournamentDTO>(`/admin/tournaments/${id}/reject`, { reason }),
  suspend: (id: string, reason: string) =>
    post<TournamentDTO>(`/admin/tournaments/${id}/suspend`, { reason }),
  reinstate: (id: string) => post<TournamentDTO>(`/admin/tournaments/${id}/reinstate`),
  users: (params: ListParams) =>
    getPage<UserDTO & { teamCount?: number; tournamentCount?: number }>('/admin/users', {
      params: cleanParams(params),
    }),
  setUserStatus: (id: string, status: UserStatus) =>
    patch<UserDTO>(`/admin/users/${id}/status`, { status }),
  teams: (params: ListParams) => getPage<TeamDTO>('/admin/teams', { params: cleanParams(params) }),
  reports: (params: ListParams & { status?: ReportStatus | 'all' }) =>
    getPage<ReportDTO>('/admin/reports', { params: cleanParams(params) }),
  updateReport: (id: string, body: { status: ReportStatus; resolutionNote?: string }) =>
    patch<ReportDTO>(`/admin/reports/${id}`, body),
  sports: () => get<SportDTO[]>('/admin/sports'),
  createSport: (body: SportInput) => post<SportDTO>('/admin/sports', body),
  updateSport: (id: string, body: Partial<SportInput>) =>
    patch<SportDTO>(`/admin/sports/${id}`, body),
};
