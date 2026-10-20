import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, BadgeCheck, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { tournamentSchema, type TournamentDTO } from '@playlocal/shared';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { useSports, sportLabel } from '@/hooks/useSports';
import { ApiClientError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { TournamentBanner } from '@/components/tournament/TournamentBanner';
import { formatDateRange, formatDateTime, formatMoney, toDateInput } from '@/utils/format';
import type { StepKey } from './shared';

const FIELD_STEP: Record<string, StepKey> = {
  name: 'basic',
  sport: 'basic',
  description: 'basic',
  banner: 'basic',
  venue: 'location',
  startDate: 'schedule',
  endDate: 'schedule',
  registrationDeadline: 'schedule',
  maxTeams: 'schedule',
  entryFee: 'rules',
  prizeMoney: 'rules',
  rules: 'rules',
};

function toInput(t: TournamentDTO) {
  return {
    name: t.name,
    sport: t.sport,
    banner: t.banner,
    description: t.description ?? '',
    venue: {
      name: t.venue.name,
      address: t.venue.address,
      city: t.venue.city,
      state: t.venue.state,
      coordinates: t.venue.coordinates,
    },
    startDate: t.startDate,
    endDate: t.endDate,
    registrationDeadline: toDateInput(t.registrationDeadline),
    maxTeams: t.maxTeams,
    allowWaitlist: t.allowWaitlist,
    entryFee: t.entryFee,
    prizeMoney: t.prizeMoney,
    prizeDetails: t.prizeDetails,
    rules: t.rules,
  };
}

function Section({
  title,
  step,
  id,
  children,
}: {
  title: string;
  step: StepKey;
  id: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Link
          to={`/tournaments/${id}/edit/${step}`}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          <Pencil className="size-3.5" aria-hidden /> Edit
        </Link>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <dt className="text-ink-soft">{label}</dt>
    <dd className="font-medium text-ink">
      {value || <span className="text-red-600">Missing</span>}
    </dd>
  </div>
);

export function ReviewStep({
  tournament: t,
  onBack,
}: {
  tournament: TournamentDTO;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { bySlug } = useSports();
  const { submit } = useTournamentMutations();
  const [serverErrors, setServerErrors] = useState<{ path: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const issues = useMemo(() => {
    const r = tournamentSchema.safeParse(toInput(t));
    return r.success
      ? []
      : r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  }, [t]);
  const allIssues = serverErrors.length ? serverErrors : issues;
  const submittable = t.status === 'draft' || t.status === 'rejected';

  async function onSubmit() {
    setError(null);
    setServerErrors([]);
    try {
      await submit.mutateAsync(t.id);
      navigate(`/tournaments/${t.id}/submitted`, { replace: true });
    } catch (e) {
      if (e instanceof ApiClientError && e.fieldErrors.length) setServerErrors(e.fieldErrors);
      setError(errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card overflow-hidden">
        <TournamentBanner
          src={t.banner}
          sport={t.sport}
          alt=""
          sizes="(min-width: 768px) 672px, 100vw"
          aspect={16 / 6}
        />
        <div className="p-5">
          <p className="text-sm font-medium text-ink-soft">
            {bySlug.get(t.sport)?.icon} {sportLabel(bySlug, t.sport)}
          </p>
          <h2 className="mt-1 text-xl font-bold">{t.name}</h2>
        </div>
      </div>

      {allIssues.length > 0 && (
        <InlineAlert
          tone="amber"
          icon={<AlertTriangle className="size-5" />}
          title="A few details are still missing"
        >
          <ul className="mt-1 list-disc pl-4">
            {allIssues.slice(0, 6).map((i) => {
              const step = FIELD_STEP[i.path.split('.')[0]!] ?? 'basic';
              return (
                <li key={i.path + i.message}>
                  <Link to={`/tournaments/${t.id}/edit/${step}`} className="underline">
                    {i.message}
                  </Link>
                </li>
              );
            })}
          </ul>
        </InlineAlert>
      )}

      <Section title="Basics" step="basic" id={t.id}>
        <Row label="Name" value={t.name} />
        <Row label="Sport" value={sportLabel(bySlug, t.sport)} />
        <div className="sm:col-span-2">
          <dt className="text-ink-soft">Description</dt>
          <dd className="line-clamp-3 font-medium whitespace-pre-line">
            {t.description || <span className="text-red-600">Missing</span>}
          </dd>
        </div>
      </Section>
      <Section title="Location" step="location" id={t.id}>
        <Row label="Venue" value={t.venue.name} />
        <Row label="Address" value={t.venue.address} />
        <Row label="Village / City" value={t.venue.city} />
        <Row label="State" value={t.venue.state} />
      </Section>
      <Section title="Schedule" step="schedule" id={t.id}>
        <Row label="Dates" value={t.startDate && formatDateRange(t.startDate, t.endDate)} />
        <Row
          label="Registration deadline"
          value={t.registrationDeadline && formatDateTime(t.registrationDeadline)}
        />
        <Row label="Maximum teams" value={t.maxTeams} />
        <Row label="Waitlist" value={t.allowWaitlist ? 'Allowed' : 'Not allowed'} />
      </Section>
      <Section title="Fees, prizes & rules" step="rules" id={t.id}>
        <Row label="Entry fee" value={formatMoney(t.entryFee)} />
        <Row
          label="Prize money"
          value={t.prizeMoney ? formatMoney(t.prizeMoney) : 'Trophies only'}
        />
        <Row label="Rules" value={`${t.rules.length} rule${t.rules.length === 1 ? '' : 's'}`} />
      </Section>

      {error && !serverErrors.length && <InlineAlert>{error}</InlineAlert>}

      {submittable ? (
        <div className="card flex flex-col gap-3 p-5">
          <div className="flex gap-3">
            <BadgeCheck className="size-6 shrink-0 text-accent-600" aria-hidden />
            <p className="text-sm text-ink-soft">
              After you submit, our team verifies the tournament (usually within 24 hours). It
              becomes visible with a <span className="font-semibold text-ink">Verified</span> badge
              once approved. You can still edit it while it's pending.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button variant="outline" onClick={() => navigate('/my-tournaments')}>
              Save draft & exit
            </Button>
            <Button onClick={onSubmit} loading={submit.isPending} disabled={issues.length > 0}>
              Submit for verification
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => navigate(`/my-tournaments/${t.id}`)}>Done</Button>
        </div>
      )}
    </div>
  );
}
