import { Link } from 'react-router';
import { ChevronRight, Megaphone, Users } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';

const OPTIONS = [
  {
    to: '/create/tournament',
    icon: Megaphone,
    title: 'Host a tournament',
    text: 'List your tournament for free. Our team verifies it before it goes live with a Verified badge.',
    tone: 'bg-accent-50 text-accent-700',
  },
  {
    to: '/teams/new',
    icon: Users,
    title: 'Create a team',
    text: 'Add your players once and register for any tournament in a couple of taps.',
    tone: 'bg-primary-50 text-primary-700',
  },
];

export default function CreateHubPage() {
  useDocumentTitle('Create');
  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <PageHeader title="What would you like to create?" />
      <div className="flex flex-col gap-3">
        {OPTIONS.map(({ to, icon: Icon, title, text, tone }) => (
          <Link
            key={to}
            to={to}
            className="card group flex items-center gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
          >
            <div className={`grid size-14 shrink-0 place-items-center rounded-2xl ${tone}`}>
              <Icon className="size-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{text}</p>
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
