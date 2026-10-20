import { useParams } from 'react-router';
import { BadgeCheck, Clock, Send } from 'lucide-react';
import { useTournament } from '@/hooks/useTournaments';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ButtonLink } from '@/components/ui/Button';

export default function TournamentSubmittedPage() {
  useDocumentTitle('Submitted for verification');
  const { id } = useParams();
  const { data: t } = useTournament(id);
  const steps = [
    {
      icon: Send,
      title: 'Submitted for Verification',
      text: 'We received your tournament details.',
      done: true,
    },
    {
      icon: Clock,
      title: 'Under review',
      text: 'Our team checks the details — usually within 24 hours.',
      done: false,
    },
    {
      icon: BadgeCheck,
      title: 'Live with Verified badge',
      text: 'Teams nearby can discover and register.',
      done: false,
    },
  ];
  return (
    <div className="container-page max-w-lg py-12">
      <div className="text-center">
        <div className="mx-auto grid size-20 animate-[var(--animate-slide-up)] place-items-center rounded-full bg-amber-50 text-amber-600">
          <Clock className="size-10" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Submitted for Verification
        </h1>
        <p className="mt-3 text-ink-soft">
          <span className="font-semibold text-ink">{t?.name ?? 'Your tournament'}</span> is awaiting
          verification. We'll notify you as soon as it's reviewed.
        </p>
      </div>
      <ol className="card mt-8 flex flex-col gap-4 p-5">
        {steps.map(({ icon: Icon, title, text, done }) => (
          <li key={title} className="flex gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? 'bg-primary-700 text-white' : 'bg-slate-100 text-ink-soft'}`}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-ink-soft">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink to="/my-tournaments">Go to My Tournaments</ButtonLink>
        <ButtonLink to={`/tournaments/${id}`} variant="outline">
          Preview listing
        </ButtonLink>
      </div>
    </div>
  );
}
