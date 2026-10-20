import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/layout/Logo';

/** Catches render errors and failed lazy chunk loads (e.g. after a deploy). */
export default function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const chunkFailed =
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed/i.test(error.message);

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-6 text-2xl font-bold">
          {notFound
            ? 'Page not found'
            : chunkFailed
              ? 'A new version is available'
              : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-ink-soft">
          {notFound
            ? "The page you're looking for doesn't exist or has moved."
            : chunkFailed
              ? 'Reload the page to get the latest version of PlayLocal.'
              : 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {chunkFailed ? (
            <button
              className="h-11 rounded-xl bg-primary-700 px-5 font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          ) : (
            <ButtonLink to="/">Go home</ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
