import type {
  RegistrationDTO,
  TournamentDraftInput,
  TournamentDTO,
  TournamentQuery,
  TournamentStatus,
  ReportInput,
} from '@playlocal/shared';
import { cleanParams, del, get, getPage, patch, post } from './api';

export const tournamentService = {
  list: (query: TournamentQuery, signal?: AbortSignal) =>
    getPage<TournamentDTO>('/tournaments', { params: cleanParams(query), signal }),
  get: (id: string) => get<TournamentDTO>(`/tournaments/${id}`),
  createDraft: (body: TournamentDraftInput) => post<TournamentDTO>('/tournaments', body),
  update: (id: string, body: Partial<TournamentDraftInput>) =>
    patch<TournamentDTO>(`/tournaments/${id}`, body),
  submit: (id: string) => post<TournamentDTO>(`/tournaments/${id}/submit`),
  cancel: (id: string, reason: string) =>
    post<TournamentDTO>(`/tournaments/${id}/cancel`, { reason }),
  complete: (id: string) => post<TournamentDTO>(`/tournaments/${id}/complete`),
  remove: (id: string) => del<null>(`/tournaments/${id}`),
  report: (id: string, body: ReportInput) => post<null>(`/tournaments/${id}/report`, body),
  mine: (params: { status?: TournamentStatus | 'all'; page?: number; limit?: number }) =>
    getPage<TournamentDTO>('/me/tournaments', { params: cleanParams(params) }),
  registrations: (id: string, params: { status?: string } = {}) =>
    get<RegistrationDTO[]>(`/tournaments/${id}/registrations`, { params: cleanParams(params) }),
  myRegistrationsFor: (id: string) => get<RegistrationDTO[]>(`/tournaments/${id}/my-registrations`),
};
