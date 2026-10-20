import type { NotificationDTO } from '@playlocal/shared';
import { get, getPage, patch, post } from './api';

export const notificationService = {
  list: (page = 1) => getPage<NotificationDTO>('/notifications', { params: { page, limit: 20 } }),
  unreadCount: () => get<{ count: number }>('/notifications/unread-count').then((d) => d.count),
  markRead: (id: string) => patch<null>(`/notifications/${id}/read`),
  markAllRead: () => post<null>('/notifications/read-all'),
};
