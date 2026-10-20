import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertCircle,
  CalendarDays,
  Check,
  IndianRupee,
  MapPin,
  Pencil,
  Plus,
  Users,
} from 'lucide-react';
import type { TeamDTO } from '@playlocal/shared';
import { useTournament } from '@/hooks/useTournaments';
import { useMyTeams } from '@/hooks/useTeams';
import { useMyRegistrationsFor, useRegistrationMutations } from '@/hooks/useRegistrations';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox, Textarea } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
  errorMessage,
} from '@/components/ui/States';
import { AvailabilityBadge } from '@/components/tournament/Badges';
import { formatDateRange, formatMoney, deadlineLabel } from '@/utils/format';
import { cn } from '@/utils/cn';

function Steps({ step }: { step: 1 | 2 }) {
  const items = ['Select team', 'Review & submit'];
  return (
    <ol className="mb-6 flex items-center gap-3" aria-label="Registration steps">
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2"
            aria-current={current ? 'step' : undefined}
          >
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                done
                  ? 'bg-primary-700 text-white'
                  : current
                    ? 'bg-ink text-white'
                    : 'bg-slate-200 text-ink-soft',
              )}
            >
              {done ? <Check className="size-4" /> : n}
            </span>
            <span className={cn('text-sm font-semibold', current ? 'text-ink' : 'text-ink-soft')}>
              {label}
            </span>
            {n < items.length && <span className="h-px flex-1 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function TeamOption({
  team,
  selected,
  disabledReason,
  onSelect,
}: {
  team: TeamDTO;
  selected: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  const disabled = Boolean(disabledReason);
  return (
    <label
      className={cn(
        'card flex cursor-pointer items-center gap-4 p-4 transition-all',
        selected && 'ring-2 ring-primary-500',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name="team"
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <Avatar name={team.name} src={team.logo} size="lg" square />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{team.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
          <Users className="size-4" aria-hidden /> {team.playerCount}{' '}
          {team.playerCount === 1 ? 'player' : 'players'}
        </p>
        {disabledReason && (
          <p className="mt-1 text-xs font-medium text-amber-700">{disabledReason}</p>
        )}
      </div>
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full ring-2',
          selected ? 'bg-primary-700 ring-primary-700 text-white' : 'ring-line',
        )}
        aria-hidden
      >
        {selected && <Check className="size-4" />}
      </span>
    </label>
  );
}

export default function RegisterTeamPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bySlug } = useSports();
  const tournamentQ = useTournament(id);
  const t = tournamentQ.data;
  const teamsQ = useMyTeams(t?.sport, { enabled: Boolean(t) });
  const existingQ = useMyRegistrationsFor(id);
  const { register } = useRegistrationMutations();
  useDocumentTitle(t ? `Register · ${t.name}` : 'Register team');

  const step: 1 | 2 = params.get('step') === 'review' ? 2 : 1;
  const selectedId = params.get('team');
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  const [ackError, setAckError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeTeamIds = useMemo(
    () =>
      new Set(
        (existingQ.data ?? [])
          .filter((r) => ['pending', 'confirmed', 'waitlisted'].includes(r.status))
          .map((r) => r.teamId),
      ),
    [existingQ.data],
  );

  if (tournamentQ.isLoading) return <LoadingState />;
  if (tournamentQ.isError || !t)
    return (
      <div className="container-page py-10">
        <ErrorState error={tournamentQ.error} onRetry={() => void tournamentQ.refetch()} />
      </div>
    );
  if (user?.id === t.organizerId) return <Navigate to={`/my-tournaments/${t.id}`} replace />;

  const canRegister = t.availability === 'open' || t.availability === 'waitlist';
  const selfHref = `/tournaments/${t.id}/register`;
  const teams = teamsQ.data ?? [];
  const selected = teams.find((x) => x.id === selectedId);
  const reasonFor = (team: TeamDTO) =>
    activeTeamIds.has(team.id)
      ? 'Already registered for this tournament'
      : team.playerCount === 0
        ? 'Add at least one player first'
        : undefined;

  const goReview = () => setParams({ step: 'review', team: selectedId! });

  async function submit() {
    if (!ack) return setAckError(true);
    setSubmitError(null);
    try {
      const reg = await register.mutateAsync({
        tournamentId: t!.id,
        body: { teamId: selected!.id, note: note.trim() || undefined },
      });
      navigate(`/tournaments/${t!.id}/register/success`, {
        replace: true,
        state: { registration: reg, tournamentName: t!.name },
      });
    } catch (e) {
      setSubmitError(errorMessage(e));
    }
  }

  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <PageHeader
        title="Register your team"
        back={step === 2 ? undefined : `/tournaments/${t.id}`}
      />

      {/* Tournament summary */}
      <div className="card mb-6 flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/tournaments/${t.id}`} className="font-semibold hover:underline">
            {t.name}
          </Link>
          <AvailabilityBadge availability={t.availability} short />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />{' '}
            {formatDateRange(t.startDate, t.endDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden /> {t.venue.city}
          </span>
          <span className="flex items-center gap-1.5">
            <IndianRupee className="size-4" aria-hidden /> Entry {formatMoney(t.entryFee)}
          </span>
        </div>
        {canRegister && (
          <p className="text-xs font-medium text-amber-700">
            {deadlineLabel(t.registrationDeadline)}
          </p>
        )}
      </div>

      {!canRegister ? (
        <div className="card">
          <EmptyState
            icon={<AlertCircle className="size-7" />}
            title={t.availability === 'full' ? 'Registration is full' : 'Registration is closed.'}
            description="This tournament is not accepting registrations right now."
            action={<ButtonLink to="/explore">Find other tournaments</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <Steps step={step} />
          {t.availability === 'waitlist' && (
            <InlineAlert
              tone="blue"
              className="mb-5"
              title="All spots are taken — you'll join the waitlist"
            >
              If a team withdraws, the next team on the waitlist moves up automatically and you'll
              be notified.
            </InlineAlert>
          )}

          {step === 1 && (
            <section aria-labelledby="pick-h">
              <h2 id="pick-h" className="mb-3 font-semibold">
                Choose a {sportLabel(bySlug, t.sport).toLowerCase()} team
              </h2>
              {teamsQ.isLoading ? (
                <LoadingState label="Loading your teams…" />
              ) : teamsQ.isError ? (
                <ErrorState error={teamsQ.error} onRetry={() => void teamsQ.refetch()} />
              ) : teams.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<Users className="size-7" />}
                    title={`You don't have a ${sportLabel(bySlug, t.sport).toLowerCase()} team yet`}
                    description="Create one now — you'll come straight back here."
                    action={
                      <ButtonLink
                        to={`/teams/new?sport=${t.sport}&next=${encodeURIComponent(selfHref)}`}
                        leftIcon={<Plus className="size-4" />}
                      >
                        Create a team
                      </ButtonLink>
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3" role="radiogroup" aria-labelledby="pick-h">
                  {teams.map((team) => (
                    <TeamOption
                      key={team.id}
                      team={team}
                      selected={team.id === selectedId}
                      disabledReason={reasonFor(team)}
                      onSelect={() => setParams({ team: team.id }, { replace: true })}
                    />
                  ))}
                  <Link
                    to={`/teams/new?sport=${t.sport}&next=${encodeURIComponent(selfHref)}`}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-ink-soft hover:border-primary-400 hover:text-primary-700"
                  >
                    <Plus className="size-4" /> Create another team
                  </Link>
                </div>
              )}
              <div className="sticky bottom-20 mt-6 md:bottom-4">
                <Button
                  size="lg"
                  fullWidth
                  disabled={!selected || Boolean(selected && reasonFor(selected))}
                  onClick={goReview}
                >
                  Continue
                </Button>
              </div>
            </section>
          )}

          {step === 2 && selected && (
            <section aria-labelledby="review-h" className="flex flex-col gap-5">
              <h2 id="review-h" className="sr-only">
                Review registration
              </h2>
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line p-4">
                  <Avatar name={selected.name} src={selected.logo} size="md" square />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{selected.name}</p>
                    <p className="text-sm text-ink-soft">
                      {selected.playerCount} {selected.playerCount === 1 ? 'player' : 'players'}
                    </p>
                  </div>
                  <ButtonLink
                    to={`/teams/${selected.id}?next=${encodeURIComponent(`${selfHref}?step=review&team=${selected.id}`)}`}
                    size="sm"
                    variant="ghost"
                    leftIcon={<Pencil className="size-4" />}
                  >
                    Edit players
                  </ButtonLink>
                </div>
                <ul className="grid gap-x-4 gap-y-1.5 p-4 text-sm sm:grid-cols-2">
                  {selected.players.map((p, i) => (
                    <li key={p.id} className="flex gap-2">
                      <span className="w-5 text-right text-ink-faint tabular">{i + 1}.</span>
                      <span className="truncate">
                        {p.name}
                        {p.role && <span className="text-ink-soft"> · {p.role}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Field label="Note to organiser" hint="Optional · e.g. preferred match timings">
                <Textarea
                  rows={3}
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>

              <div className="rounded-2xl bg-surface p-4 ring-1 ring-line/60">
                <Checkbox
                  label={`I understand the entry fee (${formatMoney(t.entryFee)}) is paid directly to the organiser, not through PlayLocal.`}
                  checked={ack}
                  onChange={(e) => {
                    setAck(e.target.checked);
                    setAckError(false);
                  }}
                />
                {ackError && (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                    Please confirm to continue
                  </p>
                )}
              </div>

              {submitError && <InlineAlert>{submitError}</InlineAlert>}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setParams({ team: selected.id })}
                  disabled={register.isPending}
                >
                  Back
                </Button>
                <Button size="lg" onClick={submit} loading={register.isPending}>
                  {t.availability === 'waitlist' ? 'Join waitlist' : 'Submit registration'}
                </Button>
              </div>
            </section>
          )}
          {step === 2 && !selected && !teamsQ.isLoading && <Navigate to={selfHref} replace />}
        </>
      )}
    </div>
  );
}
