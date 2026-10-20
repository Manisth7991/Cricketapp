import { Outlet, ScrollRestoration } from 'react-router';
import { Logo } from '@/components/layout/Logo';
import { NavigationProgress } from '@/components/layout/NavigationProgress';

export default function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <NavigationProgress />
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Outlet />
        </main>
      </div>
      <aside
        className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700 lg:block"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.18),transparent_45%),radial-gradient(circle_at_80%_80%,rgb(255_255_255/0.12),transparent_40%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="text-sm font-semibold tracking-widest text-primary-200 uppercase">
            Your ground. Your game.
          </p>
          <p className="mt-3 max-w-md text-4xl leading-tight font-bold">
            Find local tournaments and get your team on the field.
          </p>
          <p className="mt-4 max-w-md text-primary-100">
            Cricket, football, kabaddi, volleyball and more — from village grounds to district
            championships.
          </p>
        </div>
      </aside>
      <ScrollRestoration />
    </div>
  );
}
