import { useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, LoadingState } from '@/components/ui/States';

/** Frontend guards are UX only — the API enforces every permission. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function NotAuthorised() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        icon={<ShieldOff className="size-7" />}
        title="Admin access only"
        description="This area is for PlayLocal staff. You're signed in with a regular account."
        action={<ButtonLink to="/">Back to PlayLocal</ButtonLink>}
      />
    </div>
  );
}

/**
 * Guests are sent to the shared phone-OTP login (and come back here afterwards). Signed-in
 * non-admins get a clear "not authorised" screen instead of a redirect loop.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState className="min-h-dvh" />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (user.role !== 'admin') return <NotAuthorised />;
  return children;
}

/**
 * Redirects users who are *already* logged in when they open login/signup.
 * Once the form has been shown, the page owns post-auth navigation (e.g. signup → location).
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const shownAsGuest = useRef(false);
  if (!shownAsGuest.current) {
    if (isLoading) return <LoadingState />;
    if (user) {
      const next = new URLSearchParams(location.search).get('next');
      return <Navigate to={safeNext(next, user.role === 'admin' ? '/admin' : '/')} replace />;
    }
    shownAsGuest.current = true;
  }
  return children;
}

/** Only allow same-app relative redirects (prevents open-redirects via ?next=). */
export function safeNext(next: string | null, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
