import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  Megaphone,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { TournamentQuery } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { useUserLocation } from '@/context/LocationContext';
import { useSports } from '@/hooks/useSports';
import { useTournamentList } from '@/hooks/useTournaments';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  TournamentCard,
  TournamentGrid,
  TournamentGridSkeleton,
} from '@/components/tournament/TournamentCard';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';

function Section({
  title,
  subtitle,
  href,
  query,
  emptyTitle,
  emptyText,
  priority,
}: {
  title: string;
  subtitle?: string;
  href: string;
  query: TournamentQuery;
  emptyTitle: string;
  emptyText: string;
  priority?: boolean;
}) {
  const { data, isLoading, isError, error, refetch } = useTournamentList(query);
  return (
    <section className="mt-10" aria-labelledby={`${title}-h`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id={`${title}-h`} className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        <Link
          to={href}
          className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          See all <ArrowRight className="size-4" />
        </Link>
      </div>
      {isLoading ? (
        <TournamentGridSkeleton count={3} />
      ) : isError ? (
        <div className="card">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState
            title={emptyTitle}
            description={emptyText}
            action={
              <ButtonLink to="/explore" variant="outline">
                Explore all tournaments
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <TournamentGrid>
          {data.items.map((t, i) => (
            <TournamentCard key={t.id} tournament={t} priority={priority && i === 0} />
          ))}
        </TournamentGrid>
      )}
    </section>
  );
}

export default function HomePage() {
  useDocumentTitle();
  const { user } = useAuth();
  const { location } = useUserLocation();
  const { sports } = useSports();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const coords = location.coords;
  const nearQuery: TournamentQuery = coords
    ? { lat: coords.lat, lng: coords.lng, sort: 'nearest', radiusKm: 200, limit: 6 }
    : location.state
      ? { state: location.state, limit: 6 }
      : { limit: 6 };
  const nearHref = coords
    ? '/explore?sort=nearest'
    : location.state
      ? `/explore?state=${encodeURIComponent(location.state)}`
      : '/explore';

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/explore${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
  };

  const placeName = location.city || location.state;

  return (
    <div className="animate-[var(--animate-fade-in)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-accent-700 text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgb(255_255_255/0.16),transparent_40%),radial-gradient(circle_at_0%_100%,rgb(255_255_255/0.1),transparent_45%)]"
          aria-hidden
        />
        <div className="relative container-page pt-8 pb-10 sm:pt-12 sm:pb-14">
          <Link
            to={`/location?next=/`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm hover:bg-white/25"
          >
            <MapPin className="size-4" aria-hidden />
            {placeName
              ? `${placeName}${location.city && location.state ? `, ${location.state}` : ''}`
              : 'Set your location'}
          </Link>
          <h1 className="mt-4 max-w-2xl text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            {user
              ? `Ready to play, ${user.name.split(' ')[0]}?`
              : 'Find local tournaments near you'}
          </h1>
          <p className="mt-3 max-w-xl text-primary-100 sm:text-lg">
            Village leagues, school cups and district championships — discover them in one place and
            register your team in minutes.
          </p>
          <form
            onSubmit={onSearch}
            role="search"
            className="mt-6 flex max-w-xl gap-2 rounded-2xl bg-white p-1.5 shadow-[var(--shadow-lift)]"
          >
            <label htmlFor="home-search" className="sr-only">
              Search tournaments
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <input
                id="home-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tournament, city or venue"
                className="h-11 w-full rounded-xl pr-3 pl-10 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
                enterKeyHint="search"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-xl bg-primary-700 px-5 font-semibold text-white hover:bg-primary-800"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="container-page">
        {/* Sports */}
        {sports.length > 0 && (
          <nav
            aria-label="Browse by sport"
            className="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {sports.map((s) => (
              <Link
                key={s.slug}
                to={`/explore?sport=${s.slug}`}
                className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-sm ring-1 ring-line/70 hover:ring-primary-300"
              >
                <span aria-hidden>{s.icon}</span>
                {s.name}
              </Link>
            ))}
          </nav>
        )}

        <Section
          title={placeName ? `Near ${location.city || location.state}` : 'Upcoming tournaments'}
          subtitle={
            coords
              ? 'Sorted by distance from you'
              : placeName
                ? `Tournaments in ${location.state}`
                : 'Set your location to see what is nearby'
          }
          href={nearHref}
          query={nearQuery}
          emptyTitle="No tournaments nearby yet"
          emptyText="Try exploring other districts — or host the first one in your area."
          priority
        />

        <Section
          title="Registration open"
          subtitle="Grab a spot before the deadline"
          href="/explore?status=open"
          query={{ status: 'open', limit: 3 }}
          emptyTitle="No open registrations right now"
          emptyText="New tournaments are verified every day. Check back soon."
        />

        {/* How it works / host CTA */}
        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="How PlayLocal works">
          {[
            {
              icon: Users,
              title: 'Build your team',
              text: 'Create a team, add your players once and reuse it for every tournament.',
            },
            {
              icon: BadgeCheck,
              title: 'Only verified events',
              text: 'Every tournament is reviewed by our team before it gets the Verified badge.',
            },
            {
              icon: ShieldCheck,
              title: 'No payments here',
              text: 'Entry fees are shown for information and settled directly with the organiser.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5">
              <div className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-700">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{text}</p>
            </div>
          ))}
        </section>

        <section className="card mt-6 flex flex-col items-start gap-4 bg-gradient-to-r from-accent-50 to-primary-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex gap-4">
            <div className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-white text-accent-700 shadow-sm sm:grid">
              <Megaphone className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold">Organising a tournament?</h2>
              <p className="mt-1 text-sm text-ink-soft">
                List it for free and reach teams beyond your WhatsApp groups.
              </p>
            </div>
          </div>
          <ButtonLink to="/create/tournament" variant="accent">
            Host a tournament
          </ButtonLink>
        </section>
      </div>
    </div>
  );
}
