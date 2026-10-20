import { useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BadgeCheck,
  CheckCheck,
  CircleX,
  Flag,
  Hourglass,
  Megaphone,
  Users,
} from 'lucide-react';
import type { NotificationDTO, NotificationType } from '@playlocal/shared';
import { notificationService } from '@/services/notificationService';
import { qk } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

const ICONS: Partial<Record<NotificationType, { icon: typeof Bell; tone: string }>> = {
  tournament_approved: { icon: BadgeCheck, tone: 'bg-primary-50 text-primary-700' },
  tournament_rejected: { icon: CircleX, tone: 'bg-red-50 text-red-600' },
  tournament_suspended: { icon: CircleX, tone: 'bg-orange-50 text-orange-700' },
  tournament_cancelled: { icon: CircleX, tone: 'bg-red-50 text-red-600' },
  registration_received: { icon: Users, tone: 'bg-accent-50 text-accent-700' },
  registration_confirmed: { icon: BadgeCheck, tone: 'bg-primary-50 text-primary-700' },
  registration_declined: { icon: CircleX, tone: 'bg-red-50 text-red-600' },
  registration_promoted: { icon: Hourglass, tone: 'bg-accent-50 text-accent-700' },
  report_updated: { icon: Flag, tone: 'bg-slate-100 text-slate-700' },
};

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.notifications.list(page),
    queryFn: () => notificationService.list(page),
    placeholderData: keepPreviousData,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.notifications.all });
  const markAll = useMutation({ mutationFn: notificationService.markAllRead, onSuccess: refresh });
  const markOne = useMutation({ mutationFn: notificationService.markRead, onSuccess: refresh });
  const hasUnread = data?.items.some((n) => !n.read);

  function open(n: NotificationDTO) {
    if (!n.read) markOne.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <PageHeader
        title="Notifications"
        back="/activity"
        actions={
          hasUnread && (
            <Button
              size="sm"
              variant="ghost"
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
              leftIcon={<CheckCheck className="size-4" />}
            >
              Mark all read
            </Button>
          )
        }
      />
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="card">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState
            icon={<Bell className="size-7" />}
            title="No notifications yet"
            description="Updates about your registrations and tournaments will appear here."
          />
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-line overflow-hidden">
            {data.items.map((n) => {
              const meta = ICONS[n.type] ?? {
                icon: Megaphone,
                tone: 'bg-slate-100 text-slate-700',
              };
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      'flex w-full gap-3 p-4 text-left transition-colors hover:bg-slate-50',
                      !n.read && 'bg-primary-50/40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-full',
                        meta.tone,
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn('text-sm', n.read ? 'font-medium' : 'font-bold')}>
                          {n.title}
                        </span>
                        <span className="shrink-0 text-xs text-ink-faint">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-soft">{n.message}</span>
                    </span>
                    {!n.read && (
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary-600"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination meta={data.meta} onPage={(p) => setParams({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
