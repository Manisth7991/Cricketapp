import { useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/States';

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

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState className="min-h-dvh" />;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
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
      return <Navigate to={safeNext(next)} replace />;
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
