import type { RegistrationDTO, RegistrationInput, RegistrationStatus } from '@playlocal/shared';
import { cleanParams, getPage, patch, post } from './api';

export const registrationService = {
  register: (tournamentId: string, body: RegistrationInput) =>
    post<RegistrationDTO>(`/tournaments/${tournamentId}/register`, body),
  mine: (
    params: { status?: RegistrationStatus | 'active' | 'all'; page?: number; limit?: number } = {},
  ) => getPage<RegistrationDTO>('/me/registrations', { params: cleanParams(params) }),
  withdraw: (id: string) => patch<RegistrationDTO>(`/registrations/${id}/withdraw`),
  confirm: (id: string) => post<RegistrationDTO>(`/registrations/${id}/confirm`),
  decline: (id: string, reason?: string) =>
    post<RegistrationDTO>(`/registrations/${id}/decline`, { reason }),
};
