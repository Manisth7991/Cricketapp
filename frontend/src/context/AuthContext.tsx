import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OtpCompleteInput, OtpVerifyInput, UserDTO } from '@playlocal/shared';
import { authService, type OtpVerifyResult } from '@/services/authService';
import { ApiClientError, onUnauthorized } from '@/services/api';
import { qk } from '@/lib/queryKeys';

interface AuthContextValue {
  user: UserDTO | null;
  isLoading: boolean;
  isAdmin: boolean;
  /** Phone OTP (users and admins alike): logs in existing numbers; returns a signup ticket for new ones. */
  verifyOtp: (input: OtpVerifyInput) => Promise<OtpVerifyResult>;
  completeSignup: (input: OtpCompleteInput) => Promise<UserDTO>;
  logout: () => Promise<void>;
  setUser: (user: UserDTO) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<UserDTO | null> {
  try {
    return await authService.session();
  } catch (e) {
    if (e instanceof ApiClientError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  // Session expired / revoked anywhere → drop user (guards redirect to login).
  useEffect(() => onUnauthorized(() => qc.setQueryData(qk.me, null)), [qc]);

  const value = useMemo<AuthContextValue>(() => {
    const setUser = (user: UserDTO) => qc.setQueryData(qk.me, user);
    const afterAuth = (user: UserDTO) => {
      // Different user → nothing cached for the previous one may leak through.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'sports' });
      setUser(user);
      return user;
    };
    return {
      user: data ?? null,
      isLoading,
      isAdmin: data?.role === 'admin',
      verifyOtp: async (input) => {
        const result = await authService.verifyOtp(input);
        if (result.status === 'logged_in') afterAuth(result.user);
        return result;
      },
      completeSignup: async (input) => afterAuth(await authService.completeSignup(input)),
      logout: async () => {
        await authService.logout().catch(() => undefined);
        qc.setQueryData(qk.me, null);
        qc.removeQueries({
          predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'sports',
        });
      },
      setUser,
    };
  }, [data, isLoading, qc]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
