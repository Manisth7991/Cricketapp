import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/services/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        // Never retry client errors (4xx); retry network/5xx twice.
        if (err instanceof ApiClientError && err.status >= 400 && err.status < 500) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});
