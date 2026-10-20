import { useQuery } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { qk } from '@/lib/queryKeys';
import { config } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';

/** Polls the unread count only while the tab is visible (TanStack pauses in background). */
export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: notificationService.unreadCount,
    enabled: Boolean(user),
    refetchInterval: config.notificationPollMs,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}
