import { Link, Navigate, useLocation, useParams } from 'react-router';
import { CheckCircle2, Hourglass } from 'lucide-react';
import type { RegistrationDTO } from '@playlocal/shared';
import { ButtonLink } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function RegistrationSuccessPage() {
  useDocumentTitle('Registration submitted');
  const { id } = useParams();
  const state = useLocation().state as {
    registration?: RegistrationDTO;
    tournamentName?: string;
  } | null;
  const reg = state?.registration;
  if (!reg) return <Navigate to={`/tournaments/${id}`} replace />;

  const waitlisted = reg.status === 'waitlisted';
  const Icon = waitlisted ? Hourglass : CheckCircle2;

  return (
    <div className="container-page max-w-lg py-12 text-center">
      <div
        className={`mx-auto grid size-20 place-items-center rounded-full ${waitlisted ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-600'} animate-[var(--animate-slide-up)]`}
      >
        <Icon className="size-10" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {waitlisted ? "You're on the waitlist" : 'Registration submitted!'}
      </h1>
      <p className="mt-3 text-ink-soft">
        <span className="font-semibold text-ink">{reg.team?.name}</span>{' '}
        {waitlisted ? 'joined the waitlist for' : 'is registered for'}{' '}
        <span className="font-semibold text-ink">{state?.tournamentName}</span>.
      </p>

      <div className="card mt-8 p-5 text-left">
        <h2 className="font-semibold">What happens next?</h2>
        <ol className="mt-3 flex flex-col gap-3 text-sm text-ink-soft">
          {waitlisted ? (
            <>
              <li>
                1. You are{' '}
                <span className="font-semibold text-ink">#{reg.waitlistPosition ?? '—'}</span> on
                the waitlist.
              </li>
              <li>2. If a team withdraws, you move up automatically and we'll notify you.</li>
              <li>3. The organiser then confirms your spot.</li>
            </>
          ) : (
            <>
              <li>1. The organiser reviews your registration and confirms it.</li>
              <li>2. You'll get a notification when it's confirmed.</li>
              <li>
                3. Settle the entry fee directly with the organiser — PlayLocal never collects
                payments.
              </li>
            </>
          )}
        </ol>
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink to="/activity/registrations">View my registrations</ButtonLink>
        <ButtonLink to={`/tournaments/${id}`} variant="outline">
          Back to tournament
        </ButtonLink>
      </div>
      <Link
        to="/explore"
        className="mt-6 inline-block text-sm font-semibold text-primary-700 hover:underline"
      >
        Explore more tournaments
      </Link>
    </div>
  );
}
