import { Compass, Home, PlusCircle, Trophy, UserRound } from 'lucide-react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/layout/Logo';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { ButtonLink } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/create', label: 'Create', icon: PlusCircle },
  { to: '/activity', label: 'My Activity', icon: Trophy },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

function TopNav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-ink-soft hover:bg-slate-100 hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <NotificationBell />
              <NavLink
                to="/profile"
                className="hidden rounded-full p-1 hover:bg-slate-100 md:block"
                aria-label="Your profile"
              >
                <Avatar name={user.name} src={user.profileImage} size="sm" />
              </NavLink>
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" size="sm" className="hidden sm:inline-flex">
                Sign up
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-safe backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-primary-700' : 'text-ink-faint hover:text-ink-soft',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full transition-colors',
                      isActive && 'bg-primary-50',
                    )}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  </span>
                  {label === 'My Activity' ? 'Activity' : label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <NavigationProgress />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main" className="flex-1 pb-24 md:pb-12">
        <Outlet />
      </main>
      <footer className="hidden border-t border-line bg-white py-8 text-sm text-ink-soft md:block">
        <div className="container-page flex items-center justify-between">
          <p>© {new Date().getFullYear()} PlayLocal · Local tournaments, discovered.</p>
          <p>Entry fees are paid directly to organisers — PlayLocal never collects payments.</p>
        </div>
      </footer>
      <BottomNav />
      <ScrollRestoration />
    </div>
  );
}
