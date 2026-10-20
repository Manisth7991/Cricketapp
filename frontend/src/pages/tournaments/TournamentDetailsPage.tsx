import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Flag,
  IndianRupee,
  MapPin,
  Navigation,
  Settings2,
  Share2,
  Timer,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TournamentDTO } from '@playlocal/shared';
import { useTournament } from '@/hooks/useTournaments';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { tournamentService } from '@/services/tournamentService';
import { qk } from '@/lib/queryKeys';
import { TournamentBanner } from '@/components/tournament/TournamentBanner';
import { ContactOrganiser } from '@/components/tournament/ContactOrganiser';
import {
  AvailabilityBadge,
  RegistrationStatusBadge,
  TournamentStatusBadge,
  VerifiedBadge,
} from '@/components/tournament/Badges';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState, InlineAlert } from '@/components/ui/States';
import { ApiClientError } from '@/services/api';
import {
  deadlineLabel,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDistance,
  formatMoney,
} from '@/utils/format';
import { distanceKm } from '@playlocal/shared';
import { useUserLocation } from '@/context/LocationContext';

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-3.5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary-700 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-soft">{label}</dt>
        <dd className="mt-0.5 text-[15px] font-semibold text-ink">{children}</dd>
      </div>
    </div>
  );
}

function RegisterCta({ t, compact }: { t: TournamentDTO; compact?: boolean }) {
  const { user } = useAuth();
  const isOwner = user?.id === t.organizerId;
  if (isOwner) {
    return (
      <ButtonLink
        to={`/my-tournaments/${t.id}`}
        fullWidth
        size="lg"
        variant="outline"
        leftIcon={<Settings2 className="size-5" />}
      >
        Manage tournament
      </ButtonLink>
    );
  }
  const registerTo = `/tournaments/${t.id}/register`;
  const href = user ? registerTo : `/login?next=${encodeURIComponent(registerTo)}`;
  switch (t.availability) {
    case 'open':
      return (
        <ButtonLink to={href} fullWidth size="lg">
          Register team
        </ButtonLink>
      );
    case 'waitlist':
      return (
        <ButtonLink to={href} fullWidth size="lg" variant="accent">
          Join waitlist
        </ButtonLink>
      );
    case 'full':
      return (
        <Button fullWidth size="lg" disabled>
          All {t.maxTeams} spots are filled
        </Button>
      );
    case 'closed':
      return (
        <Button fullWidth size="lg" disabled>
          Registration is closed
        </Button>
      );
    default:
      return compact ? null : (
        <Button fullWidth size="lg" disabled>
          Registration not open
        </Button>
      );
  }
}

function MyRegistrations({ tournamentId }: { tournamentId: string }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: qk.tournaments.myRegistrationsFor(tournamentId),
    queryFn: () => tournamentService.myRegistrationsFor(tournamentId),
    enabled: Boolean(user),
  });
  const active = (data ?? []).filter((r) => r.status !== 'withdrawn' && r.status !== 'cancelled');
  if (!active.length) return null;
  return (
    <div className="rounded-2xl bg-primary-50 p-4 ring-1 ring-primary-100">
      <p className="text-sm font-semibold text-primary-900">Your registrations</p>
      <ul className="mt-2 flex flex-col gap-2">
        {active.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.team?.name}</span>
            <RegistrationStatusBadge status={r.status} />
          </li>
        ))}
      </ul>
      <Link
        to="/activity/registrations"
        className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline"
      >
        View in My Activity →
      </Link>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="container-page py-6" aria-busy>
      <Skeleton className="aspect-[16/7] w-full rounded-3xl" />
      <Skeleton className="mt-6 h-8 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function TournamentDetailsPage() {
  const { id } = useParams();
  const { data: t, isLoading, isError, error, refetch } = useTournament(id);
  const { bySlug } = useSports();
  const { user } = useAuth();
  const { location } = useUserLocation();
  const toast = useToast();
  useDocumentTitle(t?.name ?? 'Tournament');

  if (isLoading) return <DetailsSkeleton />;
  if (isError || !t) {
    const notFound = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="container-page py-10">
        <div className="card">
          <ErrorState
            error={error}
            title={notFound ? 'Tournament not found' : undefined}
            onRetry={notFound ? undefined : () => void refetch()}
          />
        </div>
      </div>
    );
  }

  const isOwner = user?.id === t.organizerId;
  const sport = bySlug.get(t.sport);
  const coords = t.venue.coordinates;
  const dist =
    coords && location.coords ? formatDistance(distanceKm(location.coords, coords)) : undefined;
  const mapsUrl = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([t.venue.name, t.venue.address, t.venue.city, t.venue.state].filter(Boolean).join(', '))}`;

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: t!.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch {
      /* user dismissed share sheet */
    }
  }

  return (
    <div className="animate-[var(--animate-fade-in)] pb-24 md:pb-0">
      <div className="container-page pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-3xl">
          <TournamentBanner
            src={t.banner}
            sport={t.sport}
            sportIcon={sport?.icon}
            alt={`${t.name} banner`}
            aspect={16 / 7}
            sizes="(min-width: 1152px) 1120px, 100vw"
            priority
          />
          <button
            type="button"
            onClick={share}
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white"
            aria-label="Share tournament"
          >
            <Share2 className="size-5" />
          </button>
        </div>
      </div>

      <div className="container-page mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {/* Status notices for owner/admin views of non-public tournaments */}
          {t.status === 'pending_verification' && (
            <InlineAlert
              tone="amber"
              className="mb-5"
              title="This tournament is awaiting verification."
              icon={<Timer className="size-5" />}
            >
              It will be visible to everyone once our team approves it.
            </InlineAlert>
          )}
          {t.status === 'rejected' && (
            <InlineAlert
              className="mb-5"
              title="This tournament was not approved."
              icon={<AlertTriangle className="size-5" />}
            >
              {t.rejectionReason ?? 'Please update the details and resubmit.'}
            </InlineAlert>
          )}
          {t.status === 'suspended' && (
            <InlineAlert
              tone="amber"
              className="mb-5"
              title="This tournament is suspended."
              icon={<AlertTriangle className="size-5" />}
            >
              {t.suspensionReason}
            </InlineAlert>
          )}
          {t.status === 'cancelled' && (
            <InlineAlert
              className="mb-5"
              title="This tournament has been cancelled."
              icon={<AlertTriangle className="size-5" />}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink ring-1 ring-line">
              {sport?.icon} {sportLabel(bySlug, t.sport)}
            </span>
            {t.verified && <VerifiedBadge />}
            {t.status === 'published' ? (
              <AvailabilityBadge availability={t.availability} />
            ) : (
              <TournamentStatusBadge status={t.status} />
            )}
          </div>
          <h1 className="mt-3 text-[28px] leading-tight font-extrabold tracking-tight sm:text-4xl">
            {t.name}
          </h1>
          {t.organizer && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
              <UserRound className="size-4" aria-hidden /> Organised by{' '}
              <span className="font-semibold text-ink">{t.organizer.name}</span>
            </p>
          )}

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Fact icon={<CalendarDays className="size-5" />} label="Dates">
              {formatDateRange(t.startDate, t.endDate)}
            </Fact>
            <Fact icon={<Timer className="size-5" />} label="Registration deadline">
              {t.registrationDeadline ? formatDateTime(t.registrationDeadline) : '—'}
              {t.availability === 'open' && (
                <span className="block text-xs font-medium text-amber-700">
                  {deadlineLabel(t.registrationDeadline)}
                </span>
              )}
            </Fact>
            <Fact icon={<Trophy className="size-5" />} label="Prize money">
              {t.prizeMoney ? formatMoney(t.prizeMoney) : 'Trophies / no cash prize'}
            </Fact>
            <Fact icon={<IndianRupee className="size-5" />} label="Entry fee (paid to organiser)">
              {formatMoney(t.entryFee)}
            </Fact>
            <Fact icon={<Users className="size-5" />} label="Teams">
              {t.registeredCount} of {t.maxTeams ?? '—'} registered
              {t.waitlistCount > 0 && (
                <span className="block text-xs font-medium text-ink-soft">
                  {t.waitlistCount} on waitlist
                </span>
              )}
            </Fact>
            <Fact icon={<MapPin className="size-5" />} label="Venue">
              {t.venue.name ?? 'TBA'}
              <span className="block text-xs font-medium text-ink-soft">
                {[t.venue.address, t.venue.city, t.venue.state].filter(Boolean).join(', ')}
                {dist && ` · ${dist}`}
              </span>
            </Fact>
          </dl>

          {t.prizeDetails && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Prizes</h2>
              <p className="mt-2 text-ink-soft">{t.prizeDetails}</p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-bold">About this tournament</h2>
            <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-soft">
              {t.description || 'No description provided.'}
            </p>
          </section>

          {t.rules.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ClipboardList className="size-5 text-primary-700" aria-hidden /> Rules
              </h2>
              <ol className="mt-3 flex flex-col gap-2">
                {t.rules.map((r, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl bg-white p-3 text-[15px] ring-1 ring-line/70"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-50 text-xs font-bold text-primary-800 tabular">
                      {i + 1}
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-bold">Getting there</h2>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-accent-700 ring-1 ring-line hover:bg-accent-50"
            >
              <Navigation className="size-4" aria-hidden /> Open venue in Google Maps
            </a>
          </section>

          <p className="mt-8 rounded-2xl bg-surface p-4 text-xs text-ink-soft ring-1 ring-line/60">
            PlayLocal does not collect entry fees or prize money. Contact the organiser for payment
            details. Verified means our team reviewed this listing — always confirm details with the
            organiser.
          </p>

          {!isOwner && t.status === 'published' && (
            <Link
              to={
                user
                  ? `/tournaments/${t.id}/report`
                  : `/login?next=${encodeURIComponent(`/tournaments/${t.id}/report`)}`
              }
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-red-700"
            >
              <Flag className="size-4" aria-hidden /> Report incorrect or suspicious tournament
            </Link>
          )}
        </div>

        {/* Desktop sticky CTA */}
        <aside className="hidden lg:block">
          <div className="card sticky top-24 flex flex-col gap-4 p-5">
            <div>
              <p className="text-sm text-ink-soft">Starts</p>
              <p className="text-lg font-bold">{formatDate(t.startDate)}</p>
            </div>
            <RegisterCta t={t} />
            <ContactOrganiser t={t} />
            <MyRegistrations tournamentId={t.id} />
          </div>
        </aside>
      </div>

      {/* Mobile CTA */}
      <div className="lg:hidden">
        <div className="container-page mt-6">
          <MyRegistrations tournamentId={t.id} />
        </div>
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-white/95 p-3 backdrop-blur-md md:bottom-0">
          <div className="mx-auto flex max-w-md items-center gap-2">
            <div className="min-w-0 flex-1">
              <RegisterCta t={t} compact />
            </div>
            <ContactOrganiser t={t} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
