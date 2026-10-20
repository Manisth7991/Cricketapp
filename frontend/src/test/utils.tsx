import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { ToastProvider } from '@/context/ToastContext';

/** Render a page inside the real providers + an in-memory router. */
export function renderRoute(
  element: ReactElement,
  opts: { path: string; url: string; extraRoutes?: RouteObject[] },
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: opts.path, element }, ...(opts.extraRoutes ?? [])], {
    initialEntries: [opts.url],
  });
  const utils = render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <LocationProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, qc };
}
