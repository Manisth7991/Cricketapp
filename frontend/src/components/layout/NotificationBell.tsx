import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import { useUnreadCount } from '@/hooks/useNotifications';
import { cn } from '@/utils/cn';

export function NotificationBell({ className }: { className?: string }) {
  const { data: count = 0 } = useUnreadCount();
  return (
    <Link
      to="/notifications"
      className={cn(
        'relative grid size-11 place-items-center rounded-full text-ink-soft hover:bg-slate-100 hover:text-ink',
        className,
      )}
      aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 grid min-w-4.5 place-items-center rounded-full bg-red-600 px-1 text-[10px] leading-4.5 font-bold text-white ring-2 ring-white tabular">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
