import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import AppLayout from '@/layouts/AppLayout';
import RouteError from '@/pages/RouteError';
import { RequireAuth, GuestOnly } from '@/components/layout/Guards';
import { LogoMark } from '@/components/layout/Logo';

function HydrateFallback() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading PlayLocal">
      <LogoMark className="size-12 animate-pulse" />
    </div>
  );
}

/**
 * Every page is a lazily-loaded chunk: users only download the code for the
 * screens they actually visit (admin code never ships to normal users).
 */
type PageModule = { default: ComponentType };
const page = (load: () => Promise<PageModule>) => async () => ({
  Component: (await load()).default,
});

const authed = (load: () => Promise<PageModule>) => async () => {
  const Component = (await load()).default;
  return {
    Component: () => (
      <RequireAuth>
        <Component />
      </RequireAuth>
    ),
  };
};

const guest = (load: () => Promise<PageModule>) => async () => {
  const Component = (await load()).default;
  return {
    Component: () => (
      <GuestOnly>
        <Component />
      </GuestOnly>
    ),
  };
};

const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    errorElement: <RouteError />,
    HydrateFallback,
    children: [
      { index: true, lazy: page(() => import('@/pages/HomePage')) },
      { path: 'explore', lazy: page(() => import('@/pages/tournaments/ExplorePage')) },
      {
        path: 'tournaments/:id',
        lazy: page(() => import('@/pages/tournaments/TournamentDetailsPage')),
      },
      {
        path: 'tournaments/:id/register',
        lazy: authed(() => import('@/pages/tournaments/RegisterTeamPage')),
      },
      {
        path: 'tournaments/:id/register/success',
        lazy: authed(() => import('@/pages/tournaments/RegistrationSuccessPage')),
      },
      { path: 'activity', lazy: authed(() => import('@/pages/activity/MyActivityPage')) },
      {
        path: 'activity/registrations',
        lazy: authed(() => import('@/pages/activity/MyRegistrationsPage')),
      },
      { path: 'create', lazy: authed(() => import('@/pages/create/CreateHubPage')) },
      {
        path: 'create/tournament',
        lazy: authed(() => import('@/pages/create/TournamentEditorPage')),
      },
      {
        path: 'tournaments/:id/edit/:step?',
        lazy: authed(() => import('@/pages/create/TournamentEditorPage')),
      },
      {
        path: 'tournaments/:id/submitted',
        lazy: authed(() => import('@/pages/create/TournamentSubmittedPage')),
      },
      { path: 'my-tournaments', lazy: authed(() => import('@/pages/organizer/MyTournamentsPage')) },
      {
        path: 'my-tournaments/:id',
        lazy: authed(() => import('@/pages/organizer/ManageTournamentPage')),
      },
      {
        path: 'tournaments/:id/report',
        lazy: authed(() => import('@/pages/tournaments/ReportTournamentPage')),
      },
      { path: 'notifications', lazy: authed(() => import('@/pages/account/NotificationsPage')) },
      { path: 'profile', lazy: page(() => import('@/pages/account/ProfilePage')) },
      { path: 'settings', lazy: authed(() => import('@/pages/account/SettingsPage')) },
      { path: 'teams', lazy: authed(() => import('@/pages/teams/MyTeamsPage')) },
      { path: 'teams/new', lazy: authed(() => import('@/pages/teams/TeamFormPage')) },
      { path: 'teams/:id', lazy: authed(() => import('@/pages/teams/TeamDetailsPage')) },
      { path: 'teams/:id/edit', lazy: authed(() => import('@/pages/teams/TeamFormPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
  {
    lazy: page(() => import('@/layouts/AuthLayout')),
    errorElement: <RouteError />,
    HydrateFallback,
    children: [
      { path: 'login', lazy: guest(() => import('@/pages/auth/LoginPage')) },
      {
        path: 'signup',
        lazy: async () => {
          const LoginPage = (await import('@/pages/auth/LoginPage')).default;
          return {
            Component: () => (
              <GuestOnly>
                <LoginPage mode="signup" />
              </GuestOnly>
            ),
          };
        },
      },
      { path: 'location', lazy: page(() => import('@/pages/auth/LocationPage')) },
    ],
  },
  {
    // Admins use the same phone-OTP login as everyone else; the old URL keeps working.
    path: '/admin/login',
    element: <Navigate to="/login?next=%2Fadmin" replace />,
    errorElement: <RouteError />,
  },
  {
    path: '/admin',
    lazy: page(() => import('@/layouts/AdminLayout')),
    errorElement: <RouteError />,
    HydrateFallback,
    children: [
      { index: true, lazy: page(() => import('@/pages/admin/AdminDashboardPage')) },
      {
        path: 'verification',
        lazy: async () => ({
          Component: (await import('@/pages/admin/AdminTournamentsPage')).AdminVerificationPage,
        }),
      },
      { path: 'tournaments', lazy: page(() => import('@/pages/admin/AdminTournamentsPage')) },
      {
        path: 'tournaments/:id',
        lazy: page(() => import('@/pages/admin/AdminTournamentDetailPage')),
      },
      { path: 'users', lazy: page(() => import('@/pages/admin/AdminUsersPage')) },
      { path: 'teams', lazy: page(() => import('@/pages/admin/AdminTeamsPage')) },
      { path: 'reports', lazy: page(() => import('@/pages/admin/AdminReportsPage')) },
      { path: 'settings', lazy: page(() => import('@/pages/admin/AdminSettingsPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
];

export const router = createBrowserRouter(routes);
