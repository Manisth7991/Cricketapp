import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { ToastProvider } from '@/context/ToastContext';
import { router } from '@/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
