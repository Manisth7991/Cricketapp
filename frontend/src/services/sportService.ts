import type { SportDTO } from '@playlocal/shared';
import { get } from './api';

export const sportService = {
  list: () => get<SportDTO[]>('/sports'),
};
