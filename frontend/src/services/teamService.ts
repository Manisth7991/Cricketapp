import type { PlayerInput, TeamDTO, TeamInput } from '@playlocal/shared';
import { del, get, patch, post } from './api';

export const teamService = {
  list: (params: { sport?: string } = {}) => get<TeamDTO[]>('/teams', { params }),
  get: (id: string) => get<TeamDTO>(`/teams/${id}`),
  create: (body: TeamInput) => post<TeamDTO>('/teams', body),
  update: (id: string, body: Partial<TeamInput>) => patch<TeamDTO>(`/teams/${id}`, body),
  remove: (id: string) => del<null>(`/teams/${id}`),
  addPlayer: (teamId: string, body: PlayerInput) => post<TeamDTO>(`/teams/${teamId}/players`, body),
  updatePlayer: (teamId: string, playerId: string, body: PlayerInput) =>
    patch<TeamDTO>(`/teams/${teamId}/players/${playerId}`, body),
  removePlayer: (teamId: string, playerId: string) =>
    del<TeamDTO>(`/teams/${teamId}/players/${playerId}`),
};
