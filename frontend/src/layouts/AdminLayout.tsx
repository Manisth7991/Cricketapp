import { useEffect, useState } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Trophy,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { adminService } from '@/services/adminService';
import { qk } from '@/lib/queryKeys';
import { Logo } from '@/components/layout/Logo';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { RequireAdmin } from '@/components/layout/Guards';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';

function useBadgeCounts() {
  return useQuery({
    queryKey: qk.admin.stats,
    queryFn: adminService.stats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useBadgeCounts();
  const items = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    {
      to: '/admin/verification',
      label: 'Verification',
      icon: ClipboardCheck,
      badge: data?.tournaments.pending_verification,
    },
    { to: '/admin/tournaments', label: 'Tournaments', icon: Trophy },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/teams', label: 'Teams', icon: UsersRound },
    { to: '/admin/reports', label: 'Reports', icon: Flag, badge: data?.reports.open },
    { to: '/admin/settings', label: 'Sports & settings', icon: Settings },
  ];
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <Icon className="size-5" aria-hidden />
          <span className="flex-1">{label}</span>
          {Boolean(badge) && (
            <span className="rounded-full bg-amber-400 px-2 text-xs font-bold text-ink tabular">
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4">
      <Avatar name={user?.name ?? 'Admin'} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/admin/login', { replace: true });
        }}
        className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label="Log out"
      >
        <LogOut className="size-5" />
      </button>
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-ink p-4">
      <div className="flex items-center justify-between">
        <Logo to="/admin" className="text-white [&_span]:text-white" suffix="Admin" />
        <span
          className="grid size-8 place-items-center rounded-lg bg-white/10 text-primary-300 lg:hidden"
          aria-hidden
        >
          <Shield className="size-4" />
        </span>
      </div>
      <Nav onNavigate={() => setOpen(false)} />
      <SidebarFooter />
    </div>
  );

  return (
    <RequireAdmin>
      <NavigationProgress />
      <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-2 grid size-11 place-items-center rounded-lg"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="size-5" />
          </button>
          <Logo to="/admin" suffix="Admin" />
          <span className="size-11" />
        </header>
        {open && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
          >
            <button
              type="button"
              className="absolute inset-0 bg-ink/50"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />
            <div className="relative h-full w-72 animate-[var(--animate-fade-in)]">
              {sidebar}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-3 grid size-9 place-items-center rounded-lg text-white"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        )}

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </RequireAdmin>
  );
}
